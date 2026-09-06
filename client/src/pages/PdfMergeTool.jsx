import { useState, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import ResultDownload from '../components/ResultDownload';
import axios from 'axios';
import {
  GripVertical, Trash2, RotateCw, ArrowLeft, ArrowRight,
  Merge, Loader2, Upload, Plus, CheckCircle2, AlertCircle, ArrowUpDown
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (_) {}

const API = import.meta.env.VITE_API_URL || '';

// Single sortable page card
function SortablePageCard({
  page,
  index,
  total,
  onMoveLeft,
  onMoveRight,
  onRotate,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-gray-900/90 border ${
        isDragging ? 'border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]' : 'border-white/10 hover:border-pink-500/50'
      } rounded-2xl p-3 flex flex-col items-center justify-between transition-all duration-200 select-none shadow-lg`}
    >
      {/* Top bar: Sequence number & Drag handle */}
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-xs font-bold font-mono">
            {index + 1}
          </span>
          <span className="text-[10px] text-gray-400 font-medium truncate max-w-[90px]" title={page.fileName}>
            F{page.fileIndex + 1}: p.{page.pageNum}
          </span>
        </div>

        <button
          {...attributes}
          {...listeners}
          type="button"
          title="Kéo để đổi vị trí"
          className="cursor-grab active:cursor-grabbing p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Page preview thumbnail with rotation */}
      <div className="relative w-full aspect-[3/4] bg-black/40 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center p-1">
        {page.thumbnail ? (
          <img
            src={page.thumbnail}
            alt={`Trang ${page.pageNum}`}
            style={{
              transform: `rotate(${page.rotation || 0}deg)`,
              transition: 'transform 0.3s ease',
            }}
            className="w-full h-full object-contain rounded-lg shadow-md pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 text-xs gap-1">
            <Loader2 size={18} className="animate-spin text-pink-400" />
            <span className="text-[10px]">Đang tải...</span>
          </div>
        )}

        {/* Rotation indicator badge if rotated */}
        {(page.rotation % 360) !== 0 && (
          <span className="absolute top-1 right-1 bg-purple-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
            {page.rotation % 360}°
          </span>
        )}
      </div>

      {/* File name subtitle */}
      <div className="w-full mt-2 text-center">
        <p className="text-[11px] font-medium text-gray-300 truncate" title={page.fileName}>
          {page.fileName}
        </p>
      </div>

      {/* Quick Action Buttons */}
      <div className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onMoveLeft(index)}
          disabled={index === 0}
          title="Di chuyển sang trái"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
        >
          <ArrowLeft size={13} />
        </button>

        <button
          type="button"
          onClick={() => onRotate(page.id)}
          title="Xoay 90° cùng chiều kim đồng hồ"
          className="p-1 rounded-lg text-gray-400 hover:text-purple-400 hover:bg-purple-950/40 transition-all"
        >
          <RotateCw size={13} />
        </button>

        <button
          type="button"
          onClick={() => onDelete(page.id)}
          title="Xóa trang này"
          className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-all"
        >
          <Trash2 size={13} />
        </button>

        <button
          type="button"
          onClick={() => onMoveRight(index)}
          disabled={index === total - 1}
          title="Di chuyển sang phải"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
        >
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default function PdfMergeTool() {
  const [sourceFiles, setSourceFiles] = useState([]);
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const processFiles = useCallback(async (newFiles) => {
    const validPdfFiles = Array.from(newFiles).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (validPdfFiles.length === 0) return;

    setLoadingPages(true);
    setResult(null);

    const currentFiles = [...sourceFiles];
    const startIndex = currentFiles.length;
    const combinedFiles = [...currentFiles, ...validPdfFiles];
    setSourceFiles(combinedFiles);

    for (let fIdx = 0; fIdx < validPdfFiles.length; fIdx++) {
      const file = validPdfFiles[fIdx];
      const actualFileIndex = startIndex + fIdx;

      try {
        const arrayBuffer = await file.arrayBuffer();

        let count = 0;
        try {
          const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
          count = doc.getPageCount();
        } catch (_) {
          count = 1;
        }

        const filePages = [];
        for (let p = 1; p <= count; p++) {
          filePages.push({
            id: uuidv4(),
            fileIndex: actualFileIndex,
            fileName: file.name,
            pageNum: p,
            rotation: 0,
            thumbnail: null,
          });
        }

        setPages(prev => [...prev, ...filePages]);

        try {
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
            cMapPacked: true,
          });
          const pdf = await loadingTask.promise;

          for (let p = 1; p <= pdf.numPages; p++) {
            try {
              const pdfPage = await pdf.getPage(p);
              const viewport = pdfPage.getViewport({ scale: 0.25 });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d');
              await pdfPage.render({ canvasContext: ctx, viewport }).promise;
              const thumbUrl = canvas.toDataURL('image/jpeg', 0.75);

              setPages(prev =>
                prev.map(item =>
                  item.fileIndex === actualFileIndex && item.pageNum === p
                    ? { ...item, thumbnail: thumbUrl }
                    : item
                )
              );
            } catch (pErr) {
              console.warn(`Render error page ${p}:`, pErr);
            }
          }
        } catch (pdfJsErr) {
          console.warn('PDF.js render warning:', pdfJsErr);
        }
      } catch (err) {
        console.error('File process error:', err);
      }
    }

    setLoadingPages(false);
  }, [sourceFiles]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setPages(prev => {
      const oldIndex = prev.findIndex(item => item.id === active.id);
      const newIndex = prev.findIndex(item => item.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleMoveLeft = (index) => {
    if (index <= 0) return;
    setPages(prev => arrayMove(prev, index, index - 1));
  };

  const handleMoveRight = (index) => {
    if (index >= pages.length - 1) return;
    setPages(prev => arrayMove(prev, index, index + 1));
  };

  const handleRotate = (id) => {
    setPages(prev =>
      prev.map(p => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleDelete = (id) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleRotateAll = () => {
    setPages(prev => prev.map(p => ({ ...p, rotation: (p.rotation + 90) % 360 })));
  };

  const handleReverseAll = () => {
    setPages(prev => [...prev].reverse());
  };

  const handleClearAll = () => {
    setSourceFiles([]);
    setPages([]);
    setResult(null);
    setStatus(null);
  };

  const handleMerge = async () => {
    if (pages.length === 0) return;
    setStatus('processing');
    setResult(null);

    try {
      const fd = new FormData();
      sourceFiles.forEach(file => {
        fd.append('files', file);
      });

      const pageOrder = pages.map(p => ({
        fileIndex: p.fileIndex,
        pageNum: p.pageNum,
        rotation: p.rotation || 0,
      }));

      fd.append('pageOrder', JSON.stringify(pageOrder));

      const { data } = await axios.post(`${API}/api/pdf/merge`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });

      setStatus('done');
      setResult(data);
    } catch (err) {
      setStatus('error');
      setResult({
        error: err.response?.data?.error || err.message || 'Lỗi trong quá trình gộp PDF',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
            <Merge size={30} className="text-pink-500" /> Gộp PDF Visual Studio
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Xem rõ từng trang của mọi file · Tự do kéo thả, xoay góc, đổi vị trí từng trang trước khi xuất file
          </p>
        </div>

        {pages.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all"
            >
              <Plus size={15} className="text-pink-400" /> Thêm file PDF
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded-xl text-xs font-semibold border border-red-800/30 transition-all"
            >
              <Trash2 size={14} /> Xóa tất cả
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Upload Dropzone */}
      {pages.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-panel p-12 text-center cursor-pointer transition-all border-2 border-dashed ${
            dragOver
              ? 'border-pink-500 bg-pink-950/20 scale-[0.99]'
              : 'border-white/10 hover:border-pink-500/50 hover:bg-white/5'
          } rounded-3xl space-y-4`}
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto text-pink-400">
            <Upload size={32} />
          </div>
          <div>
            <p className="text-white text-lg font-bold">Kéo & thả các file PDF vào đây</p>
            <p className="text-gray-400 text-sm mt-1">hoặc bấm vào để duyệt file từ máy tính</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 text-[11px] text-gray-400">
            <CheckCircle2 size={13} className="text-emerald-400" /> Tự động phân tách từng trang và trích xuất ảnh xem trước tức thì
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-lg text-xs font-bold">
                {pages.length} trang
              </span>
              <span className="text-gray-400 text-xs font-medium">
                từ {sourceFiles.length} tài liệu PDF
              </span>
              {loadingPages && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <Loader2 size={13} className="animate-spin" /> Đang trích xuất ảnh xem trước...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRotateAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-white/5 transition-all"
              >
                <RotateCw size={13} /> Xoay tất cả 90°
              </button>
              <button
                type="button"
                onClick={handleReverseAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-white/5 transition-all"
              >
                <ArrowUpDown size={13} /> Đảo ngược thứ tự
              </button>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map(p => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 p-4 glass-card rounded-2xl min-h-[220px]">
                {pages.map((page, idx) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    index={idx}
                    total={pages.length}
                    onMoveLeft={handleMoveLeft}
                    onMoveRight={handleMoveRight}
                    onRotate={handleRotate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Error display */}
      {result?.error && (
        <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-red-400" />
          <span>{result.error}</span>
        </div>
      )}

      {/* Success Result Download */}
      {result && status === 'done' && (
        <div className="glass-panel p-6 rounded-2xl">
          <ResultDownload
            result={result}
            onReset={handleClearAll}
            label={`Tải xuống file PDF đã gộp (${pages.length} trang)`}
          />
        </div>
      )}

      {/* Action Button */}
      {pages.length > 0 && (
        <button
          onClick={handleMerge}
          disabled={status === 'processing' || pages.length === 0}
          className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 disabled:opacity-40
                     rounded-2xl py-4 font-bold text-white shadow-[0_0_25px_rgba(236,72,153,0.35)] flex items-center justify-center gap-2.5 transition-all text-sm uppercase tracking-wider"
        >
          {status === 'processing' ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Đang gộp {pages.length} trang...
            </>
          ) : (
            <>
              <Merge size={20} /> Xuất file PDF đã gộp ({pages.length} trang)
            </>
          )}
        </button>
      )}
    </div>
  );
}
