/** Browser-side readers for Word (.docx) and PowerPoint (.pptx) lectures, split into citable pages. */
export type OfficeKind = "docx" | "pptx";
export type OfficePage = { pageNumber: number; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function officeKind(name: string, bytes: Uint8Array): OfficeKind | null {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!zip) return null;
  if (/\.docx$/i.test(name)) return "docx";
  if (/\.pptx$/i.test(name)) return "pptx";
  return null;
}

/** Sniff the kind from the zip contents when the file name has no usable extension. */
export async function sniffOffice(bytes: Uint8Array): Promise<OfficeKind | null> {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return null;
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  if (zip.file("word/document.xml")) return "docx";
  if (zip.file("ppt/presentation.xml")) return "pptx";
  return null;
}

/** Split HTML into pages at headings, or roughly every 3500 characters of text. */
export function splitHtmlPages(html: string): OfficePage[] {
  const blocks = html.split(/(?=<h[12][\s>])/i);
  const pages: OfficePage[] = [];
  let buf = "";
  const flush = () => {
    if (!buf.trim()) return;
    const text = buf.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    pages.push({ pageNumber: pages.length + 1, html: buf, text });
    buf = "";
  };
  for (const b of blocks) {
    for (const part of b.split(/(?<=<\/p>)/i)) {
      if (buf.replace(/<[^>]+>/g, "").length > 3500) flush();
      buf += part;
    }
    if (/^<h1/i.test(b) || buf.replace(/<[^>]+>/g, "").length > 1500) flush();
  }
  flush();
  return pages;
}

async function readDocx(bytes: Uint8Array): Promise<OfficePage[]> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.convertToHtml({ arrayBuffer: bytes.slice().buffer });
  // Mammoth emits its own markup; strip anything active defensively.
  return splitHtmlPages(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, ""));
}

async function readPptx(bytes: Uint8Array): Promise<OfficePage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
  const parser = new DOMParser();
  const pages: OfficePage[] = [];
  for (const path of slides) {
    const xml = parser.parseFromString(await zip.file(path)!.async("text"), "application/xml");
    const paras = Array.from(xml.getElementsByTagName("a:p"))
      .map((p) => Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join("").trim())
      .filter(Boolean);
    const relsPath = path.replace("slides/", "slides/_rels/") + ".rels";
    const rels = zip.file(relsPath) ? parser.parseFromString(await zip.file(relsPath)!.async("text"), "application/xml") : null;
    const images: string[] = [];
    for (const blip of Array.from(xml.getElementsByTagName("a:blip"))) {
      const id = blip.getAttribute("r:embed");
      const target = rels && Array.from(rels.getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === id)?.getAttribute("Target");
      if (!target) continue;
      const media = zip.file("ppt/" + target.replace(/^\.\.\//, ""));
      const ext = target.split(".").pop()?.toLowerCase() ?? "";
      if (!media || !["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) continue;
      const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
      images.push(`data:${mime};base64,${await media.async("base64")}`);
    }
    const [title, ...body] = paras;
    const html = `${title ? `<h2>${esc(title)}</h2>` : ""}${body.map((p) => `<p>${esc(p)}</p>`).join("")}${images.map((src) => `<img src="${src}" alt="" loading="lazy"/>`).join("")}`;
    pages.push({ pageNumber: pages.length + 1, text: paras.join("\n"), html });
  }
  return pages;
}

export function readOffice(kind: OfficeKind, bytes: Uint8Array) {
  return kind === "docx" ? readDocx(bytes) : readPptx(bytes);
}

/** Plain text with page markers, for Wisen AI grounding. */
export async function officeText(kind: OfficeKind, bytes: Uint8Array, max = 55000) {
  const pages = await readOffice(kind, bytes);
  return pages.map((p) => `\n[Page ${p.pageNumber}] ${p.text.replace(/\s+/g, " ")}`).join("").slice(0, max);
}
