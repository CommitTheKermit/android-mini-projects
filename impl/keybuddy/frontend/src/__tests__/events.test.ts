/**
 * 이벤트 수집(events) + 익명 세션(session) 단위 테스트
 *
 * 실제 Supabase 적재는 수동 확인 영역이고, 여기서는 payload 빌더의 형태와
 * sendEvent의 PostgREST 요청(URL/헤더/바디) 및 실패 시 best-effort 동작을 검증한다.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildPurchaseClickEvent,
  buildRatingEvent,
  sendEvent,
} from '../lib/events';
import { getSessionId } from '../lib/session';

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe('events - payload 빌더', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('buildPurchaseClickEvent는 product_code를 payload에 담는다', () => {
    stubLocalStorage();
    const event = buildPurchaseClickEvent('ABC123');
    expect(event.event_type).toBe('purchase_click');
    expect(event.payload).toEqual({ product_code: 'ABC123' });
    expect(typeof event.session_id).toBe('string');
    expect(event.session_id.length).toBeGreaterThan(0);
  });

  it('buildPurchaseClickEvent는 product_code 미제공 시 null로 정규화한다', () => {
    stubLocalStorage();
    expect(buildPurchaseClickEvent(undefined).payload).toEqual({ product_code: null });
    expect(buildPurchaseClickEvent(null).payload).toEqual({ product_code: null });
  });

  it('buildRatingEvent는 별점 값을 payload에 담는다', () => {
    stubLocalStorage();
    const event = buildRatingEvent(4.5);
    expect(event.event_type).toBe('rating');
    expect(event.payload).toEqual({ rating: 4.5 });
  });
});

describe('events - sendEvent (PostgREST 적재)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('환경설정이 있으면 /rest/v1/events로 anon key 헤더와 함께 insert 한다', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await sendEvent(buildRatingEvent(3));

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/events');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('anon-key-123');
    expect(init.headers.Authorization).toBe('Bearer anon-key-123');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body).event_type).toBe('rating');
  });

  it('말미 슬래시가 있는 URL도 정규화해 호출한다', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendEvent(buildRatingEvent(1));

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/rest/v1/events');
  });

  it('환경설정이 없으면 fetch를 호출하지 않고 false를 반환한다', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const ok = await sendEvent(buildRatingEvent(2));

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('응답이 실패면 false를 반환한다', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    expect(await sendEvent(buildRatingEvent(2))).toBe(false);
  });

  it('네트워크 예외가 나도 삼키고 false를 반환한다(best-effort)', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    expect(await sendEvent(buildPurchaseClickEvent('X'))).toBe(false);
  });
});

describe('session - 익명 세션 ID', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('localStorage에 한 번 생성한 세션 ID를 재사용한다', () => {
    stubLocalStorage();
    const first = getSessionId();
    const second = getSessionId();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});
