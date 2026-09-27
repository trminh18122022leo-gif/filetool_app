import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ResultDownload from '../components/ResultDownload';
import {
  ShieldAlert, ShieldCheck, Upload, FileText, Check,
  AlertCircle, Loader2, Sparkles, Plus, Trash2, CheckCircle2,
  Lock, EyeOff, Layers, ArrowLeft
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfRedactTool() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [tempFilePath, setTempFilePath] = useState(null);
  const [customKeywords, setCustomKeywords] = useState('');
  
  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Redaction options
  const [fillColor, setFillColor] = useState('black'); // 'black' | 'white' | 'gray'
  const [stampLabel, setStampLabel] = useState('[ĐÃ CHE]');
  const [flatten, setFlatten] = useState(true);
  
  // Processing state
  const [redacting, setRedacting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 1. Quét tài liệu PDF
  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (customKeywords.trim()) {
      const kwList = customKeywords.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      formData.append('customKeywords', JSON.stringify(kwList));
    }

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await axios.post(`${API}/api/pdf/redact-scan`, formData, {
        headers,
        withCredentials: true,
      });

      setScanResult(res.data);
      setTempFilePath(res.data.tempFilePath);
      // Mặc định chọn tất cả mục tìm thấy
      const allIds = new Set((res.data.findings || []).map(f => f.id));
      setSelectedIds(allIds);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi quét thông tin nhạy cảm');
    } finally {
      setScanning(false);
    }
  };

  // Toggle selection
  const toggleItem = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!scanResult?.findings) return;
    if (selectedIds.size === scanResult.findings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scanResult.findings.map(f => f.id)));
    }
  };

  // 2. Thực hiện che vĩnh viễn
  const handleRedact = async () => {
    if (!file && !tempFilePath) return;
    if (selectedIds.size === 0) {
      setError('Vui lòng chọn ít nhất một mục thông tin để che giấu');
      return;
    }

    setRedacting(true);
    setError(null);

    const chosenFindings = (scanResult?.findings || []).filter(f => selectedIds.has(f.id));

    const formData = new FormData();
    if (tempFilePath) {
      formData.append('tempFilePath', tempFilePath);
    } else {
      formData.append('file', file);
    }
    formData.append('redactions', JSON.stringify(chosenFindings));
    formData.append('fillColor', fillColor);
    formData.append('stampLabel', stampLabel);
    formData.append('flatten', String(flatten));

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await axios.post(`${API}/api/pdf/redact`, formData, {
        headers,
        withCredentials: true,
      });

      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi che giấu thông tin');
    } finally {
      setRedacting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setTempFilePath(null);
    setScanResult(null);
    setSelectedIds(new Set());
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/pdf')}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Quay lại PDF Tools</span>
        </button>
        <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
          PII Data Privacy
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <ShieldAlert size={22} />
            </span>
            <span>AI Privacy Redactor</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl">
            Tự động phát hiện CCCD, CMND, Số điện thoại, Email, Thẻ tín dụng trong hợp đồng/tài liệu và che mờ vĩnh viễn không thể phục hồi.
          </p>
        </div>
      </div>

      {/* Upload Box */}
      {!file ? (
        <div
          onClick={() => document.getElementById('redact-pdf-input').click()}
          className="border-2 border-dashed border-gray-700 hover:border-rose-500/60 rounded-3xl p-12 text-center cursor-pointer transition-all bg-gray-950/40 hover:bg-rose-950/10 space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Upload size={32} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              Kéo thả hoặc nhấp để chọn file PDF / Hợp đồng cần bảo mật
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Hỗ trợ định dạng PDF tài liệu, hợp đồng kinh tế, hồ sơ nhân sự (Tối đa 100MB)
            </p>
          </div>
          <input
            id="redact-pdf-input"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setScanResult(null);
                setResult(null);
                setError(null);
              }
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="flex items-center justify-between p-4 bg-gray-950/80 border border-gray-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
                PDF
              </div>
              <div>
                <p className="text-sm font-semibold text-white truncate max-w-sm sm:max-w-md">
                  {file.name}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Step 1: Scan config */}
          {!scanResult && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Từ khóa tùy chỉnh cần che thêm (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A, 100.000.000, Mã dự án X (phân tách bằng dấu phẩy)..."
                  value={customKeywords}
                  onChange={e => setCustomKeywords(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
                <p className="text-[11px] text-gray-500">
                  Hệ thống sẽ luôn tự động quét: CCCD (12 số), CMND (9 số), Số điện thoại Việt Nam, Email và Thẻ ngân hàng.
                </p>
              </div>

              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang phân tích cấu trúc PDF và quét dữ liệu PII...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Quét Thông Tin Nhạy Cảm Ngay</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Findings checklist & Redaction Options */}
          {scanResult && !result && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={18} className="text-rose-400" />
                    <span>Kết Quả Phát Hiện: {scanResult.totalFindings} mục</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Chọn các thông tin bạn muốn che giấu vĩnh viễn trong tài liệu.
                  </p>
                </div>

                {scanResult.totalFindings > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    {selectedIds.size === scanResult.findings.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {/* Items List */}
              {scanResult.totalFindings === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 bg-gray-950/60 rounded-2xl border border-gray-800">
                  Không tìm thấy thông tin nhạy cảm theo tiêu chuẩn mặc định. Bạn có thể nhập từ khóa tùy chỉnh ở bước trên nếu muốn che theo tên riêng.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {scanResult.findings.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-950/30 border-rose-500/50 text-white'
                            : 'bg-gray-950/60 border-gray-800/80 text-gray-400 hover:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isSelected ? 'bg-rose-600 border-rose-500 text-white' : 'border-gray-700 bg-gray-900'
                          }`}>
                            {isSelected && <Check size={13} />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white">
                                {item.text}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                                Trang {item.page}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400">{item.label}</span>
                          </div>
                        </div>

                        <span className="text-[10px] text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                          {item.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Redaction Customization Options */}
              <div className="p-4 bg-gray-950/80 border border-gray-800 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Fill Color */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1.5 uppercase">
                      Màu khối che
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: 'black', label: 'Hộp Đen' },
                        { id: 'gray',  label: 'Xám Đậm' },
                        { id: 'white', label: 'Trắng' },
                      ].map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFillColor(c.id)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            fillColor === c.id
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stamp Label */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1.5 uppercase">
                      Nhãn dán lên vết che
                    </label>
                    <input
                      type="text"
                      value={stampLabel}
                      onChange={e => setStampLabel(e.target.value)}
                      placeholder="Ví dụ: [ĐÃ CHE]"
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Flatten Option */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1.5 uppercase">
                      Chế độ bảo mật
                    </label>
                    <button
                      type="button"
                      onClick={() => setFlatten(f => !f)}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        flatten
                          ? 'bg-green-500/20 border-green-500 text-green-300'
                          : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}
                    >
                      <Layers size={13} />
                      <span>{flatten ? 'Triệt để (Flatten Raster)' : 'Vector Tiêu chuẩn'}</span>
                    </button>
                  </div>
                </div>

                {flatten && (
                  <p className="text-[11px] text-green-400/90 leading-relaxed bg-green-950/20 border border-green-900/40 p-2.5 rounded-xl">
                    🛡️ <strong>Chế độ Triệt để:</strong> Trang được rasterize thành hình ảnh chất lượng cao để xóa hoàn toàn luồng ký tự ngầm bên dưới, đảm bảo không một phần mềm nào có thể bôi đen hay khôi phục lại chữ gốc.
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleRedact}
                disabled={redacting || selectedIds.size === 0}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {redacting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang áp dụng che mờ và làm phẳng tài liệu...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Che Vĩnh Viễn {selectedIds.size} Mục Đã Chọn</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Redaction Complete & Download */}
          {result && (
            <div className="p-6 bg-gray-950/90 border border-green-500/40 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Đã bảo mật và che thông tin nhạy cảm thành công!</span>
                </div>
                <span className="text-[11px] font-mono text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                  {result.flattened ? 'Flattened Secure PDF' : 'Vector Masked PDF'}
                </span>
              </div>

              <ResultDownload
                result={result}
                onReset={resetAll}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
