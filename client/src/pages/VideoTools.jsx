import { useState, useEffect } from 'react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import WatermarkComparisonSlider from '../components/WatermarkComparisonSlider';
import axios from 'axios';
import {
  Film, Scissors, Layers, Gauge, Volume2, VolumeX,
  Palette, Captions, Droplets, Layout, Camera,
  Wind, Gift, Type, Wand2, Search, RotateCcw, Loader2,
  Sparkles, ShieldCheck, CheckCircle2, ChevronRight, Plus,
  Trash2, Play, Download, Sliders, ArrowLeft, Image as ImageIcon
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// 20 Creative Video Tools
const TOOLS = [
  { id: 'watermark-remove', icon: Wand2,       label: 'Gỡ Watermark Google Flow', desc: 'Xóa watermark Google Flow/Veo 3/Omini tự động', badge: 'BOTOCIT AI' },
  { id: 'story-creator',   icon: Sparkles,    label: 'Tạo Video Người Que 2D',  desc: 'Video kể chuyện với giọng đọc & hình ảnh nhất quán', badge: 'STORY AI' },
  { id: 'trim',            icon: Scissors,    label: 'Cắt video',               desc: 'Cắt đầu/cuối/đoạn giữa chuẩn xác', files: 1 },
  { id: 'merge',           icon: Layers,      label: 'Ghép video',              desc: 'Ghép nhiều clip kèm hiệu ứng xfade', files: 10 },
  { id: 'compress',        icon: Gauge,       label: 'Nén video',               desc: 'Giảm dung lượng không giảm chất lượng', files: 1 },
  { id: 'convert',         icon: Film,        label: 'Chuyển định dạng',        desc: 'MP4 · WebM · MOV · AVI · GIF · MP3', files: 1 },
  { id: 'speed',           icon: Gauge,       label: 'Tốc độ',                  desc: 'Slow-motion 0.25x hoặc timelapse 4x', files: 1 },
  { id: 'remove-audio',    icon: VolumeX,     label: 'Tắt âm thanh',            desc: 'Tách/xóa audio track khỏi video', files: 1 },
  { id: 'replace-audio',   icon: Volume2,     label: 'Thay thế âm thanh',       desc: 'Lồng nhạc nền hoặc đè audio mới', files: 2, special: 'audio' },
  { id: 'color',           icon: Palette,     label: 'Chỉnh màu (Color Grade)', desc: 'Brightness, contrast, saturation, LUT', files: 1 },
  { id: 'subtitle',        icon: Captions,    label: 'Ép phụ đề cứng',          desc: 'Burn SRT vào video chuẩn VEED', files: 2, special: 'subtitle' },
  { id: 'watermark',       icon: Droplets,    label: 'Đóng dấu Watermark',      desc: 'Thêm logo thương hiệu và bản quyền', files: 2, special: 'watermark' },
  { id: 'split-screen',    icon: Layout,      label: 'Màn hình chia đôi/tư',    desc: 'Layout 2x1, 1x2, 2x2 multi-cam', files: 4 },
  { id: 'frames',          icon: Camera,      label: 'Chụp frame ảnh & ZIP',    desc: 'Export các khung hình từ video', files: 1 },
  { id: 'stabilize',       icon: Wind,        label: 'Chống rung video',        desc: 'Thuật toán vidstab 2-pass', files: 1 },
  { id: 'to-gif',          icon: Gift,        label: 'Video → GIF nét cao',     desc: 'Tạo GIF mượt mà 256 màu palette', files: 1 },
  { id: 'text',            icon: Type,        label: 'Thêm chữ vào video',      desc: 'Text overlay với tùy chọn thời gian', files: 1 },
  { id: 'remove-bg',       icon: Wand2,       label: 'Xóa nền (Chroma Key)',    desc: 'Tách phông xanh/màu đơn sắc', files: 1 },
  { id: 'reverse',         icon: RotateCcw,   label: 'Quay ngược video',        desc: 'Đảo ngược hình ảnh và âm thanh', files: 1 },
  { id: 'scenes',          icon: Search,      label: 'Phát hiện cảnh',          desc: 'Tự động dò tìm các điểm cắt cảnh', files: 1, resultType: 'json' },
  { id: 'info',            icon: Film,        label: 'Thông tin kỹ thuật',      desc: 'Duration, FPS, codec, resolution', files: 1, resultType: 'json' },
];

export default function VideoTools() {
  const [activeTab, setActiveTab] = useState('watermark-remover'); // 'watermark-remover' | 'tools' | 'storyteller'
  const [selectedTool, setSelectedTool] = useState(null);

  // States cho xử lý file
  const [files, setFiles] = useState([]);
  const [files2, setFiles2] = useState([]);
  const [opts, setOpts] = useState({});
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [jsonResult, setJsonResult] = useState(null);

  // States riêng cho BotocIT Watermark Remover
  const [wmPreset, setWmPreset] = useState('google-flow');
  const [wmMode, setWmMode] = useState('single'); // 'single' | 'batch'
  const [batchResults, setBatchResults] = useState([]);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);

  // States riêng cho Storyteller Người Que 2D
  const [storyTitle, setStoryTitle] = useState('Hành Trình Của Bạn Người Que');
  const [storyVoice, setStoryVoice] = useState('Voice 1');
  const [storyScenes, setStoryScenes] = useState([
    { text: 'Ngày xửa ngày xưa, tại một vương quốc công nghệ tràn ngập niềm vui.' },
    { text: 'Anh chàng người que quyết định bước ra thế giới để sáng tạo những thước phim tuyệt đỉnh.' },
    { text: 'Và thế là, một kiệt tác video đầy cảm hứng đã chính thức được tạo ra!' }
  ]);

  const setOpt = (k, v) => setOpts(o => ({ ...o, [k]: v }));

  // Tạo URL preview cho ảnh/video gốc khi chọn file
  useEffect(() => {
    if (files.length > 0 && files[0] instanceof File) {
      const url = URL.createObjectURL(files[0]);
      setOriginalPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [files]);

  // Xử lý gửi API chung cho các tool
  const handleExecute = async () => {
    if (!files.length && activeTab !== 'storyteller') return;
    setStatus('processing');
    setProgress(15);
    setResult(null);
    setJsonResult(null);
    setBatchResults([]);

    const fd = new FormData();

    // ── XỬ LÝ WATERMARK REMOVER ──
    if (activeTab === 'watermark-remover') {
      if (wmMode === 'batch') {
        files.forEach(f => fd.append('files', f));
        fd.append('preset', wmPreset);
        try {
          setProgress(40);
          const { data } = await axios.post(`${API}/api/video/batch-watermark-remove`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
            timeout: 600000,
            onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 35) + 15),
          });
          setProgress(100);
          setStatus('done');
          setBatchResults(data.results || []);
        } catch (err) {
          setStatus('error');
          setResult({ error: err.response?.data?.error || 'Lỗi xử lý xóa watermark hàng loạt' });
        }
        return;
      } else {
        fd.append('file', files[0]);
        fd.append('preset', wmPreset);
        if (opts.customW) fd.append('w', opts.customW);
        if (opts.customH) fd.append('h', opts.customH);
        if (opts.customX) fd.append('x', opts.customX);
        if (opts.customY) fd.append('y', opts.customY);

        try {
          setProgress(40);
          const { data } = await axios.post(`${API}/api/video/watermark-remove`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
            timeout: 600000,
            onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 35) + 15),
          });
          setProgress(100);
          setStatus('done');
          setResult(data);
        } catch (err) {
          setStatus('error');
          setResult({ error: err.response?.data?.error || 'Lỗi gỡ watermark' });
        }
        return;
      }
    }

    // ── XỬ LÝ STORYTELLER 2D ──
    if (activeTab === 'storyteller') {
      fd.append('title', storyTitle);
      fd.append('voice', storyVoice);
      fd.append('style', 'stickman_2d');
      fd.append('scenes', JSON.stringify(storyScenes));

      try {
        setProgress(30);
        const { data } = await axios.post(`${API}/api/video/story-creator`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
          timeout: 600000,
          onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 40) + 10),
        });
        setProgress(100);
        setStatus('done');
        setResult(data);
      } catch (err) {
        setStatus('error');
        setResult({ error: err.response?.data?.error || 'Lỗi tạo video câu chuyện 2D' });
      }
      return;
    }

    // ── XỬ LÝ 20 CREATIVE TOOLS ──
    const tool = TOOLS.find(t => t.id === selectedTool);
    if (!tool) return;

    if (tool.special === 'subtitle') {
      fd.append('video', files[0]);
      if (files2[0]) fd.append('srt', files2[0]);
    } else if (tool.special === 'watermark') {
      fd.append('video', files[0]);
      if (files2[0]) fd.append('watermark', files2[0]);
    } else if (tool.special === 'audio') {
      fd.append('video', files[0]);
      if (files2[0]) fd.append('audio', files2[0]);
    } else if (tool.files > 1) {
      files.forEach(f => fd.append('files', f));
    } else if (files[0]) {
      fd.append('file', files[0]);
    }

    Object.entries(opts).forEach(([k, v]) => {
      if (v !== undefined && v !== '') fd.append(k, v);
    });

    try {
      setProgress(40);
      const endpoint = `${API}/api/video/${tool.id}`;
      const { data } = await axios.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
        timeout: 600000,
        onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 35) + 15),
      });

      setProgress(100);
      setStatus('done');
      if (tool.resultType === 'json' || data.info || data.scenes) {
        setJsonResult(data);
      } else {
        setResult(data);
      }
    } catch (err) {
      setStatus('error');
      setResult({ error: err.response?.data?.error || 'Lỗi xử lý video' });
    }
  };

  const currentToolObj = TOOLS.find(t => t.id === selectedTool);

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-2 sm:px-4">
      {/* ── HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-amber-900/20 border border-purple-500/30 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold tracking-wide uppercase">
              <Sparkles size={13} />
              <span>CapCut · Adobe Premiere · DaVinci · BotocIT AI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Video & Creative Studio Pro
            </h1>
            <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
              Bộ công cụ biên tập video điện ảnh chuẩn CapCut + Adobe Premiere kết hợp công nghệ độc quyền BotocIT giúp <strong>gỡ watermark Google Flow, Veo 3, Omini</strong> và <strong>tạo video kể chuyện Người Que 2D</strong> nhất quán.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 shrink-0 self-start md:self-auto">
            <button
              onClick={() => { setActiveTab('watermark-remover'); setSelectedTool(null); setResult(null); setStatus(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'watermark-remover'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wand2 size={15} />
              <span>Gỡ Watermark Flow</span>
            </button>
            <button
              onClick={() => { setActiveTab('tools'); setResult(null); setStatus(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'tools'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Film size={15} />
              <span>20 Công Cụ Video</span>
            </button>
            <button
              onClick={() => { setActiveTab('storyteller'); setSelectedTool(null); setResult(null); setStatus(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'storyteller'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles size={15} />
              <span>Video Người Que 2D</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: GỠ WATERMARK GOOGLE FLOW (BOTOCIT STYLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'watermark-remover' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái: Cài đặt và Upload */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-card p-5 rounded-3xl border border-white/10 bg-black/40 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wand2 size={18} className="text-purple-400" />
                  <span>Cấu Hình Xóa Watermark</span>
                </h3>

                {/* Chọn chế độ: Đơn lẻ vs Hàng loạt */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => { setWmMode('single'); setFiles([]); }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      wmMode === 'single' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    1 Tệp (Kèm So Sánh)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWmMode('batch'); setFiles([]); }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      wmMode === 'batch' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Hàng Loạt (Tối đa 30)
                  </button>
                </div>

                {/* Chọn Preset */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Preset Vị Trí Watermark</label>
                  <div className="space-y-2">
                    {[
                      { id: 'google-flow', label: 'Google Flow / Veo 3', desc: 'Tự động tính góc dưới phải cho video AI' },
                      { id: 'omini',       label: 'Video Omini',         desc: 'Khử logo Omini góc trên/dưới' },
                      { id: 'bottomright', label: 'Góc Dưới Bên Phải',   desc: 'Vị trí logo tiêu chuẩn 16% bề rộng' },
                      { id: 'topright',    label: 'Góc Trên Bên Phải',   desc: 'Vị trí watermark logo đài/kênh' },
                      { id: 'bottomleft',  label: 'Góc Dưới Bên Trái',   desc: 'Vị trí timestamp hoặc nhãn video' },
                      { id: 'custom',      label: 'Tùy Chỉnh Toạ Độ',    desc: 'Nhập thủ công x, y, width, height' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setWmPreset(p.id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                          wmPreset === p.id
                            ? 'bg-purple-950/60 border-purple-500/60 text-white shadow'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{p.label}</span>
                          {wmPreset === p.id && <CheckCircle2 size={15} className="text-purple-400" />}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Coordinates nếu chọn 'custom' */}
                {wmPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-black/60 rounded-xl border border-white/10">
                    {[['customX', 'X (px)', 1000], ['customY', 'Y (px)', 650], ['customW', 'Rộng (px)', 200], ['customH', 'Cao (px)', 60]].map(([k, l, d]) => (
                      <label key={k} className="space-y-1">
                        <span className="text-[11px] text-gray-400">{l}</span>
                        <input
                          type="number"
                          placeholder={String(d)}
                          onChange={e => setOpt(k, e.target.value)}
                          className="w-full bg-gray-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: Upload Stage & Kết Quả So Sánh */}
            <div className="lg:col-span-2 space-y-5">
              <FileDropzone
                onFiles={f => setFiles(Array.isArray(f) ? f : [f])}
                accept={{ 'video/*': [], 'image/*': [] }}
                multiple={wmMode === 'batch'}
                label={wmMode === 'batch' ? 'Chọn nhiều video hoặc ảnh Google Flow' : 'Kéo thả Video hoặc Ảnh Google Flow vào đây'}
                hint="Hỗ trợ file MP4, WebM, MOV, JPG, PNG, WebP"
              />

              {files.length > 0 && (
                <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-gray-300">
                    Đã nạp: <strong className="text-white">{files.length} tệp</strong> ({files.map(f => f.name).slice(0, 2).join(', ')}{files.length > 2 ? '...' : ''})
                  </span>
                  <span className="text-purple-300 font-semibold uppercase">{wmPreset}</span>
                </div>
              )}

              {status === 'processing' && <ProgressBar progress={progress} status={status} />}

              {result?.error && (
                <div className="p-4 bg-red-950/50 border border-red-500/40 rounded-2xl text-red-300 text-xs">
                  {result.error}
                </div>
              )}

              {/* So Sánh Trước / Sau Trực Quan (BotocIT Style) */}
              {result && status === 'done' && !result.error && (
                <div className="space-y-4">
                  <WatermarkComparisonSlider
                    originalSrc={originalPreviewUrl}
                    processedSrc={result.viewUrl?.startsWith('http') ? result.viewUrl : `${API}${result.viewUrl}`}
                    isVideo={!result.isImage}
                    detectedBox={result.detectedBox}
                    title="Kết Quả Gỡ Sạch Watermark Google Flow"
                  />
                  <ResultDownload result={result} />
                </div>
              )}

              {/* Danh sách kết quả hàng loạt */}
              {batchResults.length > 0 && (
                <div className="glass-card p-5 rounded-3xl border border-white/10 bg-black/40 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span>Hoàn tất xử lý hàng loạt ({batchResults.length} tệp)</span>
                  </h4>
                  <div className="divide-y divide-white/5">
                    {batchResults.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-gray-300 truncate max-w-xs">{item.file}</span>
                        {item.success ? (
                          <a
                            href={`${API}${item.downloadUrl}`}
                            download
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5 shadow"
                          >
                            <Download size={13} /> Tải file
                          </a>
                        ) : (
                          <span className="text-red-400">Lỗi: {item.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecute}
                disabled={!files.length || status === 'processing'}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-sm shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 transition-all"
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang định vị và xóa watermark...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    <span>Tiến Hành Gỡ Watermark Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: 20 CÔNG CỤ VIDEO SÁNG TẠO (CAPCUT + ADOBE PREMIERE + DAVINCI)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          {!selectedTool ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {TOOLS.filter(t => t.id !== 'watermark-remove' && t.id !== 'story-creator').map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTool(t.id);
                    setFiles([]);
                    setFiles2([]);
                    setOpts({});
                    setResult(null);
                    setJsonResult(null);
                    setStatus(null);
                  }}
                  className="glass-card p-4 rounded-2xl border border-white/5 hover:border-purple-500/50 bg-black/30 hover:bg-purple-950/20 text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 flex items-center justify-center transition-colors">
                        <t.icon size={18} />
                      </div>
                      {t.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {t.label}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>
                  <span className="text-[11px] text-purple-400 font-semibold mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Sử dụng công cụ <ChevronRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/10 bg-black/50 max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button
                  type="button"
                  onClick={() => setSelectedTool(null)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft size={15} /> Trở lại danh sách công cụ
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    {currentToolObj && <currentToolObj.icon size={16} />}
                  </div>
                  <h3 className="text-base font-bold text-white">{currentToolObj?.label}</h3>
                </div>
              </div>

              {/* Uploads theo từng tool */}
              <FileDropzone
                onFiles={f => setFiles(Array.isArray(f) ? f : [f])}
                accept={{ 'video/*': [] }}
                multiple={currentToolObj?.files > 1 && !currentToolObj?.special}
                label={currentToolObj?.special ? 'Tải lên Video chính' : currentToolObj?.files > 1 ? `Tải lên ${currentToolObj.files} video` : 'Tải lên file video'}
              />

              {currentToolObj?.special === 'subtitle' && (
                <FileDropzone
                  onFiles={f => setFiles2(Array.isArray(f) ? f : [f])}
                  accept={{ 'text/plain': ['.srt'], 'application/x-subrip': ['.srt'] }}
                  label="Tải lên tệp phụ đề SRT"
                />
              )}

              {currentToolObj?.special === 'watermark' && (
                <FileDropzone
                  onFiles={f => setFiles2(Array.isArray(f) ? f : [f])}
                  accept={{ 'image/*': [] }}
                  label="Tải lên ảnh Watermark / Logo"
                />
              )}

              {currentToolObj?.special === 'audio' && (
                <FileDropzone
                  onFiles={f => setFiles2(Array.isArray(f) ? f : [f])}
                  accept={{ 'audio/*': [] }}
                  label="Tải lên tệp âm thanh (MP3, WAV, AAC)"
                />
              )}

              {/* Tùy chỉnh chi tiết từng tool */}
              {selectedTool === 'trim' && (
                <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">Bắt đầu (giây)</span>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue="0"
                      onChange={e => setOpt('start', e.target.value)}
                      className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">Kết thúc (giây)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="vd: 15.5"
                      onChange={e => setOpt('end', e.target.value)}
                      className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              )}

              {selectedTool === 'compress' && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-400 block">Mức độ nén</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ['low', 'Nhỏ nhất'],
                      ['medium', 'Cân bằng'],
                      ['high', 'Chất lượng cao'],
                      ['ultra', 'Ultra HD']
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOpt('quality', v)}
                        className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                          (opts.quality || 'medium') === v
                            ? 'bg-purple-600 text-white border-purple-500 shadow'
                            : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTool === 'convert' && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-400 block">Định dạng đích</span>
                  <div className="flex flex-wrap gap-2">
                    {['mp4', 'webm', 'mov', 'avi', 'mkv', 'gif', 'mp3', 'wav'].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setOpt('format', f)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs uppercase font-bold transition-all border ${
                          (opts.format || 'mp4') === f
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTool === 'speed' && (
                <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Tốc độ phát:</span>
                    <strong className="text-purple-400 font-bold text-sm">{opts.speed || 1}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.25"
                    max="4"
                    step="0.25"
                    defaultValue="1"
                    onChange={e => setOpt('speed', e.target.value)}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>0.25x (Slow-mo)</span>
                    <span>1.0x (Chuẩn)</span>
                    <span>4.0x (Timelapse)</span>
                  </div>
                </div>
              )}

              {selectedTool === 'color' && (
                <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                  {[
                    ['brightness', 'Độ sáng', -0.5, 0.5, 0, 0.05],
                    ['contrast',   'Độ tương phản', 0.5, 2.0, 1, 0.1],
                    ['saturation', 'Bão hòa màu', 0, 3.0, 1, 0.1],
                    ['gamma',      'Gamma', 0.5, 2.0, 1, 0.1],
                  ].map(([k, l, min, max, def, step]) => (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{l}</span>
                        <span className="text-white font-mono">{opts[k] ?? def}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        defaultValue={def}
                        onChange={e => setOpt(k, e.target.value)}
                        className="w-full accent-purple-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedTool === 'to-gif' && (
                <div className="grid grid-cols-3 gap-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                  {[['fps', 'FPS (Khung hình)', 12], ['width', 'Chiều rộng (px)', 480], ['duration', 'Thời lượng (s)', 5]].map(([k, l, d]) => (
                    <label key={k} className="space-y-1">
                      <span className="text-[11px] text-gray-400">{l}</span>
                      <input
                        type="number"
                        defaultValue={d}
                        onChange={e => setOpt(k, e.target.value)}
                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </label>
                  ))}
                </div>
              )}

              {status === 'processing' && <ProgressBar progress={progress} status={status} />}

              {result?.error && (
                <div className="p-4 bg-red-950/50 border border-red-500/40 rounded-2xl text-red-300 text-xs">
                  {result.error}
                </div>
              )}

              {result && status === 'done' && !result.error && <ResultDownload result={result} />}

              {jsonResult?.info && (
                <div className="p-4 bg-black/60 rounded-2xl border border-white/10 grid grid-cols-2 gap-3 text-xs">
                  {Object.entries(jsonResult.info).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-400 capitalize">{k}:</span>
                      <strong className="text-white">{String(v)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {jsonResult?.scenes && (
                <div className="p-4 bg-black/60 rounded-2xl border border-white/10 space-y-2">
                  <p className="text-xs font-bold text-white">{jsonResult.count} điểm chuyển cảnh được phát hiện</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jsonResult.scenes.map((s, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white/5 rounded-md text-[11px] text-purple-300">
                        Scene {idx + 1}: {s.toFixed(2)}s
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecute}
                disabled={!files.length || status === 'processing'}
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all"
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang render xử lý video...</span>
                  </>
                ) : (
                  <>
                    <currentToolObj.icon size={16} />
                    <span>Thực Hiện: {currentToolObj?.label}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: TẠO VIDEO KỂ CHUYỆN NGƯỜI QUE 2D NHẤT QUÁN (BOTOCIT STYLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'storyteller' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái: Cấu hình kịch bản */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-card p-5 rounded-3xl border border-white/10 bg-black/40 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-400" />
                  <span>Kịch Bản & Giọng Đọc</span>
                </h3>

                <label className="space-y-1 block">
                  <span className="text-xs text-gray-400">Tiêu đề video</span>
                  <input
                    type="text"
                    value={storyTitle}
                    onChange={e => setStoryTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs text-gray-400">Chọn giọng kể chuyện (Voice 1 - Voice 25)</span>
                  <select
                    value={storyVoice}
                    onChange={e => setStoryVoice(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {Array.from({ length: 25 }, (_, i) => `Voice ${i + 1}`).map(v => (
                      <option key={v} value={v}>{v} (Tiếng Việt AI)</option>
                    ))}
                  </select>
                </label>

                <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-[11px] text-amber-200 leading-relaxed space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-amber-400" />
                    Đồng bộ nhất quán xuyên suốt:
                  </p>
                  <p>Hệ thống tự động vẽ nhân vật 2D hoạt họa, phối giọng đọc AI theo từng cảnh, thêm hiệu ứng zoom điện ảnh và chèn phụ đề đồng bộ.</p>
                </div>
              </div>
            </div>

            {/* Cột phải: Danh sách phân cảnh và Render */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card p-6 rounded-3xl border border-white/10 bg-black/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers size={16} className="text-purple-400" />
                    <span>Các Phân Cảnh (Tổng cộng: {storyScenes.length} cảnh)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setStoryScenes(s => [...s, { text: 'Phân cảnh tiếp theo của câu chuyện...' }])}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow"
                  >
                    <Plus size={14} /> Thêm cảnh
                  </button>
                </div>

                <div className="space-y-3">
                  {storyScenes.map((sc, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-400">Cảnh {idx + 1}</span>
                        {storyScenes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setStoryScenes(s => s.filter((_, i) => i !== idx))}
                            className="text-gray-500 hover:text-red-400 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={sc.text}
                        onChange={e => {
                          const val = e.target.value;
                          setStoryScenes(prev => prev.map((item, i) => i === idx ? { ...item, text: val } : item));
                        }}
                        className="w-full bg-gray-900 border border-white/5 rounded-xl p-3 text-xs text-white resize-none"
                        placeholder="Lời thoại hoặc thuyết minh cho phân cảnh này..."
                      />
                    </div>
                  ))}
                </div>

                {status === 'processing' && <ProgressBar progress={progress} status={status} />}

                {result?.error && (
                  <div className="p-4 bg-red-950/50 border border-red-500/40 rounded-2xl text-red-300 text-xs">
                    {result.error}
                  </div>
                )}

                {result && status === 'done' && !result.error && (
                  <div className="space-y-3">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                      <video
                        src={result.viewUrl?.startsWith('http') ? result.viewUrl : `${API}${result.viewUrl}`}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <ResultDownload result={result} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={status === 'processing' || !storyScenes.length}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 hover:brightness-110 disabled:opacity-40 text-white font-bold text-sm shadow-xl shadow-amber-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Đang tổng hợp các cảnh & giọng đọc...</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      <span>Tạo Hoàn Chỉnh Video Người Que 2D</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
