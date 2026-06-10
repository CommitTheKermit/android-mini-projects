/**
 * AC7 - 의도 확장/검색/스코어링 경로 LLM 호출 0회 (카운트 검증)
 *
 * 클라이언트 스파이를 주입하고 expandIntents + searchWithProfile를 실행해
 * messages.create 호출 수가 0임을 확인한다.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { _setClientForTest, type AnthropicClient } from '../lib/extractRawTags';
import { expandIntents } from '../lib/intentProfile';
import { searchWithProfile } from '../lib/intentSearch';
import rawCatalog from '../data/keyboards.json';
import type { Keyboard } from '../types';

const catalog = rawCatalog as Keyboard[];

describe('AC7 - 의도 확장/검색 경로 LLM 0회', () => {
  let calls = 0;
  const spy = {
    messages: {
      create: async () => {
        calls += 1;
        return { content: [] };
      },
    },
  } as unknown as AnthropicClient;

  afterEach(() => {
    _setClientForTest(null);
    calls = 0;
  });

  it('expandIntents + searchWithProfile는 LLM을 호출하지 않는다', () => {
    _setClientForTest(spy);
    const expanded = expandIntents({
      intents: ['사무용', '게이밍'],
      explicit: { hardConstraints: { price_max: 150000 }, softIntentTags: ['RGB'] },
    });
    const out = searchWithProfile(expanded, catalog);
    expect(out.results.length).toBeGreaterThan(0);
    expect(calls).toBe(0);
  });

  it('완화 경로(필수 모순)에서도 LLM을 호출하지 않는다', () => {
    _setClientForTest(spy);
    const out = searchWithProfile(
      { hardConstraints: {}, requiredTags: ['저소음', '기계식'], softIntentTags: [] },
      catalog,
    );
    expect(out.isFallback).toBe(true);
    expect(calls).toBe(0);
  });
});
