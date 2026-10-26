import { useState } from 'react';
import {
  ShieldAlert, Sparkles, Scissors, Layers, Minimize2, Stamp, Lock,
  FileCode, Sliders, CheckCircle2, AlertCircle, Plus, Trash2, ArrowRight
} from 'lucide-react';

export default function PdfInspector({
  activeAction,
  actionParams,
  onChangeParams,
  onExecuteAction,
  onScanPii,
  scanningPii,
  piiMatches = [],
  redactions = [],
  onTogglePiiMatch,
  loading,
  error,
}) {
  const [keywordInput, setKeywordInput] = useState('');

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    onChangeParams({
      ...actionParams,
      customKeywords: [...(actionParams.customKeywords || []), keywordInput.trim()],
    });
    setKeywordInput('');
  };

  const handleRemoveKeyword = (idx) => {
    const next = [...(actionParams.customKeywords || [])];
    next.splice(idx, 1);
    onChangeParams({ ...actionParams, customKeywords: next });
  };

  return (
    <div
      className="w-80 shrink-0 border-l flex flex-col h-full select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Bảng điều khiển tham số công cụ"
    >
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-inherit flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={15} style={{ color: 'var(--accent-primary)' }} />
          <span className="font-bold text-xs uppercase tracking-wider text-gray-300">
            {activeAction === 'redact' && 'Che PII & Bảo Mật'}
            {activeAction === 'merge' && 'Gộp File & Ghép Trang'}
            {activeAction === 'split' && 'Tách File PDF'}
            {activeAction === 'compress' && 'Nén & Tối Ưu Hóa'}
            {activeAction === 'watermark' && 'Đóng Dấu Watermark'}
            {activeAction === 'protect' && 'Đặt Mật Khẩu Bảo Vệ'}
            {activeAction === 'convert' && 'Chuyển Đổi Định Dạng'}
            {activeAction === 'organize' && 'Sắp Xếp & Xoay Trang'}
          </span>
        </div>
      </div>

      {/* Inspector Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ── REDACT PII INSPECTOR ── */}
        {activeAction === 'redact' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 leading-relaxed text-[11px]">
              <div className="font-semibold flex items-center gap-1.5 mb-1 text-red-400">
                <ShieldAlert size={14} />
                <span>Secure Redaction Engine</span>
              </div>
              Loại bỏ vĩnh viễn vector text và metadata khỏi PDF. Không thể khôi phục bằng công cụ trích xuất text.
            </div>

            {/* Auto PII Scanner Button */}
            <div>
              <button
                type="button"
                onClick={onScanPii}
                disabled={scanningPii}
                className="w-full py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFFFFF',
                }}
              >
                <Sparkles size={14} className={scanningPii ? 'animate-spin' : ''} />
                <span>{scanningPii ? 'Đang quét tài liệu...' : 'Quét Tự Động CCCD, SĐT, Email'}</span>
              </button>
            </div>

            {/* Discovered PII List */}
            {piiMatches.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Phát hiện ({piiMatches.length} mục):
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {piiMatches.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-red-500/30 transition-all cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked !== false}
                        onChange={() => onTogglePiiMatch(idx)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 truncate">
                        <div className="font-mono text-[11px] font-bold text-red-400 truncate">
                          {item.value}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {item.label} · Trang {item.pageNum || 1}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Keywords */}
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Từ khóa cần che bổ sung:
              </div>
              <form onSubmit={handleAddKeyword} className="flex gap-1.5 mb-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Nhập tên riêng, địa chỉ..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 text-gray-200 cursor-pointer"
                  title="Thêm từ khóa"
                >
                  <Plus size={15} />
                </button>
              </form>

              {actionParams.customKeywords?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {actionParams.customKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-[10px]"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(i)}
                        className="hover:text-red-100 cursor-pointer"
                      >
                        <Trash2 size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPRESS INSPECTOR ── */}
        {activeAction === 'compress' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Mức độ nén:
            </div>
            {[
              { id: 'ebook', label: 'Tiêu chuẩn (Khuyên dùng)', dpi: '150 DPI', desc: 'Dung lượng vừa phải, rõ chữ' },
              { id: 'screen', label: 'Tối đa (Gửi email/Web)', dpi: '72 DPI', desc: 'Giảm sâu kích thước file' },
              { id: 'prepress', label: 'Chất lượng cao', dpi: '300 DPI', desc: 'Giữ nét phục vụ in ấn' },
            ].map(opt => (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  actionParams.compressQuality === opt.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-black/5 dark:border-white/5 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="compressQuality"
                  value={opt.id}
                  checked={actionParams.compressQuality === opt.id}
                  onChange={() => onChangeParams({ ...actionParams, compressQuality: opt.id })}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-xs text-gray-200">{opt.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc} ({opt.dpi})</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* ── SPLIT INSPECTOR ── */}
        {activeAction === 'split' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Phạm vi trích xuất:
            </div>
            <input
              type="text"
              value={actionParams.splitRange || ''}
              onChange={(e) => onChangeParams({ ...actionParams, splitRange: e.target.value })}
              placeholder="Vd: 1-3, 5, 8-12"
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px] text-gray-400 leading-normal">
              Nhập số trang hoặc dải trang cần tách. Để trống để tách toàn bộ thành file ZIP từng trang riêng lẻ.
            </p>
          </div>
        )}

        {/* ── WATERMARK INSPECTOR ── */}
        {activeAction === 'watermark' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Nội dung đóng dấu:
            </div>
            <input
              type="text"
              value={actionParams.watermarkText || 'CONFIDENTIAL'}
              onChange={(e) => onChangeParams({ ...actionParams, watermarkText: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none font-semibold"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="flex items-center justify-between text-gray-400">
              <span>Độ mờ đục:</span>
              <span className="font-mono">{Math.round((actionParams.watermarkOpacity || 0.3) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={actionParams.watermarkOpacity || 0.3}
              onChange={(e) => onChangeParams({ ...actionParams, watermarkOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        )}

        {/* ── PROTECT INSPECTOR ── */}
        {activeAction === 'protect' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Mật khẩu mở file:
            </div>
            <input
              type="password"
              value={actionParams.userPassword || ''}
              onChange={(e) => onChangeParams({ ...actionParams, userPassword: e.target.value })}
              placeholder="Nhập mật khẩu..."
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px] text-gray-400">
              Mã hóa bảo mật chuẩn AES-256 bit. Người xem phải nhập đúng mật khẩu này để mở tài liệu.
            </p>
          </div>
        )}

        {/* ── CONVERT FORMAT INSPECTOR ── */}
        {activeAction === 'convert' && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Định dạng đầu ra:
            </div>
            {[
              { id: 'markdown', label: 'Markdown (.md)', desc: 'AI trích xuất cấu trúc văn bản' },
              { id: 'excel', label: 'Excel (.xlsx)', desc: 'Trích xuất bảng dữ liệu tự động' },
              { id: 'pptx', label: 'PowerPoint (.pptx)', desc: 'Tạo slide trình chiếu 150 DPI' },
              { id: 'pdfa', label: 'Chuẩn PDF/A-2b', desc: 'Bảo quản lưu trữ lâu dài' },
            ].map(fmt => (
              <label
                key={fmt.id}
                className={`flex items-start gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                  actionParams.targetFormat === fmt.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-black/5 dark:border-white/5 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="targetFormat"
                  value={fmt.id}
                  checked={actionParams.targetFormat === fmt.id}
                  onChange={() => onChangeParams({ ...actionParams, targetFormat: fmt.id })}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-xs text-gray-200">{fmt.label}</div>
                  <div className="text-[10px] text-gray-400">{fmt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Primary Execution CTA Bar */}
      <div className="p-3.5 border-t border-inherit space-y-2">
        <button
          type="button"
          onClick={onExecuteAction}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
          }}
        >
          {loading ? (
            <span>Đang thực thi tác vụ...</span>
          ) : (
            <>
              <span>Áp Dụng & Xuất File</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
        <div className="text-[10px] text-center text-gray-400 font-mono">
          Trạng thái: Sẵn sàng xử lý
        </div>
      </div>
    </div>
  );
}
