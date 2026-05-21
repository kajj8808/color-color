import { HSLColor, RGBColor } from "../types/colors";

interface CalculateHueProps {
  red: number;
  green: number;
  blue: number;
  max: number;
  delta: number;
}

function calculateHue(props: CalculateHueProps) {
  let hue = 0;

  const { red, green, blue, delta, max } = props;

  if (max === red) {
    hue = (green - blue) / delta;
  }

  if (max === green) {
    hue = (blue - red) / delta + 2;
  }

  if (max === blue) {
    hue = (red - green) / delta + 4;
  }

  hue *= 60;

  if (hue < 0) {
    hue += 360;
  }

  return hue;
}

export function rgbToHsl(rgb: RGBColor): HSLColor {
  // 계산 편의 상 정규화 ( 공식 편의상.. )
  const red = rgb.r / 255;
  const green = rgb.g / 255;
  const blue = rgb.b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  const lightness = (max + min) / 2; // 가장 많이 섞인 색과 아닌 색을 더하고 나누면 놀랍게도...

  // rgb 색상이 모두 값은 경우 무채색 상태로 보고.. 이후 공식에 문제가 생기지 않도록
  if (max === min) {
    return {
      h: 0,
      s: 0,
      l: lightness,
    };
  }

  const delta = max - min;

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  const hue = calculateHue({ red, green, blue, delta, max });

  return {
    h: hue,
    s: saturation,
    l: lightness,
  };
}
