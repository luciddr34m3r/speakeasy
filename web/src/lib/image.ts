/**
 * Convert a base64 PNG (e.g. a DALL-E response) into a downscaled JPEG File
 * ready for the existing photo-upload path. Guests view drink photos at
 * ~180px, so the ~3MB PNG becomes a ~200KB JPEG with no visible loss.
 * Falls back to the raw PNG if canvas conversion fails.
 */
export async function base64PngToJpegFile(
  b64: string,
  fileName: string,
  maxDim = 1024,
  quality = 0.85,
): Promise<File> {
  const pngBlob = await fetch(`data:image/png;base64,${b64}`).then((r) => r.blob());

  try {
    const bitmap = await createImageBitmap(pngBlob);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!jpegBlob) throw new Error('toBlob failed');

    return new File([jpegBlob], fileName.replace(/\.png$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return new File([pngBlob], fileName, { type: 'image/png' });
  }
}
