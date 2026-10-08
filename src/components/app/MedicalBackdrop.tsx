import { useEffect, useRef } from 'react';

/** A live, low-contrast medical drawing; colors inherit the active study theme. */
export function MedicalBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    const paint = (time: number) => {
      if (time - last < 40 && !reduced.matches) { frame = requestAnimationFrame(paint); return; }
      last = time;
      const w = window.innerWidth, h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const styles = getComputedStyle(canvas);
      ctx.strokeStyle = styles.getPropertyValue('--medical-line').trim();
      ctx.fillStyle = styles.getPropertyValue('--medical-dot').trim();
      ctx.lineWidth = 1;
      const t = reduced.matches ? 0 : time / 18000;
      const line = (points: number[][]) => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x ?? 0, y ?? 0) : ctx.moveTo(x ?? 0, y ?? 0)); ctx.stroke(); };
      ctx.save();
      ctx.translate(w * 0.86, h * 0.64 + Math.sin(t) * 12);
      ctx.rotate(Math.sin(t * 0.5) * 0.025);
      // Stethoscope tubing and diaphragm.
      ctx.beginPath(); ctx.moveTo(-82, -150); ctx.bezierCurveTo(-126, -108, -130, -42, -100, -8); ctx.bezierCurveTo(-68, 25, -12, 12, -1, -28); ctx.bezierCurveTo(10, -67, -2, -130, -25, -159); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-57, 16); ctx.bezierCurveTo(-67, 110, 76, 88, 72, 190); ctx.bezierCurveTo(69, 236, 130, 244, 144, 205); ctx.stroke();
      ctx.beginPath(); ctx.arc(146, 184, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(146, 184, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // Slowly turning DNA double helix near the left margin.
      ctx.save(); ctx.translate(w * 0.07, h * 0.35); ctx.rotate(-0.3);
      const a: number[][] = [], b: number[][] = [];
      for (let i = 0; i < 260; i += 4) { const x = Math.sin(i / 29 + t) * 34; a.push([x, i]); b.push([-x, i]); if (i % 20 === 0) line([[x, i], [-x, i]]); }
      line(a); line(b); ctx.restore();
      // ECG trace with a travelling highlighted segment.
      ctx.save(); ctx.translate(w * 0.53, h * 0.83); line([[-180, 0], [-100, 0], [-83, -12], [-69, 0], [-43, 0], [-30, 18], [-14, -58], [0, 29], [16, 0], [54, 0], [69, -16], [87, 0], [170, 0]]); ctx.restore();
      for (let i = 0; i < 70; i++) {
        const x = w * 0.68 + Math.sin(i * 12.989 + t * 0.22) * 130;
        const y = h * 0.16 + Math.cos(i * 7.17 + t * 0.17) * 125;
        ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 1.6 : 0.8, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced.matches) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    const refresh = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
    window.addEventListener('resize', refresh); reduced.addEventListener('change', refresh);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', refresh); reduced.removeEventListener('change', refresh); };
  }, []);
  return <canvas ref={ref} className="medical-backdrop" aria-hidden="true"/>;
}