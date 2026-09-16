import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, FileText, Image, ArrowRightLeft, Wand2, Sparkles, ScanText, Archive, QrCode, Mic, FileCode } from 'lucide-react';

const ALL_TOOLS = [
  { name: 'Advanced Editor (Monaco / CSV / Code)', path: '/editor', category: 'Developer & Data', icon: FileCode, tags: ['editor','monaco','code','csv','json','markdown','python','javascript','vscode','lập trình'] },
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
  { name: 'Speech to Text (Ghi âm)', path: '/speech',   category: 'AI & Speech', icon: Mic, tags: ['speech','voice','ghi âm','giọng nói','âm thanh','whisper','transcribe'] },
  { name: 'AI Tóm tắt văn bản',path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['summarize','tóm tắt','ai','gemini'] },
  { name: 'AI Dịch thuật',     path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['translate','dịch','dịch thuật'] },
  { name: 'Chat với PDF',      path: '/ai',             category: 'AI & OCR',  icon: Sparkles, tags: ['chat','hỏi đáp','ai'] },
  { name: 'Office → PDF',      path: '/office',         category: 'Office',    icon: FileText, tags: ['docx','xlsx','pptx','word','excel'] },
  { name: 'Sắp xếp trang (Visual)', path: '/pdf/organize',   category: 'PDF Tools', icon: FileText, tags: ['reorder','organize','sắp xếp','thứ tự','trang'] },
  { name: 'PDF → Markdown',    path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['markdown','md','convert','pdf'] },
  { name: 'PDF → Excel (Tables)', path: '/pdf',         category: 'PDF Tools', icon: FileText, tags: ['excel','xlsx','table','bảng','pdf'] },
  { name: 'PDF → PowerPoint',  path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['pptx','powerpoint','slide','trình chiếu','pdf'] },
  { name: 'Scan Ảnh → PDF',    path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['scan','scan to pdf','ảnh','tối ưu'] },
  { name: 'So sánh nội dung PDF', path: '/pdf',         category: 'PDF Tools', icon: FileText, tags: ['compare','diff','so sánh','thay đổi'] },
  { name: 'Cắt PDF (Crop)',    path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['crop','cắt','lề','kích thước'] },
  { name: 'Chèn ảnh vào PDF',  path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['add image','chèn ảnh','logo','con dấu'] },
  { name: 'Chèn thêm trang',   path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['insert pages','chèn trang','ghép'] },
  { name: 'Flatten PDF',       path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['flatten','cố định','form','annotations'] },
  { name: 'Chuyển sang PDF/A', path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['pdfa','pdf/a','lưu trữ','archival','iso'] },
  { name: 'Sửa chữa PDF hỏng', path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['repair','fix','phục hồi','sửa lỗi'] },
  { name: 'HTML → PDF',        path: '/pdf',            category: 'PDF Tools', icon: FileText, tags: ['html','htm','web','pdf'] },
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
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 rounded-xl text-xs text-gray-300 hover:text-white transition-all shadow-sm cursor-pointer group"
        title="Tìm kiếm công cụ (Ctrl + K)"
      >
        <Search size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline font-medium">Tìm công cụ...</span>
        <kbd className="hidden sm:inline text-[10px] bg-white/5 text-amber-300/80 px-1.5 py-0.5 rounded-md border border-white/10 font-mono">
          Ctrl K
        </kbd>
      </button>

      {/* Luxury Command Palette Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => { setOpen(false); setQuery(''); }}
        >
          {/* Main Box */}
          <div
            className="w-full max-w-2xl bg-[#0E0E14]/95 text-gray-200 border border-amber-400/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col font-sans backdrop-blur-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-white/5 border-b border-white/10">
              <span className="text-amber-400 font-bold text-sm font-mono">&gt;</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tên công cụ, chức năng (gộp pdf, nén, ocr, ai...)"
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm font-medium"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-white p-1">
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Results List */}
            <div className="py-2 max-h-[380px] overflow-y-auto">
              {results.length > 0 ? (
                results.map((tool, idx) => {
                  const isSelected = selectedIndex === idx;
                  const Icon = tool.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => go(tool.path)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl cursor-pointer text-sm transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-semibold'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-amber-300' : 'text-gray-400'} />
                      <span className="font-medium">{tool.name}</span>
                      <span className="ml-auto text-xs px-2.5 py-0.5 rounded-lg bg-white/5 text-amber-300/80 border border-white/10 font-mono">
                        {tool.category}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-gray-400 text-sm">
                  Không tìm thấy công cụ nào phù hợp với "<span className="text-amber-300 font-semibold">{query}</span>"
                </div>
              )}
            </div>

            {/* Footer status bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-t border-white/10 text-[11px] text-gray-400">
              <div className="flex gap-3 items-center">
                <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 border border-white/10">↑↓</kbd> Di chuyển</span>
                <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 border border-white/10">↵</kbd> Chọn</span>
                <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 border border-white/10">Esc</kbd> Đóng</span>
              </div>
              <span className="text-amber-400/80 font-mono text-[10px]">FileTools Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
