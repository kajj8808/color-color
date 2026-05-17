import { labToRgb, rgbToLab } from "./conversions/rgb-to-lab";
import { deltaE76 } from "./distance/delta-e-76";
import { rgbDistance } from "./distance/rgb-distance";

async function main() {
  /*  const url =
    "https://i.scdn.co/image/ab67616d00001e024bbc4baec76f21f341fcf775";
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const image = sharp(Buffer.from(buffer));

  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  console.log(data); */
}

/* const labColor = rgbToLab({ r: 120, g: 151, b: 120 });
console.log(labColor);
console.log(labToRgb(labColor));
 */

/* const 빨강RGB = { r: 255, g: 0, b: 0 };
const 어두운빨강RGB = { r: 230, g: 10, b: 10 };
const 파랑RGB = { r: 0, g: 0, b: 255 };
const 오랜지RGB = { r: 255, g: 120, b: 0 };
const 보라RGB = { r: 255, g: 220, b: 0 };
const 노란색RGB = { r: 180, g: 0, b: 255 };

const 빨강LAB = rgbToLab(빨강RGB);
const 어두운빨강LAB = rgbToLab(어두운빨강RGB);
const 파랑LAB = rgbToLab(파랑RGB);
const 오랜지LAB = rgbToLab(오랜지RGB);
const 보라LAB = rgbToLab(보라RGB);
const 노란색LAB = rgbToLab(노란색RGB);

console.log("deltaE76 색상 비교");
console.log(`빨강 vs 어두운 빨강: ${deltaE76(빨강LAB, 어두운빨강LAB)}`);
console.log(`빨강 vs 파랑: ${deltaE76(빨강LAB, 파랑LAB)}`);
console.log(`빨강 vs 오랜지: ${deltaE76(빨강LAB, 오랜지LAB)}`);
console.log(`빨강 vs 노랑: ${deltaE76(빨강LAB, 노란색LAB)}`);
console.log(`빨강 vs 보라: ${deltaE76(빨강LAB, 보라LAB)}`);

console.log("\nRGB 색상 비교");
console.log(`빨강 vs 어두운 빨강: ${rgbDistance(빨강RGB, 어두운빨강RGB)}`);
console.log(`빨강 vs 파랑: ${rgbDistance(빨강RGB, 파랑RGB)}`);
console.log(`빨강 vs 오랜지: ${rgbDistance(빨강RGB, 오랜지RGB)}`);
console.log(`빨강 vs 노랑: ${rgbDistance(빨강RGB, 노란색RGB)}`);
console.log(`빨강 vs 보라: ${rgbDistance(빨강RGB, 보라RGB)}`);
 */
