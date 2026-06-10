import { useState, useRef } from 'react';
import {
  Search,
  Keyboard,
  ChevronLeft,
  SlidersHorizontal,
  Check,
  RefreshCw,
  Copy,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { recommend } from './lib/recommend';
import type { Recommendation, RecommendInput, RecommendResult } from './types';

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

export default function App() {
  const [view, setView] = useState<'home' | 'step' | 'results'>('home');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRecommend = async (input: RecommendInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await recommend(input);
      setResult(res);
      setView('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- HOME VIEW ---
  const HomeView = () => {
    const [query, setQuery] = useState('');
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
            onClick={() => setView('step')}
            className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <SlidersHorizontal size={18} className="mr-2 text-indigo-500" /> 단계별로 선택하기
          </button>
        </div>
      </div>
    );
  };

  // --- STEP BY STEP VIEW ---
  const StepByStepView = () => {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [minBudget, setMinBudget] = useState(0);
    const [maxBudget, setMaxBudget] = useState(1000000);

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
          onClick={() => setView('home')}
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
  const ResultView = () => {
    const [activeFilter, setActiveFilter] = useState('전체');
    const [sortOrder, setSortOrder] = useState<'default' | 'priceAsc' | 'priceDesc'>('default');
    const [copiedName, setCopiedName] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 공유 toast: 어느 카드의 구매하기를 눌러도 화면 하단 중앙에 1개만 표시, 2초 후 자동 사라짐
    const showToast = (msg: string) => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2000);
    };

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

    const handleCopy = (text: string) => {
      navigator.clipboard?.writeText(text).then(
        () => {
          setCopiedName(text);
          setTimeout(() => setCopiedName(null), 2000);
        },
        () => {},
      );
    };

    return (
      <div className="max-w-3xl mx-auto bg-white min-h-screen border-x border-slate-100 pb-10">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 px-4 py-4 flex items-center">
          <button
            onClick={() => setView('home')}
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
              processed.map((item) => (
                <div
                  key={item.product_name}
                  className="flex p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-slate-100">
                    <KeyboardImage src={item.image_url} alt={item.product_name} />
                  </div>

                  <div className="flex flex-col ml-4 sm:ml-5 flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold text-slate-900 truncate pr-2">
                        {item.product_name}
                      </h3>
                      <button
                        onClick={() => handleCopy(item.product_name)}
                        className="p-1.5 shrink-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center"
                        title="제품명 복사"
                      >
                        {copiedName === item.product_name ? (
                          <CheckCircle2 size={18} className="text-green-500" />
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    </div>
                    <p className="text-slate-500 text-sm mt-1 leading-snug line-clamp-2">
                      {item.reason}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-md font-bold">
                        {item.brand}
                      </span>
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-3 flex items-end justify-between">
                      <span className="text-xs text-slate-400">
                        {item.switch_type} · {item.layout} · {item.connection}
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {item.price.toLocaleString()}원
                      </span>
                    </div>

                    <div className="pt-3 flex justify-end">
                      <button
                        onClick={() => showToast('준비 중인 기능입니다')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <ShoppingCart size={16} /> 구매하기
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 별점 피드백 카드: 전체 추천 결과에 대한 단일 평가 */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-800">이번 추천, 얼마나 마음에 드세요?</h3>
            <p className="text-[13px] text-slate-500 mt-1">별점으로 매칭 결과를 평가해 주세요.</p>

            <div className="flex justify-center gap-2 mt-4" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((n) => {
                // 표시값 기준 이 별의 채움 비율: 0(빈 별) / 0.5(반 개) / 1(꽉 참)
                const displayed = hoverRating || rating;
                const fillRatio = Math.max(0, Math.min(1, displayed - (n - 1)));
                return (
                  <div key={n} className="relative w-[34px] h-[34px]">
                    <Star size={34} className="text-slate-300" fill="none" />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${fillRatio * 100}%` }}
                    >
                      <Star size={34} className="text-blue-600" fill="#2563EB" />
                    </div>
                    {/* 좌측 절반 = 0.5점, 우측 절반 = 1점 */}
                    <button
                      type="button"
                      onClick={() => setRating(n - 0.5)}
                      onMouseEnter={() => setHoverRating(n - 0.5)}
                      className="absolute inset-y-0 left-0 w-1/2"
                      aria-label={`${n - 0.5}점`}
                    />
                    <button
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      className="absolute inset-y-0 right-0 w-1/2"
                      aria-label={`${n}점`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center mt-3">
              <div className="w-[280px] flex justify-between text-xs text-slate-400">
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
              onClick={() => setView('home')}
              className="flex items-center px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors shadow-sm"
            >
              <RefreshCw size={18} className="mr-2" /> 처음부터 다시 찾기
            </button>
          </div>
        </div>

        {/* 공유 toast: 하단 중앙 고정 */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-slate-900 text-white text-sm font-medium shadow-lg">
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

      {view === 'home' && <HomeView />}
      {view === 'step' && <StepByStepView />}
      {view === 'results' && <ResultView />}
    </div>
  );
}
