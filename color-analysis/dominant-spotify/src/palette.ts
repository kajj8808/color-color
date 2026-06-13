import sharp from "sharp";
import { clampByte, HSL, luma, RGB, rgbSaturation } from "./color-space";

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

interface WeightedColor {
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
  nearBlackLuma: number;
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
