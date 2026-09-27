import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Volume2, Play, Pause, Download, Sparkles,
  BookOpen, Trash2, Plus, RefreshCw, Check,
  AlertCircle, FileText, CheckCircle2, Sliders,
  HelpCircle, Archive, Mic2, Layers, Tag
} from 'lucide-react';
import ProgressBar from './ProgressBar';

const API = import.meta.env.VITE_API_URL || '';

const DEFAULT_SAMPLE_TEXT = `Xin chào các bạn! [hắng giọng] Chào mừng bạn đến với AI Voice Studio thế hệ mới. [nghỉ 500ms]
Hôm nay, mình rất vui được giới thiệu hệ thống chuyển văn bản thành giọng nói tiếng Việt với chất lượng âm thanh 48kHz chân thực.
Hệ thống tự động phát âm chuẩn các từ viết tắt như KTX, SGK, UBND, TPHCM hay công nghệ AI. [nghỉ 1s]
Thật tuyệt vời đúng không ạ? [cười] Chúc các bạn có những trải nghiệm thật thú vị!`;

export default function AiVoiceStudio() {
  const [text, setText] = useState(DEFAULT_SAMPLE_TEXT);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('Voice 1');
  const [engine, setEngine] = useState(null);
  const [loadingVoices, setLoadingVoices] = useState(false);

  // Filters
  const [regionFilter, setRegionFilter] = useState('all'); // 'all' | 'Bắc' | 'Trung' | 'Nam'
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'male' | 'female'

  // Settings
  const [format, setFormat] = useState('mp3'); // 'mp3' | 'wav'
  const [applyDict, setApplyDict] = useState(true);
  const [smartClean, setSmartClean] = useState(true);

  // Dictionary modal
  const [showDictModal, setShowDictModal] = useState(false);
  const [dictionary, setDictionary] = useState({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [dictSavedMsg, setDictSavedMsg] = useState(false);

  // Generation state
  const [status, setStatus] = useState(null); // 'processing' | 'done' | 'error'
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Audio player state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 1. Tải danh sách giọng và trạng thái động cơ
  useEffect(() => {
    async function initStudio() {
      setLoadingVoices(true);
      try {
        const [voicesRes, statusRes, dictRes] = await Promise.all([
          axios.get(`${API}/api/speech/tts/voices`),
          axios.get(`${API}/api/speech/tts/status`),
          axios.get(`${API}/api/speech/tts/dictionary`)
        ]);

        if (voicesRes.data?.success) {
          setVoices(voicesRes.data.voices || []);
          if (voicesRes.data.voices?.length > 0) {
            setSelectedVoice(voicesRes.data.voices[0].id);
          }
        }
        if (statusRes.data?.success) {
          setEngine(statusRes.data.engine);
        }
        if (dictRes.data?.success) {
          setDictionary(dictRes.data.dictionary || {});
        }
      } catch (err) {
        console.warn('Lỗi khởi tạo AI Voice Studio:', err);
      } finally {
        setLoadingVoices(false);
      }
    }
    initStudio();
  }, []);

  // Lọc giọng theo vùng miền và giới tính
  const filteredVoices = voices.filter(v => {
    if (regionFilter !== 'all' && v.region !== regionFilter) return false;
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    return true;
  });

  // Chèn tag vào vị trí con trỏ
  const insertTag = (tag) => {
    setText(prev => `${prev} ${tag} `);
  };

  // Làm sạch văn bản thông minh (Smart Clean)
  const handleSmartClean = async () => {
    if (!text.trim()) return;
    try {
      const res = await axios.post(`${API}/api/speech/tts/clean-text`, { text });
      if (res.data?.success) {
        setText(res.data.cleaned);
      }
    } catch (_) {}
  };

  // Lưu từ điển phát âm
  const handleSaveDict = async () => {
    try {
      await axios.post(`${API}/api/speech/tts/dictionary`, { dictionary });
      setDictSavedMsg(true);
      setTimeout(() => setDictSavedMsg(false), 2000);
    } catch (err) {
      alert('Lỗi lưu từ điển: ' + err.message);
    }
  };

  const handleAddDictItem = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setDictionary(prev => ({
      ...prev,
      [newKey.trim()]: newVal.trim()
    }));
    setNewKey('');
    setNewVal('');
  };

  const handleDeleteDictItem = (key) => {
    setDictionary(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // 2. Tạo giọng nói AI
  const isBatchMode = /\[P\d+\]/i.test(text);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setStatus('processing');
    setProgress(20);
    setErrorMsg('');
    setResult(null);
    setBatchResult(null);

    const progressTimer = setInterval(() => {
      setProgress(p => (p < 85 ? p + 10 : p));
    }, 400);

    try {
      if (isBatchMode) {
        const res = await axios.post(`${API}/api/speech/tts/batch`, {
          text,
          voiceId: selectedVoice,
          format,
          language: 'vi'
        });
        clearInterval(progressTimer);
        setProgress(100);
        setStatus('done');
        setBatchResult(res.data);
      } else {
        const res = await axios.post(`${API}/api/speech/tts/generate`, {
          text,
          voiceId: selectedVoice,
          format,
          language: 'vi',
          applyDictionary: applyDict,
          smartClean
        });
        clearInterval(progressTimer);
        setProgress(100);
        setStatus('done');
        setResult(res.data);
      }
    } catch (err) {
      clearInterval(progressTimer);
      setStatus('error');
      setProgress(0);
      setErrorMsg(err.response?.data?.error || err.message || 'Lỗi tạo giọng nói AI');
    }
  };

  // Quản lý audio player
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatSec = (s) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Engine Status Banner (VieNeu-TTS & CIT Hybrid) ── */}
      <div className="p-4 rounded-2xl bg-gray-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Volume2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">
                {engine?.name || 'Hệ Thống Giọng Nói AI (VieNeu & CIT Style)'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                engine?.type !== 'edge'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {engine?.type !== 'edge' ? '48kHz Local Neural' : 'Cloud Neural Fast'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Tích hợp 25 giọng đọc tuyển chọn 3 miền Bắc - Trung - Nam, hỗ trợ thẻ cảm xúc [cười], [thở dài] và mốc [P1], [P2].
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDictModal(true)}
          className="glass-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-amber-300 hover:text-amber-200"
        >
          <BookOpen size={14} /> Từ điển phát âm ({Object.keys(dictionary).length})
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/50 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Text Input Area & Action Toolbar ── */}
      <div className="p-6 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-4 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <FileText size={15} className="text-amber-400" /> Văn bản cần chuyển thành giọng nói
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSmartClean}
              title="Xóa khoảng trắng thừa, nối dòng ngắt quãng của PDF nhưng giữ nguyên công thức"
              className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold cursor-pointer transition-colors"
            >
              🧹 Làm sạch văn bản
            </button>
            <button
              type="button"
              onClick={() => setText('')}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-300 border border-gray-700 cursor-pointer transition-colors"
            >
              Xóa hết
            </button>
          </div>
        </div>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập nội dung văn bản tiếng Việt... Bạn có thể chèn các thẻ [cười], [thở dài], [nghỉ 1s] hoặc [P1], [P2] để tách thành từng file riêng."
          className="w-full glass-input text-sm p-4 leading-relaxed font-sans resize-y min-h-[140px]"
        />

        {/* Quick Insert Tags Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
          <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center gap-1">
            <Tag size={12} /> Chèn thẻ nhanh:
          </span>

          <button
            type="button"
            onClick={() => insertTag('[cười]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 cursor-pointer font-medium"
          >
            😄 [cười]
          </button>
          <button
            type="button"
            onClick={() => insertTag('[thở dài]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 cursor-pointer font-medium"
          >
            😮‍💨 [thở dài]
          </button>
          <button
            type="button"
            onClick={() => insertTag('[hắng giọng]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer font-medium"
          >
            🗣️ [hắng giọng]
          </button>

          <span className="text-gray-600">|</span>

          <button
            type="button"
            onClick={() => insertTag('[nghỉ 500ms]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-medium"
          >
            ⏱️ [nghỉ 500ms]
          </button>
          <button
            type="button"
            onClick={() => insertTag('[nghỉ 1s]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-medium"
          >
            ⏱️ [nghỉ 1s]
          </button>
          <button
            type="button"
            onClick={() => insertTag('[nghỉ 2s]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-medium"
          >
            ⏱️ [nghỉ 2s]
          </button>

          <span className="text-gray-600">|</span>

          <button
            type="button"
            onClick={() => insertTag('[P1]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 cursor-pointer font-bold"
          >
            📦 [P1]
          </button>
          <button
            type="button"
            onClick={() => insertTag('[P2]')}
            className="px-2 py-1 text-[11px] rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 cursor-pointer font-bold"
          >
            📦 [P2]
          </button>
        </div>
      </div>

      {/* ── Voice Gallery & Filter Toolbar ── */}
      <div className="p-6 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-5 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Mic2 size={16} className="text-amber-400" /> Chọn Giọng Đọc Tuyển Chọn
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Được phân loại chi tiết theo vùng miền và phong cách phát thanh
            </p>
          </div>

          {/* Region & Gender filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs">
              {['all', 'Bắc', 'Trung', 'Nam'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegionFilter(r)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    regionFilter === r ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'Toàn Quốc' : `Miền ${r}`}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'male', label: 'Nam' },
                { id: 'female', label: 'Nữ' },
              ].map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenderFilter(g.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    genderFilter === g.id ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
          {filteredVoices.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVoice(v.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative group ${
                selectedVoice === v.id
                  ? 'bg-amber-500/20 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'bg-gray-950/70 border-white/5 text-gray-300 hover:border-white/20 hover:bg-gray-900'
              }`}
            >
              {v.featured && (
                <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-400 text-black shadow-sm">
                  ⭐ HOT
                </span>
              )}

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/30">
                  {v.name}
                </span>
                {v.rawName && v.rawName !== v.name && (
                  <span className="font-bold text-xs text-white">
                    {v.rawName}
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-400 border border-white/5 ml-auto mr-12">
                  {v.gender === 'male' ? 'Nam' : 'Nữ'} · {v.region}
                </span>
              </div>

              <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                {v.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5 text-xs text-gray-300">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyDict}
                onChange={(e) => setApplyDict(e.target.checked)}
                className="accent-amber-500 cursor-pointer"
              />
              <span>Áp dụng từ điển phát âm (KTX, SGK...)</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span>Định dạng:</span>
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${format === 'mp3' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}
              >
                MP3
              </button>
              <button
                type="button"
                onClick={() => setFormat('wav')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${format === 'wav' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}
              >
                WAV (48kHz)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-gray-400">
            {isBatchMode ? '📦 Chế độ tạo hàng loạt [P1], [P2] (Xuất file ZIP)' : '⚡ Chế độ đọc đơn lẻ'}
          </div>
        </div>

        {status === 'processing' && (
          <div className="space-y-2">
            <p className="text-xs text-amber-300 font-mono animate-pulse">
              Đang tổng hợp giọng nói AI...
            </p>
            <ProgressBar progress={progress} />
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!text.trim() || status === 'processing'}
          className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          {status === 'processing'
            ? 'Đang Sinh Giọng Đọc...'
            : isBatchMode
            ? '📦 Bắt Đầu Tạo Hàng Loạt & Tải File ZIP'
            : '⚡ Tạo Giọng Nói AI Ngay'}
        </button>
      </div>

      {/* ── Single Audio Result Player ── */}
      {result && status === 'done' && (
        <div className="p-6 rounded-3xl bg-gray-950 border border-green-500/40 space-y-4 shadow-2xl animate-in fade-in">
          <audio
            ref={audioRef}
            src={result.viewUrl.startsWith('http') ? result.viewUrl : `${API}${result.viewUrl}`}
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onEnded={() => setIsPlaying(false)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-sm">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Giọng Đọc Đã Hoàn Tất!</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-black/40 px-2 py-0.5 rounded">
                    Giọng: {result.voiceId}
                  </span>
                </h4>
                <p className="text-xs text-gray-400">Định dạng {result.format?.toUpperCase()} · Sẵn sàng tải về hoặc nhúng vào video</p>
              </div>
            </div>

            <a
              href={result.downloadUrl.startsWith('http') ? result.downloadUrl : `${API}${result.downloadUrl}`}
              download={result.filename}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Download size={14} /> Tải File Âm Thanh
            </a>
          </div>

          {/* Interactive Player Controls */}
          <div className="flex items-center gap-4 bg-gray-900/90 p-3 rounded-2xl border border-gray-800">
            <button
              type="button"
              onClick={togglePlay}
              className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer shrink-0"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                <span>{formatSec(currentTime)}</span>
                <span>{formatSec(duration)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Audio Result View ── */}
      {batchResult && status === 'done' && (
        <div className="p-6 rounded-3xl bg-gray-950 border border-emerald-500/40 space-y-4 shadow-2xl animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                📦
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Đã Tạo Xong {batchResult.totalParts} Đoạn Âm Thanh Hàng Loạt!
                </h4>
                <p className="text-xs text-gray-400">Các mốc [P1], [P2] đã được chia thành các tệp độc lập</p>
              </div>
            </div>

            <a
              href={batchResult.downloadUrl.startsWith('http') ? batchResult.downloadUrl : `${API}${batchResult.downloadUrl}`}
              download={batchResult.zipFilename}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Archive size={16} /> Tải Toàn Bộ Gói ZIP (.zip)
            </a>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {batchResult.parts?.map((part, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400">{part.id}</span>
                <span className="text-gray-400 truncate max-w-[200px] sm:max-w-md">{part.sampleText}</span>
                <a
                  href={`/outputs/${part.filename}`}
                  download={part.filename}
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Download size={12} /> Tải riêng
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pronunciation Dictionary Modal ── */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-gray-950 border border-amber-500/40 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen size={18} className="text-amber-400" />
                Từ Điển Phát Âm Tiếng Việt
              </h3>
              <button
                onClick={() => setShowDictModal(false)}
                className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-gray-800"
              >
                Đóng
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Tự động thay thế từ viết tắt, tên riêng hoặc thuật ngữ khó phát âm trước khi chuyển thành giọng nói.
            </p>

            {/* Add new entry input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Từ viết tắt (VD: KTX)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="flex-1 glass-input text-xs py-2"
              />
              <input
                type="text"
                placeholder="Cách đọc (VD: ký túc xá)"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                className="flex-1 glass-input text-xs py-2"
              />
              <button
                type="button"
                onClick={handleAddDictItem}
                className="px-3 py-2 bg-amber-500 text-black font-bold text-xs rounded-xl hover:bg-amber-400 cursor-pointer"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Dictionary items table */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {Object.entries(dictionary).map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 font-mono">{k}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-gray-200">{v}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDictItem(k)}
                    className="text-gray-500 hover:text-red-400 cursor-pointer p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-xs text-green-400 font-semibold">
                {dictSavedMsg ? '✓ Đã lưu thay đổi từ điển!' : ''}
              </span>
              <button
                type="button"
                onClick={handleSaveDict}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer"
              >
                Lưu Từ Điển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
