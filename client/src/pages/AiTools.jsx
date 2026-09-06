import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { Sparkles, Languages, MessageSquare, PenTool, Copy, Check, Cpu, Zap } from 'lucide-react';

const TABS = [
  { id: 'summarize',   label: 'Tóm Tắt Tài Liệu', icon: Sparkles,      accept: '.pdf' },
  { id: 'translate',   label: 'Dịch Thuật AI',    icon: Languages,     accept: '.pdf' },
  { id: 'chat',        label: 'Chat Với PDF',     icon: MessageSquare, accept: '.pdf' },
  { id: 'handwriting', label: 'Chữ Viết Tay',     icon: PenTool,       accept: '.pdf' },
];

export default function AiTools() {
  const [activeTab, setActiveTab] = useState('summarize');
  const [file, setFile]           = useState(null);
  const [provider, setProvider]   = useState('auto'); // 'auto' | 'gemini-flash' | 'gemini-pro' | 'groq'

  // Summarize options
  const [sumLang, setSumLang]     = useState('vi');
  const [sumLength, setSumLength] = useState('medium');

  // Translate options
  const [targetLang, setTargetLang] = useState('en');

  // Chat options
  const [question, setQuestion]     = useState('');

  // Handwriting options
  const [fontStyle, setFontStyle]   = useState('casual');
  const [fontSize, setFontSize]     = useState(18);

  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [aiText, setAiText]         = useState('');
  const [fileResult, setFileResult] = useState(null);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFile(null);
    setAiText('');
    setFileResult(null);
    setError(null);
    setProgress(0);
    setQuestion('');
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    reset();
  };

  const handleCopy = () => {
    if (!aiText) return;
    navigator.clipboard.writeText(aiText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setAiText('');
    setFileResult(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('provider', provider);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let endpoint = `/api/ai/${activeTab}`;

    if (activeTab === 'summarize') {
      fd.append('language', sumLang);
      fd.append('length', sumLength);
    } else if (activeTab === 'translate') {
      fd.append('targetLang', targetLang);
    } else if (activeTab === 'chat') {
      if (!question.trim()) {
        setError('Vui lòng nhập câu hỏi');
        setLoading(false);
        return;
      }
      fd.append('question', question.trim());
    } else if (activeTab === 'handwriting') {
      fd.append('style', fontStyle);
      fd.append('fontSize', fontSize);
    }

    try {
      setProgress(60);
      const { data } = await axios.post(`${API}${endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setProgress(100);
      if (data.summary) setAiText(data.summary);
      if (data.translated) setAiText(data.translated);
      if (data.answer) setAiText(data.answer);
      if (data.file || data.downloadUrl) setFileResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Xử lý AI thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Document Tools (100% Free AI Models)</h1>
        <p className="text-sm text-gray-400 mt-1">
          Hệ sinh thái AI miễn phí: Google Gemini 1.5 Flash/Pro kết hợp Groq Llama 3.3 70B siêu tốc.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Model Selector Bar */}
        <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
              <Cpu size={14} className="text-blue-400" /> Tùy chọn mô hình AI (Model Selector):
            </span>
            <span className="text-[10px] text-green-400 bg-green-950/60 border border-green-800/40 px-2 py-0.5 rounded-full font-bold">
              100% Free Tier
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setProvider('auto')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex flex-col justify-center ${
                provider === 'auto'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/30'
                  : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <span className="font-bold flex items-center gap-1">⚡ Auto Router</span>
              <span className="text-[10px] opacity-80">Gemini → Groq</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider('gemini-flash')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex flex-col justify-center ${
                provider === 'gemini-flash'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/30'
                  : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <span className="font-bold">🚀 Gemini Flash</span>
              <span className="text-[10px] opacity-80">Siêu nhanh 1M token</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider('gemini-pro')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex flex-col justify-center ${
                provider === 'gemini-pro'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/30'
                  : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <span className="font-bold">🧠 Gemini Pro</span>
              <span className="text-[10px] opacity-80">Tài liệu dài & sâu</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider('groq')}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex flex-col justify-center ${
                provider === 'groq'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border border-purple-400/30'
                  : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <span className="font-bold flex items-center gap-1"><Zap size={12} /> Groq Llama 3.3</span>
              <span className="text-[10px] opacity-80">Free 70B Model</span>
            </button>
          </div>
        </div>

        <FileDropzone
          key={activeTab}
          onFilesSelected={setFile}
          accept={curTab?.accept}
          label={`Tải file PDF cho: ${curTab?.label}`}
        />

        {file && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            {activeTab === 'summarize' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Ngôn ngữ tóm tắt</label>
                  <select
                    value={sumLang}
                    onChange={e => setSumLang(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Độ dài tóm tắt</label>
                  <select
                    value={sumLength}
                    onChange={e => setSumLength(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  >
                    <option value="short">Ngắn gọn (3-5 câu)</option>
                    <option value="medium">Vừa phải (2-3 đoạn)</option>
                    <option value="long">Chi tiết (5-7 đoạn)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'translate' && (
              <div>
                <label className="text-xs text-gray-300">Ngôn ngữ đích</label>
                <select
                  value={targetLang}
                  onChange={e => setTargetLang(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                >
                  <option value="en">Tiếng Anh (English)</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="zh">Tiếng Trung (Chinese)</option>
                  <option value="ja">Tiếng Nhật (Japanese)</option>
                  <option value="ko">Tiếng Hàn (Korean)</option>
                  <option value="fr">Tiếng Pháp (French)</option>
                  <option value="de">Tiếng Đức (German)</option>
                </select>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Nhập câu hỏi về nội dung file PDF</label>
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="VD: Bản hợp đồng này có thời hạn bao lâu? Ai là người đại diện?"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {activeTab === 'handwriting' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Kiểu chữ viết tay</label>
                  <select
                    value={fontStyle}
                    onChange={e => setFontStyle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  >
                    <option value="casual">Caveat (Tự nhiên)</option>
                    <option value="elegant">Dancing Script (Nghệ thuật, uốn lượn)</option>
                    <option value="print">Patrick Hand (Chữ in tay)</option>
                    <option value="childish">Schoolbell (Nét bút trẻ thơ)</option>
                    <option value="messy">Indie Flower (Phóng khoáng)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Cỡ chữ (px)</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50"
            >
              {loading ? 'AI đang xử lý...' : `Thực hiện: ${curTab?.label}`}
            </button>
          </div>
        )}

        {loading && <ProgressBar progress={progress} status="Đang gọi AI Model..." />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {aiText && (
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Sparkles size={14} /> Phản hồi từ AI:
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2.5 py-1 bg-gray-900 border border-gray-800 rounded-lg transition-colors"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap font-sans bg-gray-900/70 p-4 rounded-lg border border-gray-800">
              {aiText}
            </div>
          </div>
        )}

        {fileResult && <ResultDownload result={fileResult} onReset={reset} label="Tải PDF Chữ Viết Tay" />}
      </div>
    </div>
  );
}
