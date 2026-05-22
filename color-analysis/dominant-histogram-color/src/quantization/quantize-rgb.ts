import { RGBColor } from "../types/colors";
import { quantizeChannel } from "./quantize-channel";

export function quantizeRgb(color: RGBColor, bucketSize: number) {
  return {
    r: quantizeChannel(color.r, bucketSize),
    g: quantizeChannel(color.g, bucketSize),
    b: quantizeChannel(color.b, bucketSize),
  };
}
