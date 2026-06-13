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
