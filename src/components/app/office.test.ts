import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { officeKind, sniffOffice, splitHtmlPages } from "./office";

test("detects docx and pptx only for zip bytes", () => {
  const zip = new Uint8Array([0x50, 0x4b, 3, 4]);
  assert.equal(officeKind("Cours.docx", zip), "docx");
  assert.equal(officeKind("Cours.pptx", zip), "pptx");
  assert.equal(officeKind("Cours.pptx", new Uint8Array([0x25, 0x50])), null);
});

test("splits a document into a new page at each top heading", () => {
  const pages = splitHtmlPages("<h1>Heart</h1><p>Atria</p><h1>Lungs</h1><p>Alveoli</p>");
  assert.deepEqual(pages.map((p) => p.text), ["Heart Atria", "Lungs Alveoli"]);
});

test("recognises a PowerPoint file without an extension", async () => {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", "<p/>");
  assert.equal(await sniffOffice(await zip.generateAsync({ type: "uint8array" })), "pptx");
});
