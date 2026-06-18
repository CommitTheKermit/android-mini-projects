import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Keyboard,
  ChevronLeft,
  ArrowRight,
  Check,
  RefreshCw,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Play,
  ShoppingCart,
  Star,
  AlertTriangle,
} from 'lucide-react';
import switchesData from './data/switches.json';
import { recommend } from './lib/recommend';
import { logPurchaseClick, logRating } from './lib/events';
import { getDisplayImageUrl } from './lib/imageUrl';
import { getBeginnerGuide, getProductTags } from './lib/productDisplay';
import { getSwitchDisplayData, type GraphLevel } from './lib/switchDisplay';
import type {
  Recommendation,
  RecommendInput,
  RecommendResult,
  SwitchDictionary,
} from './types';

const switches = switchesData as SwitchDictionary;
const RATING_STAR_SIZE = 34;

function useAutoDismiss<T>(duration: number) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const show = useCallback((next: T) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setValue(null), durationRef.current);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [value, show] as const;
}

// --- [질문 데이터] 단계별 선택지 ---
const HOME_TABS = [
  { key: 'freeform', label: '자유롭게 입력' },
  { key: 'step', label: '단계별 선택' },
] as const;

const questions = [
  { id: '용도', title: '어떤 용도로 사용하시나요?', options: ['사무용', '게임용', '상관없음'] },
  {
    id: '휴대성',
    title: '주로 어디서 사용하시나요?',
    options: ['책상에 놓고 쓸 거예요', '자주 가지고 다닐래요', '상관없음'],
  },
  {
    id: '소리',
    title: '타건 소리는 어느 정도가 좋나요?',
    options: [
      '조용해야 해요 (매우 낮음)',
      '조금 소리가 났으면 해요 (낮음)',
      '적당한 소리 (보통)',
      '경쾌한 소리 (조금 큼)',
      '타건감 위주 (시끄러워도 됨)',
    ],
  },
  {
    id: '키감',
    title: '어떤 느낌의 키감을 선호하시나요?',
    options: [
      '또각또각 (걸림이 있는 느낌)',
      '서걱서걱 (부드럽게 들어가는 느낌)',
      '보글보글 (독특한 무접점 느낌)',
      '잘 모르겠어요',
    ],
  },
  {
    id: '키압',
    title: '키를 누를 때의 무게감은요?',
    options: [
      '가볍게 눌렸으면 좋겠어요 (35~45g)',
      '보편적인게 좋아요 (45~55g)',
      '묵직한게 좋아요 (60g 이상)',
      '잘 모르겠어요',
    ],
  },
  {
    id: '연결방식',
    title: '어떤 연결 방식을 원하시나요?',
    options: ['유선', '무선 USB 동글', '블루투스', '유/무선 모두', '상관없음'],
  },
  {
    id: '크기',
    title: '원하시는 키보드 크기가 있나요?',
    options: [
      '숫자 패드가 있는 일반 키보드 (풀배열)',
      '숫자 패드가 있지만 콤팩트함 (1800배열)',
      '숫자 패드가 없음 (텐키리스)',
      'F열은 있고 숫자패드만 없는 콤팩트 (75%)',
      'F열 없이 방향키는 있는 콤팩트 (65%)',
      'F1~F12키도 없는 미니 (60%)',
    ],
  },
  { id: '예산', title: '예산은 어느 정도로 생각하시나요?', type: 'range', options: [] as string[] },
  {
    id: '각인',
    title: '키보드 각인은 어떻게 할까요?',
    options: [
      '한국어, 영어가 모두 필요해요',
      '영어만 적혀있길 바라요',
      '한국어만 적혀있길 바라요',
      '상관없음',
    ],
  },
  {
    id: '백라이트',
    title: '백라이트(조명)가 필요하신가요?',
    options: ['화려한 RGB가 좋아요', '은은한 단색 조명이 좋아요', '없어도 돼요 (배터리 절약)'],
  },
];

interface StepOptionGuide {
  title: string;
  description: string;
  panelLabel: string;
  insight: string;
  badges: string[];
}

type KeyToken = string | { label: string; span?: number; rowSpan?: number };
type KeyboardRow = KeyToken[];
type KeyboardLayoutMode = 'full' | 'compact1800' | 'tkl' | 'compact75' | 'compact65' | 'sixty';
type BacklightMode = 'rgb' | 'single' | 'off';
type SizePreviewCluster = 'nav' | 'arrows' | 'numpad' | 'compactNav';

interface SizeLayoutBlueprint {
  label: string;
  description: string;
  widthClass: string;
  rows: KeyboardRow[];
  functionRow?: KeyboardRow;
  clusters?: SizePreviewCluster[];
  activeKeys?: string[];
  labelMode?: 'all' | 'essential';
  visibleLabels?: string[];
}

const STEP_OPTION_GUIDES: Record<string, Record<string, StepOptionGuide>> = {
  용도: {
    사무용: {
      title: '사무용',
      description: '문서 입력과 회의가 많은 환경에서 안정적으로 쓰기 좋은 기준입니다.',
      panelLabel: 'Work Focus',
      insight: '소음, 장시간 입력 피로, 숫자 입력 빈도를 함께 보면 실패 확률이 낮아집니다.',
      badges: ['조용함', '정확한 입력', '피로도'],
    },
    게임용: {
      title: '게임용',
      description: 'WASD 접근성, 빠른 입력, 책상 위 마우스 공간을 우선합니다.',
      panelLabel: 'Game Focus',
      insight: '마우스 이동 폭을 확보하려면 텐키리스 이하 배열과 안정적인 유선/동글 연결이 유리합니다.',
      badges: ['WASD', '응답성', '마우스 공간'],
    },
    상관없음: {
      title: '상관없음',
      description: '용도를 강하게 제한하지 않고 추천 후보를 넓게 탐색합니다.',
      panelLabel: 'Balanced',
      insight: '용도가 정해지지 않았을 때는 소리, 키감, 예산처럼 체감 차이가 큰 조건을 더 크게 반영합니다.',
      badges: ['넓은 탐색', '균형', '취향 우선'],
    },
  },
  휴대성: {
    '책상에 놓고 쓸 거예요': {
      title: '책상 고정',
      description: '무게와 크기보다 안정적인 타건감과 기능키 구성을 우선합니다.',
      panelLabel: 'Desk Setup',
      insight: '고정 사용이면 숫자패드, 팜레스트, 묵직한 하우징까지 후보에 포함할 수 있습니다.',
      badges: ['안정감', '기능키', '책상용'],
    },
    '자주 가지고 다닐래요': {
      title: '휴대용',
      description: '가방에 넣기 쉬운 폭, 낮은 무게, 무선 연결을 우선합니다.',
      panelLabel: 'Portable Setup',
      insight: '휴대성이 중요하면 75% 이하 배열과 블루투스, 낮은 무게가 실제 사용 만족도를 크게 좌우합니다.',
      badges: ['가벼움', '무선', '작은 폭'],
    },
    상관없음: {
      title: '상관없음',
      description: '고정 사용과 휴대 사용을 모두 열어두고 추천합니다.',
      panelLabel: 'Flexible',
      insight: '사용 장소가 섞이면 무게보다 연결 방식과 배열 호환성을 먼저 확인하는 편이 안전합니다.',
      badges: ['유연함', '범용', '후보 확대'],
    },
  },
  소리: {
    '조용해야 해요 (매우 낮음)': {
      title: '매우 조용',
      description: '공유 사무실, 도서관처럼 주변 소음 민감도가 높은 환경에 맞춥니다.',
      panelLabel: 'Noise Level 1',
      insight: '저소음 스위치, 펜타그래프, 무접점 계열을 우선하면 주변 사람에게 들리는 소리가 줄어듭니다.',
      badges: ['저소음', '공유 공간', '흡음'],
    },
    '조금 소리가 났으면 해요 (낮음)': {
      title: '낮은 소리',
      description: '약간의 타건음은 허용하지만 거슬리는 클릭음은 줄이는 선택입니다.',
      panelLabel: 'Noise Level 2',
      insight: '리니어나 저소음 택타일처럼 소리가 낮은 축을 고르면 사무실에서도 무난합니다.',
      badges: ['낮은 타건음', '무난함', '업무용'],
    },
    '적당한 소리 (보통)': {
      title: '보통',
      description: '기계식 키보드의 기본적인 타건음을 허용하는 균형형 선택입니다.',
      panelLabel: 'Noise Level 3',
      insight: '소리 제한이 강하지 않으면 키감과 가격 선택지가 넓어집니다.',
      badges: ['균형', '선택지 넓음', '일반'],
    },
    '경쾌한 소리 (조금 큼)': {
      title: '경쾌한 소리',
      description: '타건음이 분명하게 들리는 쪽을 선호하는 선택입니다.',
      panelLabel: 'Noise Level 4',
      insight: '클릭감이나 하우징 울림이 있는 제품까지 후보에 넣되, 공용 공간 사용 여부를 꼭 확인해야 합니다.',
      badges: ['분명한 소리', '타건 재미', '개인 공간'],
    },
    '타건감 위주 (시끄러워도 됨)': {
      title: '타건감 우선',
      description: '소음보다 손끝 피드백과 재미를 우선합니다.',
      panelLabel: 'Noise Level 5',
      insight: '청축류나 강한 택타일도 후보가 되지만, 주변 환경과 야간 사용에는 불리할 수 있습니다.',
      badges: ['클릭감', '강한 피드백', '개인용'],
    },
  },
  키감: {
    '또각또각 (걸림이 있는 느낌)': {
      title: '또각또각',
      description: '눌리는 중간에 걸림이 있어 입력 지점이 손끝에 분명히 느껴집니다.',
      panelLabel: 'Tactile Feel',
      insight: '오타를 줄이고 입력감을 느끼고 싶다면 택타일 계열이 잘 맞습니다.',
      badges: ['택타일', '걸림', '입력감'],
    },
    '서걱서걱 (부드럽게 들어가는 느낌)': {
      title: '서걱서걱',
      description: '중간 걸림 없이 부드럽게 내려가는 리니어 느낌입니다.',
      panelLabel: 'Linear Feel',
      insight: '빠른 반복 입력과 게임 용도에는 걸림이 적은 리니어 축을 선호하는 경우가 많습니다.',
      badges: ['리니어', '부드러움', '반복 입력'],
    },
    '보글보글 (독특한 무접점 느낌)': {
      title: '보글보글',
      description: '러버돔과 정전용량 방식 특유의 둥글고 탄성 있는 느낌입니다.',
      panelLabel: 'Capacitive Feel',
      insight: '무접점은 소리와 키감이 독특하므로, 가격대와 배열 선택지를 함께 확인하는 것이 좋습니다.',
      badges: ['무접점', '탄성', '독특함'],
    },
    '잘 모르겠어요': {
      title: '잘 모르겠어요',
      description: '키감 조건을 강하게 제한하지 않고 다른 취향 조건을 먼저 반영합니다.',
      panelLabel: 'Open Feel',
      insight: '초보자라면 소리와 키압을 먼저 고르고, 키감은 추천 결과에서 비교해도 충분합니다.',
      badges: ['후보 확대', '초보자', '비교 추천'],
    },
  },
  키압: {
    '가볍게 눌렸으면 좋겠어요 (35~45g)': {
      title: '가벼운 키압',
      description: '오래 입력해도 손가락 부담이 적은 35~45g 중심의 선택입니다.',
      panelLabel: 'Light Force',
      insight: '장시간 문서 작업에는 가벼운 키압이 편하지만, 손을 올려두는 습관이 있으면 오입력이 늘 수 있습니다.',
      badges: ['35~45g', '피로 감소', '가벼움'],
    },
    '보편적인게 좋아요 (45~55g)': {
      title: '보편적인 키압',
      description: '대부분의 사용자가 적응하기 쉬운 45~55g 범위입니다.',
      panelLabel: 'Medium Force',
      insight: '처음 구매라면 중간 키압이 실패 가능성이 가장 낮습니다.',
      badges: ['45~55g', '무난함', '입문'],
    },
    '묵직한게 좋아요 (60g 이상)': {
      title: '묵직한 키압',
      description: '눌림이 확실하고 반발력이 강한 60g 이상 중심의 선택입니다.',
      panelLabel: 'Heavy Force',
      insight: '강한 피드백을 좋아하면 만족도가 높지만 장시간 사용 피로는 커질 수 있습니다.',
      badges: ['60g+', '확실한 반발', '묵직함'],
    },
    '잘 모르겠어요': {
      title: '잘 모르겠어요',
      description: '키압을 제한하지 않고 보편적인 범위까지 열어둡니다.',
      panelLabel: 'Open Force',
      insight: '키압이 낯설다면 45~55g 전후의 추천을 기준으로 비교하는 편이 안전합니다.',
      badges: ['열린 조건', '입문', '균형'],
    },
  },
  연결방식: {
    유선: {
      title: '유선',
      description: '케이블 연결로 지연과 배터리 걱정을 줄입니다.',
      panelLabel: 'USB Wired',
      insight: '게임이나 고정 책상 사용에서는 유선이 가장 단순하고 안정적인 선택입니다.',
      badges: ['안정성', '무충전', '낮은 지연'],
    },
    '무선 USB 동글': {
      title: '무선 USB 동글',
      description: '2.4GHz 리시버로 무선 편의성과 빠른 반응을 함께 노립니다.',
      panelLabel: '2.4GHz Dongle',
      insight: '게이밍 무선은 블루투스보다 동글 연결을 쓰는 제품이 많습니다.',
      badges: ['2.4GHz', '낮은 지연', '무선'],
    },
    블루투스: {
      title: '블루투스',
      description: '노트북, 태블릿, 휴대폰 등 여러 기기 전환에 유리합니다.',
      panelLabel: 'Bluetooth',
      insight: '휴대성과 멀티페어링이 중요하면 블루투스 지원 여부가 핵심입니다.',
      badges: ['멀티페어링', '태블릿', '휴대'],
    },
    '유/무선 모두': {
      title: '유/무선 모두',
      description: '책상에서는 유선, 이동 중에는 무선으로 상황에 맞게 씁니다.',
      panelLabel: 'Hybrid',
      insight: '사용 장소가 자주 바뀌면 연결 방식을 모두 지원하는 모델이 오래 쓰기 좋습니다.',
      badges: ['하이브리드', '전환', '범용'],
    },
    상관없음: {
      title: '상관없음',
      description: '연결 조건을 제한하지 않고 다른 취향을 우선합니다.',
      panelLabel: 'Any Connection',
      insight: '연결 방식이 중요하지 않다면 같은 예산에서 키감이나 배열 선택지를 넓힐 수 있습니다.',
      badges: ['후보 확대', '가격 우선', '취향 우선'],
    },
  },
  크기: {
    '숫자 패드가 있는 일반 키보드 (풀배열)': {
      title: '풀배열',
      description: 'F열, 방향키, 숫자패드를 모두 갖춘 가장 익숙한 구성입니다.',
      panelLabel: '100% Full Size',
      insight: '숫자 입력이 많고 책상 공간이 충분하면 가장 안정적인 선택입니다.',
      badges: ['숫자패드', 'F열', '넓은 폭'],
    },
    '숫자 패드가 있지만 콤팩트함 (1800배열)': {
      title: '1800배열',
      description: '숫자패드를 유지하면서 전체 폭을 줄인 압축 배열입니다.',
      panelLabel: '1800 Compact',
      insight: '엑셀 작업은 많지만 마우스 공간도 필요할 때 풀배열보다 효율적입니다.',
      badges: ['숫자패드', '콤팩트', '업무'],
    },
    '숫자 패드가 없음 (텐키리스)': {
      title: '텐키리스',
      description: '숫자패드를 덜어내 마우스 공간을 확보한 대표적인 축소 배열입니다.',
      panelLabel: 'TKL',
      insight: '게임과 문서 작업을 함께 한다면 배열 적응 부담이 적고 공간 효율도 좋습니다.',
      badges: ['마우스 공간', '방향키', '입문'],
    },
    'F열은 있고 숫자패드만 없는 콤팩트 (75%)': {
      title: '75%',
      description: 'F열과 방향키는 남기고 숫자패드와 여백을 줄인 콤팩트 배열입니다.',
      panelLabel: '75% Compact',
      insight: 'F열을 자주 쓰면서도 마우스 공간을 확보하고 싶을 때 좋지만, 우측 Shift와 방향키 위치 적응이 필요할 수 있습니다.',
      badges: ['F열 유지', '방향키', '콤팩트'],
    },
    'F열 없이 방향키는 있는 콤팩트 (65%)': {
      title: '65%',
      description: 'F열은 덜어내고 숫자열, 문자열, 방향키 중심으로 폭을 줄입니다.',
      panelLabel: '65% Compact',
      insight: '방향키와 기본 입력 키는 남기면서 휴대성을 높이고 싶을 때 적합하며, F키는 조합키 사용에 익숙해져야 합니다.',
      badges: ['F열 없음', '방향키', '휴대성'],
    },
    'F1~F12키도 없는 미니 (60%)': {
      title: '60%',
      description: '문자 입력 핵심 키만 남겨 가장 작게 줄인 미니 배열입니다.',
      panelLabel: '60% Compact',
      insight: '마우스 공간은 가장 넓지만 방향키와 F열을 자주 쓰면 조합키 학습이 필요합니다.',
      badges: ['최소 폭', '미니', '조합키'],
    },
  },
  각인: {
    '한국어, 영어가 모두 필요해요': {
      title: '한/영 각인',
      description: '한국어와 영어 표기가 모두 있어 처음 쓰는 사람도 찾기 쉽습니다.',
      panelLabel: 'Korean + English',
      insight: '가족이나 공용 PC에서 함께 쓰면 한/영 각인이 가장 안전합니다.',
      badges: ['한글', '영문', '공용'],
    },
    '영어만 적혀있길 바라요': {
      title: '영문 각인',
      description: '키캡 표기가 단정하고 디자인 선택지가 넓습니다.',
      panelLabel: 'English Only',
      insight: '키 위치가 익숙하다면 영문 각인이 더 깔끔하게 느껴질 수 있습니다.',
      badges: ['깔끔함', '디자인', '숙련자'],
    },
    '한국어만 적혀있길 바라요': {
      title: '한글 각인',
      description: '한국어 입력 위치 확인을 가장 우선합니다.',
      panelLabel: 'Korean Only',
      insight: '한글 단독 각인은 제품 선택지가 제한될 수 있어 후보 수를 함께 확인해야 합니다.',
      badges: ['한글', '가독성', '선택지 확인'],
    },
    상관없음: {
      title: '상관없음',
      description: '각인 조건을 제한하지 않고 가격과 성능 후보를 넓힙니다.',
      panelLabel: 'Any Legends',
      insight: '각인이 중요하지 않다면 같은 조건에서 더 다양한 브랜드와 키캡 옵션을 볼 수 있습니다.',
      badges: ['후보 확대', '가격', '디자인'],
    },
  },
  백라이트: {
    '화려한 RGB가 좋아요': {
      title: 'RGB 백라이트',
      description: '여러 색상 효과와 게이밍 감성을 중시합니다.',
      panelLabel: 'RGB Lighting',
      insight: 'RGB는 시각적 만족도가 높지만 무선 사용 시 배터리 소모가 커질 수 있습니다.',
      badges: ['RGB', '효과', '게이밍'],
    },
    '은은한 단색 조명이 좋아요': {
      title: '단색 백라이트',
      description: '어두운 환경에서 키 위치를 확인하기 쉬운 절제된 조명입니다.',
      panelLabel: 'Single Color',
      insight: '단색 조명은 실용성과 배터리 부담 사이의 균형이 좋습니다.',
      badges: ['가독성', '절제', '야간'],
    },
    '없어도 돼요 (배터리 절약)': {
      title: '백라이트 없음',
      description: '조명보다 배터리 지속 시간과 단순한 디자인을 우선합니다.',
      panelLabel: 'No Lighting',
      insight: '무선 휴대용 키보드에서는 백라이트 없음이 배터리와 무게 측면에서 유리할 수 있습니다.',
      badges: ['배터리', '단순함', '실용'],
    },
  },
};

const BUDGET_GUIDE: StepOptionGuide = {
  title: '예산 범위',
  description: '최소와 최대 금액을 정하면 추천 후보의 가격대를 안정적으로 좁힙니다.',
  panelLabel: 'Budget Range',
  insight: '기계식, 무접점, 무선 기능은 가격 차이가 커서 예산 범위가 추천 정확도에 직접 영향을 줍니다.',
  badges: ['가격대', '후보 압축', '가성비'],
};

const DEFAULT_GUIDE: StepOptionGuide = {
  title: '선택 기준',
  description: '선택한 조건을 기준으로 추천 후보를 좁힙니다.',
  panelLabel: 'Guide',
  insight: '조건을 명확히 고를수록 추천 이유와 후보 정렬이 더 구체적입니다.',
  badges: ['조건', '추천', '비교'],
};

const SIZE_REFERENCE_VISIBLE_LABELS = [
  'Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Del', 'Bksp',
  'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\',
  'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter',
  'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Ctrl', 'Win', 'Alt', 'Fn', 'Menu', 'Space',
  'Ins', 'Home', 'PgU', 'End', 'PgD', '↑', '←', '↓', '→',
  'Clr', 'Num', '+', '*', 'Ent', 'Prt', 'Scr', 'Pause',
];

const SIZE_COMPACT_VISIBLE_LABELS = [
  'Esc', 'Tab', 'Caps', 'Shift', 'Ctrl', 'Alt', 'Fn', 'Space', 'Del', 'Bksp', 'Enter',
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
  'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']',
  'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'",
  'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', '↑', '←', '↓', '→',
];

const NUMPAD_KEYS: KeyToken[] = [
  'Clr',
  '=',
  '/',
  '*',
  '7',
  '8',
  '9',
  '-',
  '4',
  '5',
  '6',
  '+',
  '1',
  '2',
  '3',
  { label: 'Ent', rowSpan: 2 },
  { label: '0', span: 2 },
  '.',
];

const NUMPAD_1800_KEYS: KeyToken[] = [
  'Clr',
  '=',
  '/',
  '*',
  '7',
  '8',
  '9',
  '-',
  '4',
  '5',
  '6',
  { label: '+', rowSpan: 2 },
  '1',
  '2',
  '3',
  { label: '0', span: 2 },
  '.',
  { label: 'Ent', rowSpan: 2 },
];

const SYSTEM_1800_KEYS = ['Ins', 'Home', 'PgU', 'Prt', 'Del', 'End', 'PgD', 'Scr', 'Pause'];
const ESSENTIAL_KEY_LABELS = new Set([
  'Esc',
  'Tab',
  'Caps',
  'Shift',
  'Ctrl',
  'Win',
  'Alt',
  'Space',
  'Fn',
  'Menu',
  'Enter',
  'Bksp',
  'Del',
  '↑',
  '←',
  '↓',
  '→',
]);

function getOptionGuide(questionId: string, option?: string) {
  if (questionId === '예산') return BUDGET_GUIDE;
  const guides = STEP_OPTION_GUIDES[questionId];
  if (!guides) return DEFAULT_GUIDE;
  if (option && guides[option]) return guides[option];
  return Object.values(guides)[0] ?? DEFAULT_GUIDE;
}

function formatBudget(value: number) {
  return value >= 1000000 ? '100만원+' : `${value.toLocaleString()}원`;
}

function getBudgetSearchLabel(budget: { min: number; max: number }) {
  const hasMin = budget.min > 0;
  const hasMax = budget.max < 1000000;
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) return `${formatBudget(budget.min)}~${formatBudget(budget.max)}`;
  if (hasMin) return `${formatBudget(budget.min)} 이상`;
  return `${formatBudget(budget.max)} 이하`;
}

function isMeaningfulSearchAnswer(option: string) {
  return option !== '상관없음' && option !== '잘 모르겠어요';
}

function getGuidedSearchTitle(answers: Record<string, string>, budget: { min: number; max: number }) {
  const summaryOrder = ['용도', '크기', '소리', '키감', '키압', '연결방식', '각인', '백라이트', '휴대성'];
  const labels = summaryOrder
    .map((questionId) => {
      const option = answers[questionId];
      if (!option || !isMeaningfulSearchAnswer(option)) return null;
      return getOptionGuide(questionId, option).title;
    })
    .filter((label): label is string => Boolean(label));
  const budgetLabel = getBudgetSearchLabel(budget);
  if (budgetLabel) labels.push(budgetLabel);
  if (labels.length === 0) return '조건을 넓게 둔 키보드';
  return labels.join(' · ');
}

function getSearchContextTitle(input: RecommendInput) {
  if (input.mode === 'freeform') return `"${input.query.trim().replace(/\s+/g, ' ')}"`;
  return getGuidedSearchTitle(input.answers, input.budget);
}

function getKeyboardLayoutMode(option?: string): KeyboardLayoutMode {
  if (!option) return 'full';
  if (option.includes('1800')) return 'compact1800';
  if (option.includes('텐키리스')) return 'tkl';
  if (option.includes('75%')) return 'compact75';
  if (option.includes('65%')) return 'compact65';
  if (option.includes('60%')) return 'sixty';
  return 'full';
}

function getSoundLevel(option?: string) {
  if (!option) return 3;
  if (option.includes('매우 낮음')) return 1;
  if (option.includes('낮음')) return 2;
  if (option.includes('보통')) return 3;
  if (option.includes('조금 큼')) return 4;
  return 5;
}

function getPressureTarget(option?: string) {
  if (!option) return 'medium';
  if (option.includes('35~45g')) return 'light';
  if (option.includes('60g')) return 'heavy';
  return 'medium';
}

function getBacklightMode(option?: string): BacklightMode {
  if (!option) return 'single';
  if (option.includes('RGB')) return 'rgb';
  if (option.includes('단색')) return 'single';
  return 'off';
}

function keyTokenLabel(token: KeyToken) {
  return typeof token === 'string' ? token : token.label;
}

function keyTokenSpan(token: KeyToken, defaultSpan = 1) {
  return typeof token === 'string' ? defaultSpan : token.span ?? defaultSpan;
}

function keyTokenRowSpan(token: KeyToken) {
  return typeof token === 'string' ? 1 : token.rowSpan ?? 1;
}

const SIZE_FUNCTION_ROW: KeyboardRow = [
  { label: 'Esc', span: 6 },
  { label: 'F1', span: 4 },
  { label: 'F2', span: 4 },
  { label: 'F3', span: 4 },
  { label: 'F4', span: 4 },
  { label: 'F5', span: 4 },
  { label: 'F6', span: 4 },
  { label: 'F7', span: 4 },
  { label: 'F8', span: 4 },
  { label: 'F9', span: 4 },
  { label: 'F10', span: 4 },
  { label: 'F11', span: 4 },
  { label: 'F12', span: 4 },
  { label: 'Del', span: 6 },
];

const SIZE_1800_FUNCTION_ROW: KeyboardRow = [
  { label: 'Esc', span: 6 },
  { label: 'F1', span: 4 },
  { label: 'F2', span: 4 },
  { label: 'F3', span: 4 },
  { label: 'F4', span: 4 },
  { label: 'F5', span: 4 },
  { label: 'F6', span: 4 },
  { label: 'F7', span: 4 },
  { label: 'F8', span: 4 },
  { label: 'F9', span: 4 },
  { label: 'F10', span: 4 },
  { label: 'F11', span: 4 },
  { label: 'F12', span: 4 },
];

const SIZE_FULL_ROWS: KeyboardRow[] = [
  [
    { label: '`', span: 4 },
    { label: '1', span: 4 },
    { label: '2', span: 4 },
    { label: '3', span: 4 },
    { label: '4', span: 4 },
    { label: '5', span: 4 },
    { label: '6', span: 4 },
    { label: '7', span: 4 },
    { label: '8', span: 4 },
    { label: '9', span: 4 },
    { label: '0', span: 4 },
    { label: '-', span: 4 },
    { label: '=', span: 4 },
    { label: 'Bksp', span: 8 },
  ],
  [
    { label: 'Tab', span: 7 },
    { label: 'Q', span: 4 },
    { label: 'W', span: 4 },
    { label: 'E', span: 4 },
    { label: 'R', span: 4 },
    { label: 'T', span: 4 },
    { label: 'Y', span: 4 },
    { label: 'U', span: 4 },
    { label: 'I', span: 4 },
    { label: 'O', span: 4 },
    { label: 'P', span: 4 },
    { label: '[', span: 3 },
    { label: ']', span: 3 },
    { label: '\\', span: 3 },
  ],
  [
    { label: 'Caps', span: 8 },
    { label: 'A', span: 4 },
    { label: 'S', span: 4 },
    { label: 'D', span: 4 },
    { label: 'F', span: 4 },
    { label: 'G', span: 4 },
    { label: 'H', span: 4 },
    { label: 'J', span: 4 },
    { label: 'K', span: 4 },
    { label: 'L', span: 4 },
    { label: ';', span: 4 },
    { label: "'", span: 4 },
    { label: 'Enter', span: 8 },
  ],
  [
    { label: 'Shift', span: 10 },
    { label: 'Z', span: 4 },
    { label: 'X', span: 4 },
    { label: 'C', span: 4 },
    { label: 'V', span: 4 },
    { label: 'B', span: 4 },
    { label: 'N', span: 4 },
    { label: 'M', span: 4 },
    { label: ',', span: 4 },
    { label: '.', span: 4 },
    { label: '/', span: 4 },
    { label: 'Shift', span: 10 },
  ],
  [
    { label: 'Ctrl', span: 5 },
    { label: 'Win', span: 5 },
    { label: 'Alt', span: 5 },
    { label: 'Space', span: 25 },
    { label: 'Alt', span: 5 },
    { label: 'Fn', span: 5 },
    { label: 'Menu', span: 5 },
    { label: 'Ctrl', span: 5 },
  ],
];

const SIZE_1800_ROWS: KeyboardRow[] = [
  [
    { label: '`', span: 4 },
    { label: '1', span: 4 },
    { label: '2', span: 4 },
    { label: '3', span: 4 },
    { label: '4', span: 4 },
    { label: '5', span: 4 },
    { label: '6', span: 4 },
    { label: '7', span: 4 },
    { label: '8', span: 4 },
    { label: '9', span: 4 },
    { label: '0', span: 4 },
    { label: '-', span: 4 },
    { label: '=', span: 4 },
    { label: 'Bksp', span: 8 },
  ],
  [
    { label: 'Tab', span: 7 },
    { label: 'Q', span: 4 },
    { label: 'W', span: 4 },
    { label: 'E', span: 4 },
    { label: 'R', span: 4 },
    { label: 'T', span: 4 },
    { label: 'Y', span: 4 },
    { label: 'U', span: 4 },
    { label: 'I', span: 4 },
    { label: 'O', span: 4 },
    { label: 'P', span: 4 },
    { label: '[', span: 3 },
    { label: ']', span: 3 },
    { label: '\\', span: 7 },
  ],
  [
    { label: 'Caps', span: 8 },
    { label: 'A', span: 4 },
    { label: 'S', span: 4 },
    { label: 'D', span: 4 },
    { label: 'F', span: 4 },
    { label: 'G', span: 4 },
    { label: 'H', span: 4 },
    { label: 'J', span: 4 },
    { label: 'K', span: 4 },
    { label: 'L', span: 4 },
    { label: ';', span: 4 },
    { label: "'", span: 4 },
    { label: 'Enter', span: 8 },
  ],
  [
    { label: 'Shift', span: 10 },
    { label: 'Z', span: 4 },
    { label: 'X', span: 4 },
    { label: 'C', span: 4 },
    { label: 'V', span: 4 },
    { label: 'B', span: 4 },
    { label: 'N', span: 4 },
    { label: 'M', span: 4 },
    { label: ',', span: 4 },
    { label: '.', span: 4 },
    { label: '/', span: 4 },
    { label: 'Shift', span: 10 },
  ],
  [
    { label: 'Ctrl', span: 5 },
    { label: 'Win', span: 5 },
    { label: 'Alt', span: 5 },
    { label: 'Space', span: 25 },
    { label: 'Alt', span: 5 },
    { label: 'Fn', span: 5 },
    { label: 'Menu', span: 5 },
    { label: 'Ctrl', span: 5 },
  ],
];

const SIZE_COMPACT_ROWS: KeyboardRow[] = [
  [
    { label: 'Esc', span: 5 },
    { label: '1', span: 4 },
    { label: '2', span: 4 },
    { label: '3', span: 4 },
    { label: '4', span: 4 },
    { label: '5', span: 4 },
    { label: '6', span: 4 },
    { label: '7', span: 4 },
    { label: '8', span: 4 },
    { label: '9', span: 4 },
    { label: '0', span: 4 },
    { label: '-', span: 4 },
    { label: '=', span: 4 },
    { label: 'Bksp', span: 7 },
  ],
  [
    { label: 'Tab', span: 7 },
    { label: 'Q', span: 4 },
    { label: 'W', span: 4 },
    { label: 'E', span: 4 },
    { label: 'R', span: 4 },
    { label: 'T', span: 4 },
    { label: 'Y', span: 4 },
    { label: 'U', span: 4 },
    { label: 'I', span: 4 },
    { label: 'O', span: 4 },
    { label: 'P', span: 4 },
    { label: '[', span: 3 },
    { label: ']', span: 3 },
    { label: 'Del', span: 7 },
  ],
  [
    { label: 'Caps', span: 8 },
    { label: 'A', span: 4 },
    { label: 'S', span: 4 },
    { label: 'D', span: 4 },
    { label: 'F', span: 4 },
    { label: 'G', span: 4 },
    { label: 'H', span: 4 },
    { label: 'J', span: 4 },
    { label: 'K', span: 4 },
    { label: 'L', span: 4 },
    { label: ';', span: 4 },
    { label: "'", span: 4 },
    { label: 'Enter', span: 8 },
  ],
  [
    { label: 'Shift', span: 9 },
    { label: 'Z', span: 4 },
    { label: 'X', span: 4 },
    { label: 'C', span: 4 },
    { label: 'V', span: 4 },
    { label: 'B', span: 4 },
    { label: 'N', span: 4 },
    { label: 'M', span: 4 },
    { label: ',', span: 4 },
    { label: '.', span: 4 },
    { label: '/', span: 4 },
    { label: 'Shift', span: 7 },
    { label: '↑', span: 4 },
  ],
  [
    { label: 'Ctrl', span: 6 },
    { label: 'Win', span: 6 },
    { label: 'Alt', span: 6 },
    { label: 'Space', span: 24 },
    { label: 'Fn', span: 6 },
    { label: '←', span: 4 },
    { label: '↓', span: 4 },
    { label: '→', span: 4 },
  ],
];

const SIZE_75_ROWS: KeyboardRow[] = [
  [
    { label: '`', span: 4 },
    { label: '1', span: 4 },
    { label: '2', span: 4 },
    { label: '3', span: 4 },
    { label: '4', span: 4 },
    { label: '5', span: 4 },
    { label: '6', span: 4 },
    { label: '7', span: 4 },
    { label: '8', span: 4 },
    { label: '9', span: 4 },
    { label: '0', span: 4 },
    { label: '-', span: 4 },
    { label: '=', span: 4 },
    { label: 'Bksp', span: 8 },
  ],
  [
    { label: 'Tab', span: 7 },
    { label: 'Q', span: 4 },
    { label: 'W', span: 4 },
    { label: 'E', span: 4 },
    { label: 'R', span: 4 },
    { label: 'T', span: 4 },
    { label: 'Y', span: 4 },
    { label: 'U', span: 4 },
    { label: 'I', span: 4 },
    { label: 'O', span: 4 },
    { label: 'P', span: 4 },
    { label: '[', span: 3 },
    { label: ']', span: 3 },
    { label: '\\', span: 7 },
  ],
  [
    { label: 'Caps', span: 8 },
    { label: 'A', span: 4 },
    { label: 'S', span: 4 },
    { label: 'D', span: 4 },
    { label: 'F', span: 4 },
    { label: 'G', span: 4 },
    { label: 'H', span: 4 },
    { label: 'J', span: 4 },
    { label: 'K', span: 4 },
    { label: 'L', span: 4 },
    { label: ';', span: 4 },
    { label: "'", span: 4 },
    { label: 'Enter', span: 8 },
  ],
  [
    { label: 'Shift', span: 9 },
    { label: 'Z', span: 4 },
    { label: 'X', span: 4 },
    { label: 'C', span: 4 },
    { label: 'V', span: 4 },
    { label: 'B', span: 4 },
    { label: 'N', span: 4 },
    { label: 'M', span: 4 },
    { label: ',', span: 4 },
    { label: '.', span: 4 },
    { label: '/', span: 4 },
    { label: 'Shift', span: 7 },
    { label: '↑', span: 4 },
  ],
  [
    { label: 'Ctrl', span: 6 },
    { label: 'Win', span: 6 },
    { label: 'Alt', span: 6 },
    { label: 'Space', span: 24 },
    { label: 'Fn', span: 6 },
    { label: '←', span: 4 },
    { label: '↓', span: 4 },
    { label: '→', span: 4 },
  ],
];

const SIZE_SIXTY_ROWS: KeyboardRow[] = [
  [
    { label: 'Esc', span: 6 },
    { label: '1', span: 4 },
    { label: '2', span: 4 },
    { label: '3', span: 4 },
    { label: '4', span: 4 },
    { label: '5', span: 4 },
    { label: '6', span: 4 },
    { label: '7', span: 4 },
    { label: '8', span: 4 },
    { label: '9', span: 4 },
    { label: '0', span: 4 },
    { label: '-', span: 4 },
    { label: '=', span: 4 },
    { label: 'Bksp', span: 6 },
  ],
  [
    { label: 'Tab', span: 7 },
    { label: 'Q', span: 4 },
    { label: 'W', span: 4 },
    { label: 'E', span: 4 },
    { label: 'R', span: 4 },
    { label: 'T', span: 4 },
    { label: 'Y', span: 4 },
    { label: 'U', span: 4 },
    { label: 'I', span: 4 },
    { label: 'O', span: 4 },
    { label: 'P', span: 4 },
    { label: '[', span: 4 },
    { label: ']', span: 4 },
    { label: '\\', span: 5 },
  ],
  [
    { label: 'Caps', span: 9 },
    { label: 'A', span: 4 },
    { label: 'S', span: 4 },
    { label: 'D', span: 4 },
    { label: 'F', span: 4 },
    { label: 'G', span: 4 },
    { label: 'H', span: 4 },
    { label: 'J', span: 4 },
    { label: 'K', span: 4 },
    { label: 'L', span: 4 },
    { label: ';', span: 4 },
    { label: "'", span: 4 },
    { label: 'Enter', span: 7 },
  ],
  [
    { label: 'Shift', span: 10 },
    { label: 'Z', span: 4 },
    { label: 'X', span: 4 },
    { label: 'C', span: 4 },
    { label: 'V', span: 4 },
    { label: 'B', span: 4 },
    { label: 'N', span: 4 },
    { label: 'M', span: 4 },
    { label: ',', span: 4 },
    { label: '.', span: 4 },
    { label: '/', span: 4 },
    { label: 'Shift', span: 10 },
  ],
  [
    { label: 'Ctrl', span: 7 },
    { label: 'Win', span: 7 },
    { label: 'Alt', span: 7 },
    { label: 'Space', span: 25 },
    { label: 'Fn', span: 7 },
    { label: 'Ctrl', span: 7 },
  ],
];

const SIZE_LAYOUT_BLUEPRINTS: Record<KeyboardLayoutMode, SizeLayoutBlueprint> = {
  full: {
    label: '100%',
    description: 'F열 + 방향키 + 숫자패드',
    widthClass: 'w-full',
    functionRow: SIZE_FUNCTION_ROW,
    rows: SIZE_FULL_ROWS,
    clusters: ['nav', 'arrows', 'numpad'],
    labelMode: 'essential',
    visibleLabels: SIZE_REFERENCE_VISIBLE_LABELS,
  },
  compact1800: {
    label: '1800',
    description: '숫자패드는 유지하고 폭은 압축',
    widthClass: 'w-full',
    functionRow: SIZE_1800_FUNCTION_ROW,
    rows: SIZE_1800_ROWS,
    clusters: ['compactNav', 'numpad'],
    labelMode: 'essential',
    visibleLabels: SIZE_REFERENCE_VISIBLE_LABELS,
  },
  tkl: {
    label: 'TKL',
    description: '숫자패드 제외, 방향키 유지',
    widthClass: 'w-[88%]',
    functionRow: SIZE_FUNCTION_ROW,
    rows: SIZE_FULL_ROWS,
    clusters: ['nav', 'arrows'],
    labelMode: 'essential',
    visibleLabels: SIZE_REFERENCE_VISIBLE_LABELS,
  },
  compact75: {
    label: '75%',
    description: 'F열 유지, 숫자패드 제외',
    widthClass: 'w-[80%]',
    functionRow: SIZE_FUNCTION_ROW,
    rows: SIZE_75_ROWS,
    activeKeys: ['↑', '←', '↓', '→'],
    labelMode: 'essential',
    visibleLabels: SIZE_REFERENCE_VISIBLE_LABELS,
  },
  compact65: {
    label: '65%',
    description: 'F열 제외, 방향키 유지',
    widthClass: 'w-[74%]',
    rows: SIZE_COMPACT_ROWS,
    activeKeys: ['↑', '←', '↓', '→'],
    labelMode: 'essential',
    visibleLabels: SIZE_COMPACT_VISIBLE_LABELS,
  },
  sixty: {
    label: '60%',
    description: 'F열·방향키·숫자패드 없음',
    widthClass: 'w-[68%]',
    rows: SIZE_SIXTY_ROWS,
    activeKeys: ['A', 'S', 'D', 'Space'],
    labelMode: 'essential',
    visibleLabels: SIZE_COMPACT_VISIBLE_LABELS,
  },
};

function SizePreviewKey({
  token,
  active = false,
  showLabel = true,
  lighting = 'off',
  colorIndex = 0,
}: {
  token: KeyToken;
  active?: boolean;
  showLabel?: boolean;
  lighting?: BacklightMode;
  colorIndex?: number;
}) {
  const label = keyTokenLabel(token);
  const span = keyTokenSpan(token);
  const rowSpan = keyTokenRowSpan(token);
  const rgbClasses = [
    'border-rose-300/70 bg-rose-400/70 text-white',
    'border-orange-300/70 bg-orange-400/70 text-slate-950',
    'border-amber-200/80 bg-amber-300/80 text-slate-950',
    'border-emerald-200/70 bg-emerald-400/70 text-slate-950',
    'border-sky-200/70 bg-sky-400/70 text-slate-950',
    'border-violet-300/70 bg-violet-500/70 text-white',
  ];
  const inactiveClass =
    lighting === 'rgb'
      ? rgbClasses[colorIndex % rgbClasses.length]
      : lighting === 'single'
        ? 'border-cyan-100/90 bg-cyan-200 text-slate-950 shadow-[0_0_10px_rgba(103,232,249,0.45)]'
        : 'border-slate-400/60 bg-slate-100 text-slate-600 shadow-[inset_0_-1px_0_rgba(15,23,42,0.14)]';

  return (
    <div
      className={`flex min-w-0 items-center justify-center overflow-hidden rounded-[4px] border px-px text-[6px] font-black leading-none shadow-sm sm:px-0.5 sm:text-[8px] ${
        rowSpan > 1 ? 'h-full min-h-4 sm:min-h-6' : 'h-4 sm:h-6'
      } ${
        active
          ? 'border-blue-500 bg-blue-500 text-white'
          : inactiveClass
      } ${lighting === 'rgb' && !active ? 'keybuddy-rgb-key' : ''}`}
      style={{
        gridColumn: `span ${span} / span ${span}`,
        gridRow: rowSpan > 1 ? `span ${rowSpan} / span ${rowSpan}` : undefined,
        animationDelay: lighting === 'rgb' && !active ? `${(colorIndex % 12) * -0.09}s` : undefined,
      }}
    >
      {showLabel ? label : ''}
    </div>
  );
}

function KeyboardSizePreview({
  blueprint,
  lighting = 'off',
}: {
  blueprint: SizeLayoutBlueprint;
  lighting?: BacklightMode;
}) {
  const activeSet = new Set(blueprint.activeKeys ?? []);
  const visibleLabelSet = new Set(blueprint.visibleLabels ?? []);
  const visibleLabel = (label: string) =>
    blueprint.labelMode === 'all' || activeSet.has(label) || ESSENTIAL_KEY_LABELS.has(label) || visibleLabelSet.has(label);
  let colorIndex = 0;

  const renderRow = (row: KeyboardRow) => (
    <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-0.5 sm:gap-1">
      {row.map((token, index) => {
        const label = keyTokenLabel(token);
        return (
          <SizePreviewKey
            key={`${label}-${index}`}
            token={token}
            active={activeSet.has(label)}
            showLabel={visibleLabel(label)}
            lighting={lighting}
            colorIndex={colorIndex++}
          />
        );
      })}
    </div>
  );

  const renderNavigationCluster = () => (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      {['Ins', 'Home', 'PgU', 'Del', 'End', 'PgD'].map((label) => (
        <SizePreviewKey
          key={label}
          token={label}
          showLabel={visibleLabel(label)}
          lighting={lighting}
          colorIndex={colorIndex++}
        />
      ))}
    </div>
  );

  const renderArrowCluster = () => (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      <div />
      <SizePreviewKey token="↑" active={activeSet.has('↑')} lighting={lighting} colorIndex={colorIndex++} />
      <div />
      {['←', '↓', '→'].map((label) => (
        <SizePreviewKey key={label} token={label} active={activeSet.has(label)} lighting={lighting} colorIndex={colorIndex++} />
      ))}
    </div>
  );

  const render1800StatusDots = () => (
    <div className="flex h-4 items-center justify-center gap-0.5 sm:h-6 sm:gap-1">
      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={index}
          className="h-0.5 w-0.5 rounded-full bg-slate-300/75 shadow-[0_0_5px_rgba(203,213,225,0.45)] sm:h-1 sm:w-1"
        />
      ))}
    </div>
  );

  const render1800SystemCluster = () => (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      {SYSTEM_1800_KEYS.map((label) => (
        <SizePreviewKey
          key={label}
          token={label}
          active={activeSet.has(label)}
          showLabel={visibleLabel(label)}
          lighting={lighting}
          colorIndex={colorIndex++}
        />
      ))}
    </div>
  );

  const renderNumpadCluster = (keys: KeyToken[] = NUMPAD_KEYS) => (
    <div className="grid w-12 shrink-0 grid-flow-row-dense grid-cols-4 auto-rows-[1rem] gap-0.5 sm:w-[4.75rem] sm:auto-rows-[1.5rem] sm:gap-1">
      {keys.map((token, index) => {
        const label = keyTokenLabel(token);
        return (
          <SizePreviewKey
            key={`${label}-${index}`}
            token={token}
            showLabel={visibleLabel(label)}
            lighting={lighting}
            colorIndex={colorIndex++}
          />
        );
      })}
    </div>
  );

  const renderReference1800Preview = () => (
    <div className="overflow-hidden rounded-2xl bg-slate-800/90 p-2 shadow-inner ring-1 ring-white/10 sm:p-3">
      <div className="mx-auto w-full max-w-full transition-[width] duration-200">
        <div className="rounded-xl bg-slate-700/45 p-1.5 ring-1 ring-black/20 sm:p-2">
          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_4.1rem] items-stretch gap-1 sm:grid-cols-[minmax(0,1fr)_5rem_5.25rem] sm:gap-1.5">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              {blueprint.functionRow && <div className="mb-1 sm:mb-1.5">{renderRow(blueprint.functionRow)}</div>}
              {blueprint.rows.map((row) => renderRow(row))}
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-1 sm:gap-1.5">
              <div className="space-y-0.5 sm:space-y-1">
                {render1800StatusDots()}
                {render1800SystemCluster()}
              </div>
              <div className="mt-auto">
                {renderArrowCluster()}
              </div>
            </div>

            <div className="min-w-0">
              {renderNumpadCluster(NUMPAD_1800_KEYS)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (blueprint.clusters?.includes('compactNav')) {
    return renderReference1800Preview();
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-800/90 p-2 shadow-inner ring-1 ring-white/10 sm:p-3">
      <div className={`mx-auto ${blueprint.widthClass} max-w-full transition-[width] duration-200`}>
        <div className="flex items-end gap-1 sm:gap-2">
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            {blueprint.functionRow && <div className="mb-1 sm:mb-1.5">{renderRow(blueprint.functionRow)}</div>}
            {blueprint.rows.map((row) => renderRow(row))}
          </div>

          {(blueprint.clusters?.includes('nav') || blueprint.clusters?.includes('arrows')) && (
            <div className="flex w-9 shrink-0 flex-col justify-between gap-2 self-stretch sm:w-14 sm:gap-3">
              {blueprint.clusters?.includes('nav') ? renderNavigationCluster() : <div />}
              {blueprint.clusters?.includes('arrows') && renderArrowCluster()}
            </div>
          )}

          {blueprint.clusters?.includes('numpad') && renderNumpadCluster(NUMPAD_KEYS)}
        </div>
      </div>
    </div>
  );
}

function UnifiedKeyboardPreview({
  mode = 'tkl',
  activeKeys = [],
  lighting = 'off',
}: {
  mode?: KeyboardLayoutMode;
  activeKeys?: string[];
  lighting?: BacklightMode;
}) {
  return (
    <KeyboardSizePreview
      blueprint={{
        ...SIZE_LAYOUT_BLUEPRINTS[mode],
        activeKeys,
        labelMode: 'essential',
      }}
      lighting={lighting}
    />
  );
}

function KeyboardSizeArtwork({ option }: { option?: string }) {
  const mode = getKeyboardLayoutMode(option);
  const selected = SIZE_LAYOUT_BLUEPRINTS[mode];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Selected Layout</p>
          <p className="mt-1 text-3xl font-black text-white">{selected.label}</p>
        </div>
        <p className="max-w-[9rem] break-keep text-right text-xs font-medium leading-relaxed text-slate-300">
          {selected.description}
        </p>
      </div>
      <KeyboardSizePreview blueprint={selected} />
    </div>
  );
}

function PurposeArtwork({ option }: { option?: string }) {
  const isGame = option === '게임용';
  const isWork = option === '사무용';
  const workMetrics = [
    { label: '장시간 입력', value: '높음' },
    { label: '소음 민감도', value: '높음' },
    { label: '숫자 입력', value: '상황별' },
  ];
  const gameMetrics = [
    { label: '반응 속도', value: '높음' },
    { label: '마우스 공간', value: '중요' },
    { label: '반복 입력', value: '높음' },
  ];
  const activeMetrics = isGame ? gameMetrics : workMetrics;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className={`rounded-2xl border p-3 ${isWork ? 'border-emerald-300 bg-emerald-300/20 text-white' : 'border-white/10 bg-white/5 text-slate-400'}`}>
          <p className="text-xs font-black">문서 입력</p>
          <div className="mt-3 space-y-2">
            {workMetrics.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-[10px] font-black">
                <span>{metric.label}</span>
                <span className={isWork ? 'text-emerald-200' : 'text-slate-500'}>{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-2xl border p-3 ${isGame ? 'border-blue-300 bg-blue-400/20 text-white' : 'border-white/10 bg-white/5 text-slate-400'}`}>
          <p className="text-xs font-black">게임 조작</p>
          <div className="mt-3 space-y-2">
            {gameMetrics.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-[10px] font-black">
                <span>{metric.label}</span>
                <span className={isGame ? 'text-blue-200' : 'text-slate-500'}>{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-300">
            {isGame ? '게임 환경 우선순위' : isWork ? '업무 환경 우선순위' : '균형 탐색 기준'}
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-slate-300">
            {isGame ? '공간/반응' : isWork ? '소음/피로' : '조건 완화'}
          </span>
        </div>
        <div className="mt-4 grid gap-2">
          {activeMetrics.map((metric, index) => (
            <div key={metric.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-[11px] font-bold text-slate-300">
              <span>{metric.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-700">
                <span
                  className={`block h-full rounded-full ${isGame ? 'bg-blue-400' : 'bg-emerald-400'}`}
                  style={{ width: `${92 - index * 16}%` }}
                />
              </span>
              <span className="text-slate-400">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortabilityArtwork({ option }: { option?: string }) {
  const portable = option?.includes('가지고');
  const desk = option?.includes('책상');

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <div className={`rounded-2xl border p-4 ${desk ? 'border-emerald-300 bg-emerald-300/15' : 'border-white/10 bg-white/5'}`}>
        <div className="mx-auto flex h-32 max-w-48 flex-col items-center justify-end rounded-2xl bg-slate-900/80 p-4 ring-1 ring-white/10">
          <div className="h-16 w-28 rounded-lg border-4 border-slate-500 bg-slate-800" />
          <div className="h-3 w-10 bg-slate-600" />
          <div className="h-2 w-24 rounded-full bg-slate-700" />
        </div>
        <p className="mt-3 text-center text-xs font-black text-slate-300">고정된 책상 환경</p>
      </div>
      <div className={`rounded-2xl border p-4 ${portable ? 'border-blue-300 bg-blue-400/15' : 'border-white/10 bg-white/5'}`}>
        <div className="mx-auto flex h-32 max-w-48 items-end justify-center rounded-2xl bg-slate-900/80 p-4 ring-1 ring-white/10">
          <div className="relative h-24 w-24 rounded-[1.75rem] border-2 border-slate-500 bg-slate-800 p-3">
            <div className="absolute left-1/2 top-2 h-5 w-12 -translate-x-1/2 rounded-full border-2 border-slate-600" />
            <div className="absolute bottom-4 left-1/2 h-9 w-14 -translate-x-1/2 rounded-lg bg-slate-700 ring-1 ring-white/10" />
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-black text-slate-300">가방에 넣고 이동</p>
      </div>
    </div>
  );
}

function SoundArtwork({ option }: { option?: string }) {
  const level = getSoundLevel(option);
  const labels = ['매우 낮음', '낮음', '보통', '조금 큼', '큼'];

  return (
    <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <div className="flex h-32 items-end justify-center gap-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <div key={value} className="flex w-10 flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-xl transition-colors ${value <= level ? 'bg-blue-400' : 'bg-slate-700'}`}
              style={{ height: `${22 + value * 16}px` }}
            />
            <span className={`text-[10px] font-bold ${value === level ? 'text-blue-200' : 'text-slate-500'}`}>
              {labels[value - 1]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>공유 공간</span>
        <span>개인 공간</span>
      </div>
    </div>
  );
}

const YOUTUBE_FEEL_VIDEOS = {
  tactile: {
    title: '택타일 스위치 13종 타건 모음',
    query: '택타일 키보드 축 소리 비교 또각또각',
    videoId: 'StsG-ihgrZo',
  },
  linear: {
    title: '서걱서걱 리니어 스위치 비교',
    query: '리니어 키보드 축 소리 비교 서걱서걱',
    videoId: '_Xs70BUDYrk',
  },
  capacitive: {
    title: '보글보글 무접점 키보드 타건 소리 모음',
    query: '무접점 키보드 보글보글 타건음',
    videoId: 'Ye19rE8f-tA',
  },
} as const;

function getYouTubeEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function getYouTubeSearchUrl(query: string) {
  const params = new URLSearchParams({ search_query: query });
  return `https://www.youtube.com/results?${params.toString()}`;
}

function FeelArtwork({ option }: { option?: string }) {
  const isLinear = option?.includes('서걱');
  const isCapacitive = option?.includes('보글');
  const isUnknown = !option || option.includes('잘 모르겠');
  const video = isLinear
    ? YOUTUBE_FEEL_VIDEOS.linear
    : isCapacitive
      ? YOUTUBE_FEEL_VIDEOS.capacitive
      : YOUTUBE_FEEL_VIDEOS.tactile;

  if (isUnknown) {
    return (
      <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {[
            { label: '또각또각', detail: '걸림 있음' },
            { label: '서걱서걱', detail: '부드러움' },
            { label: '보글보글', detail: '무접점' },
          ].map((feel) => (
            <div key={feel.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm font-black text-white">{feel.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{feel.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-bold leading-relaxed text-slate-300">
          키감은 제한하지 않고, 소리와 키압 같은 다른 조건을 먼저 반영합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-slate-900/90 p-4 ring-1 ring-white/10">
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <iframe
          title={video.title}
          src={getYouTubeEmbedUrl(video.videoId)}
          className="aspect-video w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <a
        href={getYouTubeSearchUrl(video.query)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-blue-100 transition-colors hover:bg-white/15"
      >
        <Play size={14} fill="currentColor" />
        YouTube에서 비교 영상 더 보기
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

function PressureArtwork({ option }: { option?: string }) {
  const isUnknown = !option || option.includes('잘 모르겠');
  const target = getPressureTarget(option);
  const weights = [
    { key: 'light', label: '35~45g', height: 'h-12', color: 'bg-emerald-400' },
    { key: 'medium', label: '45~55g', height: 'h-20', color: 'bg-blue-400' },
    { key: 'heavy', label: '60g+', height: 'h-28', color: 'bg-amber-400' },
  ];

  if (isUnknown) {
    return (
      <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {weights.map((weight) => (
            <div key={weight.key} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm font-black text-white">{weight.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {weight.key === 'light' ? '가벼움' : weight.key === 'medium' ? '보편적' : '묵직함'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-bold leading-relaxed text-slate-300">
          키압은 제한하지 않고, 처음 쓰기 쉬운 보편 범위까지 열어둡니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <div className="flex h-36 items-end justify-center gap-5">
        {weights.map((weight) => (
          <div key={weight.key} className="flex w-20 flex-col items-center gap-2">
            <div className={`w-14 rounded-t-2xl ${weight.height} ${weight.color} ${target === weight.key ? 'opacity-100 ring-4 ring-white/20' : 'opacity-35'}`} />
            <span className={`text-xs font-black ${target === weight.key ? 'text-white' : 'text-slate-500'}`}>
              {weight.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs font-bold text-slate-400">낮을수록 가볍고, 높을수록 반발력이 강합니다.</p>
    </div>
  );
}

function ConnectionArtwork({ option }: { option?: string }) {
  const modes = [
    { key: 'wired', label: 'USB-C', detail: '케이블', active: option === '유선' || option === '유/무선 모두' },
    { key: 'dongle', label: '2.4G', detail: '동글', active: option === '무선 USB 동글' || option === '유/무선 모두' },
    { key: 'bluetooth', label: 'BT', detail: '페어링', active: option === '블루투스' || option === '유/무선 모두' },
  ];
  const any = option === '상관없음' || !option;

  return (
    <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <div className="flex flex-col items-center">
        <div className="relative flex h-28 w-full max-w-72 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-white/10">
          <div className="w-48 rounded-xl bg-slate-700 p-3 shadow-inner ring-1 ring-white/10">
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 36 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-2 rounded-sm ${index > 27 && index < 34 ? 'bg-blue-400' : 'bg-slate-500'}`}
                />
              ))}
            </div>
            <div className="mx-auto mt-2 h-2 w-24 rounded-sm bg-blue-400" />
          </div>
          <div className="absolute -bottom-5 h-10 w-px bg-slate-600" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {modes.map((mode) => (
          <div
            key={mode.key}
            className={`rounded-2xl border px-2 py-4 text-center ${
              mode.active || any ? 'border-blue-300 bg-blue-400/20 text-white' : 'border-white/10 bg-white/5 text-slate-500'
            }`}
          >
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-current/15 text-[11px] font-black">
              {mode.key === 'wired' ? 'USB' : mode.key === 'dongle' ? '2.4' : 'BT'}
            </div>
            <p className="text-sm font-black">{mode.label}</p>
            <p className="mt-1 text-[10px] font-bold opacity-70">{mode.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetArtwork({ minBudget, maxBudget }: { minBudget: number; maxBudget: number }) {
  const minPercent = Math.max(0, Math.min(100, (minBudget / 1000000) * 100));
  const maxPercent = Math.max(0, Math.min(100, (maxBudget / 1000000) * 100));

  return (
    <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs font-bold text-slate-400">최소</p>
          <p className="mt-1 text-xl font-black text-white">{formatBudget(minBudget)}</p>
        </div>
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs font-bold text-slate-400">최대</p>
          <p className="mt-1 text-xl font-black text-white">{formatBudget(maxBudget)}</p>
        </div>
      </div>
      <div className="relative mt-8 h-4 rounded-full bg-slate-700">
        <div
          className="absolute top-0 h-4 rounded-full bg-blue-400"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <div className="absolute -top-2 h-8 w-2 rounded-full bg-white shadow" style={{ left: `${minPercent}%` }} />
        <div className="absolute -top-2 h-8 w-2 rounded-full bg-white shadow" style={{ right: `${100 - maxPercent}%` }} />
      </div>
      <div className="mt-4 flex justify-between text-xs font-bold text-slate-400">
        <span>입문</span>
        <span>고급</span>
      </div>
    </div>
  );
}

function LegendArtwork({ option }: { option?: string }) {
  const isEnglish = option?.includes('영어만');
  const isKoreanOnly = option?.includes('한국어만');
  const any = option === '상관없음' || !option;

  if (any) {
    return (
      <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {[
            { label: '한/영', detail: '공용에 무난' },
            { label: '영문', detail: '깔끔한 표기' },
            { label: '한글', detail: '입력 위치 확인' },
          ].map((legend) => (
            <div key={legend.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm font-black text-white">{legend.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{legend.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-bold leading-relaxed text-slate-300">
          각인 조건은 제한하지 않고, 가격과 배열이 더 잘 맞는 후보를 우선합니다.
        </p>
      </div>
    );
  }

  const legends = isEnglish
    ? ['Q', 'W', 'E', 'R']
    : isKoreanOnly
      ? ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ']
      : ['Q ㅂ', 'W ㅈ', 'E ㄷ', 'R ㄱ'];

  return (
    <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <div className="grid grid-cols-4 gap-3">
        {legends.map((legend) => (
          <div key={legend} className="flex aspect-square items-center justify-center rounded-2xl bg-slate-700 text-lg font-black text-white shadow-lg">
            {legend}
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-xs font-bold text-slate-400">키캡에 보이는 문자 표기 방식입니다.</p>
    </div>
  );
}

function BacklightArtwork({ option }: { option?: string }) {
  const mode = getBacklightMode(option);

  return (
    <div className="space-y-4 rounded-2xl bg-slate-900/90 p-5 ring-1 ring-white/10">
      <UnifiedKeyboardPreview
        activeKeys={[]}
        lighting={mode}
      />
      <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs font-bold text-slate-300">
        <span>시각 효과</span>
        <span className={mode === 'off' ? 'text-slate-500' : 'text-blue-200'}>
          {mode === 'rgb' ? '높음' : mode === 'single' ? '중간' : '없음'}
        </span>
      </div>
    </div>
  );
}

function StepGuideArtwork({
  questionId,
  option,
  minBudget,
  maxBudget,
}: {
  questionId: string;
  option?: string;
  minBudget: number;
  maxBudget: number;
}) {
  if (questionId === '크기') return <KeyboardSizeArtwork option={option} />;
  if (questionId === '용도') return <PurposeArtwork option={option} />;
  if (questionId === '휴대성') return <PortabilityArtwork option={option} />;
  if (questionId === '소리') return <SoundArtwork option={option} />;
  if (questionId === '키감') return <FeelArtwork option={option} />;
  if (questionId === '키압') return <PressureArtwork option={option} />;
  if (questionId === '연결방식') return <ConnectionArtwork option={option} />;
  if (questionId === '예산') return <BudgetArtwork minBudget={minBudget} maxBudget={maxBudget} />;
  if (questionId === '각인') return <LegendArtwork option={option} />;
  if (questionId === '백라이트') return <BacklightArtwork option={option} />;
  return <PurposeArtwork option={option} />;
}

function StepGuidePanel({
  questionId,
  selectedOption,
  minBudget,
  maxBudget,
}: {
  questionId: string;
  selectedOption?: string;
  minBudget: number;
  maxBudget: number;
}) {
  const guide = getOptionGuide(questionId, selectedOption);

  return (
    <aside className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl ring-1 ring-slate-800 sm:p-6 lg:sticky lg:top-8">
      <div className="mb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">
          {guide.panelLabel}
        </p>
      </div>

      <h3 className="text-2xl font-black tracking-tight sm:text-3xl">{guide.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{guide.description}</p>

      <div className="mt-6">
        <StepGuideArtwork
          questionId={questionId}
          option={selectedOption}
          minBudget={minBudget}
          maxBudget={maxBudget}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-700 bg-white/5 p-4">
        <h4 className="text-sm font-black text-white">왜 이 선택이 중요한가요?</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{guide.insight}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {guide.badges.map((badge) => (
          <span key={badge} className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-bold text-blue-100">
            {badge}
          </span>
        ))}
      </div>
    </aside>
  );
}

// 이미지 lazyload 깨짐 대비: 실패 시 키보드 아이콘으로 대체
function KeyboardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <Keyboard size={40} className="text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={getDisplayImageUrl(src)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-contain bg-white"
    />
  );
}

interface LevelMeterProps {
  label: string;
  level: GraphLevel | null;
  lowLabel?: string;
  highLabel?: string;
}

const LEVEL_WIDTHS: Record<GraphLevel, string> = {
  1: '33.3333%',
  2: '66.6667%',
  3: '100%',
};

const LEVEL_LABELS: Record<GraphLevel, string> = {
  1: '약함',
  2: '중간',
  3: '강함',
};

function LevelMeter({
  label,
  level,
  lowLabel = '약함',
  highLabel = '강함',
}: LevelMeterProps) {
  return (
    <div className="min-w-0">
      <div
        aria-hidden="true"
        className="mb-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm text-slate-800 sm:text-base"
      >
        <span className="text-left">{lowLabel}</span>
        <span className="text-center font-medium">{label}</span>
        <span className="text-right">{highLabel}</span>
      </div>

      {level === null ? (
        <div
          role="status"
          aria-label={`${label} 정보 확인 중`}
          className="flex h-4 items-center justify-center bg-slate-700 text-[11px] font-medium leading-none text-white"
        >
          정보 확인 중
        </div>
      ) : (
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={level}
          aria-valuetext={LEVEL_LABELS[level]}
          className="h-4 overflow-hidden bg-slate-700"
        >
          <div
            aria-hidden="true"
            className="h-full bg-emerald-500"
            style={{ width: LEVEL_WIDTHS[level] }}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'home' | 'step' | 'results'>('home');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchContextTitle, setSearchContextTitle] = useState('키보드 추천');
  const [homeTab, setHomeTab] = useState<'freeform' | 'step'>('freeform');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [sortOrder, setSortOrder] = useState<'default' | 'priceAsc' | 'priceDesc'>('default');
  const [toast, showToast] = useAutoDismiss<string>(2000);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hasLoggedRating, setHasLoggedRating] = useState(false);

  const runRecommend = async (input: RecommendInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await recommend(input);
      setResult(res);
      setSearchContextTitle(getSearchContextTitle(input));
      setActiveFilter('전체');
      setSortOrder('default');
      setRating(0);
      setHoverRating(0);
      setHasLoggedRating(false);
      setView('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 홈으로 복귀할 때 공유하는 상태 초기화. 초기화 항목이 늘어도 이 한 곳만 고치면 된다.
  const goHome = () => {
    setQuery('');
    setHomeTab('freeform');
    setSearchContextTitle('키보드 추천');
    setRating(0);
    setHoverRating(0);
    setHasLoggedRating(false);
    setError(null);
    setView('home');
  };

  // 템플릿 선택: 입력 채움 + freeform 탭 전환 + 오류 초기화를 한 지점에 모은다.
  const selectTemplate = (text: string) => {
    setQuery(text);
    setHomeTab('freeform');
    setError(null);
  };

  // --- HOME VIEW ---
  const renderHomeView = () => {
    const templates = [
      '조용한 사무실에서 눈치보지 않고 사용할 도각도각 소리가 나는 키보드 추천해줘',
      '게임할 때 반응속도가 빠르고 화려한 RGB 조명이 있는 텐키리스 키보드 찾아줘',
      '아이패드랑 같이 들고 다닐 작고 가벼운 블루투스 키보드 필요해',
    ];

    const handleSubmit = () => {
      if (!query) return;
      runRecommend({ mode: 'freeform', query });
    };

    const startStepByStep = () => {
      setStep(0);
      setAnswers({});
      setMinBudget(0);
      setMaxBudget(1000000);
      setError(null);
      setView('step');
    };

    return (
      <div className="flex flex-col items-center min-h-screen px-6 bg-slate-50 py-12">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-bold text-slate-800 mb-2.5">나만의 키보드 찾기</h1>
          <p className="text-slate-500">원하는 방식으로 키보드를 찾아보세요.</p>
        </div>

        {error && (
          <div className="w-full max-w-2xl mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 입력 방식 세그먼트 토글 */}
        <div className="w-full max-w-2xl flex gap-1 p-1 rounded-xl bg-slate-100 mb-4">
          {HOME_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setHomeTab(key); setError(null); }}
              className={`flex-1 py-2.5 rounded-[10px] text-sm transition-colors ${
                homeTab === key
                  ? 'bg-white text-slate-800 font-semibold shadow-sm'
                  : 'text-slate-500 font-medium hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 선택한 방식에 따른 카드 */}
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-4 mb-7">
          {homeTab === 'freeform' ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 조용한 사무용 키보드를 추천해줘"
                className="w-full h-32 p-2 outline-none resize-none text-slate-800 bg-transparent placeholder:text-slate-400"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={!query || loading}
                  className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors ${query && !loading ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400'}`}
                >
                  분석하기 <Search size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 px-2 text-center">
              <div className="flex flex-wrap justify-center gap-2">
                {['용도', '타건감', '예산'].map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-500 text-[13px] font-medium"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-500">몇 가지 질문에 답하면 조건에 맞는 키보드를 찾아드려요.</p>
              <button
                onClick={startStepByStep}
                className="w-full max-w-xs py-3 rounded-xl bg-indigo-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors"
              >
                단계별로 시작 <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* 템플릿 제공 섹션 */}
        <div className="w-full max-w-2xl">
          <p className="text-sm font-medium text-slate-500 mb-3">이런 식으로 질문해 보세요:</p>
          <div className="flex flex-col gap-2">
            {templates.map((txt, idx) => (
              <button
                key={idx}
                onClick={() => selectTemplate(txt)}
                className="text-left p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm hover:bg-blue-50 hover:border-blue-100 transition-colors"
              >
                "{txt}"
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- STEP BY STEP VIEW ---
  const renderStepByStepView = () => {
    const activeQuestion = questions[step] ?? questions[0];
    const answeredQuestionCount = questions.filter((question) => (
      question.type === 'range' || Boolean(answers[question.id])
    )).length;
    const canSubmit = answeredQuestionCount === questions.length;
    const previewOption = activeQuestion.type === 'range'
      ? undefined
      : answers[activeQuestion.id] ?? activeQuestion.options[0];

    const handleSelect = (questionIndex: number, questionId: string, option: string) => {
      setStep(questionIndex);
      setAnswers((prev) => ({ ...prev, [questionId]: option }));
    };

    const handleComplete = () => {
      if (!canSubmit || loading) return;
      runRecommend({ mode: 'guided', answers, budget: { min: minBudget, max: maxBudget } });
    };

    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[96rem]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={goHome}
              className="flex items-center rounded-full px-2 py-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <ChevronLeft size={20} /> <span className="ml-1 text-sm font-bold">처음으로</span>
            </button>

            <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
              {answeredQuestionCount} / {questions.length} 완료
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(answeredQuestionCount / questions.length) * 100}%` }}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.75fr)] xl:items-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-7">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                  Survey {questions.length} Questions
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  조건을 한 번에 골라주세요
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  각 항목을 고르면 오른쪽 이미지가 방금 선택한 기준을 바로 보여줍니다.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {questions.map((question, questionIndex) => {
                  const selectedOption = answers[question.id];
                  const isActive = questionIndex === step;
                  const isRequired = question.type !== 'range';

                  return (
                    <div
                      key={question.id}
                      className={`rounded-2xl border-2 p-4 transition-colors sm:p-5 ${
                        isActive ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 bg-white'
                      }`}
                      onFocus={() => setStep(questionIndex)}
                      onMouseEnter={() => setStep(questionIndex)}
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                            Question {questionIndex + 1}
                          </p>
                          <h3 className="mt-1 text-lg font-black leading-snug text-slate-950">
                            {question.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              isRequired ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isRequired ? '필수' : '선택'}
                          </span>
                          {isRequired && (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                selectedOption
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {selectedOption ? getOptionGuide(question.id, selectedOption).title : '미선택'}
                            </span>
                          )}
                        </div>
                      </div>

                      {question.type === 'range' ? (
                        <div className="flex w-full flex-col py-3">
                          <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center shadow-sm sm:px-3">
                              <span className="mb-1 block text-xs font-bold text-slate-500">최소 금액</span>
                              <span className="break-keep text-base font-black text-blue-600 sm:text-lg">
                                {formatBudget(minBudget)}
                              </span>
                            </div>
                            <span className="text-center font-black text-slate-400">~</span>
                            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center shadow-sm sm:px-3">
                              <span className="mb-1 block text-xs font-bold text-slate-500">최대 금액</span>
                              <span className="break-keep text-base font-black text-blue-600 sm:text-lg">
                                {formatBudget(maxBudget)}
                              </span>
                            </div>
                          </div>

                          <div className="relative flex h-6 w-full items-center">
                            <div className="pointer-events-none absolute left-0 right-0 h-2 rounded-lg bg-slate-200" />
                            <div
                              className="pointer-events-none absolute z-10 h-2 rounded-lg bg-blue-500"
                              style={{
                                left: `${(minBudget / 1000000) * 100}%`,
                                right: `${100 - (maxBudget / 1000000) * 100}%`,
                              }}
                            />
                            <input
                              type="range"
                              min="0"
                              max="1000000"
                              step="10000"
                              value={minBudget}
                              onFocus={() => setStep(questionIndex)}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStep(questionIndex);
                                setMinBudget(Math.min(val, maxBudget - 10000));
                              }}
                              className="pointer-events-none absolute left-0 right-0 z-20 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                            />
                            <input
                              type="range"
                              min="0"
                              max="1000000"
                              step="10000"
                              value={maxBudget}
                              onFocus={() => setStep(questionIndex)}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStep(questionIndex);
                                setMaxBudget(Math.max(val, minBudget + 10000));
                              }}
                              className="pointer-events-none absolute left-0 right-0 z-30 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                            />
                          </div>
                          <div className="mt-4 flex justify-between px-1 text-xs font-bold text-slate-400">
                            <span>0원</span>
                            <span>100만원+</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {question.options.map((opt) => {
                            const guide = getOptionGuide(question.id, opt);
                            const isSelected = selectedOption === opt;

                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleSelect(questionIndex, question.id, opt)}
                                className={`group flex h-full min-h-24 w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-base font-black">{guide.title}</span>
                                  <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                                    {guide.description}
                                  </span>
                                </span>
                                {isSelected && <Check size={20} className="shrink-0 text-blue-600" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
                <p className="text-sm font-bold text-slate-500">
                  {canSubmit ? '모든 조건을 선택했습니다.' : `${questions.length - answeredQuestionCount}개 항목을 더 선택해주세요.`}
                </p>
                <button
                  onClick={handleComplete}
                  disabled={!canSubmit || loading}
                  className={`rounded-xl px-6 py-2 text-sm font-black transition-colors shadow-sm ${
                    canSubmit && !loading
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  결과 보기
                </button>
              </div>
            </section>

            <StepGuidePanel
              questionId={activeQuestion.id}
              selectedOption={previewOption}
              minBudget={minBudget}
              maxBudget={maxBudget}
            />
          </div>
        </div>
      </div>
    );
  };

  // --- RESULT VIEW ---
  const renderResultView = () => {
    const all: Recommendation[] = result?.recommendations ?? [];

    // 동적 필터 옵션: 브랜드 + DB 속성 기반 태그
    const filterSet = new Set<string>();
    all.forEach((k) => {
      filterSet.add(k.brand);
      k.tags.forEach((t) => filterSet.add(t));
    });
    const filterOptions = ['전체', ...Array.from(filterSet)];

    // 1. 필터링
    let processed =
      activeFilter === '전체'
        ? [...all]
        : all.filter((k) => k.tags.includes(activeFilter) || k.brand === activeFilter);

    // 2. 정렬
    if (sortOrder === 'priceAsc') processed.sort((a, b) => a.price - b.price);
    else if (sortOrder === 'priceDesc') processed.sort((a, b) => b.price - a.price);

    const isAllFilter = activeFilter === '전체';
    const headerTitle = searchContextTitle;
    const resultCount = isAllFilter ? all.length : processed.length;
    const resultCountSpan = <span className="text-blue-600">{resultCount}개</span>;

    return (
      <div className="max-w-6xl mx-auto bg-white min-h-screen border-x border-slate-100 pb-10">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 px-4 py-4 flex items-center">
          <button
            onClick={goHome}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="ml-2 min-w-0 flex-1 break-words text-lg font-bold leading-snug text-slate-800">
            [{headerTitle}]
          </h1>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {isAllFilter ? (
                  <>총 {resultCountSpan}의 상품을 찾았어요</>
                ) : (
                  <>
                    <span className="text-blue-600">{activeFilter}</span> 필터로{' '}
                    {resultCountSpan}의 상품이 남았어요
                  </>
                )}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {result?.summary ?? '입력하신 조건에 가장 잘 맞는 추천 목록입니다.'}
              </p>
            </div>

            {/* 정렬 드롭다운 */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0 shadow-sm">
              <ArrowUpDown size={16} className="text-slate-500 mr-2" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="default">기본 추천순</option>
                <option value="priceAsc">낮은 가격순</option>
                <option value="priceDesc">높은 가격순</option>
              </select>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="flex items-center gap-2 mb-6 pb-2">
            <div className="flex items-center text-slate-400 mr-1 shrink-0">
              <Filter size={16} />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
              {filterOptions.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeFilter === f
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* 제품 리스트 */}
          <div className="space-y-4">
            {processed.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                해당 조건에 맞는 제품이 없습니다.
              </div>
            ) : (
              processed.map((item, index) => {
                const switchDisplay = getSwitchDisplayData(item, switches);
                const productTags = getProductTags(item);
                const beginnerGuide = getBeginnerGuide(item);
                const mediaLabel = '시청각 자료 보기';

                return (
                  <article
                    key={item.product_code ?? `${item.product_name}-${index}`}
                    className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 lg:grid-cols-[15rem_minmax(0,1fr)_13rem] lg:gap-7"
                  >
                    <div className="flex min-w-0 flex-col">
                      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <KeyboardImage src={item.image_url} alt={item.product_name} />
                      </div>
                      <p className="mt-4 text-center text-2xl font-extrabold tracking-tight text-slate-950 lg:text-3xl">
                        {item.price.toLocaleString()}원
                      </p>
                    </div>

                    <div className="flex min-w-0 flex-col">
                      <div className="min-w-0">
                        <h3
                          className="truncate text-xl font-extrabold text-slate-950 lg:text-2xl"
                          title={item.product_name}
                        >
                          {item.product_name}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-slate-500">
                          {item.reason}
                        </p>
                      </div>

                      {beginnerGuide.labels.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {beginnerGuide.labels.map((label) => (
                            <span
                              key={label}
                              className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold leading-snug text-blue-800"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}

                      {beginnerGuide.notes.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800">
                            <AlertTriangle size={14} aria-hidden="true" />
                            확인할 점
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-900">
                            {beginnerGuide.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-5 space-y-5 lg:mt-6">
                        <LevelMeter
                          label="누르는 중간에 걸리는 느낌"
                          level={switchDisplay.tactility}
                        />
                        <LevelMeter label="소음" level={switchDisplay.noise} />
                      </div>

                      <div className="mt-auto flex flex-wrap gap-2 pt-5">
                        {productTags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-4 lg:justify-between">
                      {item.media_url ? (
                        <a
                          href={item.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-36 flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-slate-700 px-4 py-6 text-center text-sm font-bold text-white transition-colors hover:bg-slate-800 lg:min-h-0"
                          aria-label={`${item.product_name} ${mediaLabel}`}
                        >
                          <Play size={28} aria-hidden="true" />
                          <span>{mediaLabel}</span>
                        </a>
                      ) : (
                        <div
                          role="status"
                          className="flex min-h-36 flex-1 items-center justify-center rounded-xl bg-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500 lg:min-h-0"
                        >
                          {item.media_url_is_placeholder
                            ? '시청각 자료 준비 중'
                            : '시청각 자료 정보 확인 중'}
                        </div>
                      )}

                      {item.price_compare_url ? (
                        <a
                          href={item.price_compare_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void logPurchaseClick(item.product_code)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                          aria-label={`${item.product_name} 구매 가격 비교 페이지 열기`}
                        >
                          <ShoppingCart size={16} aria-hidden="true" />
                          구매하기
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void logPurchaseClick(item.product_code);
                            showToast('준비 중인 기능입니다');
                          }}
                          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                        >
                          <ShoppingCart size={16} aria-hidden="true" />
                          구매하기
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-800">이번 추천, 얼마나 마음에 드세요?</h3>
            <p className="mt-1 text-[13px] text-slate-500">별점으로 매칭 결과를 평가해 주세요.</p>

            <div
              className="mt-4 flex justify-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              role="slider"
              tabIndex={0}
              aria-label="추천 결과 별점"
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={rating}
              aria-valuetext={`${rating}점`}
              onMouseLeave={() => setHoverRating(0)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setRating((current) => Math.min(5, current + 0.5));
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  setRating((current) => Math.max(0, current - 0.5));
                }
              }}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const displayedRating = hoverRating || rating;
                const fillRatio = Math.max(0, Math.min(1, displayedRating - (value - 1)));

                return (
                  <div
                    key={value}
                    className="relative h-[34px] w-[34px] cursor-pointer"
                    onMouseMove={(event) =>
                      setHoverRating(event.nativeEvent.offsetX < RATING_STAR_SIZE / 2 ? value - 0.5 : value)
                    }
                    onClick={(event) => {
                      const next = event.nativeEvent.offsetX < RATING_STAR_SIZE / 2 ? value - 0.5 : value;
                      setRating(next);
                      if (!hasLoggedRating) {
                        setHasLoggedRating(true);
                        // 추천 전체 별점은 한 추천 결과당 최초 1회만 적재한다(best-effort).
                        void logRating(next);
                      }
                    }}
                  >
                    <Star size={RATING_STAR_SIZE} className="pointer-events-none text-slate-300" fill="none" />
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden"
                      style={{ width: `${fillRatio * 100}%` }}
                    >
                      <Star size={RATING_STAR_SIZE} className="text-blue-600" fill="#2563EB" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-center">
              <div className="flex w-[280px] justify-between text-xs text-slate-400">
                {rating > 0 ? (
                  <span className="w-full text-center font-medium text-blue-600">
                    감사합니다 ({rating}점)
                  </span>
                ) : (
                  <>
                    <span>아쉬워요</span>
                    <span>완벽해요</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <button
              onClick={goHome}
              className="flex items-center px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors shadow-sm"
            >
              <RefreshCw size={18} className="mr-2" /> 처음부터 다시 찾기
            </button>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="animate-spin text-blue-600 mb-4">
            <RefreshCw size={40} />
          </div>
          <p className="text-slate-800 font-bold text-lg animate-pulse">취향을 분석하고 있어요...</p>
        </div>
      )}

      {view === 'home' && renderHomeView()}
      {view === 'step' && renderStepByStepView()}
      {view === 'results' && renderResultView()}
    </div>
  );
}
