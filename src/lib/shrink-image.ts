// Browser-only helper: resize a photo to at most `maxSize` px on its longest
// side and re-encode it as JPEG, so phone photos (often 3-8 MB) upload quickly
// and stay well under the server's 2 MB limit. Also strips camera metadata
// such as GPS location, because only the pixels are re-encoded.
export async function shrinkImage(source: Blob, maxSize = 1280, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image."))), "image/jpeg", quality),
  );
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
