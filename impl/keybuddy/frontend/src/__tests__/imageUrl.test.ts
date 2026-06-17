import { describe, expect, it } from 'vitest';
import { getDisplayImageUrl } from '../lib/imageUrl';

describe('getDisplayImageUrl', () => {
  it('다나와 130px catalog 썸네일을 결과 카드용 큰 썸네일로 바꾼다', () => {
    const result = getDisplayImageUrl(
      'https://img.danuri.io/catalog-image/476/026/094/a2377078683d4985b1880e8ea1f7a7a4.jpg?shrink=130:130&_v=20260610124800',
    );

    expect(result).toContain('shrink=600:600');
    expect(result).toContain('_v=20260610124800');
  });

  it('다나와 catalog 이미지에 shrink가 없으면 표시용 shrink를 추가한다', () => {
    const result = getDisplayImageUrl(
      'https://img.danuri.io/catalog-image/476/026/094/a2377078683d4985b1880e8ea1f7a7a4.jpg',
    );

    expect(result).toContain('shrink=600:600');
  });

  it('다나와 catalog 이미지가 아니면 원본 URL을 유지한다', () => {
    const src = 'https://example.com/keyboard.jpg?shrink=130:130';

    expect(getDisplayImageUrl(src)).toBe(src);
  });
});
