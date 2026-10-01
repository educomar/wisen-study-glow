import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { Fragment, type ReactNode } from "react";

/** Renders Wisen text with **bold**, "- " bullets, LaTeX ($..$, $$..$$, \(..\), \[..\]) and mhchem (\ce{..}). */
const MATH = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\\ce\{(?:[^{}]|\{[^{}]*\})*\})/g;

function tex(src: string, display: boolean) {
  try { return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: "ignore" }); } catch { return src; }
}

export function Inline({ text }: { text: string }): ReactNode {
  return text.split(MATH).map((seg, i) => {
    if (i % 2) {
      const display = seg.startsWith("$$") || seg.startsWith("\\[");
      const inner = seg.startsWith("\\ce") ? seg : seg.startsWith("$$") ? seg.slice(2, -2) : seg.startsWith("$") ? seg.slice(1, -1) : seg.slice(2, -2);
      return <span key={i} className={display ? "my-2 block overflow-x-auto" : ""} dangerouslySetInnerHTML={{ __html: tex(inner, display) }} />;
    }
    return <Fragment key={i}>{seg.split(/\*\*(.+?)\*\*/g).map((x, j) => (j % 2 ? <strong key={j}>{x}</strong> : x))}</Fragment>;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  // Keep display blocks together before splitting into lines.
  const blocks = text.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g).flatMap((b, i) => (i % 2 ? [b] : b.split(/\n+/))).filter((l) => l.trim());
  return (
    <div dir="auto" className={className ?? "space-y-1.5"}>
      {blocks.map((l, i) => {
        const b = /^\s*[-•*]\s+/.test(l);
        const body = <Inline text={l.replace(/^\s*[-•*]\s+/, "")} />;
        return b ? <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:text-primary before:content-['•']">{body}</p> : <p key={i}>{body}</p>;
      })}
    </div>
  );
}
