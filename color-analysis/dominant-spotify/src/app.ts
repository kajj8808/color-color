import path from "node:path";

import {
  copyColor,
  extractKMeansPalette,
  loadWeightedColors,
  pickInitialCentroids,
} from "./palette";
import { hslToRgb, rgbToHsl } from "./color-space";
import { createThemeCandidatesFromPalette } from "./theme-candidates";
import { resolveThemeCandidate } from "./resolver";

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
  const imagePath = path.join(__dirname, "../sample", "image_2.jpg");

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
      family: candidate.family,
      sourceHex: candidate.sourceHex,
      sourceHexes: candidate.sourceHexes.join(", "),
      baseHex: candidate.baseHex,
      confidence: candidate.confidence.toFixed(4),
      reason: candidate.reason,
    })),
  );

  const primary = resolveThemeCandidate(candidates);

  if (!primary) {
    console.log("No theme candidate found.");
    return;
  }

  console.log("\nPrimary theme candidate");
  console.table([
    {
      type: primary.type,
      family: primary.family,
      sourceHex: primary.sourceHex,
      baseHex: primary.baseHex,
      confidence: primary.confidence.toFixed(4),
    },
  ]);

  console.log("\nPrimary CSS vars");
  console.log(
    Object.entries(primary.vars)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n"),
  );
}
main();
