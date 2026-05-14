export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface LabColor {
  l: number; // 밝기: 0 (검정) ~ 100 (흰색)
  a: number; // 색상이 어떤 방향으로 치우쳐졌는지: 음수(초록에 치우쳐진 색상) ~ 양수 (빨강/보라에 치우쳐진 색상)
  b: number; // 색상이 어떤 방향으로 치우쳐졌는지: 음수(파랑에 치우쳐진 색상) ~ 양수 (노랑에 치우쳐진 색상)
}

export interface XYZColor {
  x: number;
  y: number;
  z: number;
}
