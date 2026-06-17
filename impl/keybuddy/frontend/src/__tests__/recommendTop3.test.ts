/**
 * recommend(경로2 배선) 통합 테스트
 *
 * - freeform: 서버 태그추출(extract 모드) 1회 호출 후 점수순 상위 3개로 압축
 * - guided: 서버/LLM 호출 0회로 결정론 검색 후 상위 3개
 * - searchWithProfile 결과가 점수 내림차순임을 확인(상위 3개 = 점수순 top 3)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import catalog from '../data/keyboards.json';
import type { Keyboard } from '../types';
import { expandIntents } from '../lib/intentProfile';
import { searchWithProfile } from '../lib/intentSearch';
import { recommend } from '../lib/recommend';

const keyboards = catalog as Keyboard[];

function extractResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('recommend - 경로2 배선 + 점수순 상위 3개', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('freeform: 서버에 extract 모드로 1회 호출하고 결과는 1~3개', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(extractResponse({ intents: ['게이밍'], hardConstraints: {}, softIntentTags: ['RGB'] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '게임용 RGB 키보드 추천' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string).mode).toBe('extract');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('freeform: 추출된 의도와 조건이 없으면 기본 후보를 끼워넣지 않고 0개를 반환한다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(extractResponse({ intents: [], hardConstraints: {}, softIntentTags: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '응가' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.recommendations).toHaveLength(0);
    expect(result.summary).toContain('찾지 못했어요');
  });

  it('freeform: 넓은 키보드 추천 입력은 추출 결과가 비어도 기본 후보를 반환한다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(extractResponse({ intents: [], hardConstraints: {}, softIntentTags: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '키보드 추천해줘' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('freeform: softIntentTags만 있어도 신호로 보고 검색한다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(extractResponse({ intents: [], hardConstraints: {}, softIntentTags: ['저소음'] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '조용한 키보드' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('freeform: price_max 0만 추출되면 검색 신호로 보지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(extractResponse({ intents: [], hardConstraints: { price_max: 0 }, softIntentTags: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '응가' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.recommendations).toHaveLength(0);
    expect(result.summary).toContain('찾지 못했어요');
  });

  it('freeform: 원시 추출값이 정제 후 모두 버려지면 스키마 불일치 경고를 남긴다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      extractResponse({
        intents: ['없는의도'],
        hardConstraints: { layout: '없는배열' },
        softIntentTags: ['없는태그'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({ mode: 'freeform', query: '응가' });

    expect(result.recommendations).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[keybuddy] 태그 추출 응답이 클라이언트 스키마 정제 후 비었습니다.',
      expect.any(Object),
    );
    warnSpy.mockRestore();
  });

  it('guided: 결정론 검색으로 결과는 1~3개', async () => {
    // 네트워크 미호출 불변식 자체는 recommendLlmNoCall.test.ts에서 단언한다.
    // 여기서는 fetch를 reject로 막아 결정론 경로임을 보장하면서 상위 3개 컷만 확인한다.
    const fetchMock = vi.fn().mockRejectedValue(new Error('guided 경로는 네트워크를 호출하면 안 됩니다'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({
      mode: 'guided',
      answers: { 용도: '게임용', 연결방식: '유선' },
      budget: { min: 0, max: 1000000 },
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('guided: 선택 조건을 모두 만족하는 상품이 없으면 완화 없이 0개를 반환한다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('guided 경로는 네트워크를 호출하면 안 됩니다'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({
      mode: 'guided',
      answers: {
        용도: '게임용',
        휴대성: '자주 가지고 다닐래요',
        소리: '조용해야 해요 (매우 낮음)',
        키감: '보글보글 (독특한 무접점 느낌)',
        키압: '묵직한게 좋아요 (60g 이상)',
        연결방식: '유/무선 모두',
        크기: '숫자 패드가 있지만 콤팩트함 (1800배열)',
        각인: '한국어, 영어가 모두 필요해요',
        백라이트: '화려한 RGB가 좋아요',
      },
      budget: { min: 0, max: 1 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.recommendations).toHaveLength(0);
    expect(result.summary).toContain('찾지 못했어요');
  });

  it('searchWithProfile 결과는 점수 내림차순이다 (상위 3개 = 점수순 top 3)', () => {
    const expanded = expandIntents({
      intents: ['게이밍'],
      explicit: { hardConstraints: {}, softIntentTags: ['RGB'] },
    });
    const output = searchWithProfile(expanded, keyboards);

    const scores = output.results.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
    // 상위 3개 컷이 의미를 가지려면 후보가 3개를 넘어야 한다.
    expect(output.results.length).toBeGreaterThan(3);
  });
});
