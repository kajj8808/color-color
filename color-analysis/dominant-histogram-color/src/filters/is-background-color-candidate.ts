import { HSLColor } from "../types/colors";

export interface BackgroundColorCandidateOptions {
  minSaturation?: number;
  minLightness?: number;
  maxLightness?: number;
}

/**
 * 너무 어둡거나 너무 밝은 부분을 잘라내는 함수 채도가 없거나..
 *   */
export function isBackgroundColorCandidate(
  hslColor: HSLColor,
  options: BackgroundColorCandidateOptions,
) {
  const minSaturation = options.minSaturation ?? 0.18;
  const minLightness = options.minLightness ?? 0.1;
  const maxLightness = options.maxLightness ?? 0.88;

  if (hslColor.s < minSaturation) {
    return false;
  }

  if (hslColor.l < minLightness) {
    return false;
  }

  if (hslColor.l > maxLightness) {
    return false;
  }

  return true;
}
