import {
  clamp01,
  clampByte,
  hslToRgb,
  luma,
  RGB,
  rgbToHsl,
  toHexRgb,
  toHexRgba,
} from "./color-space";
import { PaletteSwatch } from "./palette";

const DEFAULT_NEUTRAL_BASE_GRAY = 0x53; // #535353

export type ThemeCandidateType =
  | "neutralized-muted"
  | "chromatic"
  | "neutral-fallback";

export type ThemeFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "magenta"
  | "muted"
  | "neutral";

export interface ThemeCandidate {
  type: ThemeCandidateType;
  family: ThemeFamily;

  sourceColor: RGB;
  sourceHex: string;
  sourceHexes: string[];

  baseColor: RGB;
  baseHex: string;

  confidence: number;
  vars: Record<string, string>;
  reason: string;
}

function gray(value: number): RGB {
  const v = clampByte(value);
  return { r: v, g: v, b: v };
}

function weightedAverageColor(swatches: PaletteSwatch[]): RGB {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let weightSum = 0;

  for (const swatch of swatches) {
    /**
     * 여기서는 count 를 weight로 사용합니다.
     * 이유 :
     *  Spotify가 색상감 만 보는게 아니라, 이미지에서 어느정도 밀집되어 나온 색을 보는 거 같기 때문입니다.
     */
    const weight = swatch.count;

    rSum += swatch.color.r * weight;
    gSum += swatch.color.g * weight;
    bSum += swatch.color.b * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return {
      r: 128,
      g: 128,
      b: 128,
    };
  }

  return {
    r: clampByte(rSum / weightSum),
    g: clampByte(gSum / weightSum),
    b: clampByte(bSum / weightSum),
  };
}

/**
 * Modern Times 같은 케이스:
 *
 * 실제 원본 주요 색상은 베이지/브라운이지만,
 * Spotify 최종 theme은 색상감을 죽인 gray 계열로 갑니다.
 *
 * 이 함수는 그런 source 후보를 찾습니다.
 */
function isWarmMutedBrightSource(swatch: PaletteSwatch) {
  const hue = swatch.hsl.h;

  const isWarmHue = hue >= 15 && hue <= 60; // 대략적으로 15°에서 60° 사이의 색상은 따뜻한 느낌을 줍니다.
  const isBrightEnough = swatch.luma >= 130 && swatch.luma <= 210; // 너무 어둡지도, 너무 밝지도 않은 색상
  const isMutedEnough = swatch.saturation >= 0.12 && swatch.saturation <= 0.55; // 너무 채도가 낮지도, 너무 높지도 않은 색상
  const isNotTooColorful = swatch.labChroma <= 35; // 너무 화려하지 않은 색상
  const hasEnoughCoverage = swatch.keptCoverage >= 0.03; // 이미지에서 충분히 나타나는 색상

  return (
    isWarmHue &&
    isBrightEnough &&
    isMutedEnough &&
    isNotTooColorful &&
    hasEnoughCoverage
  );
}

function createNeutralSpotifyVars(baseGray: number) {
  const base = gray(baseGray);

  const cinemaTo = gray(baseGray - 30);

  const highlight = gray(baseGray - 13);
  const press = gray(baseGray - 26);

  const tintedBase = gray(baseGray - 32);
  const tintedHighlight = gray(baseGray - 45);
  const tintedPress = gray(baseGray - 57);

  const textSubdued = gray(205);

  return {
    "--cinema-mode-bg-color-from": toHexRgba(base),
    "--cinema-mode-bg-color-to": toHexRgba(cinemaTo),

    "--background-base": toHexRgba(base),
    "--background-highlight": toHexRgb(highlight),
    "--background-press": toHexRgb(press),

    "--background-elevated-base": toHexRgba(base),
    "--background-elevated-highlight": toHexRgb(highlight),
    "--background-elevated-press": toHexRgb(press),

    "--background-tinted-base": toHexRgba(tintedBase),
    "--background-tinted-highlight": toHexRgb(tintedHighlight),
    "--background-tinted-press": toHexRgb(tintedPress),

    "--text-base": "#FFFFFFFF",
    "--text-subdued": toHexRgba(textSubdued),

    "--text-bright-accent": "#FFFFFFFF",
    "--text-negative": "#FFFFFFFF",
    "--text-warning": "#FFFFFFFF",
    "--text-positive": "#FFFFFFFF",
    "--text-announcement": "#FFFFFFFF",

    "--essential-base": "#FFFFFFFF",
    "--essential-subdued": toHexRgba(textSubdued),
    "--essential-bright-accent": "#FFFFFFFF",
    "--essential-negative": "#FFFFFFFF",
    "--essential-warning": "#FFFFFFFF",
    "--essential-positive": "#FFFFFFFF",
    "--essential-announcement": "#FFFFFFFF",

    "--decorative-base": "#FFFFFFFF",
    "--decorative-subdued": toHexRgba(textSubdued),
  };
}

function createNeutralFallbackCandidate(
  palette: PaletteSwatch[],
): ThemeCandidate {
  const baseGray = DEFAULT_NEUTRAL_BASE_GRAY; // 0x53 = #535353
  const baseColor = gray(baseGray);

  const sourceSwatches = palette.slice(0, Math.min(3, palette.length));

  const sourceColor =
    sourceSwatches.length > 0
      ? weightedAverageColor(sourceSwatches)
      : baseColor;

  return {
    type: "neutral-fallback",
    family: "neutral",

    sourceColor,
    sourceHex: toHexRgb(sourceColor),
    sourceHexes: sourceSwatches.map((swatch) => swatch.hex),

    baseColor,
    baseHex: toHexRgb(baseColor),

    confidence: 0.1,

    vars: createNeutralSpotifyVars(baseGray),

    reason:
      "No warm-muted or chromatic candidate found; fallback to Spotify default neutral gray theme.",
  };
}

function getFamilyFromHue(hue: number, saturation: number): ThemeFamily {
  if (saturation < 0.08) return "neutral";

  if (hue >= 345 || hue < 15) return "red";
  if (hue >= 15 && hue < 45) return "orange";
  if (hue >= 45 && hue < 80) return "yellow";
  if (hue >= 80 && hue < 165) return "green";
  if (hue >= 165 && hue < 195) return "cyan";
  if (hue >= 195 && hue < 250) return "blue";
  if (hue >= 250 && hue < 305) return "purple";
  if (hue >= 305 && hue < 345) return "magenta";

  return "muted";
}

function isChromaticSource(swatch: PaletteSwatch) {
  // 너무 검은색은 후보에서 제외
  if (swatch.luma < 25) return false;

  // 거의 흰색과 비슷한 밝은 색은 제외
  if (swatch.luma > 235 && swatch.saturation < 0.18) return false;

  // 너무 적게 나온 색을 작은 하이라이트일 수 도 있으므로 제외
  if (swatch.keptCoverage < 0.008) return false;

  // 채도가 너무 낮으면 chromatic 후보에서 제외
  if (swatch.saturation < 0.18) return false;

  // lab chroma가 너무 낮으면 chromatic 후보에서 제외 (색이 약한 후보임)
  if (swatch.labChroma < 8) return false;

  // chrofulness가 너무 낮으면 chromatic 후보에서 제외
  if (swatch.colorfulness < 12) return false;

  return true;
}

/** source 색상을 spotify 스타일식 base 색상으로 매핑하는 함수. */
function mapSourceToChromaticBase(source: RGB): RGB {
  const hsl = rgbToHsl(source);

  if (shouldUseStrongRedMapping(source)) {
    return hslToRgb({
      h: hsl.h - 6,
      s: Math.min(0.86, Math.max(0.72, hsl.s * 1.3)),
      l: Math.min(0.34, Math.max(0.3, hsl.l * 0.85)),
    });
  }

  if (shouldUseDarkBlueMapping(source)) {
    return hslToRgb({
      h: hsl.h - 3,
      s: Math.min(0.65, Math.max(0.55, hsl.s * 1.8)),
      l: 0.22,
    });
  }

  /**
   * 분석 결과? spotify 2026 스타일은 대체로 어두운 영역으로 눌리게 됩니다.
   *
   * 밝은 색:
   *    0.34 근처로 강하게 낮춤
   * 이미 중간/어두운 색상:
   *    0.28 ~ 0.36 사이에 들어오게 제한
   */
  const targetLightness =
    hsl.l > 0.58 ? 0.34 : Math.min(0.36, Math.max(0.28, hsl.l * 0.92));

  /**
   * 너무 약한 채도는 조금 올리고, 너무 강한 채도는 과하게 튀지 않게 제한.
   */
  const targetSaturation = Math.min(0.72, Math.max(0.35, hsl.s)); // *0.1?

  return hslToRgb({ h: hsl.h, s: targetSaturation, l: targetLightness });
}

function createRedToneFromBase(base: RGB, lightnessRatio: number): RGB {
  const hsl = rgbToHsl(base);

  return hslToRgb({
    h: 0,
    s: 1,
    l: clamp01(hsl.l * lightnessRatio),
  });
}

/** Chromatic Spotify 변수들을 생성하는 함수
 * baseColor가 정해졌을 때 나머지 token을 만듭니다.
 */
function buildChromaticVars(input: {
  baseColor: RGB;
  cinemaTo: RGB;

  backgroundHighlight: RGB;
  backgroundPress: RGB;

  backgroundTintedBase: RGB;
  backgroundTintedHighlight: RGB;
  backgroundTintedPress: RGB;

  textSubdued: RGB;
}) {
  return {
    "--cinema-mode-bg-color-from": toHexRgba(input.baseColor),
    "--cinema-mode-bg-color-to": toHexRgba(input.cinemaTo),

    "--background-base": toHexRgba(input.baseColor),
    "--background-highlight": toHexRgb(input.backgroundHighlight),
    "--background-press": toHexRgb(input.backgroundPress),

    "--background-elevated-base": toHexRgba(input.baseColor),
    "--background-elevated-highlight": toHexRgb(input.backgroundHighlight),
    "--background-elevated-press": toHexRgb(input.backgroundPress),

    "--background-tinted-base": toHexRgba(input.backgroundTintedBase),
    "--background-tinted-highlight": toHexRgb(input.backgroundTintedHighlight),
    "--background-tinted-press": toHexRgb(input.backgroundTintedPress),

    "--text-base": "#FFFFFFFF",
    "--text-subdued": toHexRgba(input.textSubdued),

    "--text-bright-accent": "#FFFFFFFF",
    "--text-negative": "#FFFFFFFF",
    "--text-warning": "#FFFFFFFF",
    "--text-positive": "#FFFFFFFF",
    "--text-announcement": "#FFFFFFFF",

    "--essential-base": "#FFFFFFFF",
    "--essential-subdued": toHexRgba(input.textSubdued),
    "--essential-bright-accent": "#FFFFFFFF",
    "--essential-negative": "#FFFFFFFF",
    "--essential-warning": "#FFFFFFFF",
    "--essential-positive": "#FFFFFFFF",
    "--essential-announcement": "#FFFFFFFF",

    "--decorative-base": "#FFFFFFFF",
    "--decorative-subdued": toHexRgba(input.textSubdued),
  };
}

function createChromaticSpotifyVars(
  baseColor: RGB,
  options: {
    useRedSpecial?: boolean;
    useDarkBlueSpecial?: boolean;
  } = {},
) {
  const hsl = rgbToHsl(baseColor);

  const backgroundHighlight = hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: clamp01(hsl.l - 0.05),
  });

  const backgroundPress = hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: clamp01(hsl.l - 0.1),
  });

  /**
   * image_5 같은 dark navy 계열 전용.
   * 이 분기는 반드시 useDarkBlueSpecial일 때만 타야 합니다.
   */
  if (options.useDarkBlueSpecial) {
    const cinemaTo = baseColor;

    const backgroundTintedBase = hslToRgb({
      h: hsl.h,
      s: 0.38,
      l: 0.359,
    });

    const backgroundTintedHighlight = hslToRgb({
      h: hsl.h,
      s: 0.38,
      l: 0.308,
    });

    const backgroundTintedPress = hslToRgb({
      h: hsl.h,
      s: 0.38,
      l: 0.259,
    });

    const textSubdued = hslToRgb({
      h: hsl.h,
      s: 1,
      l: 0.845,
    });

    return buildChromaticVars({
      baseColor,
      cinemaTo,
      backgroundHighlight,
      backgroundPress,
      backgroundTintedBase,
      backgroundTintedHighlight,
      backgroundTintedPress,
      textSubdued,
    });
  }

  function createChromaticCandidate(swatch: PaletteSwatch): ThemeCandidate {
    const useRedSpecial = shouldUseStrongRedMapping(swatch.color);
    const useDarkBlueSpecial = shouldUseDarkBlueMapping(swatch.color);

    const baseColor = mapSourceToChromaticBase(swatch.color);
    const baseHsl = rgbToHsl(baseColor);

    return {
      type: "chromatic",
      family: getFamilyFromHue(baseHsl.h, baseHsl.s),

      sourceColor: swatch.color,
      sourceHex: swatch.hex,
      sourceHexes: [swatch.hex],

      baseColor,
      baseHex: toHexRgb(baseColor),

      confidence: swatch.score,

      vars: createChromaticSpotifyVars(baseColor, {
        useRedSpecial,
        useDarkBlueSpecial,
      }),

      reason: "chromatic swatch converted to Spotify dark cinema theme",
    };
  }

  const redLike = options.useRedSpecial && isRedLikeHue(hsl.h);

  const cinemaTo = redLike
    ? createRedToneFromBase(baseColor, 0.607)
    : hslToRgb({
        h: hsl.h,
        s: clamp01(hsl.s * 1.15),
        l: clamp01(hsl.l - 0.07),
      });

  const backgroundTintedBase = redLike
    ? createRedToneFromBase(baseColor, 0.565)
    : hslToRgb({
        h: hsl.h,
        s: clamp01(Math.max(hsl.s, 0.35) * 1.35),
        l: clamp01(hsl.l * 0.58),
      });

  const backgroundTintedHighlight = redLike
    ? createRedToneFromBase(baseColor, 0.416)
    : hslToRgb({
        h: hsl.h,
        s: clamp01(Math.max(hsl.s, 0.35) * 1.35),
        l: clamp01(hsl.l * 0.45),
      });

  const backgroundTintedPress = redLike
    ? createRedToneFromBase(baseColor, 0.261)
    : hslToRgb({
        h: hsl.h,
        s: clamp01(Math.max(hsl.s, 0.35) * 1.35),
        l: clamp01(hsl.l * 0.32),
      });

  const textSubdued = redLike
    ? hslToRgb({
        h: hsl.h + 4,
        s: 1,
        l: 0.843,
      })
    : hslToRgb({
        h: hsl.h,
        s: clamp01(Math.max(hsl.s, 0.2) * 1.25),
        l: 0.86,
      });

  return buildChromaticVars({
    baseColor,
    cinemaTo,
    backgroundHighlight,
    backgroundPress,
    backgroundTintedBase,
    backgroundTintedHighlight,
    backgroundTintedPress,
    textSubdued,
  });
}

function createChromaticCandidate(swatch: PaletteSwatch): ThemeCandidate {
  const useRedSpecial = shouldUseStrongRedMapping(swatch.color);
  const useDarkBlueSpecial = shouldUseDarkBlueMapping(swatch.color);

  const baseColor = mapSourceToChromaticBase(swatch.color);
  const baseHsl = rgbToHsl(baseColor);

  return {
    type: "chromatic",
    family: getFamilyFromHue(baseHsl.h, baseHsl.s),

    sourceColor: swatch.color,
    sourceHex: swatch.hex,
    sourceHexes: [swatch.hex],

    baseColor,
    baseHex: toHexRgb(baseColor),

    confidence: swatch.score,

    vars: createChromaticSpotifyVars(baseColor, {
      useRedSpecial,
      useDarkBlueSpecial,
    }),

    reason: "chromatic swatch converted to Spotify dark cinema theme",
  };
}

export function createThemeCandidatesFromPalette(
  palette: PaletteSwatch[],
): ThemeCandidate[] {
  const conditions: ThemeCandidate[] = [];

  /**
   * 1. Modern Times 같은 warm-muted source 후보를 찾습니다.
   * 2. score 순서가 아니라, 이미 palette가 score순으로 정렬되어 있으므로 상위 3개만 사용합니다.
   * 3. 너무 많은 후보를 섞으면 어두운 갈색까지 들어가서 gray가 과하게 어두워질 수 있습니다.
   */

  const warmMutedSources = palette.filter(isWarmMutedBrightSource).slice(0, 3);

  if (warmMutedSources.length >= 2) {
    const sourceColor = weightedAverageColor(warmMutedSources);
    const sourceLuma = luma(sourceColor);

    /**
     * Spotify 2026 neutralized gray 계열로 압축하는 계수입니다.
     *
     * Modern Times 기준:
     * sourceLuma ≈ 162~164
     * 162 * 0.51 ≈ 83
     * #535353
     */
    const baseGray = Math.round(sourceLuma * 0.51);
    const baseColor = gray(baseGray);

    const coverage = warmMutedSources.reduce(
      (sum, swatch) => sum + swatch.keptCoverage,
      0,
    );

    conditions.push({
      type: "neutralized-muted",
      family: "neutral",

      sourceColor,
      sourceHex: toHexRgb(sourceColor),
      sourceHexes: warmMutedSources.map((swatch) => swatch.hex),

      baseColor,
      baseHex: toHexRgb(baseColor),

      /**
       * Modern Times 같은 케이스에서는 neutral 후보가 primary가 되게
       * confidence를 조금 높여둡니다.
       */
      confidence: 1 + coverage,

      vars: createNeutralSpotifyVars(baseGray),

      reason:
        "Warm, muted, bright colors with good coverage were found in the palette.",
    });
  }

  const chromaticCandidates = palette
    .filter(isChromaticSource)
    .slice(0, 10)
    .map(createChromaticCandidate);

  conditions.push(...chromaticCandidates);

  if (conditions.length === 0) {
    conditions.push(createNeutralFallbackCandidate(palette));
  }

  return conditions.sort((a, b) => b.confidence - a.confidence);
}

function isRedLikeHue(hue: number) {
  return hue >= 345 || hue <= 25;
}

function shouldUseStrongRedMapping(source: RGB) {
  const hsl = rgbToHsl(source);
  const y = luma(source);

  return isRedLikeHue(hsl.h) && hsl.s >= 0.42 && y <= 150;
}

function isBlueLikeHue(hue: number) {
  return hue >= 195 && hue <= 235;
}

function shouldUseDarkBlueMapping(source: RGB) {
  const hsl = rgbToHsl(source);
  const y = luma(source);

  return isBlueLikeHue(hsl.h) && hsl.l <= 0.25 && hsl.s >= 0.25 && y <= 80;
}
