import { RGBColor } from "../types/colors";

interface ColorGroup {
  bucket: RGBColor;
  count: number;

  redTotal: number;
  greenTotal: number;
  blueTotal: number;
}

export interface ColorCandidate {
  color: RGBColor;
  bucket: RGBColor;

  count: number;
  radio: number;
}

interface CreateColorCandidatesOptions {
  channels?: 3 | 4;
  bucketSize?: number;
  alphaThreshold?: number;
}

interface ResolvedOptions {
  channels: 3 | 4;
  bucketSize: number;
  alphaThreshold: number;
}

interface Pixel {
  color: RGBColor;
  alpha: number;
}

function validatePixels(pixels: Uint8Array, channels: 3 | 4 = 4) {
  // rgba -> r,g,b,a
  if (pixels.length % channels !== 0) {
    throw new Error(
      `pixels length must be a multiple of ${channels} (${channels === 4 ? "rgba" : "rgb"})`,
    );
  }
}

function validateBucketSize(bucketSize: number) {
  // bucket 은 보통 count 하기에 1부터 256까지임. 0~255 은 256개임.
  if (bucketSize <= 0 || bucketSize > 256) {
    throw new Error("bucket size must be between 1 and 256. (0~255 total 256)");
  }
}

function resolveOptions(options: CreateColorCandidatesOptions) {
  return {
    channels: options.channels ?? 4,
    bucketSize: options.bucketSize ?? 16,
    alphaThreshold: options.alphaThreshold ?? 1,
  };
}

function collectColorGroups(pixels: Uint8Array, options: ResolvedOptions) {
  const groups = {};

  for (let index = 0; index < pixels.length; index += options.channels) {
    const pixel = readPixel(pixels, index, options.channels);

    console.log(pixel);
  }

  return groups;
}

function readPixel(pixels: Uint8Array, index: number, channels: 3 | 4): Pixel {
  return {
    color: {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
    },
    alpha: channels === 4 ? pixels[index + 3] : 255,
  };
}

export function createColorCandidates(
  pixels: Uint8Array,
  options: CreateColorCandidatesOptions = {},
) {
  const resolvedOptions = resolveOptions(options);

  validatePixels(pixels, resolvedOptions.channels);

  const groups = collectColorGroups(pixels, resolvedOptions);

  console.log(groups);
}
