import { hslToRgb, parseHexRgb, rgbToHsl, toHexRgb } from "./color-space";
import { copyColor } from "./palette";

/* console.log(parseHexRgb("#eb4034"));

console.log(toHexRgb({ r: 235, g: 64, b: 52 })); */
const hsl = rgbToHsl({ r: 235, g: 64, b: 52 });
console.log(hsl);
console.log(hslToRgb(hsl));

const sampleColor = { r: 235, g: 64, b: 52 };
const sampleColor_copy = copyColor(sampleColor);

sampleColor_copy.r = 200;

console.log(sampleColor);
console.log(sampleColor_copy);
