import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTree, cleanName, detectKind, FOLDER, parseFolderId } from "./drive-import";

type T = { id: string; name: string; mimeType: string; size: number; createdTime: string | null; children?: T[] | undefined };
const f = (id: string, name: string, children?: T[]): T => ({ id, name, mimeType: children ? FOLDER : "application/pdf", size: 1, createdTime: null, children });

describe("drive importer", () => {
  it("tags EMD, QCM, Rattrapage and Sujet files as past EMDs", () => {
    assert.equal(detectKind("EMD1 2022.pdf"), "past_emd");
    assert.equal(detectKind("Sujet Rattrapage.pdf"), "past_emd");
    assert.equal(detectKind("serie.pdf", ["QCM Anatomie"]), "past_emd");
    assert.equal(detectKind("Cours Femur.pdf"), "course");
  });
  it("strips course prefixes, version tags, underscores and dates", () => {
    assert.equal(cleanName("cours_plexus_brachial_v2_final.pdf", true), "Plexus Brachial.pdf");
    assert.equal(cleanName("TD_le femur 2023"), "Le Femur");
  });
  it("maps a year folder to subjects, units, lessons and files", () => {
    const root = f("r", "Year 1", [f("s", "Anatomie", [f("u", "Osteologie", [f("l", "Femur", [f("x", "a.pdf")])])])]);
    const t = buildTree(root, "year");
    assert.equal(t[0]!.type, "subject");
    assert.equal(t[0]!.children[0]!.children[0]!.children[0]!.driveId, "x");
  });
  it("reads folder ids from Drive links", () => {
    assert.equal(parseFolderId("https://drive.google.com/drive/folders/1AbCdEfGhIjK?usp=sharing"), "1AbCdEfGhIjK");
    assert.equal(parseFolderId("not a link"), null);
  });
});
