// utils/imageCompression.ts
/** Downscale/compress an image (File/Blob) to maxWidth, return a File. */
export async function compressImage(
  src: File | Blob,
  opts: { maxWidth?: number; quality?: number; name?: string } = {}
): Promise<File> {
  const maxWidth = opts.maxWidth ?? 1280;
  const quality = opts.quality ?? 0.82;

  const dataUrl = await blobToDataURL(src);
  const img = await loadImage(dataUrl);

  const ratio = img.width / img.height || 1;
  const width = Math.min(maxWidth, img.width);
  const height = Math.round(width / ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b || new Blob()), "image/jpeg", quality)
  );

  return new File([blob], opts.name ?? "image.jpg", { type: "image/jpeg" });
}

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(b);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
