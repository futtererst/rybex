export type Palette = { primary: string; accent: string };
export const palettes: Record<string, Palette> = {
  d5o: { primary: "#172B3A", accent: "#57D7C6" },
  rybex: { primary: "#102A43", accent: "#D4AF37" },
  rotork: { primary: "#171717", accent: "#C8102E" }
};
// Presentation-only presets for the admitted synthetic workspaces, never business rules.
export function workspacePalette(workspace?: string): Palette {
  if (workspace === "5488a1a7-d6eb-460c-88a4-4629d742d705") return palettes.rybex;
  if (workspace === "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6") return palettes.rotork;
  return palettes.d5o;
}
export function validPalette(value: unknown): value is Palette {
  if (!value || typeof value !== "object") return false;
  const p = value as Palette;
  return /^#[0-9a-f]{6}$/i.test(p.primary) && /^#[0-9a-f]{6}$/i.test(p.accent);
}
export function foreground(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
