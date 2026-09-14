import { useState, useEffect } from 'react';
import { usePdfThumbnails } from '../hooks/usePdfThumbnails';
import ResultDownload from '../components/ResultDownload';
import {
  DndContext, closestCenter,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axios from 'axios';
import {
  GripVertical, Upload, RotateCcw, Loader2, ArrowUpDown,
  FileText, Trash2, ArrowLeft, ArrowRight, RefreshCw, Check
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

function SortablePage({ id, pageNum, src, index, onMoveLeft, onMoveRight }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-gray-950/90 border rounded-2xl p-3 flex flex-col items-center justify-between transition-all duration-200 select-none shadow-lg ${
        isDragging ? 'border-red-500 shadow-red-900/50 scale-105' : 'border-white/10 hover:border-red-500/50'
      }`}
    >
      {/* Header bar: Index & Drag Handle */}
      <div className="w-full flex items-center justify-between mb-2">
        <span className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center text-xs font-bold font-mono">
          #{index + 1}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">Gốc: Trang {pageNum}</span>
        <button
          {...attributes}
          {...listeners}
          type="button"
          title="Kéo thả để sắp xếp"
          className="cursor-grab active:cursor-grabbing p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="relative w-full aspect-[3/4] bg-black/40 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center p-1">
        {src ? (
          <img
            src={src}
            alt={`Trang ${pageNum}`}
            className="w-full h-full object-contain rounded-lg pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-gray-500">
            <Loader2 size={16} className="animate-spin text-red-400" />
            <span className="text-[9px]">Đang tải...</span>
          </div>
        )}
      </div>

      {/* Quick Move Buttons */}
      <div className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMoveLeft(index)}
          disabled={index === 0}
          title="Dịch sang trái"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all cursor-pointer"
        >
          <ArrowLeft size={13} />
        </button>
        <span className="text-[10px] text-gray-400 font-bold">Trang {pageNum}</span>
        <button
          type="button"
          onClick={() => onMoveRight(index)}
          title="Dịch sang phải"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default function PdfOrganizeTool() {
  const [file, setFile] = useState(null);
  const [order, setOrder] = useState([]); // array of 1-based page numbers
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  const { thumbnails, pageCount, loading } = usePdfThumbnails(file, 0.3);

  // Initialize order whenever pageCount updates
  useEffect(() => {
    if (pageCount > 0) {
      setOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
    } else {
      setOrder([]);
    }
  }, [pageCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setOrder(prev => {
      const oldIdx = prev.indexOf(active.id);
      const newIdx = prev.indexOf(over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const moveLeft = (index) => {
    if (index <= 0) return;
    setOrder(prev => arrayMove(prev, index, index - 1));
  };

  const moveRight = (index) => {
    if (index >= order.length - 1) return;
    setOrder(prev => arrayMove(prev, index, index + 1));
  };

  const reset = () => setOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
  const reverse = () => setOrder(prev => [...prev].reverse());

  const handleSave = async () => {
    if (!file || !order.length) return;
    setStatus('processing');
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('order', order.join(','));

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const { data } = await axios.post(`${API}/api/pdf/reorder`, fd, {
        headers,
        withCredentials: true,
      });

      setStatus('done');
      setResult(data);
    } catch (err) {
      setStatus('error');
      setResult({ error: err.response?.data?.error || 'Lỗi sắp xếp trang PDF' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <ArrowUpDown size={13} /> Visual Organizer
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Sắp Xếp Lại Trang PDF Trực Quan
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Kéo thả các trang PDF theo ý muốn, đảo ngược thứ tự hoặc dịch chuyển linh hoạt trước khi xuất tệp.
        </p>
      </div>

      {/* Upload zone */}
      {!file ? (
        <div
          onClick={() => document.getElementById('org-file-input').click()}
          className="border-2 border-dashed border-gray-700 hover:border-red-500/60 rounded-3xl p-12 text-center cursor-pointer transition-all bg-gray-950/40 hover:bg-red-950/10 space-y-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Upload size={28} />
          </div>
          <div>
            <p className="text-base font-bold text-white">
              Kéo thả hoặc nhấp để chọn tệp PDF cần sắp xếp
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Hỗ trợ xem trước thumbnail toàn bộ các trang chất lượng cao
            </p>
          </div>
          <input
            id="org-file-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setResult(null);
                setStatus(null);
              }
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* File toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-950/80 border border-gray-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-mono text-xs font-bold">
                PDF
              </div>
              <div>
                <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-gray-400">{pageCount} trang</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reverse}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                <ArrowUpDown size={13} />
                <span>Đảo ngược</span>
              </button>

              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Đặt lại</span>
              </button>

              <button
                type="button"
                onClick={() => { setFile(null); setOrder([]); setResult(null); setStatus(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 rounded-xl text-xs font-semibold transition-all border border-red-800/40 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Đổi file</span>
              </button>
            </div>
          </div>

          {/* DnD grid */}
          {loading && !thumbnails.length ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
              <Loader2 size={24} className="animate-spin text-red-500" />
              <span className="text-sm">Đang tải thumbnail các trang PDF...</span>
            </div>
          ) : (
            order.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={order} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {order.map((pageNum, index) => {
                      const thumb = thumbnails[pageNum - 1];
                      return (
                        <SortablePage
                          key={pageNum}
                          id={pageNum}
                          pageNum={pageNum}
                          src={thumb}
                          index={index}
                          onMoveLeft={moveLeft}
                          onMoveRight={moveRight}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )
          )}

          {/* Save button & error */}
          {order.length > 0 && (
            <div className="space-y-4 pt-2">
              {result?.error && (
                <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 rounded-xl p-3">
                  {result.error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={status === 'processing'}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xuất file PDF mới...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Lưu & Tải Xuống PDF Theo Thứ Tự Mới</span>
                  </>
                )}
              </button>

              {result && status === 'done' && (
                <ResultDownload
                  result={result}
                  onReset={() => { setFile(null); setOrder([]); setResult(null); setStatus(null); }}
                  label="Tải xuống PDF đã sắp xếp"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
