import { labToRgb, rgbToLab } from "./conversions/rgbToLab";

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

const labColor = rgbToLab({ r: 120, g: 150, b: 120 });
console.log(labColor);
console.log(labToRgb(labColor));

main();
