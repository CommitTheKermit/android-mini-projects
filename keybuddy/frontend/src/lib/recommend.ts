import type { RecommendInput, RecommendResult } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const localFunctionUrl = import.meta.env.VITE_SUPABASE_RECOMMEND_URL;

function getRecommendUrl(): string {
  if (localFunctionUrl) {
    return localFunctionUrl;
  }
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL이 설정되지 않았습니다.');
  }
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/recommend`;
}

export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const response = await fetch(getRecommendUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '추천 요청에 실패했습니다.');
  }

  return (await response.json()) as RecommendResult;
}
