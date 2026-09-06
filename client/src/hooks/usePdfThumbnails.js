import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (_) {}

export function usePdfThumbnails(file, scale = 0.22) {
  const [thumbnails, setThumbnails] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) {
      setThumbnails([]);
      setPageCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setThumbnails([]);
    setError(null);

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();

        // Step 1: Extract page count with PDF-Lib (100% reliable, zero worker dependency)
        try {
          const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
          if (!cancelled) {
            setPageCount(doc.getPageCount());
          }
        } catch (pdfLibErr) {
          console.warn('pdf-lib count warn:', pdfLibErr.message);
        }

        // Step 2: Render thumbnails with PDF.js
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        const results = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            results.push(canvas.toDataURL('image/jpeg', 0.7));
            if (!cancelled) setThumbnails([...results]);
          } catch (renderErr) {
            console.warn(`Page ${i} render failed:`, renderErr);
          }
        }
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error('PDF Read Error:', err);
        if (!cancelled) {
          setLoading(false);
          // Only show error if pageCount couldn't even be determined
          setPageCount(prev => {
            if (prev === 0) {
              setError('Không thể đọc file PDF. Vui lòng kiểm tra lại file.');
            }
            return prev;
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [file, scale]);

  return { thumbnails, pageCount, loading, error };
}
