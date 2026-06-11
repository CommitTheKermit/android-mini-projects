import type { Recommendation } from '../types';

function normalizeDisplayValue(value: string): string {
  return value.replace(/^\[키보드\]\s*/, '').trim();
}

function getWirelessTypeTag(connection: string, wirelessType: string): string | null {
  const normalizedWirelessType = normalizeDisplayValue(wirelessType);

  if (
    !normalizedWirelessType ||
    normalizedWirelessType === connection ||
    normalizedWirelessType === '유선' ||
    normalizedWirelessType === '정보없음'
  ) {
    return null;
  }

  return normalizedWirelessType;
}

function getBacklightTag(backlight: string): string {
  const normalizedBacklight = normalizeDisplayValue(backlight);

  if (!normalizedBacklight || normalizedBacklight === '정보없음') {
    return '백라이트: 정보 확인 중';
  }
  if (normalizedBacklight === '없음') return '백라이트: 없음';
  if (/레인보우/.test(normalizedBacklight)) return '백라이트: 레인보우';
  if (/RGB/.test(normalizedBacklight)) return '백라이트: RGB';
  if (/단색/.test(normalizedBacklight)) return '백라이트: 단색';
  if (/LED/.test(normalizedBacklight)) return '백라이트: LED';

  return `백라이트: ${normalizedBacklight}`;
}

export function getProductTags(item: Recommendation): string[] {
  const rawSwitchName = item.raw_switch_name?.trim();
  const switchType = item.switch_type.trim();
  const switchTag = rawSwitchName
    ? `스위치 ${rawSwitchName}`
    : switchType || '스위치 정보 확인 중';
  const keyForce = item.key_force.trim();
  const connection = normalizeDisplayValue(item.connection);

  const tags = [
    switchTag,
    connection,
    item.layout,
    !keyForce || keyForce === '0g' ? '키압 정보 확인 중' : `키압 ${keyForce}`,
    getWirelessTypeTag(connection, item.wireless_type),
    getBacklightTag(item.backlight),
  ];

  return Array.from(new Set(tags.filter((tag): tag is string => Boolean(tag))));
}
