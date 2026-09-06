import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, FileText, Image, ArrowRightLeft, Wand2, Sparkles, ScanText, Archive, QrCode } from 'lucide-react';

const ALL_TOOLS = [
  { name: 'Gộp PDF (Visual)',  path: '/pdf/merge',      category: 'PDF Tools', icon: FileText, tags: ['merge','pdf','gộp','kết hợp'] },
  { name: 'Tách PDF (Visual)', path: '/pdf/split',      category: 'PDF Tools', icon: FileText, tags: ['split','pdf','tách','chia'] },
  { name: 'Ký PDF (Visual)',   path: '/pdf/sign',       category: 'PDF Tools', icon: FileText, tags: ['sign','ký','chữ ký','pdf'] },
  { name: 'Xóa trang PDF',     path: '/pdf/delete',     category: 'PDF Tools', icon: FileText, tags: ['delete','pdf','xóa','trang'] },
  { name: 'Nén PDF',           path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['compress','pdf','nén','giảm dung lượng'] },
  { name: 'Thêm số trang PDF', path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['page numbers','đánh số','số trang'] },
  { name: 'Header / Footer PDF',path: '/pdf',           category: 'PDF Tools', icon: FileText, tags: ['header','footer','tiêu đề','chân trang'] },
  { name: 'Watermark PDF',     path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['watermark','chữ mờ','pdf'] },
  { name: 'Bảo vệ PDF',        path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['protect','mật khẩu','bảo vệ'] },
  { name: 'Ảnh → PDF',         path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['image to pdf','ảnh','chuyển đổi'] },
  { name: 'PDF → Ảnh (ZIP)',   path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['pdf to image','ảnh','chuyển đổi'] },
  { name: 'URL → PDF',         path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['url','web','trang web','pdf'] },
  { name: 'Markdown → PDF',    path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['markdown','md','pdf'] },
  { name: 'JSON → Excel',      path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['json','excel','data'] },
  { name: 'CSV → Excel',       path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['csv','excel','xlsx'] },
  { name: 'Thống kê PDF',      path: '/convert',        category: 'Convert',   icon: ArrowRightLeft, tags: ['stats','thống kê','đếm từ'] },
  { name: 'Trích màu ảnh',     path: '/creative',       category: 'Creative',  icon: Wand2, tags: ['color palette','màu','palette'] },
  { name: 'Watermark ảnh',     path: '/creative',       category: 'Creative',  icon: Wand2, tags: ['watermark','đóng dấu','ảnh'] },
  { name: 'Ghép ảnh (Collage)',path: '/creative',       category: 'Creative',  icon: Wand2, tags: ['collage','ghép','lưới'] },
  { name: 'Tạo mã vạch & QR',  path: '/creative',       category: 'Creative',  icon: Wand2, tags: ['barcode','qr','mã vạch'] },
  { name: 'Chuyển đổi định dạng ảnh', path: '/image',   category: 'Image Tools', icon: Image, tags: ['convert','jpg','png','webp','avif'] },
  { name: 'Nén ảnh',           path: '/image',          category: 'Image Tools', icon: Image, tags: ['compress','image','nén ảnh'] },
  { name: 'Resize ảnh',        path: '/image',          category: 'Image Tools', icon: Image, tags: ['resize','kích thước','ảnh'] },
  { name: 'Xóa nền ảnh (AI)',  path: '/image',          category: 'Image Tools', icon: Image, tags: ['remove background','nền','xóa nền'] },
  { name: 'OCR nhận dạng chữ', path: '/ocr',            category: 'AI & OCR',  icon: ScanText, tags: ['ocr','nhận dạng','text','chữ'] },
  { name: 'AI Tóm tắt văn bản',path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['summarize','tóm tắt','ai','gemini'] },
  { name: 'AI Dịch thuật',     path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['translate','dịch','dịch thuật'] },
  { name: 'Chat với PDF',      path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['chat','hỏi đáp','ai'] },
  { name: 'Office → PDF',      path: '/office',         category: 'Office',    icon: FileText, tags: ['docx','xlsx','pptx','word','excel'] },
  { name: 'Nén file (ZIP)',    path: '/archive',        category: 'Archive',   icon: Archive, tags: ['zip','nén','archive','giải nén'] },
  { name: 'Tạo QR Code',       path: '/qr',             category: 'QR Code',   icon: QrCode, tags: ['qr','mã qr'] },
];

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults(ALL_TOOLS.slice(0, 10));
      setSelectedIndex(0);
      return;
    }
    const q = query.toLowerCase().trim();
    const matched = ALL_TOOLS.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    );
    setResults(matched);
    setSelectedIndex(0);
  }, [query]);

  // Phím tắt Ctrl+K hoặc Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const go = (path) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1 < results.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        go(results[selectedIndex].path);
      }
    }
  };

  return (
    <>
      {/* Search trigger button in Navbar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] hover:bg-[#2d2d2d] border border-[#3c3c3c] hover:border-[#007fd4] rounded-md text-xs text-[#cccccc] hover:text-white transition-all shadow-sm"
        title="Tìm kiếm công cụ (Ctrl + K)"
      >
        <Search size={13} className="text-[#007fd4]" />
        <span className="hidden sm:inline">Tìm công cụ...</span>
        <kbd className="hidden sm:inline text-[10px] bg-[#1e1e1e] text-[#858585] px-1.5 py-0.5 rounded border border-[#3c3c3c] font-mono">
          Ctrl K
        </kbd>
      </button>

      {/* VS Code Command Palette Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm"
          onClick={() => { setOpen(false); setQuery(''); }}
        >
          {/* Main Palette Box (100% OPAQUE, Solid VS Code Theme) */}
          <div
            className="w-full max-w-2xl bg-[#1e1e1e] text-[#cccccc] border border-[#007fd4] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col font-sans"
            style={{ backgroundColor: '#1e1e1e', opacity: 1 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#252526] border-b border-[#3c3c3c]">
              <span className="text-[#007fd4] font-bold text-sm font-mono">&gt;</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tên công cụ, chức năng (gộp pdf, nén, ocr, ai...)"
                className="flex-1 bg-transparent text-white placeholder-[#757575] outline-none text-sm"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[#858585] hover:text-white">
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Results List */}
            <div className="py-1 max-h-[380px] overflow-y-auto bg-[#1e1e1e]">
              {results.length > 0 ? (
                results.map((tool, idx) => {
                  const isSelected = selectedIndex === idx;
                  const Icon = tool.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => go(tool.path)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#04395e] text-white border-l-2 border-[#007fd4]'
                          : 'text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-[#007fd4]' : 'text-[#858585]'} />
                      <span className="font-medium">{tool.name}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded bg-[#252526] text-[#858585] border border-[#333333] font-mono">
                        {tool.category}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-[#858585] text-sm bg-[#1e1e1e]">
                  Không tìm thấy công cụ nào phù hợp với "<span className="text-white font-semibold">{query}</span>"
                </div>
              )}
            </div>

            {/* Footer status bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-t border-[#3c3c3c] text-[11px] text-[#858585]">
              <div className="flex gap-3 items-center">
                <span><kbd className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-white border border-[#3c3c3c]">↑↓</kbd> Di chuyển</span>
                <span><kbd className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-white border border-[#3c3c3c]">↵</kbd> Chọn</span>
                <span><kbd className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-white border border-[#3c3c3c]">Esc</kbd> Đóng</span>
              </div>
              <span>FileTools Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
