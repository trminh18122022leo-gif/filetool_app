import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (_) {}

/**
 * useVirtualPdfThumbnails
 * High-performance virtualized PDF thumbnail generator for 1 to 300+ pages.
 * - Extracts total page count instantaneously via pdf-lib (<50ms).
 * - Lazy-renders page canvases on demand using windowed visible range.
 * - Manages object URL lifecycles to prevent memory leaks in Chrome/Edge/Safari.
 * - Detects password encryption and flags needsPassword.
 */
export function useVirtualPdfThumbnails(file, scale = 0.22) {
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [cachedThumbnails, setCachedThumbnails] = useState({});

  const pdfDocRef = useRef(null);
  const blobUrlsRef = useRef(new Set());
  const activeTaskRef = useRef(null);

  // Clean up all allocated Blob URLs on unmount or file change
  const cleanupBlobs = useCallback(() => {
    blobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    });
    blobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      cleanupBlobs();
    };
  }, [cleanupBlobs]);

  // Load Document Metadata & PDF.js instance
  useEffect(() => {
    if (!file) {
      setPageCount(0);
      setCachedThumbnails({});
      setLoading(false);
      setError(null);
      setNeedsPassword(false);
      cleanupBlobs();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsPassword(false);
    setCachedThumbnails({});
    cleanupBlobs();

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (cancelled) return;

        // Step 1: Instant page count & encryption check via PDF-Lib
        try {
          const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
          if (!cancelled) {
            setPageCount(doc.getPageCount());
          }
        } catch (pdfLibErr) {
          if (pdfLibErr.message?.toLowerCase().includes('encrypt')) {
            if (!cancelled) setNeedsPassword(true);
          }
        }

        // Step 2: Initialize PDF.js loading task with CMap support
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
          cMapPacked: true,
          disableFontFace: false,
        });

        loadingTask.onPassword = (updatePassword, reason) => {
          if (!cancelled) {
            setNeedsPassword(true);
            setLoading(false);
          }
        };

        activeTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setLoading(false);

        // Pre-render the first 3 pages immediately for instant initial perception
        const initialCount = Math.min(pdf.numPages, 3);
        for (let i = 1; i <= initialCount; i++) {
          renderPageThumbnail(pdf, i, scale);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[useVirtualPdfThumbnails] Load warning:', err);
        if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('password')) {
          setNeedsPassword(true);
        } else {
          setError('Không thể đọc file PDF. File có thể bị hỏng hoặc định dạng không chuẩn.');
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (activeTaskRef.current) {
        try {
          activeTaskRef.current.destroy();
        } catch (_) {}
      }
    };
  }, [file, scale, cleanupBlobs]);

  // Render an individual page thumbnail on demand
  const renderPageThumbnail = useCallback(async (pdf, pageNum, s) => {
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) return null;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: s });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });

      await page.render({ canvasContext: ctx, viewport }).promise;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          blobUrlsRef.current.add(blobUrl);

          setCachedThumbnails(prev => ({
            ...prev,
            [pageNum]: blobUrl,
          }));
          resolve(blobUrl);
        }, 'image/jpeg', 0.7);
      });
    } catch (err) {
      console.warn(`[useVirtualPdfThumbnails] Render failed page ${pageNum}:`, err);
      return null;
    }
  }, []);

  // Public method to request rendering for visible windowed pages (e.g. from Virtualized Rail)
  const ensurePagesRendered = useCallback((pageNumbers) => {
    const pdf = pdfDocRef.current;
    if (!pdf) return;
    pageNumbers.forEach(pageNum => {
      if (pageNum >= 1 && pageNum <= pdf.numPages && !cachedThumbnails[pageNum]) {
        renderPageThumbnail(pdf, pageNum, scale);
      }
    });
  }, [cachedThumbnails, renderPageThumbnail, scale]);

  return {
    pageCount,
    thumbnails: cachedThumbnails,
    ensurePagesRendered,
    loading,
    error,
    needsPassword,
  };
}
