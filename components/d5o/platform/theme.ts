function luminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16)) ?? [255, 255, 255];
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastText(background: string) {
  return luminance(background) > 0.18 ? "#152b38" : "#ffffff";
}

export function previewAccent(accent: string, foundation: string) {
  const a = luminance(accent);
  const b = luminance(foundation);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio >= 4.5 ? accent : contrastText(foundation);
}
