import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Lib = typeof import("pdfjs-dist");
let libPromise: Promise<Lib> | null = null;
export function loadPdfLib() {
  libPromise ??= (async () => {
    const m = await import("pdfjs-dist");
    const w = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    m.GlobalWorkerOptions.workerSrc = w.default;
    return m;
  })();
  return libPromise;
}

export function PdfPage({ pdf, n, width }: { pdf: PDFDocumentProxy; n: number; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [h, setH] = useState(width * 1.414);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !width) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const lib = await loadPdfLib();
      const page = await pdf.getPage(n);
      if (cancelled || !canvas.current || !text.current) return;
      const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      setH(vp.height);
      const os = Math.max(2, window.devicePixelRatio || 1);
      const c = canvas.current;
      c.width = Math.floor(vp.width * os);
      c.height = Math.floor(vp.height * os);
      c.style.width = `${vp.width}px`;
      c.style.height = `${vp.height}px`;
      const r = page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp, transform: [os, 0, 0, os, 0, 0] });
      task = r;
      await r.promise.catch(() => {});
      if (cancelled) return;
      text.current.innerHTML = "";
      text.current.style.setProperty("--scale-factor", String(vp.scale));
      text.current.style.setProperty("--total-scale-factor", String(vp.scale));
      await new lib.TextLayer({ textContentSource: page.streamTextContent(), container: text.current, viewport: vp }).render();
    })().catch(() => {});
    return () => { cancelled = true; task?.cancel(); };
  }, [near, width, pdf, n]);

  return (
    <div ref={box} data-page={n} className="relative mx-auto overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-border" style={{ width, height: h }}>
      <canvas ref={canvas} className="block" />
      <div ref={text} className="textLayer" style={{ width, height: h }} />
      <span className="pointer-events-none absolute bottom-1 right-2 font-mono text-[10px] text-muted-foreground">p. {n}</span>
    </div>
  );
}
