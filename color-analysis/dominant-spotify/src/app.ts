import path from "node:path";

import { copyColor, loadWeightedColors } from "./palette";
import { hslToRgb, rgbToHsl } from "./color-space";

const hsl = rgbToHsl({ r: 235, g: 64, b: 52 });
console.log(hsl);
console.log(hslToRgb(hsl));

const sampleColor = { r: 235, g: 64, b: 52 };
const sampleColor_copy = copyColor(sampleColor);

sampleColor_copy.r = 200;

console.log(sampleColor);
console.log(sampleColor_copy);

const imagePath = path.join(__dirname, "../sample", "image.jpg");
(async () => {
  const colors = await loadWeightedColors(imagePath);
  console.log(colors.points[1]);
})();
