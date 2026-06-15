import path from "node:path";

import {
  copyColor,
  extractKMeansPalette,
  loadWeightedColors,
  pickInitialCentroids,
} from "./palette";
import { hslToRgb, rgbToHsl } from "./color-space";
import { createThemeCandidatesFromPalette } from "./theme-candidates";

const hsl = rgbToHsl({ r: 235, g: 64, b: 52 });
console.log(hsl);
console.log(hslToRgb(hsl));

const sampleColor = { r: 235, g: 64, b: 52 };
const sampleColor_copy = copyColor(sampleColor);

sampleColor_copy.r = 200;

console.log(sampleColor);
console.log(sampleColor_copy);

/* (async () => {
  const result = await loadWeightedColors(imagePath);

  const centroids = pickInitialCentroids(result.points, 5);
  console.log(centroids);
})();
 */

async function main() {
  const imagePath = path.join(__dirname, "../sample", "image.jpg");

  const palette = await extractKMeansPalette(imagePath);

  console.table(
    palette.map((swatch, index) => ({
      index,
      hex: swatch.hex,
      score: swatch.score,
    })),
  );

  console.log("\nTheme candidates");
  const candidates = createThemeCandidatesFromPalette(palette);
  console.table(
    candidates.map((candidate, index) => ({
      index,
      type: candidate.type,
      sourceHex: candidate.sourceHex,
      sourceHexes: candidate.sourceHexes.join(", "),
      baseHex: candidate.baseHex,
      confidence: candidate.confidence.toFixed(4),
      reason: candidate.reason,
    })),
  );

  if (candidates[0]) {
    console.log("\nPrimary CSS vars");
    console.log(
      Object.entries(candidates[0].vars)
        .map(([key, value]) => `${key}: ${value};`)
        .join("\n"),
    );
  }
}
main();
