import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Film, Languages, Subtitles, Volume2, Sparkles,
  Play, Pause, RotateCcw, Download, Check, Copy,
  Edit3, Trash2, Plus, Sliders, VolumeX, Eye,
  Loader2, CheckCircle2, AlertCircle, ArrowRight,
  UploadCloud, FileText, CheckCheck, RefreshCw, Undo2
} from 'lucide-react';
import ResultDownload from '../components/ResultDownload';

const API = import.meta.env.VITE_API_URL || '';

const LANGUAGES = [
  { value: 'vi', label: '🇻🇳 Tiếng Việt', locale: 'vi-VN' },
  { value: 'en', label: '🇺🇸 English', locale: 'en-US' },
  { value: 'zh', label: '🇨🇳 Tiếng Trung (Chinese)', locale: 'zh-CN' },
  { value: 'ja', label: '🇯🇵 Tiếng Nhật (Japanese)', locale: 'ja-JP' },
  { value: 'ko', label: '🇰🇷 Tiếng Hàn (Korean)', locale: 'ko-KR' },
  { value: 'fr', label: '🇫🇷 Tiếng Pháp (French)', locale: 'fr-FR' },
  { value: 'de', label: '🇩🇪 Tiếng Đức (German)', locale: 'de-DE' },
  { value: 'es', label: '🇪🇸 Tiếng TBN (Spanish)', locale: 'es-ES' },
  { value: 'ru', label: '🇷🇺 Tiếng Nga (Russian)', locale: 'ru-RU' },
  { value: 'th', label: '🇹🇭 Tiếng Thái (Thai)', locale: 'th-TH' },
];

const SUBTITLE_STYLES = [
  { id: 'tiktok', label: 'TikTok / Shorts', desc: 'Chữ vàng viền đen dày, nổi bật trên Reels/Shorts', previewClass: 'text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-extrabold' },
  { id: 'classic', label: 'YouTube Cổ điển', desc: 'Chữ trắng viền đen thanh lịch, dễ đọc', previewClass: 'text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] font-semibold' },
  { id: 'boxed', label: 'Hộp mờ (Netflix)', desc: 'Chữ trắng trong khung nền tối mờ bán trong suốt', previewClass: 'text-white bg-black/70 px-2 py-0.5 rounded font-medium' },
  { id: 'neon', label: 'Cyber Neon', desc: 'Chữ xanh dạ quang viền đen hiện đại', previewClass: 'text-cyan-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-bold' },
];

export default function VideoTranslate() {
  // Step state: 'upload' | 'transcribing' | 'editor' | 'rendering' | 'result'
  const [step, setStep] = useState('upload');

  // Video & file state
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoFilename, setVideoFilename] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);

  // Configuration
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('vi');
  const [filterSdh, setFilterSdh] = useState(true);
  const [filterHallucinations, setFilterHallucinations] = useState(true);

  // Cues state (VEED-style subtitle timeline)
  const [cues, setCues] = useState([]);
  const [currentCueId, setCurrentCueId] = useState(null);

  // Dubbing & Export Settings (HeyGen-style)
  const [burnSub, setBurnSub] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState('tiktok');
  const [dubbing, setDubbing] = useState(false);
  const [ducking, setDucking] = useState(true);
  const [origVolume, setOrigVolume] = useState(0.15);
  const [muteOriginal, setMuteOriginal] = useState(false);
  const [exportFormat, setExportFormat] = useState('video'); // 'video' | 'srt' | 'vtt'

  // Dynamic Voices state (Loaded dynamically, zero dummy data)
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceRate, setVoiceRate] = useState('0%');

  // UI state
  const [translating, setTranslating] = useState(false);
  const [previewingVoiceCueId, setPreviewingVoiceCueId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [renderedResult, setRenderedResult] = useState(null);

  // Video Player Ref
  const videoRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const cuesContainerRef = useRef(null);

  // 1. Tải danh sách giọng đọc khả dụng khi đổi ngôn ngữ đích
  useEffect(() => {
    let isMounted = true;
    async function fetchVoices() {
      setLoadingVoices(true);
      try {
        const res = await axios.get(`${API}/api/video-translate/voices?lang=${targetLang}`);
        if (isMounted && res.data?.success) {
          const all = [...(res.data.customVoices || []), ...(res.data.systemVoices || [])];
          setAvailableVoices(all);
          if (all.length > 0) {
            setSelectedVoice(all[0].id || all[0].shortName);
          } else {
            setSelectedVoice('');
          }
        }
      } catch (err) {
        console.warn('Lỗi lấy danh sách giọng:', err);
      } finally {
        if (isMounted) setLoadingVoices(false);
      }
    }

    fetchVoices();
    return () => { isMounted = false; };
  }, [targetLang]);

  // Đồng bộ phụ đề hiển thị khi video đang phát
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    const activeCue = cues.find(c => time >= c.start && time <= c.end);
    if (activeCue && activeCue.id !== currentCueId) {
      setCurrentCueId(activeCue.id);
    } else if (!activeCue && currentCueId !== null) {
      setCurrentCueId(null);
    }
  };

  // Chọn file video
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('video') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      setErrorMsg('Vui lòng chọn tệp video hợp lệ (.mp4, .mov, .webm, .mkv)');
      return;
    }

    if (videoPreviewUrl) {
      try { URL.revokeObjectURL(videoPreviewUrl); } catch (_) {}
    }
    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);
    setErrorMsg('');
  };

  // 2. Bắt đầu phân tích & trích xuất phụ đề (Transcribe)
  const handleStartTranscribe = async () => {
    if (!videoFile) {
      setErrorMsg('Vui lòng tải lên một tệp video');
      return;
    }

    setStep('transcribing');
    setProgressMsg('Đang trích xuất âm thanh 16kHz & chạy Whisper nhận diện mốc thời gian...');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('language', sourceLang);
    formData.append('filterSdh', String(filterSdh));
    formData.append('filterHallucinations', String(filterHallucinations));

    try {
      const res = await axios.post(`${API}/api/video-translate/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 phút cho video dung lượng lớn
      });

      if (res.data?.success) {
        setVideoFilename(res.data.videoFilename);
        setVideoDuration(res.data.duration || 0);
        setCues(res.data.cues || []);
        setStep('editor');
      } else {
        throw new Error(res.data?.error || 'Không thể trích xuất phụ đề từ video');
      }
    } catch (err) {
      const msg = err.message === 'Network Error'
        ? 'Lỗi kết nối mạng: Không thể kết nối tới máy chủ backend. Vui lòng kiểm tra server đang chạy tại cổng 3002.'
        : (err.response?.data?.error || err.message || 'Lỗi xử lý video');
      setErrorMsg(msg);
      setStep('upload');
    }
  };

  // 3. Dịch toàn bộ phụ đề sang ngôn ngữ đích
  const handleTranslateAllCues = async () => {
    if (cues.length === 0) return;
    setTranslating(true);
    setErrorMsg('');

    try {
      const res = await axios.post(`${API}/api/video-translate/translate`, {
        cues,
        targetLang,
        sourceLang
      }, { timeout: 120000 });

      if (res.data?.success && Array.isArray(res.data.cues)) {
        setCues(res.data.cues);
      } else {
        throw new Error(res.data?.error || 'Lỗi khi dịch thuật phụ đề');
      }
    } catch (err) {
      const msg = err.message === 'Network Error'
        ? 'Lỗi kết nối mạng: Không thể kết nối tới máy chủ AI dịch thuật.'
        : (err.response?.data?.error || err.message || 'Không thể dịch phụ đề');
      setErrorMsg(msg);
    } finally {
      setTranslating(false);
    }
  };

  // 4. Nghe thử giọng đọc một câu đơn (Preview Voice)
  const handlePreviewVoice = async (cue) => {
    if (!cue.text?.trim()) return;
    setPreviewingVoiceCueId(cue.id);

    try {
      const res = await axios.post(`${API}/api/video-translate/preview-voice`, {
        text: cue.text,
        voiceId: selectedVoice,
        language: targetLang,
        rate: voiceRate
      });

      if (res.data?.audioUrl) {
        if (audioPreviewRef.current) {
          try { audioPreviewRef.current.pause(); } catch (_) {}
        }
        const audio = new Audio(`${API}${res.data.audioUrl}`);
        audioPreviewRef.current = audio;
        audio.play();
        audio.onended = () => setPreviewingVoiceCueId(null);
      }
    } catch (err) {
      alert(`Lỗi nghe thử giọng: ${err.response?.data?.error || err.message}`);
      setPreviewingVoiceCueId(null);
    }
  };

  // Cập nhật nội dung một câu phụ đề
  const handleUpdateCueText = (id, newText) => {
    setCues(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  // Nhảy video đến đúng giây của câu phụ đề
  const handleJumpToTime = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  // Xóa câu phụ đề
  const handleDeleteCue = (id) => {
    setCues(prev => prev.filter(c => c.id !== id));
  };

  // Thêm một câu phụ đề mới sau câu được chọn
  const handleAddCueAfter = (index) => {
    const prevCue = cues[index];
    const newStart = prevCue ? prevCue.end + 0.1 : 0;
    const newEnd = newStart + 2.5;
    const newCue = {
      id: Date.now(),
      start: newStart,
      end: newEnd,
      startTime: `${Math.floor(newStart)}s`,
      endTime: `${Math.floor(newEnd)}s`,
      text: 'Nội dung phụ đề mới'
    };
    const nextCues = [...cues];
    nextCues.splice(index + 1, 0, newCue);
    setCues(nextCues);
  };

  // 5. Xuất bản video thành phẩm (Render)
  const handleRenderFinal = async () => {
    if (cues.length === 0) {
      setErrorMsg('Vui lòng có ít nhất một câu phụ đề để xuất bản');
      return;
    }

    setStep('rendering');
    setProgressMsg(
      dubbing
        ? 'Đang tổng hợp giọng nói Neural AI & dùng FFmpeg Audio Ducking ghép video...'
        : 'Đang dùng FFmpeg ép phụ đề cứng (burn-in) vào video...'
    );
    setErrorMsg('');

    try {
      const payload = {
        videoFilename,
        cues,
        burnSub,
        dubbing,
        subtitleStyle,
        voiceOptions: {
          voiceId: selectedVoice,
          language: targetLang,
          rate: voiceRate
        },
        ducking,
        origVolume,
        muteOriginal,
        exportFormat
      };

      const res = await axios.post(`${API}/api/video-translate/render`, payload);
      if (res.data) {
        setRenderedResult(res.data);
        setStep('result');
      } else {
        throw new Error('Không nhận được file kết quả');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Lỗi xuất video thành phẩm');
      setStep('editor');
    }
  };

  const currentActiveCue = cues.find(c => c.id === currentCueId);
  const activeStyle = SUBTITLE_STYLES.find(s => s.id === subtitleStyle) || SUBTITLE_STYLES[0];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold">
          <Sparkles size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
          <span>VEED.io + HeyGen AI Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Dịch & Lồng Tiếng Video <span className="text-gradient">Đa Ngôn Ngữ</span>
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Tự động trích xuất âm thanh, dịch phụ đề thông minh, biên tập trực quan theo thời gian thực và lồng tiếng AI Neural với kỹ thuật Audio Ducking.
        </p>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* ── BƯỚC 1: TẢI VIDEO LÊN & CẤU HÌNH BAN ĐẦU ── */}
      {step === 'upload' && (
        <div className="max-w-3xl mx-auto glass-card p-6 sm:p-8 space-y-6">
          <div className="border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-amber-500/50 rounded-2xl p-8 text-center transition-all bg-white/50 dark:bg-white/[0.02]">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload-input"
            />
            <label htmlFor="video-upload-input" className="cursor-pointer space-y-4 block">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-500 shadow-inner">
                <UploadCloud size={32} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {videoFile ? videoFile.name : 'Nhấp hoặc kéo thả video vào đây'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Hỗ trợ MP4, MOV, WebM (Tối đa 500MB)</p>
              </div>
            </label>
          </div>

          {videoPreviewUrl && (
            <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/40 aspect-video max-h-72 mx-auto flex items-center justify-center">
              <video src={videoPreviewUrl} controls className="w-full h-full object-contain" />
            </div>
          )}

          {/* Cấu hình ngôn ngữ & thuật toán lọc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Languages size={14} className="text-amber-500" /> Ngôn ngữ nói trong video
              </label>
              <select
                value={sourceLang}
                onChange={e => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="auto">🌐 Tự động nhận diện</option>
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Languages size={14} className="text-amber-500" /> Ngôn ngữ cần dịch sang
              </label>
              <select
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:border-amber-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bộ lọc học từ WhisperSubTranslate */}
          <div className="bg-amber-500/5 dark:bg-amber-500/[0.03] border border-amber-500/20 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Kế thừa thuật toán tối ưu WhisperSubTranslate:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 text-xs text-gray-600 dark:text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterSdh}
                  onChange={e => setFilterSdh(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span>Lọc bỏ thẻ âm thanh [music], [applause], ♪</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterHallucinations}
                  onChange={e => setFilterHallucinations(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span>Triệt tiêu ảo giác lặp từ Whisper khi im lặng</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleStartTranscribe}
            disabled={!videoFile}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <span>Phân Tích & Bóc Tách Phụ Đề</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* ── BƯỚC ĐANG PHÂN TÍCH / RENDER (Loading) ── */}
      {(step === 'transcribing' || step === 'rendering') && (
        <div className="max-w-xl mx-auto glass-card p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-500 shadow-lg">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {step === 'transcribing' ? 'Đang Nhận Diện Lời Thoại Video' : 'Đang Xuất Bản Video Thành Phẩm'}
            </h3>
            <p className="text-xs text-gray-500 animate-pulse">{progressMsg}</p>
          </div>
        </div>
      )}

      {/* ── BƯỚC 2: TRÌNH BIÊN TẬP PHỤ ĐỀ TRỰC QUAN (VEED-Style Editor) ── */}
      {step === 'editor' && (
        <div className="space-y-6">
          {/* Top Bar Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 glass-card rounded-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('upload')}
                className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5"
              >
                <Undo2 size={14} /> <span>Chọn video khác</span>
              </button>
              <span className="text-xs text-gray-500">
                Tìm thấy <b>{cues.length}</b> câu phụ đề
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTranslateAllCues}
                disabled={translating}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                {translating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Dịch Toàn Bộ sang {LANGUAGES.find(l => l.value === targetLang)?.label}</span>
              </button>
            </div>
          </div>

          {/* Main Workspace (Split View) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cột trái: Trình phát video & Preview phụ đề trực tiếp */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black aspect-video flex items-center justify-center shadow-2xl">
                <video
                  ref={videoRef}
                  src={videoPreviewUrl || `${API}/uploads/${videoFilename}`}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                />

                {/* Live Subtitle Overlay on Video Player */}
                {currentActiveCue && burnSub && (
                  <div className="absolute bottom-10 left-4 right-4 pointer-events-none text-center">
                    <span className={`inline-block text-base sm:text-lg transition-all ${activeStyle.previewClass}`}>
                      {currentActiveCue.text}
                    </span>
                  </div>
                )}
              </div>

              {/* Subtitle Styling Controls */}
              <div className="glass-card p-4 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Subtitles size={14} className="text-amber-500" /> Kiểu Phụ Đề (VEED Style)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SUBTITLE_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSubtitleStyle(style.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        subtitleStyle === style.id
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <p className="text-xs font-bold">{style.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 line-clamp-1">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dubbing & Audio Ducking Controls (HeyGen Style) */}
              <div className="glass-card p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Volume2 size={14} className="text-amber-500" /> Lồng Tiếng AI & Audio Ducking (HeyGen Style)
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={dubbing}
                      onChange={e => setDubbing(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500"
                    />
                    <span>Bật lồng tiếng</span>
                  </label>
                </div>

                {dubbing && (
                  <div className="space-y-3 pt-2 text-xs border-t border-black/5 dark:border-white/5">
                    <div>
                      <label className="block text-gray-500 mb-1">
                        Chọn giọng đọc ({availableVoices.length} giọng khả dụng)
                      </label>
                      <select
                        value={selectedVoice}
                        onChange={e => setSelectedVoice(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:border-amber-500"
                      >
                        {availableVoices.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.gender})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ducking}
                          onChange={e => setDucking(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span>Audio Ducking (Hạ 85% tiếng gốc khi đọc)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={muteOriginal}
                          onChange={e => setMuteOriginal(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span>Tắt hẳn âm gốc</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: Danh sách thẻ phụ đề tương tác (Interactive Subtitle Timeline) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="glass-card p-4 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Danh Sách Đoạn Phụ Đề
                </span>
                <span className="text-[11px] text-gray-400">
                  Nhấp vào câu để tua video đến mốc thời gian đó
                </span>
              </div>

              <div
                ref={cuesContainerRef}
                className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1"
              >
                {cues.map((cue, idx) => {
                  const isActive = cue.id === currentCueId;
                  const isPreviewing = cue.id === previewingVoiceCueId;

                  return (
                    <div
                      key={cue.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'border-amber-500/70 bg-amber-500/10 shadow-md shadow-amber-500/10'
                          : 'border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                        <button
                          onClick={() => handleJumpToTime(cue.start)}
                          className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          <Play size={11} />
                          <span>{cue.startTime || `${cue.start.toFixed(1)}s`} - {cue.endTime || `${cue.end.toFixed(1)}s`}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handlePreviewVoice(cue)}
                            disabled={isPreviewing}
                            title="Nghe thử giọng câu này"
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 cursor-pointer"
                          >
                            {isPreviewing ? <Loader2 size={12} className="animate-spin text-amber-500" /> : <Volume2 size={12} />}
                          </button>
                          <button
                            onClick={() => handleAddCueAfter(idx)}
                            title="Thêm câu phụ đề phía sau"
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCue(cue.id)}
                            title="Xóa câu này"
                            className="p-1 rounded hover:bg-red-500/10 text-red-500 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={cue.text || ''}
                        onChange={e => handleUpdateCueText(cue.id, e.target.value)}
                        rows={2}
                        className="w-full p-2 rounded-lg text-xs border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white resize-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Action Button: Xuất bản video */}
              <div className="glass-card p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Định dạng xuất:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExportFormat('video')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        exportFormat === 'video' ? 'bg-amber-500 text-black' : 'bg-black/5 dark:bg-white/5 text-gray-500'
                      }`}
                    >
                      Video MP4
                    </button>
                    <button
                      onClick={() => setExportFormat('srt')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        exportFormat === 'srt' ? 'bg-amber-500 text-black' : 'bg-black/5 dark:bg-white/5 text-gray-500'
                      }`}
                    >
                      File .SRT
                    </button>
                    <button
                      onClick={() => setExportFormat('vtt')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        exportFormat === 'vtt' ? 'bg-amber-500 text-black' : 'bg-black/5 dark:bg-white/5 text-gray-500'
                      }`}
                    >
                      File .VTT
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleRenderFinal}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  <Sparkles size={18} />
                  <span>XUẤT BẢN THÀNH PHẨM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BƯỚC 3: KẾT QUẢ & TẢI VỀ (Result) ── */}
      {step === 'result' && renderedResult && (
        <div className="max-w-2xl mx-auto glass-card p-8 text-center space-y-6 animate-scale-up">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-500 shadow-inner">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Xuất Bản Thành Công!</h3>
            <p className="text-xs text-gray-500">File thành phẩm đã được xử lý và sẵn sàng tải về.</p>
          </div>

          {renderedResult.downloadUrl && (
            <div className="pt-2">
              <ResultDownload
                result={renderedResult}
                onReset={() => {
                  setStep('upload');
                  setVideoFile(null);
                  setVideoPreviewUrl('');
                  setCues([]);
                  setRenderedResult(null);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
