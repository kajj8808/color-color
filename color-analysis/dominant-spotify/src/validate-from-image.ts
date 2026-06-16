import fs from "node:fs";
import path from "node:path";

import { parseHexRgb, toHexRgb } from "./color-space";
import { extractKMeansPalette } from "./palette";
import { createThemeCandidatesFromPalette } from "./theme-candidates";
import { resolveThemeCandidate } from "./resolver";

type ThemeVars = Record<string, string>;

type SampleInput = {
  index: number;
  name: string;
  imagePath: string;
  actualCssPath: string;
};

type CompareRow = {
  token: string;
  predicted: string;
  actual: string;
  rDiff: number;
  gDiff: number;
  bDiff: number;
  errorPercent: number;
};

type ComparedResult = {
  rows: CompareRow[];
  averageError: number;
  maxError: number;
};

type CandidateSummary = {
  index: number;
  type: string;
  family: string;
  sourceHex: string;
  baseHex: string;
  confidence: number;
  averageError: number;
  maxError: number;
};

type SampleSummary = {
  sample: string;
  imagePath: string;
  actualCssPath: string;

  actualBase: string | null;
  actualCinemaFrom: string | null;

  primaryType: string;
  primaryFamily: string;
  primarySourceHex: string;
  primaryBaseHex: string;
  primaryAvgError: number;
  primaryMaxError: number;

  bestIndex: number;
  bestType: string;
  bestFamily: string;
  bestSourceHex: string;
  bestBaseHex: string;
  bestAvgError: number;
  bestMaxError: number;

  status: "OK" | "OK_WITH_WARNING" | "RESOLVER_CHECK" | "MAPPING_CHECK";
};

/**
 * 실제 비교에 사용할 token들입니다.
 *
 * 없는 token은 자동으로 skip됩니다.
 * 그래서 cinema-mode가 없는 page profile도 어느 정도 대응됩니다.
 */
const TOKENS = [
  "--cinema-mode-bg-color-from",
  "--cinema-mode-bg-color-to",

  "--background-base",
  "--background-highlight",
  "--background-press",

  "--background-elevated-base",
  "--background-elevated-highlight",
  "--background-elevated-press",

  "--background-tinted-base",
  "--background-tinted-highlight",
  "--background-tinted-press",

  "--text-subdued",
  "--essential-subdued",
  "--decorative-subdued",

  "--header-text-color",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function parseCssVars(cssText: string): ThemeVars {
  const vars: ThemeVars = {};

  const matches = cssText.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);

  for (const match of matches) {
    vars[match[1]] = match[2].trim();
  }

  return vars;
}

function rgbErrorPercent(predictedHex: string, actualHex: string) {
  const predicted = parseHexRgb(predictedHex);
  const actual = parseHexRgb(actualHex);

  const rDiff = Math.abs(predicted.r - actual.r);
  const gDiff = Math.abs(predicted.g - actual.g);
  const bDiff = Math.abs(predicted.b - actual.b);

  return {
    predicted: toHexRgb(predicted),
    actual: toHexRgb(actual),
    rDiff,
    gDiff,
    bDiff,
    errorPercent: ((rDiff + gDiff + bDiff) / 3 / 255) * 100,
  };
}

function compareVars(input: {
  predictedVars: ThemeVars;
  actualVars: ThemeVars;
  tokens: string[];
}): ComparedResult {
  const rows: CompareRow[] = [];

  for (const token of input.tokens) {
    const predicted = input.predictedVars[token];
    const actual = input.actualVars[token];

    if (!predicted || !actual) {
      continue;
    }

    if (predicted.startsWith("var(") || actual.startsWith("var(")) {
      continue;
    }

    const result = rgbErrorPercent(predicted, actual);

    rows.push({
      token,
      predicted: result.predicted,
      actual: result.actual,
      rDiff: result.rDiff,
      gDiff: result.gDiff,
      bDiff: result.bDiff,
      errorPercent: Number(result.errorPercent.toFixed(2)),
    });
  }

  if (rows.length === 0) {
    return {
      rows,
      averageError: Number.NaN,
      maxError: Number.NaN,
    };
  }

  const averageError =
    rows.reduce((sum, row) => sum + row.errorPercent, 0) / rows.length;

  const maxError = Math.max(...rows.map((row) => row.errorPercent));

  return {
    rows,
    averageError: Number(averageError.toFixed(2)),
    maxError: Number(maxError.toFixed(2)),
  };
}

function varsToCssText(vars: ThemeVars) {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n");
}

function resolveProjectPath(relativePath: string) {
  return path.resolve(process.cwd(), relativePath);
}

function findExistingFile(pathsToTry: string[]) {
  return pathsToTry.find((filePath) => fs.existsSync(filePath)) ?? null;
}

function findImagePath(sampleDir: string, index: number) {
  const candidates: string[] = [];

  /**
   * 기존 호환:
   * sample/image.jpg
   */
  if (index === 1) {
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(path.join(sampleDir, `image${ext}`));
    }
  }

  /**
   * 권장 구조:
   * sample/image_1.jpg
   * sample/image_2.jpg
   */
  for (const ext of IMAGE_EXTENSIONS) {
    candidates.push(path.join(sampleDir, `image_${index}${ext}`));
  }

  return findExistingFile(candidates);
}

function findActualCssPath(sampleDir: string, index: number) {
  const candidates: string[] = [];

  /**
   * 기존 호환:
   * sample/actual.css
   */
  if (index === 1) {
    candidates.push(path.join(sampleDir, "actual.css"));
  }

  /**
   * 권장 구조:
   * sample/actual_1.css
   * sample/actual_2.css
   */
  candidates.push(path.join(sampleDir, `actual_${index}.css`));

  return findExistingFile(candidates);
}

function getArgValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];

  if (!value) {
    return fallback;
  }

  return value;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function discoverSamples(input: {
  sampleDir: string;
  count: number;
}): SampleInput[] {
  const samples: SampleInput[] = [];

  for (let index = 1; index <= input.count; index += 1) {
    const imagePath = findImagePath(input.sampleDir, index);
    const actualCssPath = findActualCssPath(input.sampleDir, index);

    if (!imagePath || !actualCssPath) {
      console.warn(`[skip] image_${index}: image or actual css not found`, {
        imagePath,
        actualCssPath,
      });

      continue;
    }

    samples.push({
      index,
      name: `image_${index}`,
      imagePath,
      actualCssPath,
    });
  }

  return samples;
}

function diagnose(input: {
  primaryAverageError: number;
  primaryMaxError: number;
  bestAverageError: number;
  bestMaxError: number;
}): SampleSummary["status"] {
  if (input.primaryAverageError <= 10 && input.primaryMaxError <= 15) {
    return "OK";
  }

  if (input.primaryAverageError <= 10) {
    return "OK_WITH_WARNING";
  }

  if (input.bestAverageError <= 10 && input.bestMaxError <= 15) {
    return "RESOLVER_CHECK";
  }

  return "MAPPING_CHECK";
}
async function validateSample(sample: SampleInput) {
  console.log("\n============================================================");
  console.log(`Sample: ${sample.name}`);
  console.log("imagePath:", sample.imagePath);
  console.log("actualCssPath:", sample.actualCssPath);
  console.log("============================================================");

  const actualCss = fs.readFileSync(sample.actualCssPath, "utf-8");
  const actualVars = parseCssVars(actualCss);

  const actualBase = actualVars["--background-base"] ?? null;
  const actualCinemaFrom = actualVars["--cinema-mode-bg-color-from"] ?? null;

  console.log("actual background-base:", actualBase);
  console.log("actual cinema-mode-bg-color-from:", actualCinemaFrom);

  const palette = await extractKMeansPalette(sample.imagePath);
  const candidates = createThemeCandidatesFromPalette(palette);

  if (candidates.length === 0) {
    throw new Error(`No theme candidates found for ${sample.name}`);
  }

  console.log("\nPalette");
  console.table(
    palette.map((swatch, index) => ({
      index,
      hex: swatch.hex,
      score: swatch.score.toFixed(4),
      keptCoverage: swatch.keptCoverage.toFixed(4),
      luma: swatch.luma.toFixed(1),
      saturation: swatch.saturation.toFixed(3),
      colorfulness: swatch.colorfulness.toFixed(1),
      hue: swatch.hsl.h.toFixed(1),
      hslL: swatch.hsl.l.toFixed(3),
    })),
  );

  const candidateComparisons = candidates.map((candidate, index) => {
    const compared = compareVars({
      predictedVars: candidate.vars,
      actualVars,
      tokens: TOKENS,
    });

    return {
      index,
      candidate,
      compared,
    };
  });

  const candidateRows: CandidateSummary[] = candidateComparisons.map(
    ({ candidate, compared }, index) => ({
      index,
      type: candidate.type,
      family: candidate.family,
      sourceHex: candidate.sourceHex,
      baseHex: candidate.baseHex,
      confidence: Number(candidate.confidence.toFixed(4)),
      averageError: compared.averageError,
      maxError: compared.maxError,
    }),
  );

  console.log("\nTheme candidates");
  console.table(candidateRows);

  const primary = resolveThemeCandidate(candidates);

  if (!primary) {
    throw new Error(`No primary theme candidate found for ${sample.name}`);
  }

  const primaryComparison = compareVars({
    predictedVars: primary.vars,
    actualVars,
    tokens: TOKENS,
  });

  const bestCandidate = candidateComparisons
    .filter((item) => Number.isFinite(item.compared.averageError))
    .sort((a, b) => a.compared.averageError - b.compared.averageError)[0];

  if (!bestCandidate) {
    throw new Error(`No comparable candidate found for ${sample.name}`);
  }

  console.log("\nPrimary theme");
  console.table([
    {
      type: primary.type,
      family: primary.family,
      sourceHex: primary.sourceHex,
      baseHex: primary.baseHex,
      confidence: primary.confidence.toFixed(4),
      averageError: primaryComparison.averageError,
      maxError: primaryComparison.maxError,
    },
  ]);

  console.log("\nBest candidate by actual CSS");
  console.table([
    {
      index: bestCandidate.index,
      type: bestCandidate.candidate.type,
      family: bestCandidate.candidate.family,
      sourceHex: bestCandidate.candidate.sourceHex,
      baseHex: bestCandidate.candidate.baseHex,
      averageError: bestCandidate.compared.averageError,
      maxError: bestCandidate.compared.maxError,
    },
  ]);

  console.log("\nPrimary comparison");
  console.table(primaryComparison.rows);
  console.log("primary averageError:", `${primaryComparison.averageError}%`);
  console.log("primary maxError:", `${primaryComparison.maxError}%`);

  console.log("\nBest candidate comparison");
  console.table(bestCandidate.compared.rows);
  console.log("best averageError:", `${bestCandidate.compared.averageError}%`);
  console.log("best maxError:", `${bestCandidate.compared.maxError}%`);

  console.log("\nPrimary CSS vars");
  console.log(varsToCssText(primary.vars));

  const summary: SampleSummary = {
    sample: sample.name,
    imagePath: sample.imagePath,
    actualCssPath: sample.actualCssPath,

    actualBase,
    actualCinemaFrom,

    primaryType: primary.type,
    primaryFamily: primary.family,
    primarySourceHex: primary.sourceHex,
    primaryBaseHex: primary.baseHex,
    primaryAvgError: primaryComparison.averageError,
    primaryMaxError: primaryComparison.maxError,

    bestIndex: bestCandidate.index,
    bestType: bestCandidate.candidate.type,
    bestFamily: bestCandidate.candidate.family,
    bestSourceHex: bestCandidate.candidate.sourceHex,
    bestBaseHex: bestCandidate.candidate.baseHex,
    bestAvgError: bestCandidate.compared.averageError,
    bestMaxError: bestCandidate.compared.maxError,

    status: diagnose({
      primaryAverageError: primaryComparison.averageError,
      primaryMaxError: primaryComparison.maxError,
      bestAverageError: bestCandidate.compared.averageError,
      bestMaxError: bestCandidate.compared.maxError,
    }),
  };

  return {
    summary,
    report: {
      sample,
      actual: {
        backgroundBase: actualBase,
        cinemaModeBgColorFrom: actualCinemaFrom,
      },
      palette: palette.map((swatch) => ({
        hex: swatch.hex,
        score: swatch.score,
        keptCoverage: swatch.keptCoverage,
        imageCoverage: swatch.imageCoverage,
        luma: swatch.luma,
        saturation: swatch.saturation,
        colorfulness: swatch.colorfulness,
        labChroma: swatch.labChroma,
        hue: swatch.hsl.h,
        hslL: swatch.hsl.l,
      })),
      candidates: candidateComparisons.map(
        ({ candidate, compared }, index) => ({
          index,
          type: candidate.type,
          family: candidate.family,
          sourceHex: candidate.sourceHex,
          sourceHexes: candidate.sourceHexes,
          baseHex: candidate.baseHex,
          confidence: candidate.confidence,
          averageError: compared.averageError,
          maxError: compared.maxError,
        }),
      ),
      primary: {
        vars: primary.vars,
        comparison: primaryComparison,
      },
      best: {
        index: bestCandidate.index,
        vars: bestCandidate.candidate.vars,
        comparison: bestCandidate.compared,
      },
    },
  };
}

function mean(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));

  if (validValues.length === 0) {
    return Number.NaN;
  }

  return (
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  );
}

async function main() {
  const sampleDir = resolveProjectPath(getArgValue("--dir", "./sample"));

  const count = Number(getArgValue("--count", "10"));

  const outputPath = resolveProjectPath(
    getArgValue("--out", "./validation-report.json"),
  );

  const samples = discoverSamples({
    sampleDir,
    count,
  });

  if (samples.length === 0) {
    throw new Error(
      `No samples found. Expected files like sample/image_1.jpg + sample/actual_1.css`,
    );
  }

  console.log("sampleDir:", sampleDir);
  console.log("sample count:", samples.length);

  const summaries: SampleSummary[] = [];
  const reports = [];

  for (const sample of samples) {
    const result = await validateSample(sample);
    summaries.push(result.summary);
    reports.push(result.report);
  }

  console.log("\n============================================================");
  console.log("Summary");
  console.log("============================================================");

  console.table(
    summaries.map((item) => ({
      sample: item.sample,

      primaryType: item.primaryType,
      primaryFamily: item.primaryFamily,
      primarySourceHex: item.primarySourceHex,
      primaryBaseHex: item.primaryBaseHex,
      primaryAvgError: item.primaryAvgError,
      primaryMaxError: item.primaryMaxError,

      bestIndex: item.bestIndex,
      bestType: item.bestType,
      bestFamily: item.bestFamily,
      bestSourceHex: item.bestSourceHex,
      bestBaseHex: item.bestBaseHex,
      bestAvgError: item.bestAvgError,
      bestMaxError: item.bestMaxError,

      status: item.status,
    })),
  );

  const primaryMeanAverageError = mean(
    summaries.map((item) => item.primaryAvgError),
  );

  const bestMeanAverageError = mean(summaries.map((item) => item.bestAvgError));

  const primaryMaxError = Math.max(
    ...summaries.map((item) => item.primaryMaxError),
  );

  const bestMaxError = Math.max(...summaries.map((item) => item.bestMaxError));

  const statusCounts = summaries.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    "primary mean averageError:",
    `${primaryMeanAverageError.toFixed(2)}%`,
  );
  console.log("best mean averageError:", `${bestMeanAverageError.toFixed(2)}%`);
  console.log("primary max error:", `${primaryMaxError.toFixed(2)}%`);
  console.log("best max error:", `${bestMaxError.toFixed(2)}%`);
  console.log("statusCounts:", statusCounts);

  const report = {
    generatedAt: new Date().toISOString(),
    sampleDir,
    count,
    summary: {
      sampleCount: summaries.length,
      primaryMeanAverageError,
      bestMeanAverageError,
      primaryMaxError,
      bestMaxError,
      statusCounts,
    },
    samples: summaries,
    reports,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("report written:", outputPath);

  if (hasFlag("--fail-on-bad")) {
    const badSamples = summaries.filter((item) => item.status !== "OK");

    if (badSamples.length > 0) {
      console.error("Bad samples found:");
      console.table(
        badSamples.map((item) => ({
          sample: item.sample,
          status: item.status,
          primaryAvgError: item.primaryAvgError,
          bestAvgError: item.bestAvgError,
        })),
      );

      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
