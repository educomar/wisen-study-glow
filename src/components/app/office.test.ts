import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import { officeKind, splitHtmlPages } from "./office";

describe("office readers", () => {
  test("detects docx and pptx only for zip bytes", () => {
    const zip = new Uint8Array([0x50, 0x4b, 3, 4]);
    expect(officeKind("Cours.docx", zip)).toBe("docx");
    expect(officeKind("Cours.pptx", zip)).toBe("pptx");
    expect(officeKind("Cours.pptx", new Uint8Array([0x25, 0x50]))).toBeNull();
  });

  test("splits a document into a new page at each top heading", () => {
    const pages = splitHtmlPages("<h1>Heart</h1><p>Atria</p><h1>Lungs</h1><p>Alveoli</p>");
    expect(pages.map((p) => p.text)).toEqual(["Heart Atria", "Lungs Alveoli"]);
    expect(pages[1]!.pageNumber).toBe(2);
  });

  test("builds a zip that the pptx sniffer recognises", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", "<p/>");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const { sniffOffice } = await import("./office");
    expect(await sniffOffice(bytes)).toBe("pptx");
  });
});
