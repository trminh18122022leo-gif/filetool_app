import React from 'react';

export default function GlassyWisteriaBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-[480px] py-4 w-full overflow-hidden bg-[#0d0716] text-white flex items-center justify-center transition-colors duration-500 rounded-3xl ${className}`}>
      {/* ── Radial gradient blooms (theo thiết kế Glassy wisteria) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 50% 45% at 53% 76%, rgba(122, 31, 217, 0.45), rgba(136, 52, 224, 0.2) 55%, transparent 75%),
            radial-gradient(ellipse 60% 65% at 33% 55%, rgba(122, 31, 217, 0.4), rgba(182, 108, 239, 0.2) 55%, transparent 75%),
            radial-gradient(ellipse 50% 50% at 76% 26%, rgba(157, 75, 234, 0.42), rgba(207, 146, 245, 0.18) 55%, transparent 75%)
          `,
        }}
      />

      {/* ── Lưới ô vuông kính mờ thở nhẹ (Glassy tiles từ glassy.docx) ── */}
      <div className="absolute inset-0 pointer-events-none opacity-35 overflow-hidden">
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-3 p-4 w-full h-full transform -rotate-3 scale-110">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="h-20 sm:h-28 rounded-2xl backdrop-blur-md border border-purple-300/20 bg-purple-500/10"
              style={{
                animation: `pulse ${(i % 4) + 4}s ease-in-out infinite alternate`,
                animationDelay: `${(i % 6) * 0.5}s`,
                opacity: 0.2 + ((i * 23) % 45) / 100,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Glow phủ mờ ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* ── Nội dung form ── */}
      <div className="relative z-10 w-full flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
