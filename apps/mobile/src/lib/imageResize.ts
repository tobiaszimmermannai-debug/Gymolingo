import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Downscales a photo for AI analysis (longest side ≤ maxSide, JPEG) and returns base64.
 * Keeps uploads small (~100–250 KB) – faster, cheaper and within free quotas.
 */
export async function prepareForAi(uri: string, maxSide = 1024): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const base = await ImageManipulator.manipulate(uri).renderAsync();
  const ref =
    Math.max(base.width, base.height) > maxSide
      ? await ImageManipulator.manipulate(base)
          .resize(base.width >= base.height ? { width: maxSide } : { height: maxSide })
          .renderAsync()
      : base;
  const out = await ref.saveAsync({ base64: true, compress: 0.75, format: SaveFormat.JPEG });
  if (!out.base64) throw new Error('Bild konnte nicht verarbeitet werden.');
  return { data: out.base64, mediaType: 'image/jpeg' };
}
