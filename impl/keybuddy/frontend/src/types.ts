// 크롤러(output/keyboards.json)가 수집한 키보드 1개 레코드
export interface Keyboard {
  product_name: string;
  brand: string;
  price: number; // 원 단위 정수
  image_url: string;
  switch_type: string; // 기계식 / 펜타그래프 / 무접점 자석축 ...
  connection: string; // 유선 / 무선 / 유선+무선
  layout: string; // 풀배열 / 텐키리스 / 미니 ...
  key_force: string; // "43g" 형태, 미제공은 "0g"
  weight_g: number | null; // 그램, 미제공은 null
  wireless_type: string; // 전용동글(리시버), 블루투스 / 유선 ...
  engraving: string; // 한/영 정각 / 영문 정각 / 레이저각인 키캡 / 정보없음
  backlight: string; // RGB 백라이트 / 레인보우 백라이트 / 단색 백라이트 / 없음
  raw_switch_name?: string | null; // 다나와에 표시된 스위치 옵션명
  switch_name?: string | null; // switches.json과 매칭된 정규 스위치 이름
  switch_manufacturer?: string | null;
  product_code?: string | null;
  media_url?: string | null;
  price_compare_url?: string | null;
  media_url_is_placeholder?: boolean;
}

export type SwitchBehavior = 'linear' | 'tactile' | 'clicky';

export interface SwitchInfo {
  switch_type: SwitchBehavior | null;
  is_silent: boolean | null;
}

export type SwitchDictionary = Record<string, SwitchInfo>;

// 추천 1건: 원본 키보드 + LLM 추천 사유 + DB 속성 기반 태그
export interface Recommendation extends Keyboard {
  reason: string; // 이 사용자에게 추천하는 한 줄 이유
  tags: string[]; // switch_type, layout, connection 등 DB 속성에서 생성한 태그
  is_fallback: boolean; // 폴백 경로로 추가된 추천인지 여부
  source: 'llm' | 'fallback' | 'local'; // 추천 출처
}

export interface RecommendResult {
  summary: string; // 전체 추천 요약 한두 문장
  recommendations: Recommendation[];
  meta?: {
    version: string; // Edge Function이 frontend/package.json에서 가져온 앱 버전
  };
}

// 자유 입력 / 단계별 선택 두 가지 입력 형태
export type RecommendInput =
  | { mode: 'freeform'; query: string }
  | { mode: 'guided'; answers: Record<string, string>; budget: { min: number; max: number } };
