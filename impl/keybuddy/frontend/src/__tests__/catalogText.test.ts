import { describe, expect, it } from 'vitest';
import {
  formatCatalogEntry,
  type CatalogTextKeyboard,
} from '../../../supabase/functions/recommend/catalogText';

function makeKeyboard(overrides: Partial<CatalogTextKeyboard> = {}): CatalogTextKeyboard {
  return {
    product_name: '테스트 키보드',
    brand: 'TEST',
    price: 100000,
    switch_type: '기계식',
    connection: '유선',
    wireless_type: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 800,
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
    ...overrides,
  };
}

describe('formatCatalogEntry', () => {
  it('무게가 있으면 g 단위로 표시한다', () => {
    expect(formatCatalogEntry(makeKeyboard({ weight_g: 916 }), 3)).toContain('무게:916g');
  });

  it('무게가 null이면 미제공으로 표시한다', () => {
    const text = formatCatalogEntry(makeKeyboard({ weight_g: null }), 3);

    expect(text).toContain('무게 미제공');
    expect(text).not.toContain('무게:nullg');
  });
});
