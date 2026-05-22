import { isBackgroundColorCandidate } from "../filters/is-background-color-candidate";
import { ColorCandidate } from "../histogram/create-color-candidates";
import { rgbToHsl } from "../conversions/rgb-to-hsl";

import type { HSLColor, RGBColor } from "../types/colors";

export interface BackgroundColorCandidate {
  rgb: RGBColor;
  hsl: HSLColor;

  count: number;
  ratio: number;
}

export interface ScoredBackgroundColorCandidate extends BackgroundColorCandidate {
  score: number;
}

export function createBackgroundColorCandidates(
  candidates: ColorCandidate[],
): BackgroundColorCandidate[] {
  return candidates
    .map((candidate) => {
      const hsl = rgbToHsl(candidate.color);

      return {
        rgb: candidate.color,
        hsl,
        count: candidate.count,
        ratio: candidate.ratio,
      };
    })
    .filter((candidate) => {
      return isBackgroundColorCandidate(candidate.hsl, {});
    });
}

function getSaturationScore(hsl: HSLColor) {
  // 너무 낮은 채도는 별로고, 너무 과한 채도도 배경에 부담될 수 있음
  const idealSaturation = 0.55;
  const distance = Math.abs(hsl.s - idealSaturation);

  return Math.max(0, 1 - distance);
}

function getLightnessScore(hsl: HSLColor) {
  // 배경용은 너무 밝지 않고 약간 어두운 쪽이 안정적
  const idealLightness = 0.35;
  const distance = Math.abs(hsl.l - idealLightness);

  return Math.max(0, 1 - distance);
}

export function scoreBackgroundColorCandidates(
  candidates: BackgroundColorCandidate[],
): ScoredBackgroundColorCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: calculateBackgroundColorScore(candidate),
    }))
    .sort((a, b) => b.score - a.score);
}

function calculateBackgroundColorScore(
  candidate: BackgroundColorCandidate,
): number {
  const ratioScore = candidate.ratio;
  const saturationScore = getSaturationScore(candidate.hsl);
  const lightnessScore = getLightnessScore(candidate.hsl);

  return ratioScore * 0.5 + saturationScore * 0.3 + lightnessScore * 0.2;
}
