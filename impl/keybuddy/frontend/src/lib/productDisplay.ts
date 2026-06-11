import type { Recommendation } from '../types';

function normalizeDisplayValue(value: string): string {
  return value.replace(/^\[키보드\]\s*/, '').trim();
}

export function getProductTags(item: Recommendation): string[] {
  const switchTag =
    item.switch_type === '기계식'
      ? item.raw_switch_name
        ? `스위치 ${item.raw_switch_name}`
        : '스위치 정보 확인 중'
      : item.switch_type;
  const keyForce = item.key_force.trim();

  const tags = [
    switchTag,
    item.connection,
    item.layout,
    !keyForce || keyForce === '0g' ? '키압 정보 확인 중' : `키압 ${keyForce}`,
    item.wireless_type === '유선' ? null : normalizeDisplayValue(item.wireless_type),
    normalizeDisplayValue(item.backlight),
  ];

  return Array.from(new Set(tags.filter((tag): tag is string => Boolean(tag))));
}
