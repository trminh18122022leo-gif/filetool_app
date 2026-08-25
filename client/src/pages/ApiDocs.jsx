import { useState } from 'react';
import { Code, Copy, Check, Terminal, Key } from 'lucide-react';

const ENDPOINTS = [
  {
    name: 'Nén PDF (Compress PDF)',
    method: 'POST',
    path: '/api/pdf/compress',
    desc: 'Nén tài liệu PDF giảm dung lượng với chất lượng Ghostscript cao cấp.',
    params: 'file (binary), quality (screen | ebook | printer | prepress)',
    curl: `curl -X POST http://localhost:3001/api/pdf/compress \\
  -H "X-API-Key: sk-ft-xxxxxxxxxxxx" \\
  -F "file=@document.pdf" \\
  -F "quality=ebook"`,
    js: `const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('quality', 'ebook');

const res = await fetch('http://localhost:3001/api/pdf/compress', {
  method: 'POST',
  headers: { 'X-API-Key': 'sk-ft-xxxxxxxxxxxx' },
  body: form,
});
const data = await res.json();`,
  },
  {
    name: 'Nhận diện chữ OCR (OCR Image to Text)',
    method: 'POST',
    path: '/api/ocr/image',
    desc: 'Trích xuất văn bản từ hình ảnh scan bằng Tesseract OCR.',
    params: 'file (binary), lang (vie+eng | vie | eng)',
    curl: `curl -X POST http://localhost:3001/api/ocr/image \\
  -H "X-API-Key: sk-ft-xxxxxxxxxxxx" \\
  -F "file=@scan.png" \\
  -F "lang=vie+eng"`,
    js: `const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('lang', 'vie+eng');

const res = await fetch('http://localhost:3001/api/ocr/image', {
  method: 'POST',
  headers: { 'X-API-Key': 'sk-ft-xxxxxxxxxxxx' },
  body: form,
});
const data = await res.json();`,
  },
  {
    name: 'Tóm tắt tài liệu AI (AI Document Summary)',
    method: 'POST',
    path: '/api/ai/summarize',
    desc: 'Tóm tắt nội dung file PDF bằng mô hình Google Gemini / Anthropic Claude.',
    params: 'file (binary), language (vi | en), length (short | medium | long)',
    curl: `curl -X POST http://localhost:3001/api/ai/summarize \\
  -H "X-API-Key: sk-ft-xxxxxxxxxxxx" \\
  -F "file=@report.pdf" \\
  -F "language=vi" \\
  -F "length=medium"`,
    js: `const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('language', 'vi');

const res = await fetch('http://localhost:3001/api/ai/summarize', {
  method: 'POST',
  headers: { 'X-API-Key': 'sk-ft-xxxxxxxxxxxx' },
  body: form,
});
const data = await res.json();`,
  },
];

export default function ApiDocs() {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [langTab, setLangTab]     = useState('curl'); // 'curl' | 'js'

  const handleCopy = (code, idx) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-10 py-4 max-w-5xl mx-auto">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-950/60 border border-yellow-800/40 rounded-full text-xs text-yellow-300 font-medium">
          <Terminal size={13} />
          <span>Dành cho lập trình viên & tích hợp</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">FileTools Pro Public API</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Tích hợp toàn bộ năng lực xử lý tệp tin của FileTools Pro vào ứng dụng web, mobile hoặc backend của bạn thông qua RESTful API tốc độ cao.
        </p>
      </div>

      {/* Auth Info */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Key size={16} className="text-yellow-400" /> Xác thực API (Authentication)
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Mọi yêu cầu gửi đến API đều cần đính kèm header <code className="bg-gray-950 px-2 py-0.5 rounded text-yellow-300 font-mono">X-API-Key</code>.
          Bạn có thể tạo và quản lý key tại trang <a href="/dashboard" className="text-blue-400 hover:underline">Dashboard</a>.
        </p>
      </div>

      {/* Endpoints */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Endpoints Tiêu Biểu</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setLangTab('curl')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                langTab === 'curl' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setLangTab('js')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                langTab === 'js' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              JavaScript (Fetch)
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {ENDPOINTS.map((ep, i) => {
            const codeToCopy = langTab === 'curl' ? ep.curl : ep.js;
            return (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{ep.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{ep.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-green-950 border border-green-800 text-green-300 rounded-md">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs text-gray-300 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
                      {ep.path}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  <b>Tham số form-data:</b> <span className="font-mono text-gray-300">{ep.params}</span>
                </div>

                <div className="relative bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                  <button
                    onClick={() => handleCopy(codeToCopy, i)}
                    className="absolute top-3 right-3 flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 bg-gray-900 border border-gray-800 rounded-lg transition-colors"
                  >
                    {copiedIdx === i ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    <span>{copiedIdx === i ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                  <pre className="whitespace-pre">{codeToCopy}</pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
