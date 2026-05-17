import { RGBColor } from "../types/colors";

export function rgbDistance(a: RGBColor, b: RGBColor) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
