const DANURI_IMAGE_HOST = 'img.danuri.io';
const DISPLAY_IMAGE_SIZE = 600;

function buildDisplayImageUrl(url: URL): string {
  const params = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== 'shrink')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  params.push(`shrink=${DISPLAY_IMAGE_SIZE}:${DISPLAY_IMAGE_SIZE}`);
  return `${url.origin}${url.pathname}?${params.join('&')}${url.hash}`;
}

export function getDisplayImageUrl(src: string): string {
  if (!src) return src;

  try {
    const url = new URL(src);
    if (url.hostname !== DANURI_IMAGE_HOST || !url.pathname.includes('/catalog-image/')) {
      return src;
    }

    return buildDisplayImageUrl(url);
  } catch {
    return src;
  }
}
