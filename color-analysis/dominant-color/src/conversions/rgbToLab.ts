import { LABColor, RGBColor, XYZColor } from "../types/colors";

/*  
# RGB -> LAB

변환순서
RGB → Linear RGB → XYZ (D65) → LAB

3 단계를 거치는 이유
1. RGB → Linear RGB: 감마 보정 제거 (모니터 특성 제거)
2. Linear RGB → XYZ: CIE 표준 색공간으로 변환 (장치 독립)
3. XYZ → LAB: 지각적으로 균일한 공간으로 변환

*/

// 1. RGB → Linear RGB
function rgbToLinear(value: number) {
  const normalized = Math.min(255, Math.max(0, value)) / 255;
  // SRGB 공식 사용
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

// 2. Linear RGB → XYZ
export function rgbToXyz({ r, g, b }: RGBColor) {
  const linearRed = rgbToLinear(r);
  const linearGreen = rgbToLinear(g);
  const linearBlue = rgbToLinear(b);

  // IEC 61966-2-1:1999 표준 변환 행렬 (SRGB -> XYZ D65)
  return {
    x: linearRed * 0.4124564 + linearGreen * 0.3575761 + linearBlue * 0.1804375,
    y: linearRed * 0.2126729 + linearGreen * 0.7151522 + linearBlue * 0.072175,
    z: linearRed * 0.0193339 + linearGreen * 0.119192 + linearBlue * 0.9503041,
  };
}

// 3. XYZ → LAB

// D65 기준 white point
const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

function xyzToLab({ x, y, z }: XYZColor): LABColor {
  // XYZ 를 white point 로 정규화

  const fx = applyLabCorrection(x / D65.x);
  const fy = applyLabCorrection(y / D65.y);
  const fz = applyLabCorrection(z / D65.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * XYZ 색상 값을 LAB 공간으로 변환하기 위한 비선형 보정 함수.
 *
 * [왜 사용하는가?]
 * 인간의 시각 특성인 '세제곱근'을 반영하되,
 * 0 근처의 어두운 영역에서 계산 오류를 막기 위해 직선으로 보정(근사)합니다.
 *
 * t -> 아직 사람 눈에 맞게 보정되지 않은 원본 빛의 수치 0~1 0은 빛이 전혀 없는 상태 1는 최대 밝기 ( 비율 )
 */
function applyLabCorrection(t: number) {
  const delta = 6 / 29; // CIE 표준 상수 (보정 계수)
  const threshold = delta ** 3; // 약 0.00885 이 값보다 작으면 매우 어두움 (선형 변환 임계점)

  // 일반적인 밝기 세제곱근(cbrt) 으로 비선형적 감각(?) 반영
  if (t > threshold) {
    return Math.cbrt(t);
  }

  // 매우 어두운 영역 -> 수치 안정을 위해 성형 함수 로 근사 처리 ( 선형 처리 계산 안정성 )
  // 기울기가 너무 가팔라지는 것을 방지하는 역활.
  return t / (3 * delta ** 2) + 4 / 29;
}

/**
 * t: 보정된 LAB 계수
 * 역할: 보정된 값을 다시 물리적인 빛의 강도로 되돌림
 */
function undoLabCorrection(t: number) {
  const delta = 6 / 29;

  if (t > delta) {
    return t ** 3;
  }

  return 3 * delta ** 2 * (t - 4 / 29);
}

export function rgbToLab(rgb: RGBColor) {
  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

export function labToRgb({ l, a, b }: LABColor) {
  // 이전의 lab으로 변환하는 공식(l: 116 * fy - 16 등)을 수학적으로 반대로 푼 부분
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  // 2단계: 보정 함수(labF)의 반대인 역함수(labFInv)를 적용해 XYZ 값 추출
  const xyz: XYZColor = {
    x: D65.x * undoLabCorrection(fx),
    y: D65.y * undoLabCorrection(fy),
    z: D65.z * undoLabCorrection(fz),
  };

  // 3단계: XYZ를 선형(Linear) RGB로 변환 (역행렬 계산)
  // XYZ 공간에 흩어져 있는 빛의 정보를 R, G, B 채널로 다시 모으는 과정.
  const linearR = xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314;
  const linearG = xyz.x * -0.969266 + xyz.y * 1.8760108 + xyz.z * 0.041556;
  const linearB = xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252;

  // 4단계: 감마 보정 및 0~255 범위 고정 (Clamping)
  // '컴퓨터 모니터'가 표현할 수 있는 sRGB 표준으로 바꾸고,
  // 범위를 벗어나는 값은 0이나 255로 잘라줍니다.
  return {
    r: clamp(linearToSrgb(linearR) * 255),
    g: clamp(linearToSrgb(linearG) * 255),
    b: clamp(linearToSrgb(linearB) * 255),
  };
}

function linearToSrgb(value: number) {
  return value <= 0.0031308
    ? 12.92 * value
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

// 헬퍼 함수: 0~255 범위를 강제하는 함수
function clamp(value: number) {
  return Math.round(Math.min(255, Math.max(0, value)));
}
