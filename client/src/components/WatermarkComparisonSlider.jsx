import { useState, useRef } from 'react';
import { ArrowLeftRight, ZoomIn, Eye, Sparkles, X } from 'lucide-react';

/**
 * WatermarkComparisonSlider — Widget so sánh Trước & Sau khi xóa watermark
 * Lấy cảm hứng từ thiết kế hiện đại của BotocIT (botocit.com)
 */
export default function WatermarkComparisonSlider({
  originalSrc,
  processedSrc,
  isVideo = false,
  detectedBox = null,
  title = 'So Sánh Kết Quả Xóa Watermark'
}) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [mode, setMode] = useState('split'); // 'split' | 'before' | 'after'
  const containerRef = useRef(null);

  const handleSliderChange = (e) => {
    setSliderPos(Number(e.target.value));
    setMode('split');
  };

  const showBefore = () => {
    setSliderPos(100);
    setMode('before');
  };

  const showAfter = () => {
    setSliderPos(0);
    setMode('after');
  };

  // Tính toán vùng zoom dựa trên detectedBox hoặc góc dưới phải
  const zoomX = detectedBox?.x ? `${detectedBox.x}px` : '85%';
  const zoomY = detectedBox?.y ? `${detectedBox.y}px` : '88%';

  return (
    <div className="glass-card p-5 sm:p-7 rounded-3xl border border-white/10 bg-[#0c0c14]/90 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-base font-bold text-white tracking-tight">{title}</h4>
            <p className="text-xs text-gray-400">Kéo thanh trượt hoặc chọn chế độ để kiểm tra chi tiết</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={showBefore}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              mode === 'before'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-gray-400 hover:text-white border-white/10 hover:bg-white/10'
            }`}
          >
            Trước
          </button>
          <button
            type="button"
            onClick={showAfter}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              mode === 'after'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-white/5 text-gray-400 hover:text-white border-white/10 hover:bg-white/10'
            }`}
          >
            Sau
          </button>
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <ZoomIn size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Phóng to vùng xóa</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Comparison Stage */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black select-none border border-white/10 shadow-inner group"
      >
        {/* Layer 1: Sau (Cleaned / Processed) - Background */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
          {isVideo ? (
            <video
              src={processedSrc}
              controls
              playsInline
              className="w-full h-full object-contain pointer-events-auto"
            />
          ) : (
            <img
              src={processedSrc}
              alt="Sau khi xóa watermark"
              className="w-full h-full object-contain pointer-events-none"
            />
          )}
        </div>

        {/* Layer 2: Trước (Original with Watermark) - Clipped Overlay */}
        {!isVideo && (
          <div
            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
            style={{
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
            }}
          >
            <img
              src={originalSrc}
              alt="Trước khi xóa watermark"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {/* Labels */}
        {!isVideo && (
          <div className="absolute top-3 inset-x-3 flex justify-between pointer-events-none text-xs font-bold tracking-wider uppercase z-20">
            <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/30 shadow">
              Trước (Gốc)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-purple-300 border border-purple-500/30 shadow">
              Sau (Đã xóa)
            </span>
          </div>
        )}

        {/* Divider Bar & Handle (cho Image mode) */}
        {!isVideo && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-20"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute inset-y-0 -left-px w-0.5 bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 rounded-full bg-purple-600 text-white shadow-lg border-2 border-white flex items-center justify-center">
              <ArrowLeftRight size={14} />
            </div>
          </div>
        )}

        {/* Invisible Range Input Slider on Top */}
        {!isVideo && (
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            aria-label="Thanh trượt so sánh trước và sau"
          />
        )}
      </div>

      {!isVideo && (
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span>← Kéo sang trái để xem ảnh ĐÃ XÓA</span>
          <span>Kéo sang phải để xem ảnh GỐC →</span>
        </div>
      )}

      {/* Zoom Modal - Xem cận cảnh khu vực xóa watermark */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-card max-w-2xl w-full p-6 rounded-3xl border border-white/20 bg-gray-950 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ZoomIn size={18} className="text-purple-400" />
              So Sánh Phóng To Vùng Watermark (300% Zoom)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Trước (Ảnh gốc)</p>
                <div className="w-full h-56 rounded-2xl overflow-hidden bg-black border border-white/10 relative">
                  <img
                    src={originalSrc}
                    alt="Trước zoom"
                    className="w-full h-full object-cover scale-[3]"
                    style={{ transformOrigin: `${zoomX} ${zoomY}` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Sau (Đã inpaint sạch)</p>
                <div className="w-full h-56 rounded-2xl overflow-hidden bg-black border border-white/10 relative">
                  <img
                    src={processedSrc}
                    alt="Sau zoom"
                    className="w-full h-full object-cover scale-[3]"
                    style={{ transformOrigin: `${zoomX} ${zoomY}` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsZoomOpen(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow"
              >
                Đóng xem lớn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
