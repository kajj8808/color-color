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
  ratio: number;
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

// 255 를 240 같은 bucket 값으로 바꿈.
function quantizeChannel(value: number, bucketSize: number) {
  return Math.floor(value / bucketSize) * bucketSize;
}

// rgb 전체를 buckt rgb로 변경
function quantizeRgb(color: RGBColor, bucketSize: number): RGBColor {
  return {
    r: quantizeChannel(color.r, bucketSize),
    g: quantizeChannel(color.g, bucketSize),
    b: quantizeChannel(color.b, bucketSize),
  };
}

// color 를 객체 key로 사용하기 위해 사용.
function createColorKey(color: RGBColor) {
  return `${color.r},${color.g},${color.b}`;
}

// 처음 보는 bucket이면 새 그룹 생성.
function createColorGroup(bucket: RGBColor): ColorGroup {
  return {
    bucket,
    count: 0,
    redTotal: 0,
    greenTotal: 0,
    blueTotal: 0,
  };
}

// bucket에 픽셀츨 추가하고 count 추가, 원본 RGB 값 누적
function addColorToGroup(group: ColorGroup, color: RGBColor) {
  group.count += 1;

  group.redTotal += color.r;
  group.greenTotal += color.g;
  group.blueTotal += color.b;
}

function collectColorGroups(pixels: Uint8Array, options: ResolvedOptions) {
  const groups: Record<string, ColorGroup> = {};

  for (let index = 0; index < pixels.length; index += options.channels) {
    const pixel = readPixel(pixels, index, options.channels);

    // 밝기 기준으로..
    if (pixel.alpha < options.alphaThreshold) {
      continue;
    }

    const bucket = quantizeRgb(pixel.color, options.bucketSize);
    const key = createColorKey(bucket);

    if (!groups[key]) {
      groups[key] = createColorGroup(bucket);
    }

    addColorToGroup(groups[key], pixel.color);
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
  validateBucketSize(resolvedOptions.bucketSize);

  const groups = collectColorGroups(pixels, resolvedOptions);

  return createCandidatesFromGroups(groups);
}

export function averageRgb(
  redTotal: number,
  greenTotal: number,
  blueTotal: number,
  count: number,
): RGBColor {
  return {
    r: Math.round(redTotal / count),
    g: Math.round(greenTotal / count),
    b: Math.round(blueTotal / count),
  };
}

export function countTotalPixels(groups: Record<string, ColorGroup>) {
  return Object.values(groups).reduce((total, group) => {
    return total + group.count;
  }, 0);
}

function createColorCandidate(
  group: ColorGroup,
  totalPixels: number,
): ColorCandidate {
  return {
    color: averageRgb(
      group.redTotal,
      group.greenTotal,
      group.blueTotal,
      group.count,
    ),
    bucket: group.bucket,
    count: group.count,
    ratio: group.count / totalPixels,
  };
}

function createCandidatesFromGroups(
  groups: Record<string, ColorGroup>,
): ColorCandidate[] {
  const totalPixels = countTotalPixels(groups);

  if (totalPixels === 0) {
    return [];
  }

  return Object.values(groups)
    .map((group) => createColorCandidate(group, totalPixels))
    .sort((a, b) => b.count - a.count);
}
