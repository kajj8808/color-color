import { LABColor } from "../types/colors";

export function deltaE76(a: LABColor, b: LABColor) {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}
