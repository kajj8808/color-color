import sharp from "sharp";
import { Buffer } from "buffer";

import { rgbToHex } from "./color";

export interface ImagePixelData {
  width: number;
  height: number;
  data: Uint8Array;
  channels: number;
}

export function calculateAverageColor(image: ImagePixelData) {
  const { data, channels } = image;
  const pixelCount = data.length / channels;

  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < data.length; i += channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  return {
    r: Math.round(r / pixelCount),
    g: Math.round(g / pixelCount),
    b: Math.round(b / pixelCount),
  };
}

export async function getImageAverageColor(
  url: string,
  resultType: "hex" | "rgb" = "hex",
) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const image = sharp(Buffer.from(buffer));

  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = calculateAverageColor({
    data,
    ...info,
  });

  return resultType === "hex" ? rgbToHex(result) : result;
}
