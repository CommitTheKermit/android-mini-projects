import type { Recommendation } from '../types';

const FULL_NUMPAD_LAYOUTS = /풀배열|96키|98키|99키/;
const NO_NUMPAD_LAYOUTS = /텐키리스|미니|65키|68키|75키|80키|87키/;
const CLICKY_SWITCH_NAME = /청축|클릭|clicky/i;
const BEGINNER_NOTE_LIMIT = 2;

interface NormalizedProductDisplay {
  switchType: string;
  switchName: string;
  connection: string;
  wirelessType: string;
  layout: string;
  backlight: string;
  engraving: string;
  keyForce: number | null;
  weightG: number | null;
}

interface CautionNote {
  priority: number;
  text: string;
}

export interface BeginnerGuide {
  labels: string[];
  notes: string[];
}

function normalizeDisplayValue(value: string): string {
  return value.replace(/^\[키보드\]\s*/, '').trim();
}

function firstDisplayValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = normalizeDisplayValue(value ?? '');
    if (normalized) return normalized;
  }

  return '';
}

function parseGram(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? Number(match[1]) : null;
}

function normalizeProductDisplay(item: Recommendation): NormalizedProductDisplay {
  return {
    switchType: normalizeDisplayValue(item.switch_type),
    switchName: firstDisplayValue(item.raw_switch_name, item.switch_name),
    connection: normalizeDisplayValue(item.connection),
    wirelessType: normalizeDisplayValue(item.wireless_type),
    layout: normalizeDisplayValue(item.layout),
    backlight: normalizeDisplayValue(item.backlight),
    engraving: normalizeDisplayValue(item.engraving),
    keyForce: parseGram(normalizeDisplayValue(item.key_force)),
    weightG: item.weight_g,
  };
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

function buildBeginnerLabels(product: NormalizedProductDisplay): string[] {
  const labels: string[] = [];

  if (/무접점 자석축/.test(product.switchType)) labels.push('빠른 반응형 키감');
  else if (/무접점 광축/.test(product.switchType)) labels.push('빠른 입력에 강한 키감');
  else if (/무접점/.test(product.switchType)) labels.push('부드러운 무접점 키감');
  else if (/펜타그래프/.test(product.switchType)) labels.push('노트북처럼 낮은 키');
  else if (/멤브레인/.test(product.switchType)) labels.push('익숙한 기본 키감');
  else if (/기계식/.test(product.switchType)) labels.push('축에 따라 키감 차이 큼');

  if (FULL_NUMPAD_LAYOUTS.test(product.layout)) labels.push('숫자키 있음');
  else if (NO_NUMPAD_LAYOUTS.test(product.layout)) labels.push('숫자키 없음');

  if (product.connection === '유선+무선') labels.push('유선/무선 모두 가능');
  else if (product.connection === '무선') labels.push('무선 연결');
  else if (product.connection === '유선') labels.push('케이블 연결');

  if (/RGB|레인보우/.test(product.backlight)) labels.push('화려한 조명');
  else if (/단색|LED/.test(product.backlight)) labels.push('조명 있음');
  else if (product.backlight === '없음') labels.push('조명 없음');

  if (/영문/.test(product.engraving) && !/한\/영/.test(product.engraving)) {
    labels.push('한글 각인 없음');
  }

  if (product.keyForce !== null) {
    if (product.keyForce >= 55) labels.push('누르는 힘이 무거운 편');
    else if (product.keyForce <= 40) labels.push('가볍게 눌리는 편');
  }

  if (product.weightG !== null) {
    if (product.weightG >= 1000) labels.push('본체 무게가 묵직함');
    else if (product.weightG <= 800) labels.push('본체 무게가 가벼운 편');
  }

  return Array.from(new Set(labels));
}

function note(priority: number, text: string): CautionNote {
  return { priority, text };
}

function selectCautionNotes(notes: CautionNote[]): string[] {
  const seen = new Set<string>();

  return notes
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.text)
    .filter((text) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, BEGINNER_NOTE_LIMIT);
}

function buildCautionNotes(product: NormalizedProductDisplay): string[] {
  const notes: CautionNote[] = [];

  if (CLICKY_SWITCH_NAME.test(product.switchName)) {
    notes.push(
      note(90, '클릭감 있는 축은 소리가 크게 느껴질 수 있어 조용한 공간에서는 확인이 필요해요.'),
    );
  } else if (/기계식/.test(product.switchType)) {
    notes.push(
      note(80, '기계식은 축 종류에 따라 소음과 키감 차이가 커서 사용 환경을 확인해보는 게 좋아요.'),
    );
  }

  if (/무접점 자석축|무접점 광축/.test(product.switchType)) {
    notes.push(
      note(70, '빠른 입력용 성향이 강해 문서 작업만 원한다면 과하게 느껴질 수 있어요.'),
    );
  }

  if (NO_NUMPAD_LAYOUTS.test(product.layout)) {
    notes.push(note(100, '숫자키가 없는 배열이라 엑셀이나 숫자 입력이 많다면 불편할 수 있어요.'));
  }

  if (product.connection === '유선') {
    notes.push(note(50, '여러 기기를 오가며 쓰려면 무선 연결 제품이 더 편할 수 있어요.'));
  } else if (
    product.connection === '무선' &&
    product.wirelessType &&
    product.wirelessType !== '정보없음' &&
    !/블루투스/.test(product.wirelessType)
  ) {
    notes.push(
      note(60, '블루투스가 필요한 노트북·태블릿 환경에서는 연결 방식을 확인해야 해요.'),
    );
  }

  if (product.weightG !== null && product.weightG >= 1000) {
    notes.push(note(40, '본체 무게가 있는 편이라 자주 들고 다니는 용도에는 부담스러울 수 있어요.'));
  }

  if (/RGB|레인보우/.test(product.backlight)) {
    notes.push(note(30, '조명이 화려한 편이라 차분한 디자인을 원하면 호불호가 있을 수 있어요.'));
  }

  if (/영문/.test(product.engraving) && !/한\/영/.test(product.engraving)) {
    notes.push(note(20, '한글 각인이 필요하다면 키캡 표기를 확인해보는 게 좋아요.'));
  }

  if (product.keyForce !== null && product.keyForce >= 55) {
    notes.push(note(65, '키압이 높은 편이라 오래 타이핑하면 손이 쉽게 피로할 수 있어요.'));
  }

  return selectCautionNotes(notes);
}

export function getBeginnerGuide(item: Recommendation): BeginnerGuide {
  const product = normalizeProductDisplay(item);

  return {
    labels: buildBeginnerLabels(product),
    notes: buildCautionNotes(product),
  };
}

export function getBeginnerLabels(item: Recommendation): string[] {
  return getBeginnerGuide(item).labels;
}

export function getCautionNotes(item: Recommendation): string[] {
  return getBeginnerGuide(item).notes;
}
