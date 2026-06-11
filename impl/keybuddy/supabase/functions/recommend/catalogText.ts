export interface CatalogTextKeyboard {
  product_name: string;
  brand: string;
  price: number;
  switch_type: string;
  connection: string;
  wireless_type: string;
  layout: string;
  key_force: string;
  weight_g: number | null;
  engraving: string;
  backlight: string;
}

export function formatCatalogEntry(keyboard: CatalogTextKeyboard, index: number): string {
  const keyForce = keyboard.key_force.trim();
  const force = !keyForce || keyForce === '0g' ? '키압 미제공' : `키압 ${keyForce}`;
  const weight = keyboard.weight_g === null ? '무게 미제공' : `무게:${keyboard.weight_g}g`;

  return `[${index}] ${keyboard.product_name} | 브랜드:${keyboard.brand} | 가격:${keyboard.price}원 | 스위치:${keyboard.switch_type} | 연결:${keyboard.connection}(${keyboard.wireless_type}) | 배열:${keyboard.layout} | ${force} | ${weight} | 각인:${keyboard.engraving} | 백라이트:${keyboard.backlight}`;
}
