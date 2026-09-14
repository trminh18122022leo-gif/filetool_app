import { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus2, Scissors, PenTool, Trash2, Hash, AlignCenter, BarChart3,
  Minimize2, FileOutput, RotateCw, Stamp, Lock, Unlock, Moon, BookOpen,
  FileCode2, ScanLine, Scale, Globe, ArrowUpDown, Crop, FileSpreadsheet,
  Presentation, ImagePlus, Layers, Archive, Wrench, RefreshCw, CheckCircle2,
  Download, AlertCircle, Sparkles, Sliders, Image as ImageIcon, Eye
} from 'lucide-react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';

const API = import.meta.env.VITE_API_URL || '';

const TABS = [
  // ── Nhóm Công Cụ Trực Quan Chuyên Dụng (Special Visual Tools) ──
  { id: 'merge',         label: 'Gộp PDF',             icon: FilePlus2,        special: true },
  { id: 'split',         label: 'Tách PDF',            icon: Scissors,         special: true },
  { id: 'sign',          label: 'Ký PDF',              icon: PenTool,          special: true },
  { id: 'delete',        label: 'Xóa trang',           icon: Trash2,           special: true },
  { id: 'reorder',       label: 'Sắp xếp trang',       icon: ArrowUpDown,      special: true },

  // ── Nhóm Chuyển Đổi Nâng Cao (Advanced Conversions) ──
  { id: 'to-markdown',   label: 'PDF → Markdown',      icon: FileCode2,        multiple: false, accept: '.pdf' },
  { id: 'to-excel',      label: 'PDF → Excel',         icon: FileSpreadsheet,  multiple: false, accept: '.pdf' },
  { id: 'to-pptx',       label: 'PDF → PowerPoint',    icon: Presentation,     multiple: false, accept: '.pdf' },
  { id: 'to-word',       label: 'PDF → Word',          icon: FileOutput,       multiple: false, accept: '.pdf' },
  { id: 'from-word',     label: 'Word → PDF',          icon: FileOutput,       multiple: false, accept: '.docx,.doc' },
  { id: 'scan-to-pdf',   label: 'Scan Ảnh → PDF',      icon: ScanLine,         multiple: true,  accept: 'image/*' },
  { id: 'html-to-pdf',   label: 'HTML → PDF',          icon: Globe,            multiple: false, accept: '.html,.htm' },

  // ── Nhóm Chỉnh Sửa & Ghép Trang (Edit & Assemble) ──
  { id: 'crop',          label: 'Cắt PDF (Crop)',      icon: Crop,             multiple: false, accept: '.pdf' },
  { id: 'add-image',     label: 'Chèn ảnh vào PDF',    icon: ImagePlus,        multiple: false, accept: '.pdf' },
  { id: 'insert-pages',  label: 'Chèn thêm trang',     icon: FilePlus2,        multiple: false, accept: '.pdf' },
  { id: 'compare-text',  label: 'So sánh PDF',         icon: Scale,            multiple: true,  accept: '.pdf' },

  // ── Nhóm Bảo Quản & Tối Ưu (Standard & Archival) ──
  { id: 'flatten',       label: 'Flatten PDF',         icon: Layers,           multiple: false, accept: '.pdf' },
  { id: 'to-pdfa',       label: 'Chuẩn PDF/A',         icon: Archive,          multiple: false, accept: '.pdf' },
  { id: 'repair',        label: 'Sửa lỗi PDF',         icon: Wrench,           multiple: false, accept: '.pdf' },
  { id: 'compress',      label: 'Nén PDF',             icon: Minimize2,        multiple: false, accept: '.pdf' },

  // ── Nhóm Đánh Số, Định Dạng & Bảo Mật ──
  { id: 'page-numbers',  label: 'Số trang',            icon: Hash,             multiple: false, accept: '.pdf' },
  { id: 'header-footer', label: 'Header/Footer',       icon: AlignCenter,      multiple: false, accept: '.pdf' },
  { id: 'rotate',        label: 'Xoay PDF',            icon: RotateCw,         multiple: false, accept: '.pdf' },
  { id: 'watermark',     label: 'Watermark',           icon: Stamp,            multiple: false, accept: '.pdf' },
  { id: 'protect',       label: 'Đặt mật khẩu',        icon: Lock,             multiple: false, accept: '.pdf' },
  { id: 'unlock',        label: 'Gỡ mật khẩu',         icon: Unlock,           multiple: false, accept: '.pdf' },
  { id: 'dark',          label: 'Dark Mode',           icon: Moon,             multiple: false, accept: '.pdf' },
  { id: 'toc',           label: 'Tạo Mục Lục',         icon: BookOpen,         multiple: false, accept: '.pdf' },
  { id: 'stats',         label: 'Thống kê',            icon: BarChart3,        multiple: false, accept: '.pdf' },
];

export default function PdfTools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('compress');
  const [files, setFiles]         = useState(null);
  const [secondaryFile, setSecondaryFile] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  // Form options
  const [compressQuality, setCompressQuality] = useState('ebook');
  const [rotateAngle, setRotateAngle]         = useState(90);
  const [watermarkText, setWatermarkText]     = useState('CONFIDENTIAL');
  const [userPassword, setUserPassword]       = useState('');
  const [unlockPassword, setUnlockPassword]   = useState('');
  const [darkModeBg, setDarkModeBg]           = useState('dark');
  const [tocTitle, setTocTitle]               = useState('MỤC LỤC');
  const [tocAI, setTocAI]                     = useState(false);
  const [pagePosition, setPagePosition]       = useState('bottom-center');
  const [pageStartFrom, setPageStartFrom]     = useState(1);
  const [pageFormat, setPageFormat]           = useState('{n}');
  const [headerText, setHeaderText]           = useState('');
  const [footerText, setFooterText]           = useState('');

  // New Advanced Options
  const [scanMode, setScanMode]               = useState('auto');
  const [scanSearchable, setScanSearchable]   = useState(true);
  const [scanPaperSize, setScanPaperSize]     = useState('A4');
  const [cropBox, setCropBox]                 = useState({ x: 0, y: 0, width: 450, height: 650, pages: 'all' });
  const [pptxDpi, setPptxDpi]                 = useState(150);
  const [pdfaLevel, setPdfaLevel]             = useState('2b');
  const [insertAfterPage, setInsertAfterPage] = useState(1);
  const [imgEmbed, setImgEmbed]               = useState({ page: 0, x: 50, y: 50, width: 200, height: 150, opacity: 1 });
  const [compareFormat, setCompareFormat]     = useState('pdf');

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFiles(null);
    setSecondaryFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    if (id === 'merge') return navigate('/pdf/merge');
    if (id === 'split') return navigate('/pdf/split');
    if (id === 'sign') return navigate('/signature');
    if (id === 'delete') return navigate('/pdf/delete');
    if (id === 'reorder') return navigate('/pdf/organize');
    setActiveTab(id);
    reset();
  };

  const handleSubmit = async () => {
    if (!files) return;
    setLoading(true);
    setError(null);
    setProgress(25);

    const fd = new FormData();
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let endpoint = '';

    if (activeTab === 'compress') {
      endpoint = '/api/pdf/compress';
      fd.append('file', files);
      fd.append('quality', compressQuality);
    } else if (activeTab === 'page-numbers') {
      endpoint = '/api/pdf/page-numbers';
      fd.append('file', files);
      fd.append('position', pagePosition);
      fd.append('startFrom', pageStartFrom);
      fd.append('format', pageFormat);
    } else if (activeTab === 'header-footer') {
      endpoint = '/api/pdf/header-footer';
      fd.append('file', files);
      fd.append('headerText', headerText);
      fd.append('footerText', footerText);
    } else if (activeTab === 'stats') {
      endpoint = '/api/pdf/stats';
      fd.append('file', files);
    } else if (activeTab === 'to-word') {
      endpoint = '/api/pdf/to-word';
      fd.append('file', files);
    } else if (activeTab === 'from-word') {
      endpoint = '/api/pdf/from-word';
      fd.append('file', files);
    } else if (activeTab === 'rotate') {
      endpoint = '/api/pdf/rotate';
      fd.append('file', files);
      fd.append('angle', rotateAngle);
    } else if (activeTab === 'watermark') {
      endpoint = '/api/pdf/watermark';
      fd.append('file', files);
      fd.append('text', watermarkText);
    } else if (activeTab === 'protect') {
      endpoint = '/api/pdf/protect';
      fd.append('file', files);
      fd.append('userPassword', userPassword);
    } else if (activeTab === 'unlock') {
      endpoint = '/api/pdf/unlock';
      fd.append('file', files);
      fd.append('password', unlockPassword);
    } else if (activeTab === 'dark') {
      endpoint = '/api/pdf/dark-mode';
      fd.append('file', files);
      fd.append('bg', darkModeBg);
    } else if (activeTab === 'toc') {
      endpoint = '/api/pdf/auto-toc';
      fd.append('file', files);
      fd.append('title', tocTitle);
      fd.append('useAI', tocAI);
    }
    // ── New Features ──
    else if (activeTab === 'to-markdown') {
      endpoint = '/api/pdf/to-markdown';
      fd.append('file', files);
      fd.append('language', 'vi');
    } else if (activeTab === 'scan-to-pdf') {
      endpoint = '/api/pdf/scan-to-pdf';
      const fileList = Array.isArray(files) ? files : [files];
      fileList.forEach(f => fd.append('files', f));
      fd.append('mode', scanMode);
      fd.append('searchable', scanSearchable ? 'true' : 'false');
      fd.append('paperSize', scanPaperSize);
    } else if (activeTab === 'compare-text') {
      endpoint = '/api/pdf/compare-text';
      const fileList = Array.isArray(files) ? files : [files];
      if (fileList.length < 2) {
        setLoading(false);
        return setError('Vui lòng chọn đủ 2 file PDF để so sánh');
      }
      fileList.slice(0, 2).forEach(f => fd.append('files', f));
      fd.append('outputFormat', compareFormat);
    } else if (activeTab === 'html-to-pdf') {
      endpoint = '/api/pdf/html-to-pdf';
      fd.append('file', files);
      fd.append('format', 'A4');
    } else if (activeTab === 'crop') {
      endpoint = '/api/pdf/crop';
      fd.append('file', files);
      fd.append('x', cropBox.x);
      fd.append('y', cropBox.y);
      fd.append('width', cropBox.width);
      fd.append('height', cropBox.height);
      fd.append('pages', cropBox.pages);
    } else if (activeTab === 'to-excel') {
      endpoint = '/api/pdf/to-excel';
      fd.append('file', files);
      fd.append('language', 'vi');
    } else if (activeTab === 'to-pptx') {
      endpoint = '/api/pdf/to-pptx';
      fd.append('file', files);
      fd.append('dpi', pptxDpi);
    } else if (activeTab === 'add-image') {
      endpoint = '/api/pdf/add-image';
      if (!secondaryFile) {
        setLoading(false);
        return setError('Vui lòng tải lên ảnh cần chèn vào tài liệu');
      }
      fd.append('file', files);
      fd.append('image', secondaryFile);
      fd.append('page', imgEmbed.page);
      fd.append('x', imgEmbed.x);
      fd.append('y', imgEmbed.y);
      fd.append('width', imgEmbed.width);
      fd.append('height', imgEmbed.height);
      fd.append('opacity', imgEmbed.opacity);
    } else if (activeTab === 'insert-pages') {
      endpoint = '/api/pdf/insert-pages';
      if (!secondaryFile) {
        setLoading(false);
        return setError('Vui lòng tải lên file PDF cần chèn thêm');
      }
      fd.append('base', files);
      fd.append('insert', secondaryFile);
      fd.append('afterPage', insertAfterPage);
    } else if (activeTab === 'flatten') {
      endpoint = '/api/pdf/flatten';
      fd.append('file', files);
    } else if (activeTab === 'to-pdfa') {
      endpoint = '/api/pdf/to-pdfa';
      fd.append('file', files);
      fd.append('level', pdfaLevel);
    } else if (activeTab === 'repair') {
      endpoint = '/api/pdf/repair';
      fd.append('file', files);
    }

    try {
      setProgress(60);
      const { data } = await axios.post(`${API}${endpoint}`, fd, {
        headers,
        withCredentials: true,
      });
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Có lỗi xảy ra trong quá trình xử lý');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient">PDF Studio Pro</h1>
        <p className="text-sm text-gray-400 mt-1">
          Bộ công cụ xử lý PDF toàn diện: Chuyển đổi Word/Excel/PPT/Markdown, Scan ảnh, So sánh, Cắt ghép, Đóng dấu và Bảo mật.
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-950/80 border border-gray-800 rounded-2xl shadow-xl backdrop-blur-md">
        {TABS.map(({ id, label, icon: Icon, special }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-950/50'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${special ? 'border border-pink-500/30' : ''}`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-pink-400'} />
              <span>{label}</span>
              {special && <span className="text-[9px] px-1 py-0.2 bg-pink-500/20 text-pink-300 rounded">Visual</span>}
            </button>
          );
        })}
      </div>

      {/* Main Workspace */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl backdrop-blur-sm">
        <FileDropzone
          key={activeTab}
          onFilesSelected={setFiles}
          accept={curTab?.accept}
          multiple={curTab?.multiple}
          label={`Tải file cho chức năng: ${curTab?.label}`}
        />

        {/* Options Panel */}
        {files && (
          <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-2xl space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-2">
              <Sliders size={14} /> Cấu hình chức năng: {curTab?.label}
            </h3>

            {/* Scan Ảnh -> PDF */}
            {activeTab === 'scan-to-pdf' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Chế độ màu tối ưu</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['auto', '⚡ Tự Động Tối Ưu'],
                      ['color', '🎨 Giữ Màu Gốc'],
                      ['grayscale', '⬛ Thang Độ Xám'],
                      ['blackwhite', '◼ Đen Trắng Rõ Nét'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setScanMode(v)}
                        className={`py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          scanMode === v ? 'bg-pink-600 border-pink-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Khổ giấy xuất ra</label>
                    <select
                      value={scanPaperSize}
                      onChange={e => setScanPaperSize(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="A4">A4 (Tiêu chuẩn tài liệu 210 × 297 mm)</option>
                      <option value="Letter">US Letter (216 × 279 mm)</option>
                      <option value="auto">Tự động vừa vặn kích thước ảnh</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scanSearchable}
                        onChange={e => setScanSearchable(e.target.checked)}
                        className="accent-pink-500 rounded w-4 h-4"
                      />
                      <span>Tự động nhận diện chữ (Searchable PDF layer)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Compare 2 PDF Text */}
            {activeTab === 'compare-text' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-300">
                  Vui lòng chọn 2 tệp PDF để hệ thống phân tích và chỉ ra từng dòng bị thêm, sửa, xóa với độ tương đồng %.
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Định dạng báo cáo xuất ra</label>
                  <div className="flex gap-2">
                    {[
                      ['pdf', '📄 Xuất Báo Cáo PDF'],
                      ['html', '🌐 Báo Cáo HTML Tương Tác'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCompareFormat(v)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          compareFormat === v ? 'bg-pink-600 border-pink-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Crop PDF */}
            {activeTab === 'crop' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400">
                  Nhập tọa độ vùng trang cần giữ lại (Hệ tọa độ Point · Khổ chuẩn A4 là 595 × 842 pt):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Tọa độ X (Trái):</label>
                    <input
                      type="number"
                      value={cropBox.x}
                      onChange={e => setCropBox({ ...cropBox, x: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Tọa độ Y (Dưới):</label>
                    <input
                      type="number"
                      value={cropBox.y}
                      onChange={e => setCropBox({ ...cropBox, y: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Chiều rộng (Width):</label>
                    <input
                      type="number"
                      value={cropBox.width}
                      onChange={e => setCropBox({ ...cropBox, width: parseInt(e.target.value, 10) || 450 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Chiều cao (Height):</label>
                    <input
                      type="number"
                      value={cropBox.height}
                      onChange={e => setCropBox({ ...cropBox, height: parseInt(e.target.value, 10) || 650 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Add Image into PDF */}
            {activeTab === 'add-image' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1.5">
                    1. Tải lên tệp ảnh cần chèn (PNG / JPG / WEBP)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setSecondaryFile(e.target.files?.[0] || null)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-pink-600 file:text-white"
                  />
                  {secondaryFile && (
                    <p className="text-[11px] text-green-400 mt-1">Đã chọn: {secondaryFile.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Trang chèn (0 là trang 1):</label>
                    <input
                      type="number"
                      min="0"
                      value={imgEmbed.page}
                      onChange={e => setImgEmbed({ ...imgEmbed, page: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vị trí X (px):</label>
                    <input
                      type="number"
                      value={imgEmbed.x}
                      onChange={e => setImgEmbed({ ...imgEmbed, x: parseInt(e.target.value, 10) || 50 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vị trí Y (px):</label>
                    <input
                      type="number"
                      value={imgEmbed.y}
                      onChange={e => setImgEmbed({ ...imgEmbed, y: parseInt(e.target.value, 10) || 50 })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Kích thước Rộng × Cao:</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="W"
                        value={imgEmbed.width}
                        onChange={e => setImgEmbed({ ...imgEmbed, width: parseInt(e.target.value, 10) || 200 })}
                        className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-2 py-2 text-xs text-white"
                      />
                      <input
                        type="number"
                        placeholder="H"
                        value={imgEmbed.height}
                        onChange={e => setImgEmbed({ ...imgEmbed, height: parseInt(e.target.value, 10) || 150 })}
                        className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-2 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Insert Pages from another PDF */}
            {activeTab === 'insert-pages' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1.5">
                    1. Tải lên tệp PDF cần chèn vào tài liệu gốc
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={e => setSecondaryFile(e.target.files?.[0] || null)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-pink-600 file:text-white"
                  />
                  {secondaryFile && (
                    <p className="text-[11px] text-green-400 mt-1">Đã chọn: {secondaryFile.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">
                    2. Chèn vào SAU trang số (0 = Chèn ngay ở đầu trang bìa):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={insertAfterPage}
                    onChange={e => setInsertAfterPage(parseInt(e.target.value, 10) || 0)}
                    className="w-full sm:w-48 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* PDF/A Standard */}
            {activeTab === 'to-pdfa' && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 block">Chọn cấp độ tiêu chuẩn PDF/A</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['1b', 'PDF/A-1b', 'Cơ bản'],
                    ['2b', 'PDF/A-2b', 'Khuyên dùng (ISO chuẩn)'],
                    ['3b', 'PDF/A-3b', 'Nâng cao'],
                  ].map(([lvl, title, sub]) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPdfaLevel(lvl)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfaLevel === lvl
                          ? 'bg-pink-600/20 border-pink-500 text-white'
                          : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      <div className="font-bold text-xs">{title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PDF -> PPTX DPI */}
            {activeTab === 'to-pptx' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Độ phân giải slide (DPI)</label>
                <select
                  value={pptxDpi}
                  onChange={e => setPptxDpi(parseInt(e.target.value, 10))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value={100}>100 DPI — File nhẹ, trình chiếu nhanh</option>
                  <option value={150}>150 DPI — Cân bằng tiêu chuẩn (Khuyên dùng)</option>
                  <option value={200}>200 DPI — Siêu nét, giữ trọn chi tiết</option>
                </select>
              </div>
            )}

            {/* Compress */}
            {activeTab === 'compress' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mức độ nén (Ghostscript)</label>
                <select
                  value={compressQuality}
                  onChange={e => setCompressQuality(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="screen">Screen (72 dpi) — Nén tối đa, dung lượng nhỏ nhất</option>
                  <option value="ebook">Ebook (150 dpi) — Khuyến nghị, cân bằng đẹp & nhẹ</option>
                  <option value="printer">Printer (300 dpi) — Chất lượng cao để in ấn</option>
                  <option value="prepress">Prepress (300 dpi) — Giữ nguyên màu sắc chuẩn</option>
                </select>
              </div>
            )}

            {/* Page Numbers */}
            {activeTab === 'page-numbers' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Vị trí đánh số</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['bottom-center','↓ Giữa dưới'],['bottom-right','↓ Phải dưới'],['bottom-left','↓ Trái dưới'],
                      ['top-center','↑ Giữa trên'],['top-right','↑ Phải trên'],['top-left','↑ Trái trên']
                    ].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setPagePosition(v)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${pagePosition === v ? 'bg-pink-600 text-white font-bold' : 'bg-gray-900 border border-gray-800 text-gray-400'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Bắt đầu từ trang số</label>
                    <input type="number" min="1" value={pageStartFrom} onChange={e => setPageStartFrom(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Định dạng số</label>
                    <input type="text" value={pageFormat} onChange={e => setPageFormat(e.target.value)} placeholder="{n} / {total}" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Header Footer */}
            {activeTab === 'header-footer' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tiêu đề đầu trang (Header)</label>
                  <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="VD: BÁO CÁO NỘI BỘ" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Chân trang (Footer)</label>
                  <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="VD: Bảo mật · Không sao chép" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
              </div>
            )}

            {/* Rotate */}
            {activeTab === 'rotate' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Góc xoay</label>
                <div className="flex gap-2">
                  {[90, 180, 270].map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setRotateAngle(a)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        rotateAngle === a
                          ? 'bg-pink-600 text-white shadow-lg'
                          : 'bg-gray-900 border border-gray-800 text-gray-400'
                      }`}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Watermark */}
            {activeTab === 'watermark' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Chữ đóng dấu (Watermark text)</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  placeholder="VD: BẢN QUYỀN / CONFIDENTIAL"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {/* Protect */}
            {activeTab === 'protect' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mật khẩu bảo vệ (qpdf 256-bit)</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  placeholder="Nhập mật khẩu cần đặt cho file PDF"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {/* Unlock */}
            {activeTab === 'unlock' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mật khẩu hiện tại của file</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={e => setUnlockPassword(e.target.value)}
                  placeholder="Nhập mật khẩu để gỡ bỏ khóa"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {/* Dark Mode */}
            {activeTab === 'dark' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Tông màu Dark Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDarkModeBg('dark')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      darkModeBg === 'dark' ? 'bg-pink-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400'
                    }`}
                  >
                    🌙 Nền Đen Thuần (#121212)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkModeBg('sepia-dark')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      darkModeBg === 'sepia-dark' ? 'bg-amber-800 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400'
                    }`}
                  >
                    📜 Sepia Đậm (Chống mỏi mắt)
                  </button>
                </div>
              </div>
            )}

            {/* TOC */}
            {activeTab === 'toc' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300">Tiêu đề trang mục lục</label>
                  <input
                    type="text"
                    value={tocTitle}
                    onChange={e => setTocTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tocAI}
                    onChange={e => setTocAI(e.target.checked)}
                    className="rounded border-white/20 text-pink-600"
                  />
                  <span className="text-xs text-gray-300">Dùng AI nhận dạng cấu trúc nâng cao</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang xử lý...' : `Thực hiện: ${curTab?.label}`}
            </button>
          </div>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div>
            {result.stats && activeTab === 'stats' ? (
              <div className="p-6 bg-gray-950 border border-gray-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ['📄 Số trang',         result.stats.pages],
                  ['📝 Tổng từ',          result.stats.words?.toLocaleString()],
                  ['🔤 Số ký tự',        result.stats.chars?.toLocaleString()],
                  ['📖 Thời gian đọc',   result.stats.readTime],
                  ['📊 Độ dễ đọc',       result.stats.readability],
                  ['💾 Dung lượng',      `${result.stats.sizeKb} KB`],
                  ['✍️ Số câu',          result.stats.sentences?.toLocaleString()],
                  ['📐 Từ/trang',        result.stats.avgWordsPerPage],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-gray-400 text-xs">{label}</p>
                    <p className="font-bold text-lg text-white mt-1">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <ResultDownload result={result} onReset={reset} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
