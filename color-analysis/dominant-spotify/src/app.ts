import path from "node:path";

import {
  copyColor,
  extractKMeansPalette,
  loadWeightedColors,
  pickInitialCentroids,
} from "./palette";
import { hslToRgb, rgbToHsl } from "./color-space";

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
}
main();
