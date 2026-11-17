// Browser only. Phone photos are often 4-10 MB. Shrink them before upload
// (max 1600 px on the long side, WebP). If anything goes wrong we send the
// original and the server says if it is not a usable photo.
const MAX_SIDE = 1600;

export async function shrinkImage(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const okType = /^image\/(jpeg|png|webp)$/.test(file.type);
    if (scale === 1 && file.size <= 1_500_000 && okType) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.86));
    if (blob && blob.type === "image/webp" && (blob.size < file.size || !okType)) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
    }
    return file;
  } catch {
    return file;
  }
}
