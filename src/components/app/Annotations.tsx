import { useEffect, useRef, useState } from "react";

export type AnnoTool = "none" | "pen" | "highlight" | "text" | "eraser";
type Pt = [number, number];
type Item =
  | { t: "stroke"; c: string; w: number; a: number; pts: Pt[] }
  | { t: "text"; c: string; x: number; y: number; s: string };

const key = (doc: string, page: number) => `wisen-anno:${doc}:${page}`;
const EVT = "wisen-anno-change";
export const ANNO_COLORS = ["#1d6fd8", "#e0352b", "#111827", "#f5c400", "#22c55e", "#ec4899"];

function load(doc: string, page: number): Item[] {
  try { return JSON.parse(localStorage.getItem(key(doc, page)) ?? "[]") as Item[]; } catch { return []; }
}
function save(doc: string, page: number, items: Item[]) {
  localStorage.setItem(key(doc, page), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT, { detail: key(doc, page) }));
}
export function undoAnno(doc: string, page: number) { save(doc, page, load(doc, page).slice(0, -1)); }
export function clearAnno(doc: string, page: number) { save(doc, page, []); }

/** Drawing layer over one page. Coordinates are stored 0..1 so they survive zoom. */
export function Annotated({ doc, page, tool, color, children }: { doc: string; page: number; tool: AnnoTool; color: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const cur = useRef<Item | null>(null);

  useEffect(() => {
    setItems(load(doc, page));
    const on = (e: Event) => { if ((e as CustomEvent).detail === key(doc, page)) setItems(load(doc, page)); };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [doc, page]);

  const draw = () => {
    const c = cv.current, b = box.current;
    if (!c || !b) return;
    const W = b.clientWidth, H = b.clientHeight, dpr = window.devicePixelRatio || 1;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const it of cur.current ? [...items, cur.current] : items) {
      if (it.t === "stroke") {
        g.globalAlpha = it.a; g.strokeStyle = it.c; g.lineWidth = it.w; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath();
        it.pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
        g.stroke();
      } else {
        g.globalAlpha = 1; g.fillStyle = it.c; g.font = "600 15px system-ui, sans-serif";
        it.s.split("\n").forEach((l, i) => g.fillText(l, it.x * W, it.y * H + i * 18));
      }
    }
    g.globalAlpha = 1;
  };
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  });

  const pos = (e: React.PointerEvent): Pt => {
    const r = box.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e: React.PointerEvent) => {
    if (tool === "none") return;
    e.preventDefault();
    const p = pos(e);
    if (tool === "text") {
      const s = window.prompt("Note");
      if (s?.trim()) save(doc, page, [...items, { t: "text", c: color, x: p[0], y: p[1], s: s.trim() }]);
      return;
    }
    if (tool === "eraser") {
      const r = box.current!.getBoundingClientRect(), tol = 14;
      const hit = (it: Item) => it.t === "stroke"
        ? it.pts.some(([x, y]) => Math.hypot((x - p[0]) * r.width, (y - p[1]) * r.height) < tol + it.w / 2)
        : Math.hypot((it.x - p[0]) * r.width, (it.y - p[1]) * r.height) < 30;
      const idx = items.map(hit).lastIndexOf(true);
      if (idx >= 0) save(doc, page, items.filter((_, i) => i !== idx));
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    cur.current = tool === "pen" ? { t: "stroke", c: color, w: 2.5, a: 1, pts: [p] } : { t: "stroke", c: color, w: 18, a: 0.3, pts: [p] };
    draw();
  };
  const move = (e: React.PointerEvent) => {
    if (cur.current?.t !== "stroke") return;
    cur.current.pts.push(pos(e));
    draw();
  };
  const up = () => {
    const it = cur.current;
    cur.current = null;
    if (it && it.t === "stroke" && it.pts.length > 1) save(doc, page, [...items, it]);
    else draw();
  };

  return (
    <div ref={box} className="relative">
      {children}
      <canvas
        ref={cv}
        aria-label="Annotation layer"
        className="absolute inset-0 z-10 h-full w-full touch-none"
        style={{ pointerEvents: tool === "none" ? "none" : "auto", cursor: tool === "none" ? undefined : tool === "text" ? "text" : "crosshair" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}
