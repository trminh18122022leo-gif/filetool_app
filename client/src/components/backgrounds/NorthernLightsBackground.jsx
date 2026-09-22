import { useEffect, useRef } from 'react';

/**
 * Northern Lights Background (Mô phỏng cực quang đêm theo light.docx)
 * Cực quang cyan/aqua #00d4ff & bầu trời sao nhấp nháy 30-60fps
 */
export default function NorthernLightsBackground({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Sinh các ngôi sao ở nửa trên
    const starCount = 65;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.65),
      size: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.02 + 0.005,
    }));

    // Cực quang tia sáng
    const rayCount = 26;
    let t = 0;

    const render = () => {
      // Nếu đang ở chế độ sáng, tạm ngưng vẽ canvas để tiết kiệm pin/GPU
      if (document.documentElement.classList.contains('light')) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Chuyển động chậm, êm dịu (khoảng 3-4 lần chậm hơn trước)
      t += 0.004;
      ctx.clearRect(0, 0, width, height);

      // 1. Nền đêm navy đậm sâu thẳm
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#040914');
      bgGrad.addColorStop(0.5, '#071224');
      bgGrad.addColorStop(1, '#02060d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Vẽ sao lấp lánh
      stars.forEach(star => {
        star.alpha += Math.sin(t * 1.5 + star.x) * 0.004;
        const currentAlpha = Math.max(0.15, Math.min(0.85, star.alpha));
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Nguồn sáng trung tâm (center emerald & cyan bloom)
      const glowX = width * 0.48 + Math.sin(t * 0.4) * 50;
      const glowY = height * 0.58 + Math.cos(t * 0.3) * 25;
      const glow = ctx.createRadialGradient(glowX, glowY, 15, glowX, glowY, width * 0.5);
      glow.addColorStop(0, 'rgba(0, 242, 254, 0.22)');
      glow.addColorStop(0.35, 'rgba(16, 185, 129, 0.14)');
      glow.addColorStop(0.7, 'rgba(56, 189, 248, 0.05)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // 4. Lớp cực quang 1: Màn sương mềm mại (Soft Ambient Aurora)
      ctx.save();
      ctx.filter = 'blur(16px)';
      for (let i = 0; i < rayCount; i++) {
        const xPos = (width / (rayCount - 1)) * i;
        const uCurve = Math.sin((i / rayCount) * Math.PI);
        const wave = Math.sin(t + i * 0.28) * 40;
        const rayH = (height * 0.48 + wave) * uCurve;
        const rayTop = height * 0.22 - uCurve * 50 + Math.cos(t * 0.6 + i * 0.2) * 20;

        const rayGrad = ctx.createLinearGradient(xPos, rayTop, xPos, rayTop + rayH);
        rayGrad.addColorStop(0, 'transparent');
        rayGrad.addColorStop(0.25, `rgba(0, 242, 254, ${0.25 + uCurve * 0.25})`);
        rayGrad.addColorStop(0.65, `rgba(52, 211, 153, ${0.2 + uCurve * 0.22})`);
        rayGrad.addColorStop(0.9, `rgba(168, 85, 247, ${0.12 + uCurve * 0.12})`);
        rayGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = rayGrad;
        ctx.fillRect(xPos - 45, rayTop, 90, rayH);
      }
      ctx.restore();

      // 5. Lớp cực quang 2: Dải tia sáng rõ nét (Crisp Ribbons Layer)
      ctx.save();
      ctx.filter = 'blur(6px)';
      for (let i = 0; i < rayCount; i += 2) {
        const xPos = (width / (rayCount - 1)) * i + Math.sin(t * 0.8 + i) * 15;
        const uCurve = Math.sin((i / rayCount) * Math.PI);
        const rayH = (height * 0.38 + Math.sin(t * 1.2 + i * 0.4) * 35) * uCurve;
        const rayTop = height * 0.26 - uCurve * 40 + Math.cos(t * 0.7 + i * 0.3) * 15;

        const crispGrad = ctx.createLinearGradient(xPos, rayTop, xPos, rayTop + rayH);
        crispGrad.addColorStop(0, 'transparent');
        crispGrad.addColorStop(0.3, `rgba(0, 242, 254, ${0.35 + uCurve * 0.3})`);
        crispGrad.addColorStop(0.7, `rgba(110, 231, 183, ${0.3 + uCurve * 0.25})`);
        crispGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = crispGrad;
        ctx.fillRect(xPos - 18, rayTop, 36, rayH);
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none -z-10 dark:opacity-100 opacity-0 transition-opacity duration-500 ${className}`}
      aria-hidden="true"
    />
  );
}
