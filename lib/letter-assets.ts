import { getSetting } from "./db";
import { DEFAULT_PLACEMENT, type LetterAssets, type Placement } from "./pdf";

export async function loadPlacement(): Promise<Placement> {
  const raw = await getSetting("placement");
  if (!raw) return { ...DEFAULT_PLACEMENT };
  try {
    return { ...DEFAULT_PLACEMENT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PLACEMENT };
  }
}

export async function loadAssets(): Promise<LetterAssets> {
  const [stamp, sig, placement] = await Promise.all([
    getSetting("stamp_png"),
    getSetting("signature_png"),
    loadPlacement(),
  ]);
  return {
    stampPng: stamp ? Buffer.from(stamp, "base64") : null,
    signaturePng: sig ? Buffer.from(sig, "base64") : null,
    placement,
  };
}
