import { useRef, useState, useEffect } from 'react';
import { RotateCcw, Download, Check } from 'lucide-react';

export default function SignaturePad({ onSave, width = 500, height = 200 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
  }, [color, lineWidth]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const handleSave = () => {
    if (!hasContent) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const downloadPNG = () => {
    if (!hasContent) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = 'signature.png';
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Ký bằng chuột hoặc ngón tay</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {['#000000', '#1d4ed8', '#dc2626'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border transition-transform ${
                  color === c ? 'scale-125 border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Nét:</span>
            {[1.5, 2.5, 4].map((w) => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                className={`px-1.5 py-0.5 rounded text-xs ${
                  lineWidth === w ? 'bg-gray-700 text-white' : 'text-gray-500'
                }`}
              >
                {w === 1.5 ? 'Mảnh' : w === 2.5 ? 'Vừa' : 'Đậm'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-2 border-dashed border-gray-700 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 text-sm select-none">
            Ký vào đây...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={clear}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <RotateCcw size={13} /> Xóa
        </button>
        <button
          onClick={downloadPNG}
          disabled={!hasContent}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors disabled:opacity-40"
        >
          <Download size={13} /> Tải PNG
        </button>
        <button
          onClick={handleSave}
          disabled={!hasContent}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
        >
          <Check size={13} /> Dùng chữ ký này
        </button>
      </div>
    </div>
  );
}
