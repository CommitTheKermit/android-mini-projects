/**
 * 추천 가설 검증용 이벤트 수집
 *
 * 구매하기 버튼 클릭(purchase_click)과 추천 전체 별점(rating)을
 * Supabase의 단일 events 테이블에 PostgREST(/rest/v1/events)로 직접 insert 한다.
 * anon key + insert-only RLS 전제이며, payload는 최소 필수만 담는다.
 *
 * 수집은 best-effort다: 설정 누락/네트워크 실패가 사용자 흐름(버튼 클릭, 별점)을
 * 막지 않도록 모든 실패를 삼키고 false를 반환한다.
 */

import { getSessionId } from './session';

export type EventType = 'purchase_click' | 'rating';

const eventTimeoutMs = 5000;

export interface PurchaseClickPayload {
  product_code: string | null;
}

export interface RatingPayload {
  rating: number;
}

export type EventPayload = PurchaseClickPayload | RatingPayload;

export interface KeybuddyEvent {
  event_type: EventType;
  session_id: string;
  payload: EventPayload;
}

export function buildPurchaseClickEvent(productCode: string | null | undefined): KeybuddyEvent {
  return {
    event_type: 'purchase_click',
    session_id: getSessionId(),
    payload: { product_code: productCode ?? null },
  };
}

export function buildRatingEvent(rating: number): KeybuddyEvent {
  return {
    event_type: 'rating',
    session_id: getSessionId(),
    payload: { rating },
  };
}

/** 이벤트 적재 대상(PostgREST). 설정이 없으면 null을 돌려 수집을 조용히 비활성화한다. */
function getEventsTarget(): { url: string; anonKey: string } | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return { url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/events`, anonKey };
}

export async function sendEvent(event: KeybuddyEvent): Promise<boolean> {
  const target = getEventsTarget();
  if (!target) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), eventTimeoutMs);
  try {
    const response = await fetch(target.url, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: target.anonKey,
        Authorization: `Bearer ${target.anonKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function logPurchaseClick(productCode: string | null | undefined): Promise<boolean> {
  return sendEvent(buildPurchaseClickEvent(productCode));
}

export function logRating(rating: number): Promise<boolean> {
  return sendEvent(buildRatingEvent(rating));
}
