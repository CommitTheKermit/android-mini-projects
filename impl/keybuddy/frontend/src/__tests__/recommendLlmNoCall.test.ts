/**
 * recommend 결정론 경로 LLM/네트워크 미호출 불변식
 *
 * CLAUDE.md §테스트 규약의 *LlmNoCall.test.ts 규약을 따른다.
 * guided(단계선택) 경로는 selectionOptionConverter + expandIntents + searchWithProfile로만
 * 동작하며 서버 태그추출(fetch)/LLM을 단 한 번도 호출하지 않아야 한다.
 * 이 보증이 깨지면 "LLM은 번역만, 태그 확장·검색은 전부 결정론" 불변식이 무너진 것이다.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { recommend } from '../lib/recommend';

describe('recommend - 결정론(guided) 경로 LLM/네트워크 미호출 불변식', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('guided 경로는 fetch(서버 태그추출)를 한 번도 호출하지 않는다', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('결정론 경로는 네트워크를 호출하면 안 됩니다'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await recommend({
      mode: 'guided',
      answers: { 용도: '게임용', 연결방식: '유선' },
      budget: { min: 0, max: 1000000 },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
