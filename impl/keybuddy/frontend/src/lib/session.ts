/**
 * 익명 세션 식별자
 *
 * 로그인이 없는 keybuddy에서 한 사용자의 추천 -> 구매 클릭 -> 별점 흐름을
 * 느슨하게 묶기 위한 클라이언트 생성 UUID다. PII가 아니며 localStorage에만 보관한다.
 * localStorage를 못 쓰는 환경(프라이버시 모드 등)에서는 비영속 UUID로 폴백한다.
 */

const SESSION_STORAGE_KEY = 'keybuddy_session_id';

export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // localStorage 접근 불가: 이번 호출 한정 비영속 id로 폴백(수집은 best-effort)
    return crypto.randomUUID();
  }
}
