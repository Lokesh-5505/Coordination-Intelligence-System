import React from "react";

interface FormattedMessageProps {
  content: string;
}

export function FormattedMessage({ content }: FormattedMessageProps) {
  if (!content) return null;

  // Split lines into blocks
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    if (currentList.type === "ul") {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="chat-markdown-ul">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="chat-markdown-li">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`list-${blocks.length}`} className="chat-markdown-ol">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="chat-markdown-li">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Heading: ### or ##
    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4 key={`h-${i}`} className="chat-markdown-h4">
          {renderInline(trimmed.replace(/^###\s+/, ""))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={`h-${i}`} className="chat-markdown-h3">
          {renderInline(trimmed.replace(/^##\s+/, ""))}
        </h3>
      );
      continue;
    }

    // Bullet item: - or *
    if (/^[-*]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      if (currentList && currentList.type === "ul") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ul", items: [itemText] };
      }
      continue;
    }

    // Numbered item: 1. 2. etc
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (currentList && currentList.type === "ol") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ol", items: [itemText] };
      }
      continue;
    }

    // Sub-bullet indented
    if (/^\s+[-*]\s+/.test(rawLine)) {
      const subText = rawLine.trim().replace(/^[-*]\s+/, "");
      if (currentList) {
        currentList.items.push(subText);
      } else {
        currentList = { type: "ul", items: [subText] };
      }
      continue;
    }

    // Regular paragraph line
    flushList();
    blocks.push(
      <p key={`p-${i}`} className="chat-markdown-p">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="chat-formatted-content">{blocks}</div>;
}

/**
 * Helper to parse bold (**...**), italics (*...*), inline code (`...`), and plain text
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex to match **bold**, *italic*, `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="chat-inline-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={index} className="chat-inline-em">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="chat-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
