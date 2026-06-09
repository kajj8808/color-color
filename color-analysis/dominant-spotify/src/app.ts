import { hslToRgb, parseHexRgb, rgbToHsl, toHexRgb } from "./color-space";

/* console.log(parseHexRgb("#eb4034"));

console.log(toHexRgb({ r: 235, g: 64, b: 52 })); */
const hsl = rgbToHsl({ r: 235, g: 64, b: 52 });
console.log(hsl);
console.log(hslToRgb(hsl));
