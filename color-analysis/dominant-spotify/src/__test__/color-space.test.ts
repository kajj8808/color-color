import { hslToRgb, parseHexRgb, rgbToHsl } from "../color-space";

describe("rgb hsl 변환 함수 테스트", () => {
  // Test cases for color space conversions
  test("rgb to hsl", () => {
    const hsl = rgbToHsl({ r: 235, g: 64, b: 52 });
    expect(hsl).toEqual({
      h: 3.934426229508197,
      s: 0.8206278026905829,
      l: 0.5627450980392157,
    });
  });
  test("hsl to rgb", () => {
    const rgb = hslToRgb({
      h: 3.934426229508197,
      s: 0.8206278026905829,
      l: 0.5627450980392157,
    });
    expect(rgb).toEqual({ r: 235, g: 64, b: 52 });
  });
});

describe("parseHexRgb 함수 테스트", () => {
  test("정상적인 6자리 hex 코드를 RGB 객체로 변환해야 한다", () => {
    expect(parseHexRgb("#eb4034")).toEqual({ r: 235, g: 64, b: 52 });

    expect(parseHexRgb("eb4034")).toEqual({ r: 235, g: 64, b: 52 });
    expect(parseHexRgb("  #eb4034  ")).toEqual({ r: 235, g: 64, b: 52 });
  });

  test("길이가 6자리가 아닌 잘못된 hex 코드를 넣으면 에러를 던져야 한다", () => {
    expect(() => parseHexRgb("#eb403")).toThrow("Invalid hex color: #eb403");

    expect(() => parseHexRgb("#eb40345")).toThrow(
      "Invalid hex color: #eb40345",
    );
  });
});
