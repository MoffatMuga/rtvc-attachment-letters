import sharp from "sharp";

/**
 * Cleans a scan or photo of a stamp/signature: trims empty margins, makes the
 * white paper transparent (ink colours stay), and limits the size.
 */
export async function cleanScan(input: Buffer): Promise<Buffer> {
  const base = sharp(input).rotate().resize({ width: 900, withoutEnlargement: true });
  let trimmed: Buffer;
  try {
    trimmed = await base.clone().trim({ threshold: 35 }).toBuffer();
  } catch {
    trimmed = await base.toBuffer();
  }
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lo = Math.min(data[i], data[i + 1], data[i + 2]);
    // Paper is near white. Fade fully transparent above 215, opaque below 150.
    const alpha = lo >= 215 ? 0 : lo <= 150 ? 255 : Math.round(((215 - lo) / 65) * 255);
    data[i + 3] = Math.min(data[i + 3], alpha);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
