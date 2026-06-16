import { luma, rgbToHsl } from "./color-space";
import { ThemeCandidate } from "./theme-candidates";

export interface ThemeResolveContext {
  /**
   * 나중에 같은 이미지에서 red/puple/blue 후보를 강제로 고르고 싶을때 사용
   */
  preferFamily?: ThemeCandidate["family"];

  /** 같은 이미지인데 트랙마다 다른 배경을 사용하고 싶을때 사용 */
  seed?: string;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0; // unsigned right shift for 32-bit overflow
  }
  return hash;
}

function hueDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function sourceHsl(candidate: ThemeCandidate) {
  return rgbToHsl(candidate.sourceColor);
}

function sourceLuma(candidate: ThemeCandidate) {
  return luma(candidate.sourceColor);
}

function isNeutralCandidate(candidate: ThemeCandidate) {
  return (
    candidate.type === "neutralized-muted" ||
    candidate.type === "neutral-fallback"
  );
}

function isRedHue(hue: number) {
  return hue >= 345 || hue <= 25;
}

function isStrongRedCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    candidate.family === "red" &&
    isRedHue(hsl.h) &&
    hsl.s >= 0.42 &&
    y <= 150
  );
}

function isDarkBlueCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    candidate.family === "blue" &&
    hsl.h >= 195 &&
    hsl.h <= 235 &&
    hsl.s >= 0.25 &&
    hsl.l <= 0.25 &&
    y <= 80
  );
}

function isWeakPastelRedCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    candidate.family === "red" &&
    isRedHue(hsl.h) &&
    hsl.s < 0.35 &&
    y >= 130
  );
}

function isMutedRoseCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    (candidate.family === "magenta" || candidate.family === "purple") &&
    hsl.h >= 300 &&
    hsl.h <= 345 &&
    hsl.s >= 0.15 &&
    y >= 70 &&
    y <= 145
  );
}

function findBestMutedRoseCandidate(candidates: ThemeCandidate[]) {
  const matched = candidates.filter(isMutedRoseCandidate);

  if (matched.length === 0) {
    return null;
  }

  /**
   * image_3 케이스에서 #7E626C 같은 muted rose 후보를 고르기 위한 점수.
   * hue는 338 근처, luma는 108 근처가 지금 샘플에서는 잘 맞았습니다.
   */
  return matched
    .map((candidate) => {
      const hsl = sourceHsl(candidate);
      const y = sourceLuma(candidate);

      const score =
        hueDistance(hsl.h, 338) + Math.abs(y - 108) * 0.7 - hsl.s * 8;

      return {
        candidate,
        score,
      };
    })
    .sort((a, b) => a.score - b.score)[0].candidate;
}

export function resolveThemeCandidate(
  candidates: ThemeCandidate[],
  context: ThemeResolveContext = {},
) {
  if (candidates.length === 0) {
    return null;
  }

  /**
   * 1. 수동 family 선호가 있으면 우선
   */
  if (context.preferFamily) {
    const preferred = candidates.find(
      (candidate) => candidate.family === context.preferFamily,
    );

    if (preferred) {
      return preferred;
    }
  }

  /**
   * 2. 같은 이미지에서 트랙마다 다르게 고르는 실험용
   */
  if (context.seed) {
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    const index = hashString(context.seed) % topCandidates.length;

    return topCandidates[index];
  }

  const neutral = candidates.find(isNeutralCandidate);
  const strongRed = candidates.find(isStrongRedCandidate);
  const darkBlue = candidates.find(isDarkBlueCandidate);

  /**
   * image_10:
   * neutralized-muted가 confidence 때문에 1등이지만,
   * 실제로는 strong red 후보가 훨씬 잘 맞습니다.
   */
  if (neutral && strongRed) {
    return strongRed;
  }

  /**
   * image_5:
   * neutralized-muted가 1등이지만,
   * 실제로는 dark blue / navy 후보가 더 맞습니다.
   */
  if (neutral && darkBlue) {
    return darkBlue;
  }

  const top = candidates[0];

  if (isBrightOrangeCandidate(top)) {
    const mutedCool = findBestMutedCoolCandidate(candidates);

    if (mutedCool) {
      return mutedCool;
    }
  }

  /**
   * image_3:
   * 밝은 pastel red 후보가 1등이지만,
   * 실제로는 muted rose / magenta 쪽이 더 맞습니다.
   */
  if (isWeakPastelRedCandidate(top)) {
    const mutedRose = findBestMutedRoseCandidate(candidates);

    if (mutedRose) {
      return mutedRose;
    }
  }

  return top;
}

function isBrightOrangeCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    candidate.family === "orange" &&
    hsl.h >= 15 &&
    hsl.h <= 45 &&
    hsl.s >= 0.35 &&
    y >= 130
  );
}

function isMutedCoolCandidate(candidate: ThemeCandidate) {
  const hsl = sourceHsl(candidate);
  const y = sourceLuma(candidate);

  return (
    candidate.type === "chromatic" &&
    (candidate.family === "blue" || candidate.family === "purple") &&
    hsl.h >= 220 &&
    hsl.h <= 270 &&
    hsl.s >= 0.12 &&
    hsl.s <= 0.45 &&
    y >= 60 &&
    y <= 150
  );
}

function findBestMutedCoolCandidate(candidates: ThemeCandidate[]) {
  const matched = candidates.filter(isMutedCoolCandidate);

  if (matched.length === 0) {
    return null;
  }

  return matched
    .map((candidate) => {
      const hsl = sourceHsl(candidate);
      const y = sourceLuma(candidate);

      /**
       * image_15의 best 후보:
       * sourceHex #5D627C
       * hue  blue/purple 영역
       * luma 중간
       */
      const score =
        Math.abs(hsl.h - 235) + Math.abs(y - 100) * 0.35 - hsl.s * 10;

      return {
        candidate,
        score,
      };
    })
    .sort((a, b) => a.score - b.score)[0].candidate;
}
