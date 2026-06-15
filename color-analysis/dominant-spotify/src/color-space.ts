export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface HSL {
  h: number; // 0 ~ 360
  s: number; // 0 ~ 1
  l: number; // 0 ~ 1
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export function clamp({
  value,
  max,
  min,
}: {
  value: number;
  max: number;
  min: number;
}) {
  return Math.max(min, Math.min(max, value));
}

export function clampByte(value: number) {
  return Math.round(clamp({ value, max: 255, min: 0 }));
}

function byteToHex(byte: number) {
  return clampByte(byte).toString(16).padStart(2, "0").toUpperCase();
}

export function toHexRgb(color: RGB) {
  return `#${byteToHex(color.r)}${byteToHex(color.g)}${byteToHex(color.b)}`;
}

export function toHexRgba(color: RGB) {
  // Spotify style에서 base 계열은 #RRGGBBAA 형태가 많아서 FF를 붙임
  return `${toHexRgb(color)}FF`;
}

export function parseHexRgb(hex: string): RGB {
  const normalized = hex.trim().replace("#", ""); // #eb4034 -> eb4034

  if (normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function luma(color: RGB) {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

export function rgbSaturation(color: RGB) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);

  if (max === 0) {
    return 0;
  }

  return (max - min) / max;
}

export function colorfulness(color: RGB) {
  const rg = color.r - color.g;
  const yb = (color.r + color.g) / 2 - color.b;

  return Math.sqrt(rg * rg + yb * yb);
}

export function rgbToHsl(color: RGB): HSL {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta != 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  return { h, s, l };
}

export function hslToRgb(hsl: HSL): RGB {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp({ value: hsl.s, max: 1, min: 0 });
  const l = clamp({ value: hsl.l, max: 1, min: 0 });

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= hp && hp < 1) {
    r = c;
    g = x;
  } else if (1 <= hp && hp < 2) {
    r = x;
    g = c;
  } else if (2 <= hp && hp < 3) {
    g = c;
    b = x;
  } else if (3 <= hp && hp < 4) {
    g = x;
    b = c;
  } else if (4 <= hp && hp < 5) {
    r = x;
    b = c;
  } else if (5 <= hp && hp < 6) {
    r = c;
    b = x;
  }

  const m = l - c / 2;

  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
  };
}

export function rgbToLab(color: RGB): Lab {
  // ==========================================
  // 1단계: sRGB를 선형(Linear) RGB로 변환
  // ==========================================
  // RGB 값은 0~255 사이이므로, 먼저 0~1 사이의 비율로 맞춥니다.
  let r = color.r / 255;
  let g = color.g / 255;
  let b = color.b / 255;

  // 감마 보정 (Gamma Correction) 해제
  // 모니터에 출력하기 위해 왜곡된 색상 값을 실제 빛의 물리적 에너지 비율로 되돌리는 작업입니다.
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // 다음 XYZ 계산을 위해 값을 0~100 범위로 확장합니다.
  r *= 100;
  g *= 100;
  b *= 100;

  // ==========================================
  // 2단계: 선형 RGB를 XYZ 색상 공간으로 변환
  // ==========================================
  // sRGB 표준 변환 행렬(Matrix)을 곱해줍니다.
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  // ==========================================
  // 3단계: XYZ를 최종 목적지인 Lab으로 변환
  // ==========================================
  // 기준이 되는 '가장 순수한 흰색(Reference White, D65 광원)' 값으로 나눠줍니다.
  let xN = x / 95.047;
  let yN = y / 100.0;
  let zN = z / 108.883;

  // 인간의 시각적 인지 특성을 반영하는 비선형 변환 함수 f(t) 적용
  // 아주 어두운 영역과 밝은 영역에서 눈이 빛을 다르게 느끼는 것을 보정합니다.
  xN = xN > 0.008856 ? Math.pow(xN, 1 / 3) : 7.787 * xN + 16 / 116;
  yN = yN > 0.008856 ? Math.pow(yN, 1 / 3) : 7.787 * yN + 16 / 116;
  zN = zN > 0.008856 ? Math.pow(zN, 1 / 3) : 7.787 * zN + 16 / 116;

  // 최종 L*, a*, b* 값 도출
  // L (Lightness): 밝기 (0~100)
  // a (Red-Green): 빨강과 초록의 정도 (-128~127)
  // b (Yellow-Blue): 노랑과 파랑의 정도 (-128~127) -> 변수명 충돌 방지를 위해 bValue 사용
  const l = 116 * yN - 16;
  const a = 500 * (xN - yN);
  const bValue = 200 * (yN - zN);

  return { l, a, b: bValue };
}

/**
 * Lab 색상에서 채도(Chroma)를 계산합니다.
 * 채도가 높을수록 색이 선명하고 쨍하며, 0에 가까울수록 무채색(회색)에 가깝습니다.
 */
export function labChroma(lab: Lab): number {
  // Math.hypot(a, b)는 내부적으로 Math.sqrt(a * a + b * b)와 동일하게 동작합니다.
  return Math.hypot(lab.a, lab.b);
}
