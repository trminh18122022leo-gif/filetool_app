import { useState, useRef } from 'react';
import axios from 'axios';
import {
  Film, Sparkles, Flame, Play, Pause, Download,
  CheckCircle2, AlertCircle, RefreshCw, Scissors,
  Layers, Sliders, ChevronRight, ArrowLeft, Eye
} from 'lucide-react';
import FileDropzone from './FileDropzone';
import ProgressBar from './ProgressBar';

const API = import.meta.env.VITE_API_URL || '';

const SUBTITLE_STYLES = [
  { id: 'tiktok', label: 'TikTok Pop', desc: 'Chữ vàng viền đen dày, cực nét trên điện thoại', previewClass: 'text-yellow-400 font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' },
  { id: 'neon', label: 'Cyber Neon', desc: 'Chữ xanh dạ quang viền đen hiện đại', previewClass: 'text-cyan-300 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' },
  { id: 'classic', label: 'Classic White', desc: 'Chữ trắng viền đen truyền thống thanh lịch', previewClass: 'text-white font-semibold drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]' },
  { id: 'boxed', label: 'Netflix Boxed', desc: 'Chữ trắng trong hộp đen mờ bán trong suốt', previewClass: 'text-white bg-black/70 px-2 py-0.5 rounded font-medium' },
];

export default function ViralShortsStudio({ onBack }) {
  // Step: 'upload' | 'scanning' | 'highlights' | 'rendering' | 'preview'
  const [step, setStep] = useState('upload');

  // Video State
  const [videoFile, setVideoFile] = useState(null);
  const [videoFilename, setVideoFilename] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [allSegments, setAllSegments] = useState([]);
  const [language, setLanguage] = useState('auto');

  // Render Options
  const [subtitleStyle, setSubtitleStyle] = useState('tiktok');
  const [blurBackground, setBlurBackground] = useState(true);
  const [burnSub, setBurnSub] = useState(true);

  // Active / Selected Clip State
  const [selectedClip, setSelectedClip] = useState(null);
  const [renderedClip, setRenderedClip] = useState(null);
  const [renderLoadingId, setRenderLoadingId] = useState(null);

  // Progress & Error
  const [scanStage, setScanStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Video preview player ref
  const videoPlayerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 1. Quét video dài để phát hiện các đoạn highlight
  const handleScanVideo = async () => {
    if (!videoFile) return;

    setErrorMsg('');
    setStep('scanning');
    setScanStage('Đang tải video lên máy chủ và trích xuất âm thanh 16kHz...');

    const fd = new FormData();
    fd.append('file', videoFile);
    fd.append('language', language);

    try {
      setTimeout(() => {
        setScanStage('Whisper AI đang nhận diện toàn bộ lời thoại và timestamps...');
      }, 3000);

      setTimeout(() => {
        setScanStage('Đạo diễn AI đang phân tích kịch bản & chấm điểm khoảnh khắc triệu views...');
      }, 7000);

      const res = await axios.post(`${API}/api/creative/viral-shorts/detect`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });

      if (res.data?.success) {
        setVideoFilename(res.data.videoFilename);
        setVideoDuration(res.data.duration);
        setDetectedLanguage(res.data.detectedLanguage);
        setHighlights(res.data.highlights || []);
        setAllSegments(res.data.segments || []);
        setStep('highlights');
      } else {
        throw new Error(res.data?.error || 'Không thể quét video');
      }
    } catch (err) {
      console.error('Lỗi scan video:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Lỗi quét video');
      setStep('upload');
    }
  };

  // 2. Render một clip highlight được chọn
  const handleRenderClip = async (clip) => {
    setErrorMsg('');
    setSelectedClip(clip);
    setRenderLoadingId(clip.id);

    try {
      const res = await axios.post(`${API}/api/creative/viral-shorts/render`, {
        videoFilename,
        clip,
        allSegments,
        subtitleStyle,
        burnSub,
        blurBackground
      }, {
        withCredentials: true
      });

      if (res.data?.success && res.data.clip) {
        setRenderedClip(res.data.clip);
        setStep('preview');
      } else {
        throw new Error(res.data?.error || 'Lỗi khi render clip ngắn');
      }
    } catch (err) {
      console.error('Lỗi render clip:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Lỗi xuất video ngắn');
    } finally {
      setRenderLoadingId(null);
    }
  };

  const formatSec = (s) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const toggleVideoPlay = () => {
    if (!videoPlayerRef.current) return;
    if (isPlaying) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      videoPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-amber-500 to-pink-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              AI AUTO-DIRECTOR
            </span>
            <span className="text-xs text-gray-400 font-mono">GPU NVENC 9:16 Shorts</span>
          </div>
          <h3 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <Film size={22} className="text-pink-400" />
            AI Viral Shorts & TikTok Clipper
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Tự động tìm kiếm đoạn kịch tính nhất trong video dài, crop dọc 9:16 làm mờ nền và ép phụ đề chữ to chuẩn TikTok / Reels.
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="glass-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Trở về danh sách
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/50 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <div className="space-y-5">
          <FileDropzone
            onFilesSelected={(incoming) => {
              const file = Array.isArray(incoming) ? incoming[0] : incoming;
              setVideoFile(file);
            }}
            accept="video/*,.mp4,.mov,.webm,.mkv"
            label="Kéo thả hoặc bấm để chọn video (.mp4, .mov, .webm) từ 1 đến 60 phút"
          />

          {videoFile && (
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-pink-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Film size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                    {videoFile.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="glass-input text-xs py-1.5 px-3 bg-gray-900 text-white"
                >
                  <option value="auto">🌐 Tự phát hiện ngôn ngữ</option>
                  <option value="vi">🇻🇳 Tiếng Việt</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="zh">🇨🇳 中文 (Chinese)</option>
                  <option value="ja">🇯🇵 日本語 (Japanese)</option>
                  <option value="ko">🇰🇷 한국어 (Korean)</option>
                </select>
              </div>
            </div>
          )}

          <button
            onClick={handleScanVideo}
            disabled={!videoFile}
            className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:from-pink-500 hover:to-amber-400 shadow-[0_0_25px_rgba(236,72,153,0.35)] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Bắt Đầu Quét & Tìm Khoảnh Khắc Viral Bằng AI
          </button>
        </div>
      )}

      {/* ── STEP 2: SCANNING ── */}
      {step === 'scanning' && (
        <div className="p-10 rounded-3xl bg-gray-950/80 border border-pink-500/40 text-center space-y-6 shadow-2xl">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-pink-500/20 border-t-pink-500 animate-spin" />
            <Film size={32} className="text-pink-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-black text-white">Đang Phân Tích Video Dài</h4>
            <p className="text-xs text-pink-300 font-mono animate-pulse">{scanStage}</p>
          </div>

          <div className="max-w-md mx-auto">
            <ProgressBar progress={65} />
          </div>

          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
            Whisper và AI Content Director đang đọc kịch bản, xác định nhịp điệu và tuyển chọn các khoảnh khắc có tỷ lệ giữ chân người xem cao nhất.
          </p>
        </div>
      )}

      {/* ── STEP 3: HIGHLIGHTS SELECTION ── */}
      {step === 'highlights' && (
        <div className="space-y-6">
          {/* Top summary bar */}
          <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs">
                ✓
              </span>
              <div>
                <p className="text-xs font-bold text-white">
                  Đã tìm thấy {highlights.length} đoạn highlight tiềm năng
                </p>
                <p className="text-[11px] text-gray-400">
                  Thời lượng gốc: {formatSec(videoDuration)} · Ngôn ngữ: {detectedLanguage.toUpperCase()}
                </p>
              </div>
            </div>

            <button
              onClick={() => { setStep('upload'); setHighlights([]); setVideoFile(null); }}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} /> Quét video khác
            </button>
          </div>

          {/* Global Short Video Styling Settings */}
          <div className="p-5 rounded-2xl bg-gray-950/70 border border-white/10 space-y-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Sliders size={15} className="text-pink-400" /> Tùy Chỉnh Định Dạng Video Ngắn 9:16
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Subtitle Style */}
              <div>
                <label className="text-[11px] font-semibold text-gray-300 block mb-1.5">
                  Phong cách chữ phụ đề:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SUBTITLE_STYLES.map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSubtitleStyle(st.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        subtitleStyle === st.id
                          ? 'border-pink-500 bg-pink-500/20 text-white shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                          : 'border-white/10 bg-gray-900/60 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className={`block text-xs mb-1 ${st.previewClass}`}>{st.label}</span>
                      <span className="text-[10px] text-gray-400 line-clamp-1">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout toggles */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-gray-300 block">
                  Hiệu ứng khung hình:
                </label>
                <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2.5">
                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Layers size={14} className="text-pink-400" /> Nền mờ nghệ thuật (Blur Background)
                    </span>
                    <input
                      type="checkbox"
                      checked={blurBackground}
                      onChange={(e) => setBlurBackground(e.target.checked)}
                      className="accent-pink-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Scissors size={14} className="text-amber-400" /> Ép phụ đề chữ to vào video
                    </span>
                    <input
                      type="checkbox"
                      checked={burnSub}
                      onChange={(e) => setBurnSub(e.target.checked)}
                      className="accent-pink-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* List of Detected Highlight Clips */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Flame size={18} className="text-amber-400" /> Danh Sách Highlight Được Đạo Diễn AI Chọn Lọc
            </h4>

            {highlights.map((clip) => {
              const isRendering = renderLoadingId === clip.id;
              const durationSec = Math.round(clip.end - clip.start);

              return (
                <div
                  key={clip.id}
                  className="p-5 rounded-3xl bg-gray-900/90 border border-white/10 hover:border-pink-500/50 transition-all shadow-xl space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-black flex items-center gap-1 shadow-md">
                          <Flame size={12} /> {clip.viralityScore || 95}/100 Điểm Viral
                        </span>
                        <span className="text-xs font-mono text-gray-400 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                          ⏱️ {formatSec(clip.start)} - {formatSec(clip.end)} ({durationSec}s)
                        </span>
                      </div>
                      <h5 className="text-base font-extrabold text-white mt-1">
                        {clip.title}
                      </h5>
                      <p className="text-xs text-pink-300 font-medium">
                        💡 Hook: "{clip.hook}"
                      </p>
                    </div>

                    <button
                      onClick={() => handleRenderClip(clip)}
                      disabled={isRendering || renderLoadingId !== null}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center gap-2 cursor-pointer transition-all shrink-0"
                    >
                      {isRendering ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang Render 9:16...</span>
                        </>
                      ) : (
                        <>
                          <Scissors size={14} />
                          <span>Render Clip 9:16 Ngay</span>
                        </>
                      )}
                    </button>
                  </div>

                  {clip.summary && (
                    <p className="text-xs text-gray-400 bg-black/30 p-3 rounded-xl border border-white/5 leading-relaxed">
                      {clip.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 4: PREVIEW & DOWNLOAD RENDERED SHORT ── */}
      {step === 'preview' && renderedClip && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-400" />
              Clip Ngắn 9:16 Đã Hoàn Thành!
            </h4>
            <button
              onClick={() => setStep('highlights')}
              className="glass-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} /> Xem các clip highlight khác
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Phone Screen Mockup Preview */}
            <div className="md:col-span-6 flex justify-center">
              <div className="relative w-[280px] sm:w-[320px] aspect-[9/16] bg-black rounded-[36px] overflow-hidden border-4 border-gray-800 shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
                <video
                  ref={videoPlayerRef}
                  src={renderedClip.viewUrl.startsWith('http') ? renderedClip.viewUrl : `${API}${renderedClip.viewUrl}`}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>
            </div>

            {/* Clip Details & Download Controls */}
            <div className="md:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-gray-900/80 border border-pink-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-pink-500 text-white">
                    9:16 VERTICAL SHORT
                  </span>
                  <span className="text-xs text-amber-400 font-mono font-bold">
                    🔥 {renderedClip.score || 95}/100 Virality
                  </span>
                </div>

                <h4 className="text-lg font-extrabold text-white leading-snug">
                  {renderedClip.title}
                </h4>
                <p className="text-xs text-pink-300 font-medium">
                  {renderedClip.hook}
                </p>
                <p className="text-xs text-gray-400">
                  Thời lượng: {renderedClip.duration.toFixed(1)}s · Sẵn sàng đăng lên TikTok, YouTube Shorts, Reels
                </p>
              </div>

              <a
                href={renderedClip.downloadUrl.startsWith('http') ? renderedClip.downloadUrl : `${API}${renderedClip.downloadUrl}`}
                download={renderedClip.filename}
                className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.35)] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download size={18} />
                Tải Video Ngắn (.MP4) Về Máy
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('highlights')}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-gray-700"
                >
                  <Scissors size={14} /> Render Thêm Đoạn Khác
                </button>
                <button
                  onClick={() => { setStep('upload'); setVideoFile(null); setHighlights([]); }}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-gray-700"
                >
                  <RefreshCw size={14} /> Chọn Video Mới
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
