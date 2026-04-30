export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
