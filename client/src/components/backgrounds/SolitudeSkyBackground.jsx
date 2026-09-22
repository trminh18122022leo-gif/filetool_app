import { useState, useEffect, useRef } from 'react';

/**
 * Solitude Sky Background (Bầu trời xanh mây trắng Solitude theo Light main)
 * - Nền trời xanh azure #1871E5 ở nửa dưới
 * - Dải mây trắng biến hình tại chỗ lặp chu kỳ 10 giây (300 frames)
 * - Từ "Solitude" bằng Instrument Serif ở trung tâm
 * - Lớp film grain mịn đơn sắc tĩnh
 * - Tự động kích hoạt khi BẬT ĐÈN (Light mode) và mờ dần khi TẮT ĐÈN (Dark mode)
 */
export default function SolitudeSkyBackground({ className = '', showSolitudeText = true }) {
  const [isLight, setIsLight] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('light');
    }
    return false;
  });

  const videoRef = useRef(null);

  useEffect(() => {
    const handleThemeChange = () => {
      const currentLight = document.documentElement.classList.contains('light');
      setIsLight(currentLight);

      if (currentLight && videoRef.current) {
        videoRef.current.play().catch(() => {});
      } else if (!currentLight && videoRef.current) {
        videoRef.current.pause();
      }
    };

    // Kiểm tra ban đầu
    handleThemeChange();

    window.addEventListener('theme-change', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);

    return () => {
      window.removeEventListener('theme-change', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  // Xử lý autoplay khi component mount hoặc visibility thay đổi
  useEffect(() => {
    if (isLight && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Fallback nếu trình duyệt chặn autoplay trước khi có click
        const handleUserInteraction = () => {
          videoRef.current?.play().catch(() => {});
          window.removeEventListener('click', handleUserInteraction);
          window.removeEventListener('touchstart', handleUserInteraction);
        };
        window.addEventListener('click', handleUserInteraction, { once: true });
        window.addEventListener('touchstart', handleUserInteraction, { once: true });
      });
    }
  }, [isLight]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-700 ease-in-out ${
        isLight ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      aria-hidden="true"
    >
      {/* ── GROUND TRUTH 10s SEAMLESS LOOP CLOUD SKY VIDEO ── */}
      <video
        ref={videoRef}
        src="/blue-sky.mp4"
        poster="/blue-sky-poster.png"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover select-none"
      />

      {/* ── FILM GRAIN OVERLAY (Đơn sắc 1px mịn blend overlay) ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </div>
  );
}
