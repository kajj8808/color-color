export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface LABColor {
  l: number; // 밝기: 0 (검정) ~ 100 (흰색)
  a: number; // 색상이 어떤 방향으로 치우쳐졌는지: 음수(초록에 치우쳐진 색상) ~ 양수 (빨강/보라에 치우쳐진 색상)
  b: number; // 색상이 어떤 방향으로 치우쳐졌는지: 음수(파랑에 치우쳐진 색상) ~ 양수 (노랑에 치우쳐진 색상)
}

export interface XYZColor {
  x: number;
  y: number;
  z: number;
}

export interface HSLColor {
  h: number; // 색상 각도 , Hue: 0-360 (0은 빨강, 120은 초록, 240은 파랑)
  s: number; // 채도: 0% (회색 선명하지 않은 색상) ~ 100% (선명한 색상)
  l: number; // Lightness 밝기: 0-1 (0은 검정, 0.5는 원래 색상, 1은 흰색)
}
