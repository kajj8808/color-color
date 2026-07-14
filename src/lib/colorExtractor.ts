import { Vibrant } from 'node-vibrant/browser';
import { converter, wcagContrast, formatHex, Oklab, clampChroma } from 'culori';

const oklab = converter('oklab');
const rgb = converter('rgb');
const white = { mode: 'rgb' as const, r: 1, g: 1, b: 1 };

export async function extractVibrantColor(imageUrl: string, targetContrast: number = 4.5): Promise<{ hex: string, rawHex: string }> {
  const palette = await Vibrant.from(imageUrl).getPalette();
  
  const swatch = palette.Vibrant || palette.DarkVibrant || palette.Muted || Object.values(palette).filter(Boolean).sort((a, b) => b!.population - a!.population)[0];
  
  if (!swatch) {
    throw new Error("Could not extract color");
  }

  const [r, g, b] = swatch.rgb;
  const rawHex = swatch.hex;
  const colorObj = { mode: 'rgb' as const, r: r / 255, g: g / 255, b: b / 255 };

  let labColor = oklab(colorObj) as Oklab;
  
  if (wcagContrast(colorObj, white) < targetContrast) {
    let minL = 0;
    let maxL = labColor.l;
    
    for (let i = 0; i < 20; i++) {
      const midL = (minL + maxL) / 2;
      const tempLab = { ...labColor, l: midL };
      const clamped = clampChroma(tempLab, 'oklch');
      const tempRgb = rgb(clamped);
      const contrast = wcagContrast(tempRgb, white);
      
      if (contrast >= targetContrast) {
        minL = midL; 
      } else {
        maxL = midL; 
      }
    }
    
    labColor.l = minL;
  }

  const finalRgb = rgb(clampChroma(labColor, 'oklch'));
  return { hex: formatHex(finalRgb), rawHex };
}
