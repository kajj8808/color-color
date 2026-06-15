import sharp from "sharp";
import {
  clampByte,
  colorfulness,
  HSL,
  labChroma,
  luma,
  RGB,
  rgbSaturation,
  rgbToHsl,
  rgbToLab,
  toHexRgb,
} from "./color-space";

export interface PaletteSwatch {
  color: RGB;
  hex: string;

  /**
   * 전체 pixel 중 cluster가 차지하는 비율 흰색을 제외하기 전 전체 기준
   *   */
  imageCoverage: number;

  /**
   * 필터링 후 남은 pxiel 중 이 cluter가 차지하는 비율,
   * 후보 색상 사이의 dominance를 볼 때 사용.
   */
  keptCoverage: number;

  count: number;

  luma: number;
  saturation: number;
  colorfulness: number;
  labChroma: number;

  hsl: HSL;

  /**
   * 후보 정렬용 점수 최종 정답 색상이라는 뜻은 아님.
   */
  score: number;
}

export interface WeightedColor {
  color: RGB;
  weight: number;
}

export interface KMeansPaletteOptions {
  /**
   * K-means cluster 개수
   * palette 후보는 8~12 정도가 좋아보임.
   */
  k?: number;

  /**
   * resize 크기 색상 추출용이라 원본 크기 상관 x
   */
  size?: number;

  /**
   * K-means 반복 횟수.
   */
  maxIterations?: number;

  /**
   * 비슷한 RGB를 먼저 약하기 묶기 위한 step, 4면 꽤 정밀, 8이면 더 빠름.
   * 크기에 따라 속도가 올라가고 정밀도가 떨어진다 보면 됨.
   */
  quantizeStep?: number;

  /**
   * 거의 흰색 배경/로고 제거 기준.
   */
  nearWhiteLuma?: number;

  /**
   * 거의 검정에 가까운 픽셀 제거 기준, 너무 높게 잡으면 dark-vibrant 후보가 사라짐.
   */
  nearBlackLuma?: number;
}

const DEFAULT_OPTIONS: Required<KMeansPaletteOptions> = {
  k: 10,
  size: 128,
  maxIterations: 16,
  quantizeStep: 4,
  nearWhiteLuma: 248,
  nearBlackLuma: 8,
};

/**
 RGB 색상 공간에서 두 색상 간 유클리드(Squared Euclidean Distance) 제곱을 계산하는 함수.
 두 색상이 서로 얼마나 비슷한지를 계산하기 위한 함수입니다.
 */
function squaredDistance(aColor: RGB, bColor: RGB) {
  const dr = aColor.r - bColor.r;
  const dg = aColor.g - bColor.g;
  const db = aColor.b - bColor.b;

  return dr * dr + dg * dg + db * db;
}

/**
 * 단일 색상 채널 (R,G,B 중 하나)의 값을 단순화 하는 양자화(Quantization) 함수
 * 수많은 값을 몇가지 지정된 간격(step)으로 반올림해서 묶어주는 역활을 하는 함수 입니다.
 * */
function quantizeChannel(value: number, step: number) {
  return clampByte(Math.round(value / step) * step);
}

/**
 * 색상을 복사하는 유틸 함수
 * 객체 참조가 섞이는 것을 피하기 위해 사용합니다.
 */
export function copyColor(color: RGB): RGB {
  return { ...color };
}

/**
 * 주어진 pixel을 palette후보로 사용할지 결정합니다.
 *
 * 중요한 부분: 너무 많은 색을 버리는 옵션을 주면 안됩니다.
 * luma < 80 과 같이 어두운 색을 제거하면 dark navy 와 같은 어두운 색상의 후보가 사라질 가능성이 생깁니다.
 */
function shouldKeepPixel(color: RGB, options: Required<KMeansPaletteOptions>) {
  const y = luma(color);
  const sat = rgbSaturation(color);

  /**
   * 완전한? 흰색만 제거합니다. (luma가 높고, saturaion도 낮은 경우만 제거합니다.)
   */
  if (y >= options.nearWhiteLuma && sat < 0.06) {
    return false;
  }

  /**
   * 거의 완전한 검정만 제거합니다. 어두운 파랑, 어두운 보라, 어두운 빨강 후보가 될 수 있으므로 nearBlackLuma는 낮게 잡습니다.
   */
  if (y <= options.nearBlackLuma) {
    return false;
  }

  return true;
}

/**
 * 이미지를 읽고 k-means 에 넣을 색상 목록을 만듭니다.
 *
 * 1. sharp로 이미지를 resize
 * 2. alpha가 있으면 흰색 배경으로 flatten
 * 3. raw RGB pixel을 읽음.
 * 4. 너무 흰색/검정에 가까운 pixel은 제거
 * 5. RGB를 quantize해서 비슷한 색끼리 묶음
 * 6. 같은 색이 몇 번 나왔는지 weight로 저장 (quantize 과정을 통해 쉬워짐)
 */
export async function loadWeightedColors(
  imagePath: string,
  options: Required<KMeansPaletteOptions> = DEFAULT_OPTIONS,
) {
  // 비율은 다소 망가져도 분석에는 상관 x
  // 이후 배경을 흰색으로 채우고(투명도도 사용해서 색상 결정), 이렇게 되면 투명도 정보는 의미가 없어지기에.
  const { data, info } = await sharp(imagePath)
    .resize(options.size, options.size, {
      fit: "cover",
    })
    .flatten({
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    })
    .removeAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });
  const pixels = new Uint8Array(data);
  const channels = info.channels;

  const totalPixels = info.width * info.height;
  let keptPixels = 0;

  const colorMap = new Map<string, { color: RGB; weight: number }>();

  for (let i = 0; i < pixels.length; i += channels) {
    const rawColor: RGB = {
      r: pixels[i],
      g: pixels[i + 1],
      b: pixels[i + 2],
    };

    if (!shouldKeepPixel(rawColor, options)) {
      continue;
    }

    keptPixels += 1;

    const color: RGB = {
      r: quantizeChannel(rawColor.r, options.quantizeStep),
      g: quantizeChannel(rawColor.g, options.quantizeStep),
      b: quantizeChannel(rawColor.b, options.quantizeStep),
    };

    const key = `${color.r}.${color.g}.${color.b}`;
    const previous = colorMap.get(key);

    if (previous) {
      previous.weight += 1;
    } else {
      colorMap.set(key, { color, weight: 1 });
    }
  }

  return {
    points: [...colorMap.values()],
    totalPixels,
    keptPixels,
  };
}

/**
 * K-means의 초기 centroid를 고르는 함수입니다.
 * 첫 번쨰 centroid:
 *  많이 나오고 색감도 어느정도 있는 색
 * 두 번째 이후 centroid:
 *  이미 선택한 centroid들과 멀리 떨어진 색
 */
export function pickInitialCentroids(
  points: WeightedColor[],
  k: number,
): RGB[] {
  if (points.length === 0) {
    return [];
  }

  const centroids: RGB[] = [];

  let firstPoint = points[0];
  let firstScore = -Infinity;

  for (const point of points) {
    const y = luma(point.color);
    const sat = rgbSaturation(point.color);
    const colorful = colorfulness(point.color);

    const brightPenalty = y > 220 && sat < 0.12 ? 0.2 : 1;

    const score =
      Math.sqrt(point.weight) *
      (0.5 + sat) *
      (0.5 + colorful / 100) *
      brightPenalty;

    if (score > firstScore) {
      firstScore = score;
      firstPoint = point;
    }
  }

  centroids.push(copyColor(firstPoint.color));

  while (centroids.length < k && centroids.length < points.length) {
    let nextPoint = points[0];
    let nextScore = -Infinity;

    for (const point of points) {
      const nearesDistance = Math.min(
        ...centroids.map((centroid) => squaredDistance(point.color, centroid)),
      );

      /** 이미 선택된 centroid들과 멀리 떨어져 있고 어느정도 많이 나온 색을 다음 centroid 로 고릅니다 */
      const score = nearesDistance * Math.sqrt(point.weight);

      if (score > nextScore) {
        nextScore = score;
        nextPoint = point;
      }
    }

    if (nextScore <= 0) {
      break;
    }

    centroids.push(copyColor(nextPoint.color));
  }

  return centroids;
}

interface KMeansAssignmentResult {
  assignments: number[];
  sums: {
    r: number;
    g: number;
    b: number;
    weight: number;
  }[];
}

/**
 * 각 색상 point를 가장 가까운 centroid에 배정하는 함수입니다.
 *
 * 예:
 * point #1은 centroid 0번
 * point #2는 centroid 3번
 */
function assignPointsToCentroids(
  points: WeightedColor[],
  centroids: RGB[],
): KMeansAssignmentResult {
  const assignments = new Array<number>(points.length).fill(0);

  const sums = centroids.map(() => ({
    r: 0,
    g: 0,
    b: 0,
    weight: 0,
  }));

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];

    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let c = 0; c < centroids.length; c++) {
      const distance = squaredDistance(point.color, centroids[c]);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = c;
      }
    }

    assignments[i] = bestIndex;

    sums[bestIndex].r += point.color.r * point.weight;
    sums[bestIndex].g += point.color.g * point.weight;
    sums[bestIndex].b += point.color.b * point.weight;
    sums[bestIndex].weight += point.weight;
  }

  return { assignments, sums };
}

interface KMeansResult {
  centroids: RGB[];
  assignments: number[];
}

/**
 * K-means를 반복 실행하는 함수입니다. (오차가 가장 적은 상태로 가는 전략.)
 *
 * 흐름:
 * 1. 초기 centroid를 고른다.
 * 2. 각 point를 가장 가까운 centroid에 배정한다.
 * 3. cluster별 평균 색으로 centroid를 다시 계산한다.
 * 4. centroid 이동량이 작아질 때까지 반복한다.
 */
export function runWeightedMeans(
  points: WeightedColor[],
  k: number,
  maxIterations: number,
): KMeansResult {
  let centroids = pickInitialCentroids(points, k);

  if (centroids.length === 0) {
    return { assignments: [], centroids: [] };
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { sums } = assignPointsToCentroids(points, centroids);

    let maxShift = 0;

    const nextCentroids = centroids.map((centroids, index) => {
      const sum = sums[index];

      if (sum.weight === 0) {
        return centroids;
      }

      const newCentroid: RGB = {
        r: Math.round(sum.r / sum.weight),
        g: Math.round(sum.g / sum.weight),
        b: Math.round(sum.b / sum.weight),
      };

      const shift = squaredDistance(centroids, newCentroid);
      maxShift = Math.max(maxShift, shift);

      return newCentroid;
    });

    centroids = nextCentroids;

    /**
     * centroid 이동량이 0.5 미만이면 충분히 수렴했다고 보고 멈춥니다. (반복 필요 x)
     */
    if (maxShift < 0.5) {
      break;
    }
  }
  /**
   * 마지막 centroid 기준으로 assignment 한 번 더 해서 최종 결과로 사용합니다.
   */
  const { assignments } = assignPointsToCentroids(points, centroids);

  return { assignments, centroids };
}

interface SwatchScoreInput {
  keptCoverage: number;
  luma: number;
  saturation: number;
  colorfulness: number;
}

/**
 * palette 후보 색상을 정렬하기 위한 점수 계산 함수입니다.
 *
 * coverage:
 *   너무 작은 포인트 색이 1등 되는 것을 막습니다.
 *
 * colorfulness:
 *   색감 있는 후보를 올립니다.
 *
 * saturation:
 *   회색/흰색 후보를 조금 낮춥니다.
 *
 * brightPenalty:
 *   밝은 흰색/연한 배경 후보를 낮춥니다.
 *
 * darkBonus:
 *   dark-vibrant 후보를 살짝 살립니다.
 */

function calculateSwatchScore(input: SwatchScoreInput) {
  const coverageScore = Math.sqrt(input.keptCoverage);
  const colorScore = 0.5 + input.colorfulness / 100;
  const saturationScore = 0.55 + input.saturation;

  const brightPenalty = input.luma > 220 && input.saturation < 0.18 ? 0.25 : 1;

  const darkBonus =
    input.luma >= 25 && input.luma <= 90 && input.saturation >= 0.18 ? 1.15 : 1;

  return (
    coverageScore * colorScore * saturationScore * brightPenalty * darkBonus
  );
}

export async function extractKMeansPalette(
  inputPath: string,
  optionsInput: KMeansPaletteOptions = {},
): Promise<PaletteSwatch[]> {
  const options: Required<KMeansPaletteOptions> = {
    ...DEFAULT_OPTIONS,
    ...optionsInput,
  };

  const { points, totalPixels, keptPixels } = await loadWeightedColors(
    inputPath,
    options,
  );

  if (points.length === 0 || keptPixels === 0) {
    return [];
  }

  const { centroids, assignments } = runWeightedMeans(
    points,
    options.k,
    options.maxIterations,
  );

  const clusterCounts = new Array<number>(centroids.length).fill(0);

  for (let i = 0; i < points.length; i++) {
    const clusterIndex = assignments[i];
    clusterCounts[clusterIndex] += points[i].weight;
  }

  const swatches: PaletteSwatch[] = centroids
    .map((centroid, index) => {
      const count = clusterCounts[index];

      if (count === 0) {
        return null;
      }

      const color: RGB = {
        r: centroid.r,
        g: centroid.g,
        b: centroid.b,
      };

      const y = luma(color);
      const sat = rgbSaturation(color);
      const colorful = colorfulness(color);

      const lab = rgbToLab(color);
      const chroma = labChroma(lab);

      const hsl = rgbToHsl(color);

      const imageCoverage = count / totalPixels;
      const keptCoverage = count / keptPixels;

      const score = calculateSwatchScore({
        keptCoverage,
        luma: y,
        saturation: sat,
        colorfulness: colorful,
      });

      const swatch: PaletteSwatch = {
        color,
        hex: toHexRgb(color),

        imageCoverage,
        keptCoverage,

        count,

        luma: y,
        saturation: sat,
        colorfulness: colorful,
        labChroma: chroma,

        hsl,

        score,
      };

      return swatch;
    })
    .filter((swatch): swatch is PaletteSwatch => swatch !== null)
    .sort((a, b) => b.score - a.score);

  return swatches;
}
