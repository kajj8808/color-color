import { RGBColor, XYZColor } from "./types/colors";

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
  const normalized = value / 255;
  // SRGB 공식 사용
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

// 2. Linear RGB → XYZ
export function linearRgbToXyz({ r, g, b }: RGBColor) {
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

function xyzToLab({ x, y, z }: XYZColor) {
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
 * t -> 아직 사람 눈에 맞게 보정되지 않은 원본 빛의 수치 0~1 0은 빛이 전혀 없는 상태 1는 최대 밝기
 */
function applyLabCorrection(t: number) {
  const delta = 6 / 29; // 표준 보정 개수
  const threshold = delta ** 3; // 약 0.00885 이 값보다 작으면 매우 어두움

  // 일반적인 밝기
  if (t > threshold) {
    return Math.cbrt(t);
  }

  // 매우 어두언 영역 -> 수치 안정을 위해 성형 함수 로 근사 처리
  return t / (3 * delta ** 2) + 4 / 29;
}

export function rgbToLab(rgb: RGBColor) {
  const xyz = linearRgbToXyz(rgb);
  return xyzToLab(xyz);
}
