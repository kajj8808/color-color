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
  L: number;
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

export function saturation(color: RGB) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);

  if (max === 0) {
    return 0;
  }

  return (max - min) / max;
}

export function colorfulness(color: RGB) {
  const rg = Math.abs(color.r - color.g);
  const yb = Math.abs((color.r - color.g) / 2 - color.b);

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
