export const COLOR_NAME_MAP: Record<string, string> = {
  "qora": "#111111",
  "classic black": "#111111",
  "klassik qora": "#111111",
  "oq": "#ffffff",
  "white": "#ffffff",
  "qizil": "#d91e36",
  "red": "#d91e36",
  "bordo": "#800020",
  "burgundy": "#800020",
  "pushti": "#f4a6b8",
  "pink": "#f4a6b8",
  "och pushti": "#ffd6e0",
  "light pink": "#ffd6e0",
  "bej": "#e8c9a8",
  "beige": "#e8c9a8",
  "pushti bej": "#f3cfc6",
  "marvarid bej": "#ede6d6",
  "krem": "#f5ead2",
  "cream": "#f5ead2",
  "jigarrang": "#7a4b2a",
  "brown": "#7a4b2a",
  "to‘q ko‘k": "#17365d",
  "to'q ko'k": "#17365d",
  "navy": "#17365d",
  "to‘q qizil": "#8b0000",
  "to'q qizil": "#8b0000",
  "dark red": "#8b0000",
  "ko‘k": "#3b82c4",
  "ko'k": "#3b82c4",
  "blue": "#3b82c4",
  "yashil": "#2f7d4a",
  "green": "#2f7d4a",
  "zumrad": "#097969",
  "emerald": "#097969",
  "zaytun": "#71823b",
  "olive": "#71823b",
  "sariq": "#f1c40f",
  "yellow": "#f1c40f",
  "to‘q sariq": "#e67e22",
  "to'q sariq": "#e67e22",
  "orange": "#e67e22",
  "binafsha": "#7e57c2",
  "purple": "#7e57c2",
  "kulrang": "#808080",
  "gray": "#808080",
  "grey": "#808080",
  "nude": "#e3bc9a",
  "universal": "#d4a373",
};

export function parseColorValue(raw: string): { name: string; hex: string } {
  if (!raw) return { name: "", hex: "#dddddd" };
  const str = String(raw).trim();

  // If format is "Name|#hex" or "Name | #hex"
  if (str.includes("|")) {
    const parts = str.split("|").map((p) => p.trim());
    const name = parts[0] || "";
    let hex = parts[1] || "";
    if (hex && !hex.startsWith("#") && /^[0-9a-fA-F]{3,8}$/.test(hex)) {
      hex = `#${hex}`;
    }
    return {
      name: name || hex,
      hex: hex || COLOR_NAME_MAP[name.toLowerCase()] || "#b95a70",
    };
  }

  // If raw is just a hex code
  if (str.startsWith("#")) {
    return { name: str, hex: str };
  }

  const normalized = str.toLowerCase().replace(/['`‘’]/g, "'").trim();
  const hex =
    COLOR_NAME_MAP[normalized] || COLOR_NAME_MAP[str.toLowerCase()] || "#b95a70";
  return { name: str, hex };
}

export function formatColorName(raw: string): string {
  if (!raw) return "";
  const { name } = parseColorValue(raw);
  return name;
}

export function isLightColor(hex: string): boolean {
  if (!hex) return false;
  const c = hex.replace("#", "").trim();
  if (c.length === 3) {
    const r = parseInt(c[0] + c[0], 16);
    const g = parseInt(c[1] + c[1], 16);
    const b = parseInt(c[2] + c[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 175;
  }
  if (c.length >= 6) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 175;
  }
  return false;
}
