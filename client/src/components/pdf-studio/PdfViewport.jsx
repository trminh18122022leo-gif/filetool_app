import { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCw, ChevronLeft, ChevronRight,
  ShieldAlert, Sparkles, Check, Move
} from 'lucide-react';

export default function PdfViewport({
  file,
  activePage,
  pageIndex,
  totalPages,
  rotation = 0,
  redactions = [],
  onAddRedaction,
  isRedactMode = false,
  onPrevPage,
  onNextPage,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [scale, setScale] = useState(1.15);
  const [rendering, setRendering] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);

  // Redaction Drag-to-select state
  const [drawingRect, setDrawingRect] = useState(null);
  const dragStartRef = useRef(null);

  // Initialize PDF.js Document
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (cancelled) return;
        const task = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
          cMapPacked: true,
        });
        const doc = await task.promise;
        if (!cancelled) setPdfDoc(doc);
      } catch (err) {
        console.warn('[PdfViewport] Document init error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [file]);

  // Render the active page
  useEffect(() => {
    if (!pdfDoc || !activePage || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);

    (async () => {
      try {
        const page = await pdfDoc.getPage(activePage.originalPageNum);
        if (cancelled) return;

        // Apply page rotation + user rotation
        const totalRot = (page.rotate + (activePage.rotation || 0)) % 360;
        const viewport = page.getViewport({ scale, rotation: totalRot });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendering(false);
      } catch (err) {
        console.warn('[PdfViewport] Page render failed:', err);
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, activePage, scale, rotation]);

  // Handle Dragging Redaction Rectangle on Canvas
  const handleMouseDown = (e) => {
    if (!isRedactMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    dragStartRef.current = { startX, startY };
    setDrawingRect({ x: startX, y: startY, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!dragStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const startX = dragStartRef.current.startX;
    const startY = dragStartRef.current.startY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    setDrawingRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!dragStartRef.current || !drawingRect) return;
    if (drawingRect.width > 15 && drawingRect.height > 10 && onAddRedaction && canvasRef.current) {
      // Normalize to canvas percentage
      const cW = canvasRef.current.width;
      const cH = canvasRef.current.height;
      onAddRedaction({
        pageNum: activePage?.originalPageNum || 1,
        x: Math.round((drawingRect.x / cW) * 595),
        y: Math.round((drawingRect.y / cH) * 842),
        width: Math.round((drawingRect.width / cW) * 595),
        height: Math.round((drawingRect.height / cH) * 842),
        label: 'Vùng khoanh thủ công',
      });
    }
    dragStartRef.current = null;
    setDrawingRect(null);
  };

  // Zoom controls
  const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)));
  const zoomOut = () => setScale(s => Math.max(0.6, +(s - 0.15).toFixed(2)));
  const zoomReset = () => setScale(1.15);

  const activePageRedactions = redactions.filter(
    r => r.pageNum === (activePage?.originalPageNum || 1)
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full overflow-hidden select-none relative"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Viewport Top Toolbar: Zoom & Page Stepper */}
      <div
        className="h-11 px-4 border-b flex items-center justify-between shrink-0 text-xs backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Page Navigation Stepper */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={pageIndex <= 0}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-gray-300 cursor-pointer"
            aria-label="Trang trước"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-mono text-xs font-semibold px-2 text-gray-300">
            Trang <span className="text-cyan-400">{pageIndex + 1}</span> / {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={pageIndex >= totalPages - 1}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-gray-300 cursor-pointer"
            aria-label="Trang kế tiếp"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-300 cursor-pointer"
            title="Thu nhỏ"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={zoomReset}
            className="px-2 py-0.5 rounded-md text-[11px] font-mono text-gray-400 hover:text-white"
            title="Đặt lại tỉ lệ phóng"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-300 cursor-pointer"
            title="Phóng to"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      {/* Main Document View Canvas Container */}
      <div
        className="flex-1 overflow-auto p-6 flex items-center justify-center relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="relative shadow-2xl rounded-sm transition-all duration-150 border border-black/20 dark:border-white/10"
          style={{
            cursor: isRedactMode ? 'crosshair' : 'default',
          }}
          onMouseDown={handleMouseDown}
        >
          <canvas ref={canvasRef} className="block max-w-none" />

          {/* Active Redaction Visual Highlights */}
          {activePageRedactions.map((redact, i) => (
            <div
              key={i}
              className="absolute bg-red-600/40 border-2 border-red-500 rounded-sm pointer-events-none flex items-center justify-center text-[10px] text-white font-bold tracking-tight shadow-md"
              style={{
                left: `${(redact.x / 595) * 100}%`,
                top: `${(redact.y / 842) * 100}%`,
                width: `${(redact.width / 595) * 100}%`,
                height: `${(redact.height / 842) * 100}%`,
              }}
            >
              <span className="bg-red-800/90 px-1 py-0.5 rounded text-[9px] truncate max-w-full">
                {redact.label || 'Che PII'}
              </span>
            </div>
          ))}

          {/* Real-time Dragging Box */}
          {drawingRect && (
            <div
              className="absolute border-2 border-dashed border-red-400 bg-red-500/20 pointer-events-none"
              style={{
                left: drawingRect.x,
                top: drawingRect.y,
                width: drawingRect.width,
                height: drawingRect.height,
              }}
            />
          )}

          {rendering && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-lg bg-black/70 text-cyan-400 text-xs font-mono font-medium animate-pulse shadow-lg">
                Đang vẽ trang...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
