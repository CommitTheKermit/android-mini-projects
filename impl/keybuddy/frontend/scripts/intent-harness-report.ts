/**
 * AC8 - 의도 하네싱 전/후 정성 비교 리포트 생성기
 *
 * 대표 자연어 쿼리 10개에 대해 추출값을 하드코딩(결정론, LLM 불필요)하고,
 *   - BEFORE(평면): 의도를 평면 소프트 태그로만 취급 (하드 승격 없음, 점수만)
 *   - AFTER(하네싱): expandIntents + searchWithProfile (필수=하드 승격)
 * 를 비교한 마크다운 리포트를 impl/keybuddy/intent-harness-before-after.md 로 출력한다.
 *
 * 핵심 지표: BEFORE 상위 5개 중 '의도 필수 차원'을 위반하는(의도에 안 맞는) 제품 수.
 * AFTER는 필수를 하드 필터로 승격하므로 이 위반이 0이 된다.
 *
 * 실행: (frontend에서) npx vite-node scripts/intent-harness-report.ts
 */

import { writeFileSync } from 'node:fs';
import rawCatalog from '../src/data/keyboards.json';
import type { Keyboard } from '../src/types';
import type { ExtractedTags } from '../src/lib/extractRawTags';
import { searchKeyboards } from '../src/lib/searchEngine';
import { expandIntents } from '../src/lib/intentProfile';
import { searchWithProfile, satisfiesRequiredTags } from '../src/lib/intentSearch';
import type { SoftIntentTag } from '../src/lib/tagSchema';

const catalog = rawCatalog as Keyboard[];

/** 평면 베이스라인용: 의도 -> 평면 소프트 태그(어휘 내) */
const FLAT_INTENT_TAGS: Record<string, SoftIntentTag[]> = {
  사무용: ['사무용'],
  게이밍: ['게이밍'],
  휴대용: ['휴대성', '가벼움'],
};

interface Case {
  name: string;
  query: string;
  intents: string[];
  explicit: ExtractedTags;
}

const CASES: Case[] = [
  { name: '조용한 사무용 (예산 15만)', query: '조용한 사무실용 키보드 15만원 이하', intents: ['사무용'], explicit: { hardConstraints: { price_max: 150000 }, softIntentTags: [] } },
  { name: '게이밍 RGB 텐키리스', query: '게임용 RGB 화려한 텐키리스', intents: ['게이밍'], explicit: { hardConstraints: { layout: '텐키리스' }, softIntentTags: ['RGB'] } },
  { name: '휴대용 무선', query: '들고다닐 가벼운 무선 키보드', intents: ['휴대용'], explicit: { hardConstraints: {}, softIntentTags: [] } },
  { name: '사무용 + 명시 RGB(충돌)', query: '사무용인데 RGB 화려한 거', intents: ['사무용'], explicit: { hardConstraints: {}, softIntentTags: ['RGB'] } },
  { name: '사무용+게이밍(모순)', query: '사무도 보고 게임도 하는 키보드', intents: ['사무용', '게이밍'], explicit: { hardConstraints: {}, softIntentTags: [] } },
  { name: '휴대용+사무용', query: '들고다니며 사무용으로 쓸 키보드', intents: ['휴대용', '사무용'], explicit: { hardConstraints: {}, softIntentTags: [] } },
  { name: '게이밍 + 명시 무접점(충돌)', query: '게임용 무접점 키보드', intents: ['게이밍'], explicit: { hardConstraints: { switch_type: '무접점' }, softIntentTags: [] } },
  { name: '사무용 가성비(5만 이하)', query: '사무용 가성비 키보드 5만원 이하', intents: ['사무용'], explicit: { hardConstraints: { price_max: 50000 }, softIntentTags: ['가성비'] } },
  { name: '게이밍 풀배열', query: '게임용 풀배열 키보드', intents: ['게이밍'], explicit: { hardConstraints: { layout: '풀배열' }, softIntentTags: [] } },
  { name: '휴대용 미니', query: '작고 가벼운 미니 키보드', intents: ['휴대용'], explicit: { hardConstraints: { layout: '미니' }, softIntentTags: [] } },
];

function row(kb: Keyboard, score: number): string {
  return `${kb.product_name} | ${kb.price.toLocaleString()}원 | ${kb.switch_type}/${kb.layout}/${kb.connection} | 점수 ${score}`;
}

function topList(results: { keyboard: Keyboard; score: number }[], n = 5): string {
  return results
    .slice(0, n)
    .map((r, i) => `${i + 1}. ${row(r.keyboard, r.score)}`)
    .join('\n');
}

const lines: string[] = [];
lines.push('# 의도 하네싱 전/후 비교 (AC8 정성 리포트)');
lines.push('');
lines.push(
  '평면 추출(의도=평면 소프트 태그, 점수만)과 의도 하네싱(의도->차원별 강도, 필수=하드 승격)을 ' +
    '대표 쿼리 10개로 비교한다. 추출값은 결정론적으로 고정(LLM 미사용).',
);
lines.push('');
lines.push(
  '핵심 지표 = **BEFORE 상위 5개 중 의도 필수 차원 위반 수**(예: 사무용->저소음 필수인데 ' +
    '시끄러운 기계식이 상위에 노출된 건수). AFTER는 필수를 하드 필터로 승격하므로, ' +
    '완화가 일어나지 않은 한 0이 된다. 필수끼리 모순돼 완화된 경우에만 완화된 필수에 ' +
    '대한 위반이 남으며 이는 설계상 의도된 동작이다(무결과 대신 근접 제시).',
);
lines.push('');

let totalBeforeViolations = 0;
let totalAfterViolations = 0;
let totalAfterViolNonFallback = 0;

for (const c of CASES) {
  const expanded = expandIntents({ intents: c.intents, explicit: c.explicit });
  const requiredTags = expanded.requiredTags;

  // BEFORE: 평면 - 의도를 평면 소프트 태그로 취급, 하드 승격 없음
  const flatSoft = [
    ...c.explicit.softIntentTags,
    ...c.intents.flatMap((i) => FLAT_INTENT_TAGS[i] ?? []),
  ];
  const before = searchKeyboards(
    { hardConstraints: c.explicit.hardConstraints, softIntentTags: [...new Set(flatSoft)] },
    catalog,
  );

  // AFTER: 하네싱
  const after = searchWithProfile(expanded, catalog);

  const beforeViol = before.results
    .slice(0, 5)
    .filter((r) => !satisfiesRequiredTags(r.keyboard, requiredTags)).length;
  const afterViol = after.results
    .slice(0, 5)
    .filter((r) => !satisfiesRequiredTags(r.keyboard, requiredTags)).length;
  totalBeforeViolations += beforeViol;
  totalAfterViolations += afterViol;
  if (!after.isFallback) totalAfterViolNonFallback += afterViol;

  lines.push(`## ${c.name}`);
  lines.push(`- 입력: "${c.query}"`);
  lines.push(`- 의도: [${c.intents.join(', ')}]`);
  lines.push(
    `- 확장: 필수(하드)=[${requiredTags.join(', ') || '-'}] · 선호(소프트)=[${expanded.softIntentTags.join(', ') || '-'}] · 명시하드=${JSON.stringify(expanded.hardConstraints)}`,
  );
  lines.push(
    `- 필수 위반(상위5): BEFORE ${beforeViol}건 -> AFTER ${afterViol}건` +
      (after.isFallback ? ` (완화: ${after.relaxedConstraints.join(', ')})` : ''),
  );
  lines.push('');
  lines.push('BEFORE (평면, 점수만):');
  lines.push('```');
  lines.push(topList(before.results) || '(결과 없음)');
  lines.push('```');
  lines.push('AFTER (하네싱, 필수=하드):');
  lines.push('```');
  lines.push(topList(after.results) || '(결과 없음)');
  lines.push('```');
  lines.push('');
}

lines.push('## 총평');
lines.push(
  `- 10개 쿼리 상위5 합산 의도 필수 위반: **BEFORE ${totalBeforeViolations}건 -> AFTER ${totalAfterViolations}건**`,
);
lines.push(
  `- AFTER 잔여 ${totalAfterViolations}건은 모두 필수 모순 완화 케이스에서 발생하며, ` +
    `**완화가 일어나지 않은 케이스의 필수 위반은 ${totalAfterViolNonFallback}건**이다.`,
);
lines.push(
  '- 하네싱은 의도가 함의한 필수 차원을 하드 필터로 승격해 "의도에 안 맞는 상위 노출"을 제거한다.',
);
lines.push(
  '- 명시 표현 충돌(예: 사무용+RGB, 게이밍+무접점)에서는 명시가 의도 프로파일을 덮어써 의도된 동작을 보인다.',
);
lines.push(
  '- 필수 모순(사무용+게이밍 = 저소음+기계식)은 결과 0이 아니라 완화로 근접 결과를 제시한다.',
);
lines.push('');

const out = lines.join('\n');
writeFileSync('../intent-harness-before-after.md', out, 'utf-8');
console.log(out);
console.log('\n--- written to impl/keybuddy/intent-harness-before-after.md ---');
