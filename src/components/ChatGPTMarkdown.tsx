import React, { useState, useEffect, useMemo } from "react";
import { Check, Copy } from "lucide-react";

interface ChatGPTMarkdownProps {
  content: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
  className?: string;
}

export const ChatGPTMarkdown: React.FC<ChatGPTMarkdownProps> = ({
  content,
  isStreaming = false,
  onStreamComplete,
  className = "",
}) => {
  const [displayedLength, setDisplayedLength] = useState<number>(() =>
    isStreaming ? 0 : content.length
  );
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // Smooth token-by-token typewriter reveal if isStreaming is true
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(content.length);
      return;
    }

    if (displayedLength >= content.length) {
      onStreamComplete?.();
      return;
    }

    // Dynamic typing speed: fast for long responses, natural for short
    const step = content.length > 300 ? 5 : content.length > 100 ? 3 : 2;
    const interval = setTimeout(() => {
      setDisplayedLength((prev) => {
        const next = Math.min(prev + step, content.length);
        if (next >= content.length) {
          onStreamComplete?.();
        }
        return next;
      });
    }, 18);

    return () => clearTimeout(interval);
  }, [content, displayedLength, isStreaming, onStreamComplete]);

  const activeText = useMemo(() => {
    if (!isStreaming) return content;
    return content.slice(0, displayedLength);
  }, [content, displayedLength, isStreaming]);

  const handleCopyCode = (codeText: string, index: number) => {
    try {
      navigator.clipboard.writeText(codeText);
      setCopiedCodeIndex(index);
      setTimeout(() => setCopiedCodeIndex(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Parse lines and blocks
  const blocks = useMemo(() => {
    const raw = activeText;
    const lines = raw.split("\n");
    const result: Array<
      | { type: "code"; lang: string; code: string }
      | { type: "list"; items: string[] }
      | { type: "paragraph"; text: string }
    > = [];

    let inCode = false;
    let codeLang = "";
    let codeBuffer: string[] = [];
    let listBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer.length > 0) {
        result.push({ type: "list", items: [...listBuffer] });
        listBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block start/end
      if (line.trim().startsWith("```")) {
        if (!inCode) {
          flushList();
          inCode = true;
          codeLang = line.trim().slice(3).trim() || "text";
          codeBuffer = [];
        } else {
          inCode = false;
          result.push({
            type: "code",
            lang: codeLang,
            code: codeBuffer.join("\n"),
          });
          codeBuffer = [];
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      // Bullet lists
      const listMatch = line.match(/^(\*|-|\d+\.)\s+(.+)$/);
      if (listMatch) {
        listBuffer.push(listMatch[2]);
        continue;
      } else {
        flushList();
      }

      // Regular paragraph or line
      if (line.trim().length > 0) {
        result.push({ type: "paragraph", text: line });
      } else {
        // empty line spacing
        result.push({ type: "paragraph", text: "" });
      }
    }

    if (inCode && codeBuffer.length > 0) {
      result.push({
        type: "code",
        lang: codeLang,
        code: codeBuffer.join("\n"),
      });
    }

    flushList();
    return result;
  }, [activeText]);

  // Helper to format inline elements: **bold**, `code`, links, badges
  const renderInline = (str: string) => {
    if (!str) return null;

    // Tokens matching: **bold**, `code`, links, or text
    const parts: React.ReactNode[] = [];
    // Regex splits by `code` or **bold** or URLs
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+|PR\s*#\d+|✅)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push(str.substring(lastIdx, match.index));
      }

      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={match.index} style={{ fontWeight: 650, color: "inherit" }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={match.index}
            style={{
              padding: "2px 6px",
              background: "rgba(0, 0, 0, 0.06)",
              borderRadius: "5px",
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: "0.88em",
              color: "#be123c",
              wordBreak: "break-word",
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith("http://") || token.startsWith("https://")) {
        parts.push(
          <a
            key={match.index}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            {token}
          </a>
        );
      } else if (token.startsWith("PR") || token.startsWith("✅")) {
        parts.push(
          <span
            key={match.index}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 6px",
              background: token.includes("✅") ? "rgba(16, 185, 129, 0.12)" : "rgba(37, 99, 235, 0.1)",
              color: token.includes("✅") ? "#059669" : "#1d4ed8",
              borderRadius: "4px",
              fontSize: "0.9em",
              fontWeight: 600,
            }}
          >
            {token}
          </span>
        );
      } else {
        parts.push(token);
      }

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < str.length) {
      parts.push(str.substring(lastIdx));
    }

    return parts;
  };

  return (
    <div
      className={`chatgpt-markdown-rendered ${className}`}
      style={{
        lineHeight: 1.65,
        fontSize: "15px",
        color: "#18181B",
        wordBreak: "break-word",
      }}
    >
      {blocks.map((block, bIdx) => {
        if (block.type === "code") {
          return (
            <div
              key={bIdx}
              style={{
                margin: "12px 0",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid #e4e4e7",
                background: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  background: "#1e293b",
                  borderBottom: "1px solid #334155",
                  fontSize: "11.5px",
                  color: "#94a3b8",
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                <span>{block.lang || "code"}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.code, bIdx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copiedCodeIndex === bIdx ? "#10b981" : "#cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                  title="Nusxa olish"
                >
                  {copiedCodeIndex === bIdx ? (
                    <>
                      <Check size={12} />
                      <span>Nusxalandi</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Nusxa olish</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  overflowX: "auto",
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.55,
                }}
              >
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={bIdx}
              style={{
                margin: "6px 0 10px 0",
                paddingLeft: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {block.items.map((item, iIdx) => (
                <li
                  key={iIdx}
                  style={{
                    listStyleType: "disc",
                    lineHeight: 1.6,
                  }}
                >
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (!block.text) {
          return <div key={bIdx} style={{ height: "8px" }} />;
        }

        return (
          <p
            key={bIdx}
            style={{
              margin: "0 0 8px 0",
              lineHeight: 1.62,
            }}
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
};
