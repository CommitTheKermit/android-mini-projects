/**
 * extractIntentInput / parseIntentInput 단위 테스트 (AC2)
 *
 * 자연어 -> {의도 어휘, 명시 하드 제약, 명시 소프트 태그} 분리 추출.
 * 어휘/스키마 밖 값 폐기, LLM 모킹 골드셋.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  parseIntentInput,
  extractIntentInput,
  _setClientForTest,
  type AnthropicClient,
  type IntentExtraction,
} from '../lib/extractRawTags';

function mockClient(jsonText: string): AnthropicClient {
  return {
    messages: { create: async () => ({ content: [{ type: 'text', text: jsonText }] }) },
  } as unknown as AnthropicClient;
}

// ---------------------------------------------------------------------------
// parseIntentInput (순수, LLM 미호출)
// ---------------------------------------------------------------------------

describe('parseIntentInput()', () => {
  it('의도/하드/소프트를 분리 파싱한다', () => {
    const out = parseIntentInput(
      JSON.stringify({
        intents: ['사무용'],
        hardConstraints: { price_max: 150000 },
        softIntentTags: ['RGB'],
      }),
    );
    expect(out.intents).toEqual(['사무용']);
    expect(out.hardConstraints).toEqual({ price_max: 150000 });
    expect(out.softIntentTags).toEqual(['RGB']);
  });

  it('어휘 밖 의도/스키마 밖 값은 폐기된다', () => {
    const out = parseIntentInput(
      JSON.stringify({
        intents: ['사무용', '존재하지않는의도', 123],
        hardConstraints: { price_max: 100000, 모르는키: 'x', switch_type: '잘못된값' },
        softIntentTags: ['무선', '없는태그'],
      }),
    );
    expect(out.intents).toEqual(['사무용']);
    expect(out.hardConstraints).toEqual({ price_max: 100000 });
    expect(out.softIntentTags).toEqual(['무선']);
  });

  it('코드펜스로 감싸도 파싱한다', () => {
    const fenced = '```json\n{"intents":["게이밍"],"hardConstraints":{},"softIntentTags":["RGB"]}\n```';
    const out = parseIntentInput(fenced);
    expect(out.intents).toEqual(['게이밍']);
    expect(out.softIntentTags).toEqual(['RGB']);
  });

  it('JSON이 아니면 빈 결과를 반환한다', () => {
    expect(parseIntentInput('이건 JSON이 아님')).toEqual({
      intents: [],
      hardConstraints: {},
      softIntentTags: [],
    });
  });
});

// ---------------------------------------------------------------------------
// extractIntentInput (LLM 모킹)
// ---------------------------------------------------------------------------

describe('extractIntentInput() - LLM 모킹', () => {
  afterEach(() => _setClientForTest(null));

  it('모킹 응답을 분리/정제해 반환한다', async () => {
    _setClientForTest(
      mockClient(
        JSON.stringify({
          intents: ['사무용', '휴대용'],
          hardConstraints: { price_max: 120000, connection: '무선' },
          softIntentTags: ['가벼움'],
        }),
      ),
    );
    const out = await extractIntentInput('가볍고 무선인 사무용 키보드 12만원 이하');
    expect(out.intents).toEqual(['사무용', '휴대용']);
    expect(out.hardConstraints).toEqual({ price_max: 120000, connection: '무선' });
    expect(out.softIntentTags).toEqual(['가벼움']);
  });

  // AC2 골드셋: 대표 쿼리 -> 기대 추출 (모킹)
  const GOLDSET: Array<{ name: string; query: string; expected: IntentExtraction }> = [
    {
      name: '조용한 사무용 + 예산',
      query: '조용한 사무실용 키보드 15만원 이하',
      expected: { intents: ['사무용'], hardConstraints: { price_max: 150000 }, softIntentTags: [] },
    },
    {
      name: '게이밍 + 명시 RGB',
      query: '게임용으로 RGB 화려한 텐키리스',
      expected: { intents: ['게이밍'], hardConstraints: { layout: '텐키리스' }, softIntentTags: ['RGB'] },
    },
    {
      name: '휴대용 무선',
      query: '들고 다닐 가벼운 무선 키보드',
      expected: { intents: ['휴대용'], hardConstraints: { connection: '무선' }, softIntentTags: ['가벼움'] },
    },
  ];

  for (const c of GOLDSET) {
    it(`골드셋 "${c.name}"`, async () => {
      _setClientForTest(mockClient(JSON.stringify(c.expected)));
      const out = await extractIntentInput(c.query);
      expect(out).toEqual(c.expected);
    });
  }
});
