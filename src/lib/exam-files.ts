import { MAX_EXAM_FILE, type ExtractedPage } from "./exam-ingestion";

export const EXAM_FILE_ACCEPT = ".pdf,.docx,.pptx,.potx,.json,.txt,.md";
export function validateExamFile(file: Pick<File, "name" | "size">) {
  if (file.size > MAX_EXAM_FILE) throw new Error("The maximum file size is 50 MB.");
  if (!/\.(pdf|docx|pptx|potx|json|txt|md)$/i.test(file.name)) throw new Error("Use PDF, DOCX, PPTX/POTX, JSON or text. Convert older DOC/PPT files first.");
}
export async function extractExamFile(file: File, onProgress: (message: string) => void, signal?: AbortSignal): Promise<{ pages: ExtractedPage[]; json?: string }> {
  validateExamFile(file);
  const check = () => { if (signal?.aborted) throw new Error("Processing stopped"); };
  const bytes = new Uint8Array(await file.arrayBuffer());
  check();
  if (/\.(json|txt|md)$/i.test(file.name)) {
    const text = new TextDecoder().decode(bytes);
    if (text.length > 1500000) throw new Error("The document exceeds 1.5 million extracted characters. Split it into smaller files.");
    return { pages: [{ number: 1, text }], ...(/\.json$/i.test(file.name) ? { json: text } : {}) };
  }
  if (/\.(docx|pptx|potx)$/i.test(file.name)) {
    // Read only text: embedded question images are intentionally not imported.
    const zip = await (await import("jszip")).default.loadAsync(bytes);
    const parser = new DOMParser();
    const paths = /\.docx$/i.test(file.name) ? ["word/document.xml"] : Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
    const pages: ExtractedPage[] = [];
    for (const path of paths) {
      check(); const entry = zip.file(path); if (!entry) continue;
      const xml = parser.parseFromString(await entry.async("text"), "application/xml");
      const paras = Array.from(xml.getElementsByTagName(/\.docx$/i.test(file.name) ? "w:p" : "a:p"));
      const text = paras.map((p) => Array.from(p.getElementsByTagName(/\.docx$/i.test(file.name) ? "w:t" : "a:t")).map((t) => t.textContent ?? "").join("")).join("\n");
      pages.push({ number: pages.length + 1, text }); onProgress(`Extracting text ${pages.length}/${paths.length}`);
    }
    if (!pages.some((p) => p.text.trim())) throw new Error("No text found. Image-only Office files must be converted to PDF for OCR.");
    return { pages };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  let worker: import("tesseract.js").Worker | undefined;
  const pages: ExtractedPage[] = [];
  try {
    if (pdf.numPages > 300) throw new Error("PDFs are limited to 300 pages per upload. Split this archive first.");
    for (let n = 1; n <= pdf.numPages; n++) {
      check(); onProgress(`Extracting page ${n}/${pdf.numPages}`);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = content.items.map((i) => "str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "").join("").trim();
      if (text.replace(/\s/g, "").length < 40) {
        onProgress(`OCR page ${n}/${pdf.numPages}`);
        if (!worker) worker = await (await import("tesseract.js")).createWorker("fra+eng+ara");
        const canvas = document.createElement("canvas");
        const viewport = page.getViewport({ scale: Math.min(2, 2200 / page.getViewport({ scale: 1 }).width) });
        canvas.width = viewport.width; canvas.height = viewport.height;
        const context = canvas.getContext("2d"); if (!context) throw new Error("Cannot render scanned page");
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await worker.recognize(canvas);
        check(); text = result.data.text;
        pages.push({ number: n, text, ocr: true, confidence: result.data.confidence });
        canvas.width = 0; canvas.height = 0;
      } else pages.push({ number: n, text });
      page.cleanup();
    }
    if (!pages.some((p) => p.text.trim())) throw new Error("No readable text found. Check the scan quality.");
    if (pages.reduce((n, p) => n + p.text.length, 0) > 1500000) throw new Error("Split this archive: extracted text exceeds 1.5 million characters.");
    return { pages };
  } finally { if (worker) await worker.terminate(); await pdf.destroy(); }
}