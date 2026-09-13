import { useState, useRef, useEffect, useCallback } from 'react';
import ResultDownload from '../components/ResultDownload';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Square, Upload, Languages,
  Copy, Download, FileText, Captions,
  Loader2, AlertCircle, CheckCircle2,
  Sparkles, Volume2, Settings, RefreshCw,
  Trash2, Radio, Check, Info, FileAudio
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

// ── Supported languages ───────────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'vi',   label: '🇻🇳 Tiếng Việt',    webCode: 'vi-VN' },
  { value: 'en',   label: '🇺🇸 English',         webCode: 'en-US' },
  { value: 'zh',   label: '🇨🇳 Tiếng Trung',    webCode: 'zh-CN' },
  { value: 'ja',   label: '🇯🇵 Tiếng Nhật',     webCode: 'ja-JP' },
  { value: 'ko',   label: '🇰🇷 Tiếng Hàn',      webCode: 'ko-KR' },
  { value: 'fr',   label: '🇫🇷 Tiếng Pháp',     webCode: 'fr-FR' },
  { value: 'de',   label: '🇩🇪 Tiếng Đức',      webCode: 'de-DE' },
  { value: 'auto', label: '🌐 Tự động nhận diện', webCode: 'vi-VN' },
];

const hasSpeechAPI = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export default function SpeechToText() {
  const navigate = useNavigate();

  // Tab & config state
  const [tab, setTab] = useState('record'); // 'record' | 'upload'
  const [language, setLanguage] = useState('vi');
  const [provider, setProvider] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const recogRef = useRef(null);
  const timerRef = useRef(null);

  // Upload state
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); // 'processing' | 'done' | 'error'
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [apiResult, setApiResult] = useState(null);

  // Output text state
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  // Recording timer
  useEffect(() => {
    if (recording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Web Speech API Handler ──────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!hasSpeechAPI) return;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      const langObj = LANGUAGES.find(l => l.value === language);
      recognition.lang = langObj?.webCode || 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += trans + ' ';
          } else {
            interimText += trans;
          }
        }

        if (finalText) {
          setTranscript(prev => {
            const next = prev + finalText;
            setOutput(next);
            return next;
          });
        }
        setInterim(interimText);
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          alert('Vui lòng cấp quyền truy cập Microphone trong trình duyệt để ghi âm.');
        }
        setRecording(false);
      };

      recognition.onend = () => {
        if (recogRef.current && recording) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      recogRef.current = recognition;
      setRecording(true);
      setInterim('');
    } catch (err) {
      console.error('Lỗi khởi động Web Speech API:', err);
    }
  }, [language, recording]);

  const stopRecording = useCallback(() => {
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
    }
    setRecording(false);
    setInterim('');
  }, []);

  useEffect(() => () => {
    if (recogRef.current) {
      recogRef.current.stop();
    }
  }, []);

  // ── Upload & Transcribe Handler ─────────────────────────────────────────────
  const handleUpload = async (outputFormat = 'text') => {
    if (!file) return;
    setStatus('processing');
    setProgress(25);
    setResult(null);
    setApiResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('language', language);
    fd.append('provider', provider);
    fd.append('outputFormat', outputFormat);
    fd.append('withTimestamps', outputFormat === 'srt' ? 'true' : 'false');

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const progressInterval = setInterval(() => {
        setProgress(p => (p < 85 ? p + 10 : p));
      }, 500);

      const { data } = await axios.post(`${API}/api/speech/transcribe`, fd, {
        headers,
        withCredentials: true,
        timeout: 180000,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setStatus('done');

      if (outputFormat === 'text') {
        setApiResult(data);
        setOutput(data.text);
      } else {
        setResult(data);
      }
    } catch (err) {
      setStatus('error');
      setProgress(0);
      setApiResult({ error: err.response?.data?.error || 'Lỗi xử lý chuyển đổi âm thanh sang văn bản' });
    }
  };

  // ── Export Handlers ─────────────────────────────────────────────────────────
  const copyText = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!output) return;
    setStatus('processing');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API}/api/speech/export-pdf`, { text: output, language }, {
        headers,
        withCredentials: true,
      });
      setResult(data);
      setStatus('done');
    } catch (err) {
      setStatus('error');
    }
  };

  const exportSrt = async () => {
    if (!output) return;
    setStatus('processing');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API}/api/speech/export-srt`, { text: output }, {
        headers,
        withCredentials: true,
      });
      setResult(data);
      setStatus('done');
    } catch (err) {
      setStatus('error');
    }
  };

  const sendToAI = (tool) => {
    if (!output) return;
    sessionStorage.setItem('ai_prefill_text', output);
    navigate(`/ai?tool=${tool}`);
  };

  const clearAll = () => {
    setTranscript('');
    setInterim('');
    setOutput('');
    setApiResult(null);
    setResult(null);
    setStatus(null);
    setFile(null);
  };

  const wordCount = output.split(/\s+/).filter(Boolean).length;
  const charCount = output.length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Mic size={13} /> Voice & Audio AI
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Chuyển Giọng Nói Thành Văn Bản (Speech to Text)
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Ghi âm trực tiếp bằng giọng nói hoặc tải lên tệp âm thanh/video để AI trích xuất nội dung thành văn bản, PDF hoặc phụ đề SRT.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(s => !s)}
          className={`self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            showSettings
              ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/40'
              : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Settings size={15} />
          <span>Cấu hình AI</span>
        </button>
      </div>

      {/* Settings Modal / Panel */}
      {showSettings && (
        <div className="bg-gray-950/90 border border-rose-900/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl backdrop-blur-md">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2.5">
              Ngôn ngữ nhận dạng
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLanguage(l.value)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                    language === l.value
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md'
                      : 'bg-gray-900/90 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2.5">
              Mô hình AI xử lý (Audio / Video File)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'auto', name: '⚡ Tự Động (Khuyên dùng)', desc: 'Tự chọn mô hình tối ưu tốc độ và độ chính xác' },
                { id: 'groq', name: '🚀 Whisper v3 (Siêu tốc)', desc: 'Mô hình Whisper Large v3 tốc độ cao' },
                { id: 'gemini', name: '🌐 Google Gemini 1.5', desc: 'Đa phương thức nhận diện ngữ cảnh phong phú' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`p-3 rounded-xl text-xs text-left border transition-all cursor-pointer ${
                    provider === p.id
                      ? 'bg-rose-500/20 border-rose-500 text-white shadow-md'
                      : 'bg-gray-900/90 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <div className="font-bold text-white">{p.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-1.5 bg-gray-950/80 border border-gray-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setTab('record')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            tab === 'record'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-950/50'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Mic size={16} />
          <span>Ghi Âm Trực Tiếp</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            tab === 'upload'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-950/50'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Upload size={16} />
          <span>Tải Lên Tệp Âm Thanh / Video</span>
        </button>
      </div>

      {/* Tab 1: Live Voice Recording */}
      {tab === 'record' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm">
          {!hasSpeechAPI ? (
            <div className="flex items-center gap-3 bg-yellow-950/40 border border-yellow-800/60 rounded-2xl p-4 text-xs text-yellow-300">
              <AlertCircle size={20} className="shrink-0 text-yellow-400" />
              <div>
                <span className="font-bold">Trình duyệt không hỗ trợ Web Speech API:</span> Vui lòng sử dụng Google Chrome, Microsoft Edge hoặc Safari để ghi âm trực tiếp.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-5">
              {/* Big pulsating record button */}
              <div className="relative">
                {recording && (
                  <>
                    <span className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping" />
                    <span className="absolute -inset-6 rounded-full bg-rose-500/10 animate-pulse" />
                  </>
                )}
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center text-white font-bold transition-all shadow-2xl cursor-pointer ${
                    recording
                      ? 'bg-red-600 hover:bg-red-500 scale-105 shadow-red-900/60'
                      : 'bg-gradient-to-tr from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-rose-900/50 hover:scale-105'
                  }`}
                >
                  {recording ? (
                    <>
                      <Square size={32} className="fill-current" />
                      <span className="text-[11px] font-mono mt-1">{formatTime(recordingSeconds)}</span>
                    </>
                  ) : (
                    <>
                      <Mic size={36} />
                      <span className="text-[10px] uppercase font-semibold mt-1">Ghi âm</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">
                  {recording ? (
                    <span className="flex items-center justify-center gap-2 text-rose-400">
                      <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-ping" />
                      Đang lắng nghe giọng nói của bạn...
                    </span>
                  ) : (
                    'Nhấn vào nút tròn để bắt đầu nói'
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Ngôn ngữ hiện tại: <span className="text-gray-200 font-semibold">{LANGUAGES.find(l => l.value === language)?.label}</span>
                </p>
              </div>

              {/* Interim Real-time speech stream */}
              {interim && (
                <div className="w-full max-w-xl bg-gray-950/80 border border-rose-900/30 rounded-2xl p-4 text-left">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">
                    Đang nhận diện trực tiếp:
                  </p>
                  <p className="text-xs text-gray-300 italic animate-pulse">
                    "{interim}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Audio / Video File Upload */}
      {tab === 'upload' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm">
          {!file ? (
            <div
              onClick={() => document.getElementById('audio-file-input').click()}
              className="border-2 border-dashed border-gray-700 hover:border-rose-500/60 rounded-3xl p-10 text-center cursor-pointer transition-all bg-gray-950/40 hover:bg-rose-950/10 space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <FileAudio size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Kéo thả hoặc nhấp để chọn tệp âm thanh / video
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Hỗ trợ định dạng MP3, WAV, OGG, M4A, FLAC, AAC, WEBM, MP4, MOV (Tối đa 500MB)
                </p>
              </div>
              <input
                id="audio-file-input"
                type="file"
                className="hidden"
                accept="audio/*,video/mp4,video/webm,video/quicktime,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.mp4,.mov"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setApiResult(null);
                    setResult(null);
                    setStatus(null);
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Card */}
              <div className="flex items-center justify-between p-4 bg-gray-950/80 border border-gray-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-mono text-xs font-bold uppercase">
                    {file.name.split('.').pop()}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {!status && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setResult(null); setApiResult(null); }}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              {!status && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleUpload('text')}
                    className="py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText size={15} />
                    <span>Trích Xuất Văn Bản</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpload('pdf')}
                    className="py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700/60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={15} />
                    <span>Xuất Thẳng Ra PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpload('srt')}
                    className="py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700/60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Captions size={15} />
                    <span>Tạo Phụ Đề SRT</span>
                  </button>
                </div>
              )}

              {/* Progress */}
              {status === 'processing' && (
                <div className="p-5 bg-gray-950 border border-rose-800/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-rose-400" />
                      <span className="font-semibold text-rose-300">
                        AI đang phân tích và chuyển đổi âm thanh...
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {apiResult?.error && (
                <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-3">
                  <AlertCircle size={18} className="shrink-0 text-red-400" />
                  <span>{apiResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Output Display Panel (Shared for both Record & Upload) */}
      {output && (
        <div className="bg-gray-950/90 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between px-5 py-4 border-b border-gray-800/80 bg-gray-900/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-400" />
              <span className="text-xs sm:text-sm font-bold text-white">Kết Quả Văn Bản</span>
              <span className="text-xs text-gray-400 font-mono">
                • {wordCount} từ ({charCount} ký tự)
              </span>
              {apiResult?.provider && (
                <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/50 px-2 py-0.5 rounded-full ml-1">
                  {apiResult.provider}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Xóa kết quả
            </button>
          </div>

          {/* Transcript Content Box */}
          <div className="p-5 max-h-80 overflow-y-auto">
            <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed selection:bg-rose-500 selection:text-white font-sans">
              {output}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="p-4 border-t border-gray-800/80 bg-gray-900/30 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyText}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                onClick={downloadTxt}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                <Download size={14} />
                <span>Tải .TXT</span>
              </button>

              <button
                type="button"
                onClick={exportPdf}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                <FileText size={14} />
                <span>Xuất PDF</span>
              </button>

              <button
                type="button"
                onClick={exportSrt}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 cursor-pointer"
              >
                <Captions size={14} />
                <span>Xuất SRT</span>
              </button>
            </div>

            {/* AI Assistant Forward Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => sendToAI('summarize')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800 text-purple-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-purple-700/60 cursor-pointer shadow-sm"
              >
                <Sparkles size={14} className="text-purple-400" />
                <span>AI Tóm Tắt</span>
              </button>

              <button
                type="button"
                onClick={() => sendToAI('translate')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-900/60 hover:bg-blue-800 text-blue-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-700/60 cursor-pointer shadow-sm"
              >
                <Languages size={14} className="text-blue-400" />
                <span>AI Dịch Thuật</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Download Component for exported PDF/SRT */}
      {result && status === 'done' && (
        <ResultDownload
          result={result}
          onReset={() => { setResult(null); setStatus(null); }}
          label="Tải xuống tệp đã xuất"
        />
      )}
    </div>
  );
}
