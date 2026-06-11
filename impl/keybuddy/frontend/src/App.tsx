import { useState } from 'react';
import {
  Search,
  Keyboard,
  ChevronLeft,
  SlidersHorizontal,
  Check,
  RefreshCw,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Play,
} from 'lucide-react';
import switchesData from './data/switches.json';
import { recommend } from './lib/recommend';
import { getProductTags } from './lib/productDisplay';
import { getSwitchDisplayData, type GraphLevel } from './lib/switchDisplay';
import type {
  Recommendation,
  RecommendInput,
  RecommendResult,
  SwitchDictionary,
} from './types';

const switches = switchesData as SwitchDictionary;

// --- [질문 데이터] 단계별 선택지 ---
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
      '숫자 패드도, 일부 특수키도 없음 (75%/65%)',
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
      src={src}
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [sortOrder, setSortOrder] = useState<'default' | 'priceAsc' | 'priceDesc'>('default');

  const runRecommend = async (input: RecommendInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await recommend(input);
      setResult(res);
      setActiveFilter('전체');
      setSortOrder('default');
      setView('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
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

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-slate-50 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-3">나만의 키보드 찾기</h1>
          <p className="text-slate-600">어떤 키보드를 찾으시나요? 자유롭게 말해주세요.</p>
        </div>

        {error && (
          <div className="w-full max-w-2xl mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 채팅창 섹션 */}
        <div className="w-full max-w-2xl bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 조용한 사무용 키보드를 추천해줘"
            className="w-full h-32 p-2 outline-none resize-none text-slate-800 bg-transparent"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmit}
              disabled={!query}
              className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center ${query ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-slate-100 text-slate-400'}`}
            >
              분석하기 <Search size={18} className="ml-2" />
            </button>
          </div>
        </div>

        {/* 템플릿 제공 섹션 */}
        <div className="w-full max-w-2xl mb-12">
          <p className="text-sm font-medium text-slate-500 mb-3 ml-1">이런 식으로 질문해 보세요:</p>
          <div className="flex flex-col gap-2">
            {templates.map((txt, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(txt)}
                className="text-left p-3.5 rounded-xl bg-slate-100/50 hover:bg-blue-50 text-slate-700 text-sm transition-colors border border-transparent hover:border-blue-100 shadow-sm"
              >
                "{txt}"
              </button>
            ))}
          </div>
        </div>

        {/* 단계별 선택 작게 배치 */}
        <div className="w-full max-w-2xl border-t border-slate-200 pt-8 flex flex-col items-center">
          <p className="text-slate-500 text-sm mb-4">질문에 답하며 하나씩 찾고 싶다면?</p>
          <button
            onClick={() => {
              setStep(0);
              setAnswers({});
              setMinBudget(0);
              setMaxBudget(1000000);
              setView('step');
            }}
            className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <SlidersHorizontal size={18} className="mr-2 text-indigo-500" /> 단계별로 선택하기
          </button>
        </div>
      </div>
    );
  };

  // --- STEP BY STEP VIEW ---
  const renderStepByStepView = () => {
    const currentQ = questions[step];
    const isLastStep = step === questions.length - 1;

    const handleSelect = (option: string) => {
      setAnswers({ ...answers, [currentQ.id]: option });
      if (!isLastStep) {
        setTimeout(() => setStep(step + 1), 200);
      }
    };

    const handleComplete = () => {
      runRecommend({ mode: 'guided', answers, budget: { min: minBudget, max: maxBudget } });
    };

    return (
      <div className="max-w-2xl mx-auto pt-12 px-6 min-h-screen">
        <button
          onClick={() => {
            setQuery('');
            setView('home');
          }}
          className="flex items-center text-slate-500 mb-6 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={20} /> <span className="ml-1">처음으로</span>
        </button>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2 rounded-full mb-8 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 min-h-[400px] flex flex-col">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-8">{currentQ.title}</h2>

          <div className="flex-1 flex flex-col gap-3">
            {currentQ.type === 'range' ? (
              <div className="flex flex-col py-8 w-full">
                <div className="flex items-center justify-between mb-12 px-2">
                  <div className="text-center w-5/12 bg-slate-50 py-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="block text-xs text-slate-500 mb-1">최소 금액</span>
                    <span className="text-lg font-bold text-blue-600">
                      {minBudget.toLocaleString()}원
                    </span>
                  </div>
                  <span className="text-slate-400 font-medium w-2/12 text-center">~</span>
                  <div className="text-center w-5/12 bg-slate-50 py-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="block text-xs text-slate-500 mb-1">최대 금액</span>
                    <span className="text-lg font-bold text-blue-600">
                      {maxBudget >= 1000000 ? '1,000,000원+' : `${maxBudget.toLocaleString()}원`}
                    </span>
                  </div>
                </div>

                <div className="relative w-full flex items-center h-6">
                  <div className="absolute left-0 right-0 h-2 bg-slate-200 rounded-lg pointer-events-none" />
                  <div
                    className="absolute h-2 bg-blue-500 rounded-lg pointer-events-none z-10"
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
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinBudget(Math.min(val, maxBudget - 10000));
                    }}
                    className="absolute w-full left-0 right-0 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1000000"
                    step="10000"
                    value={maxBudget}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxBudget(Math.max(val, minBudget + 10000));
                    }}
                    className="absolute w-full left-0 right-0 appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-4 px-1">
                  <span>0원</span>
                  <span>100만원+</span>
                </div>
              </div>
            ) : (
              currentQ.options.map((opt, idx) => {
                const isSelected = answers[currentQ.id] === opt;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(opt)}
                    className={`p-4 rounded-xl text-left font-medium transition-all flex items-center justify-between border-2
                      ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300 text-slate-700'}
                    `}
                  >
                    {opt}
                    {isSelected && <Check size={20} className="text-blue-600" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className={`px-4 py-2 text-sm font-medium ${step === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}
            >
              이전 질문
            </button>

            {(currentQ.type === 'range' || isLastStep) && (
              <button
                onClick={isLastStep ? handleComplete : () => setStep(step + 1)}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
              >
                {isLastStep ? '결과 보기' : '다음 질문'}
              </button>
            )}
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

    return (
      <div className="max-w-6xl mx-auto bg-white min-h-screen border-x border-slate-100 pb-10">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 px-4 py-4 flex items-center">
          <button
            onClick={() => {
              setQuery('');
              setView('home');
            }}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-slate-800 ml-2">
            [{processed.length}개의 제품 찾음]
          </h1>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                총 <span className="text-blue-600">{processed.length}개</span>의 상품을 찾았어요
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
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center text-slate-400 mr-1 shrink-0">
              <Filter size={16} />
            </div>
            {filterOptions.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === f
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
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
                          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                          aria-label={`${item.product_name} 가격 비교 페이지 열기`}
                        >
                          가격 비교
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <div
                          role="status"
                          className="rounded-xl bg-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-500"
                        >
                          가격 비교 정보 확인 중
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="mt-10 flex justify-center">
            <button
              onClick={() => {
                setQuery('');
                setView('home');
              }}
              className="flex items-center px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors shadow-sm"
            >
              <RefreshCw size={18} className="mr-2" /> 처음부터 다시 찾기
            </button>
          </div>
        </div>
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
