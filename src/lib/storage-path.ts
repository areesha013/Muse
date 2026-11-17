// "https://x.supabase.co/storage/v1/object/public/review-photos/<user>/<file>" -> "<user>/<file>"
export function pathInBucket(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    const p = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
    return p && !p.includes("..") ? p : null;
  } catch {
    return null;
  }
}
