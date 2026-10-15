"use client";

import React from "react";

/** Render inline: `code`, **bold**, *italic*, [label](url) — tanpa simbol mentah. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="md-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key}>{renderInline(part.slice(2, -2), `${key}b`)}</strong>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (href.startsWith("#")) {
        return <span key={key} className="md-link-placeholder">{label}</span>;
      }
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="md-link">
          {label}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const { ordered, items } = listBuffer;
    listBuffer = null;
    if (ordered) {
      blocks.push(
        <ol key={`b${key++}`} className="md-ol">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `oli${key}-${i}`)}</li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`b${key++}`} className="md-ul">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `uli${key}-${i}`)}</li>
          ))}
        </ul>
      );
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const content = renderInline(heading[2], `h${key}`);
      if (level <= 2) blocks.push(<div key={`b${key++}`} className="md-h">{content}</div>);
      else if (level === 3) blocks.push(<div key={`b${key++}`} className="md-h3">{content}</div>);
      else blocks.push(<div key={`b${key++}`} className="md-h4">{content}</div>);
      continue;
    }
    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      continue;
    }
    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(olMatch[1]);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`b${key++}`} className="md-p">
        {renderInline(trimmed, `p${key}`)}
      </p>
    );
  }
  flushList();

  return <div className="md-body">{blocks}</div>;
}
