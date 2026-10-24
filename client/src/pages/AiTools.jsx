import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import {
  Sparkles, Languages, MessageSquare, PenTool, Copy, Check,
  Cpu, Zap, ShieldCheck, Key, GitCompare, ArrowRight, AlertCircle, RefreshCw
} from 'lucide-react';

const TABS = [
  { id: 'summarize',   label: 'Tóm Tắt Tài Liệu', icon: Sparkles,      accept: '.pdf' },
  { id: 'translate',   label: 'Dịch Thuật AI',    icon: Languages,     accept: '.pdf' },
  { id: 'chat',        label: 'Chat Với PDF',     icon: MessageSquare, accept: '.pdf' },
  { id: 'diff-edit',   label: 'Hiệu Đính & Diff', icon: GitCompare,    accept: null },
  { id: 'handwriting', label: 'Chữ Viết Tay',     icon: PenTool,       accept: '.pdf' },
  { id: 'byok',        label: 'Khóa Cá Nhân BYOK', icon: Key,          accept: null },
];

export default function AiTools() {
  const [activeTab, setActiveTab] = useState('summarize');
  const [file, setFile]           = useState(null);
  const [provider, setProvider]   = useState('auto');
  const [aiConsent, setAiConsent] = useState(true);

  // Summarize options
  const [sumLang, setSumLang]     = useState('vi');
  const [sumLength, setSumLength] = useState('medium');

  // Translate options
  const [targetLang, setTargetLang] = useState('en');

  // Chat options
  const [question, setQuestion]     = useState('');

  // Diff edit options
  const [origText, setOrigText]     = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [diffResult, setDiffResult] = useState(null);

  // BYOK options
  const [byokProvider, setByokProvider] = useState('gemini');
  const [byokKey, setByokKey]           = useState('');
  const [userKeys, setUserKeys]         = useState([]);
  const [vaultConfigured, setVaultConfigured] = useState(true);

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

  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const loadByokKeys = async () => {
    try {
      const res = await fetch(`${API}/api/ai/byok`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setVaultConfigured(data.vaultConfigured !== false);
        setUserKeys(data.keys || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'byok' && token) {
      loadByokKeys();
    }
  }, [activeTab, token]);

  const reset = () => {
    setFile(null);
    setAiText('');
    setFileResult(null);
    setError(null);
    setProgress(0);
    setQuestion('');
    setDiffResult(null);
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

  const handleSaveByok = async (e) => {
    e.preventDefault();
    if (!byokKey.trim()) return;
    try {
      const res = await fetch(`${API}/api/ai/byok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ provider: byokProvider, apiKey: byokKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu khóa thất bại');
      setByokKey('');
      loadByokKeys();
      alert(`Đã lưu khóa ${data.provider} an toàn với mã hóa AES-256-GCM`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteByok = async (p) => {
    if (!confirm(`Xóa khóa ${p}?`)) return;
    try {
      await fetch(`${API}/api/ai/byok/${p}`, { method: 'DELETE', headers: authHeader });
      loadByokKeys();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDiffEditSubmit = async (e) => {
    e.preventDefault();
    if (!origText.trim()) return;
    setLoading(true);
    setError(null);
    setDiffResult(null);

    try {
      const res = await fetch(`${API}/api/ai/edit-diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          originalText: origText,
          instructions: editInstructions,
          provider,
          aiConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hiệu đính thất bại');
      setDiffResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file && activeTab !== 'diff-edit' && activeTab !== 'byok') return;
    setLoading(true);
    setError(null);
    setAiText('');
    setFileResult(null);
    setProgress(30);

    const fd = new FormData();
    if (file) fd.append('file', file);
    fd.append('provider', provider);
    fd.append('aiConsent', String(aiConsent));

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
        headers: { 'Content-Type': 'multipart/form-data', ...authHeader },
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
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Sparkles className="text-purple-400" size={26} /> AI Document & Language Studio
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Hệ thống AI xử lý tài liệu đa mô hình, kháng chèn lệnh (Prompt Injection Proof) và hỗ trợ tự mang khóa cá nhân (BYOK).
        </p>
      </div>

      {/* AI Privacy & Consent Notice */}
      <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="text-purple-400 shrink-0" size={20} />
          <span>
            <strong className="text-white">Quyền Riêng Tư & An Toàn AI:</strong> Dữ liệu chỉ dùng để sinh phản hồi cho yêu cầu hiện tại, không lưu trữ huấn luyện mô hình.
          </span>
        </div>
        <label className="flex items-center gap-2 font-medium cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => setAiConsent(e.target.checked)}
            className="rounded bg-gray-950 border-gray-700 text-purple-600 focus:ring-0 cursor-pointer"
          />
          <span className="text-purple-300 font-semibold">Đồng ý xử lý AI (Consent Granted)</span>
        </label>
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

      {/* BYOK Management View */}
      {activeTab === 'byok' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="text-cyan-400" size={18} /> Quản Lý Khóa Cá Nhân (Bring Your Own Key - BYOK)
            </h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Khóa API của bạn được mã hóa phong bì (Envelope Encryption) bằng <strong>AES-256-GCM</strong>. Khóa thô không bao giờ được trả về qua API hay lưu vào log máy chủ.
            </p>
          </div>

          {!vaultConfigured ? (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <span>Hệ thống kho khóa chưa được cấu hình biến môi trường an toàn trên máy chủ. BYOK đang tạm tắt để bảo vệ người dùng.</span>
            </div>
          ) : (
            <form onSubmit={handleSaveByok} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Nhà cung cấp</label>
                  <select
                    value={byokProvider}
                    onChange={(e) => setByokProvider(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white mt-1"
                  >
                    <option value="gemini">Google Gemini AI</option>
                    <option value="groq">Groq Cloud LPU</option>
                    <option value="cerebras">Cerebras LPU</option>
                    <option value="openrouter">OpenRouter AI</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="github">GitHub Models</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Khóa API cá nhân</label>
                  <input
                    type="password"
                    placeholder="AIza... hoặc gsk_..."
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white mt-1"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Mã Hóa & Lưu Khóa
              </button>
            </form>
          )}

          {/* User's Configured Keys */}
          {userKeys.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Khóa Đã Cấu Hình (Masked Only)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {userKeys.map(k => (
                  <div key={k.provider} className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white capitalize">{k.provider}</p>
                      <p className="text-[11px] font-mono text-cyan-400 mt-0.5">{k.keyMasked}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteByok(k.provider)}
                      className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/50 rounded-lg transition-colors border border-red-900/40"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Diff Edit View */}
      {activeTab === 'diff-edit' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GitCompare className="text-purple-400" size={18} /> Hiệu Đính AI & So Sánh Khác Biệt (Structured Diff)
            </h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Mọi thay đổi từ AI đều hiển thị trực quan dưới dạng Diff dòng-theo-dòng, yêu cầu người dùng xác nhận rõ ràng trước khi áp dụng vào tài liệu.
            </p>
          </div>

          <form onSubmit={handleDiffEditSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-300">Văn bản gốc cần hiệu đính</label>
              <textarea
                rows={4}
                value={origText}
                onChange={(e) => setOrigText(e.target.value)}
                placeholder="Dán đoạn văn bản hoặc nội dung trích xuất từ PDF cần sửa lỗi/nâng cấp..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white mt-1 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-300">Yêu cầu chỉnh sửa</label>
              <input
                type="text"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="VD: Sửa lỗi ngữ pháp tiếng Việt, văn phong trang trọng cho hợp đồng thương mại"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white mt-1 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !origText.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
            >
              {loading ? 'Đang phân tích...' : 'So Sánh Thay Đổi (Generate Diff)'}
            </button>
          </form>

          {diffResult && (
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Bảng So Sánh Thay Đổi Dòng-Theo-Dòng
                </h3>
                <span className="text-xs text-purple-400 font-mono">
                  {diffResult.hasChanges ? 'Có phát hiện sửa đổi' : 'Không có thay đổi'}
                </span>
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 font-mono text-xs overflow-x-auto space-y-1">
                {diffResult.diff.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-0.5">
                    <span className="text-gray-600 select-none w-6 text-right shrink-0">{item.line}</span>
                    {item.type === 'unchanged' && (
                      <span className="text-gray-400">{item.text}</span>
                    )}
                    {item.type === 'modified' && (
                      <div className="space-y-0.5">
                        <div className="text-red-400 bg-red-950/40 px-1 rounded">- {item.original}</div>
                        <div className="text-emerald-400 bg-emerald-950/40 px-1 rounded">+ {item.modified}</div>
                      </div>
                    )}
                    {item.type === 'added' && (
                      <span className="text-emerald-400 bg-emerald-950/40 px-1 rounded">+ {item.text}</span>
                    )}
                    {item.type === 'removed' && (
                      <span className="text-red-400 bg-red-950/40 px-1 rounded">- {item.text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Document AI View */}
      {activeTab !== 'byok' && activeTab !== 'diff-edit' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Model Selector Bar */}
          <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                <Cpu size={14} className="text-blue-400" /> Tùy chọn mô hình AI (Model Selector):
              </span>
              <span className="text-[10px] text-green-400 bg-green-950/60 border border-green-800/40 px-2 py-0.5 rounded-full font-bold">
                Multi-Model Circuit Breaker Active
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
                <span className="font-bold flex items-center gap-1">⚡ Auto Failover</span>
                <span className="text-[10px] opacity-80">Gemini → Cerebras → Groq</span>
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
                <span className="font-bold">🚀 Gemini 2.0 Flash</span>
                <span className="text-[10px] opacity-80">1M Context Window</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('cerebras')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-left flex flex-col justify-center ${
                  provider === 'cerebras'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/30'
                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
                }`}
              >
                <span className="font-bold">⚡ Cerebras LPU</span>
                <span className="text-[10px] opacity-80">Siêu tốc 2000 t/s</span>
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
                <span className="text-[10px] opacity-80">Open 70B Model</span>
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
                    placeholder="VD: Hợp đồng có điều khoản bồi thường thiệt hại không? Nằm ở trang nào?"
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
                      min={12}
                      max={48}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !aiConsent}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg"
              >
                {loading ? 'Đang phân tích & neo trang...' : 'Thực Thi Tác Vụ AI'}
              </button>
            </div>
          )}

          {loading && <ProgressBar progress={progress} label="AI đang xử lý tài liệu an toàn..." />}
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          {aiText && (
            <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Kết quả phân tích:</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded-lg transition-colors"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <div className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {aiText}
              </div>
            </div>
          )}

          {fileResult && (
            <ResultDownload
              downloadUrl={fileResult.downloadUrl || `${API}/outputs/${fileResult.filename}`}
              filename={fileResult.filename || 'result.pdf'}
              fileSize={fileResult.size}
            />
          )}
        </div>
      )}
    </div>
  );
}
