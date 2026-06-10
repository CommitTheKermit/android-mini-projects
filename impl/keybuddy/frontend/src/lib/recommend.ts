import type { RecommendInput, RecommendResult } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const localFunctionUrl = import.meta.env.VITE_SUPABASE_RECOMMEND_URL;
const recommendTimeoutMs = 45000;

function getRecommendTarget(): { url: string; headers: Record<string, string> } {
  if (localFunctionUrl) {
    return { url: localFunctionUrl, headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {} };
  }
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL이 설정되지 않았습니다.');
  }
  return {
    url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/recommend`,
    headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {},
  };
}

export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const target = getRecommendTarget();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), recommendTimeoutMs);
  let response: Response;
  try {
    response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...target.headers,
      },
      signal: controller.signal,
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('추천 요청 시간이 길어 중단했습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : '추천 요청에 실패했습니다.';
    throw new Error(message);
  }

  return (await response.json()) as RecommendResult;
}
