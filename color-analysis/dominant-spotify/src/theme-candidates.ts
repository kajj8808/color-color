import { clampByte, luma, RGB, toHexRgb, toHexRgba } from "./color-space";
import { PaletteSwatch } from "./palette";

export type ThemeCandidateType = "neutralized-muted" | "chromatic";

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

    const confidence = warmMutedSources.reduce(
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
      confidence,
      vars: createNeutralSpotifyVars(baseGray),
      reason:
        "Warm, muted, bright colors with good coverage were found in the palette.",
    });
  }
  return conditions.sort((a, b) => b.confidence - a.confidence);
}
