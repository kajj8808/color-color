import { LABColor } from "../types/colors";

// LAB 공간에서 두 점 사이의 거리 계산
export function deltaE76(a: LABColor, b: LABColor) {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}
