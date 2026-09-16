/**
 * Safely copies text to the clipboard in any environment (including iframes,
 * WebViews, and when document is not focused).
 * 
 * Avoids uncaught promise rejection errors like:
 * "Failed to execute 'writeText' on 'Clipboard': Document is not focused."
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard if available
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Failed (e.g. Document is not focused or iframe permission blocked)
      // Fall through to execCommand fallback
    }
  }

  // 2. Robust fallback: document.execCommand('copy') with invisible textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Ensure element is off-screen and non-intrusive
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn("Clipboard copy fallback error:", err);
    return false;
  }
}
