import React, { useEffect, useRef } from 'react';

export const FloatingGalaxy: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Stars & celestial particles
    const starCount = 140;
    const stars: Array<{
      x: number;
      y: number;
      z: number;
      size: number;
      color: string;
      speed: number;
      alpha: number;
      alphaSpeed: number;
    }> = [];

    const colors = [
      '#a855f7', // purple
      '#38bdf8', // cyan / sky
      '#34d399', // emerald
      '#818cf8', // indigo
      '#f472b6', // pink
      '#ffffff', // bright star
    ];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 2 + 0.5,
        size: Math.random() * 1.8 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 0.35 + 0.08,
        alpha: Math.random() * 0.7 + 0.3,
        alphaSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    // Floating Cosmic Nebula Orbs
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep space base
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#02030a');
      bgGrad.addColorStop(0.5, '#060a17');
      bgGrad.addColorStop(1, '#03050d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Swirling Galaxy Nebula Blobs
      angle += 0.002;
      const cx1 = width * 0.25 + Math.cos(angle) * 80;
      const cy1 = height * 0.3 + Math.sin(angle * 0.8) * 60;
      const rad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, width * 0.45);
      rad1.addColorStop(0, 'rgba(147, 51, 234, 0.12)'); // deep purple
      rad1.addColorStop(0.5, 'rgba(79, 70, 229, 0.05)'); // indigo
      rad1.addColorStop(1, 'transparent');
      ctx.fillStyle = rad1;
      ctx.fillRect(0, 0, width, height);

      const cx2 = width * 0.75 + Math.sin(angle * 0.7) * 90;
      const cy2 = height * 0.65 + Math.cos(angle * 0.9) * 70;
      const rad2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, width * 0.4);
      rad2.addColorStop(0, 'rgba(16, 185, 129, 0.08)'); // emerald aurora
      rad2.addColorStop(0.6, 'rgba(6, 182, 212, 0.04)'); // cyan
      rad2.addColorStop(1, 'transparent');
      ctx.fillStyle = rad2;
      ctx.fillRect(0, 0, width, height);

      // Central Galaxy Core Glow
      const centerGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        20,
        width * 0.5,
        height * 0.4,
        width * 0.6
      );
      centerGrad.addColorStop(0, 'rgba(168, 85, 247, 0.07)');
      centerGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.04)');
      centerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);

      // Render floating stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Animate position (gentle floating drift)
        star.y -= star.speed;
        star.x += Math.sin(star.y * 0.005) * 0.2;

        if (star.y < -10) {
          star.y = height + 10;
          star.x = Math.random() * width;
        }

        // Twinkle
        star.alpha += star.alphaSpeed;
        if (star.alpha > 0.95 || star.alpha < 0.2) {
          star.alphaSpeed = -star.alphaSpeed;
        }

        // Draw star
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, Math.min(1, star.alpha));
        ctx.fillStyle = star.color;
        ctx.shadowBlur = star.size * 4;
        ctx.shadowColor = star.color;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-90 transition-opacity"
      aria-hidden="true"
    />
  );
};
