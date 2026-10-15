"use client";

// Minimal, safe Markdown renderer (no HTML injection): headings, paragraphs, bullet/numbered
// lists, blockquotes, **bold**, *italic*, `code`, [links](url) and [n] source markers, which
// render as clickable citation pills when `onCite` is given.
import { Fragment, ReactNode } from "react";

type CiteFn = (n: number) => void;

function inline(text: string, onCite?: CiteFn, maxCite = 99): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|\[\d{1,2}\])/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (tok.startsWith("**") || tok.startsWith("__")) out.push(<strong key={k++}>{inline(tok.slice(2, -2), onCite, maxCite)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else if (/^\[\d{1,2}\]$/.test(tok)) {
      const n = Number(tok.slice(1, -1));
      out.push(
        n <= maxCite ? (
          <button
            key={k++}
            type="button"
            onClick={() => onCite?.(n)}
            className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-md bg-brand-50 px-1 align-middle text-[11px] font-semibold text-brand ring-1 ring-brand/15 hover:bg-brand hover:text-white"
            title={`Source ${n}`}
          >
            {n}
          </button>
        ) : null,
      );
    } else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>);
    } else out.push(<em key={k++}>{inline(tok.slice(1, -1), onCite, maxCite)}</em>);
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, onCite, maxCite, className = "" }: { text: string; onCite?: CiteFn; maxCite?: number; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], onCite, maxCite);
      blocks.push(level === 1 ? <h1 key={k++}>{content}</h1> : level === 2 ? <h2 key={k++}>{content}</h2> : level === 3 ? <h3 key={k++}>{content}</h3> : <h4 key={k++}>{content}</h4>);
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""), onCite, maxCite)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++}>{inline(q.join(" "), onCite, maxCite)}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push(
      <p key={k++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && " "}
            {inline(p, onCite, maxCite)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={`prose-legal ${className}`}>{blocks}</div>;
}
