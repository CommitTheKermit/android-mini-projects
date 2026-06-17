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

  it('guided: 서버/LLM 호출 0회로 결정론 검색, 결과는 1~3개', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('guided 경로는 네트워크를 호출하면 안 됩니다'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({
      mode: 'guided',
      answers: { 용도: '게임용', 연결방식: '유선' },
      budget: { min: 0, max: 1000000 },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
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
