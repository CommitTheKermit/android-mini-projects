const DANURI_IMAGE_HOST = 'img.danuri.io';
const DISPLAY_IMAGE_SIZE = 600;

export function getDisplayImageUrl(src: string): string {
  if (!src) return src;

  try {
    const url = new URL(src);
    if (url.hostname !== DANURI_IMAGE_HOST || !url.pathname.includes('/catalog-image/')) {
      return src;
    }

    url.searchParams.set('shrink', `${DISPLAY_IMAGE_SIZE}:${DISPLAY_IMAGE_SIZE}`);
    return url.toString();
  } catch {
    return src.replace(/([?&]shrink=)\d+:\d+/, `$1${DISPLAY_IMAGE_SIZE}:${DISPLAY_IMAGE_SIZE}`);
  }
}
