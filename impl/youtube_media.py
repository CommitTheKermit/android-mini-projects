"""YouTube Data API 기반 키보드 타건 영상 링크 보강.

크롤러 본체는 다나와 목록 수집만 담당하고, 이 모듈은 이미 수집된
제품-스위치 레코드에 공식 YouTube Data API 검색 결과를 덧입힌다.
"""

import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
DEFAULT_MAX_RESULTS = 5
MIN_ACCEPT_SCORE = 8

GENERIC_PRODUCT_TOKENS = {
    "키보드",
    "기계식",
    "무선",
    "유선",
    "유무선",
    "블루투스",
    "게이밍",
    "저소음",
    "가스켓",
    "핫스왑",
    "rgb",
    "led",
    "텐키리스",
    "풀배열",
    "미니",
    "배열",
}
MEDIA_HINT_TOKENS = ("타건", "typing", "sound", "리뷰", "review", "asmr", "소리")


class YouTubeApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_key_part(value: str | None) -> str:
    normalized = normalize_text(value)
    normalized = re.sub(r"[^\w가-힣]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def tokenize(value: str | None) -> list[str]:
    normalized = normalize_key_part(value)
    return [token for token in normalized.split() if token]


def select_product_tokens(product_name: str) -> list[str]:
    tokens = [
        token
        for token in tokenize(product_name)
        if token not in GENERIC_PRODUCT_TOKENS and len(token) >= 2
    ]
    return tokens[:5]


def select_switch_label(item: dict[str, Any]) -> str | None:
    for key in ("raw_switch_name", "switch_name"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def build_youtube_query(item: dict[str, Any]) -> str | None:
    product_name = normalize_text(item.get("product_name"))
    switch_label = normalize_text(select_switch_label(item))
    if not product_name or not switch_label:
        return None
    return f"{product_name} {switch_label}"


def build_cache_key(item: dict[str, Any]) -> str | None:
    switch_label = normalize_key_part(select_switch_label(item))
    if not switch_label:
        return None

    product_code = normalize_key_part(item.get("product_code"))
    if product_code:
        return f"product_code:{product_code}::switch:{switch_label}"

    product_name = normalize_key_part(item.get("product_name"))
    if not product_name:
        return None
    return f"product:{product_name}::switch:{switch_label}"


def youtube_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def load_cache(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "entries": {}}

    with path.open(encoding="utf-8") as file:
        cache = json.load(file)

    if isinstance(cache, dict) and "entries" in cache and isinstance(cache["entries"], dict):
        cache.setdefault("version", 1)
        return cache

    if isinstance(cache, dict):
        return {"version": 1, "entries": cache}

    raise ValueError(f"YouTube cache JSON 객체가 필요합니다: {path}")


def save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)


class YouTubeClient:
    def __init__(self, api_key: str, session: requests.Session | None = None):
        self.api_key = api_key
        self.session = session or requests.Session()

    def get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        response = self.session.get(url, params={**params, "key": self.api_key}, timeout=20)
        if response.status_code >= 400:
            raise YouTubeApiError(
                f"YouTube API 요청 실패: HTTP {response.status_code}",
                status_code=response.status_code,
            )
        return response.json()

    def search_videos(self, query: str, max_results: int = DEFAULT_MAX_RESULTS) -> list[dict[str, Any]]:
        search_data = self.get_json(
            YOUTUBE_SEARCH_URL,
            {
                "part": "snippet",
                "type": "video",
                "q": query,
                "maxResults": max_results,
                "order": "relevance",
                "regionCode": "KR",
                "relevanceLanguage": "ko",
                "safeSearch": "moderate",
                "videoEmbeddable": "true",
            },
        )
        video_ids = [
            item.get("id", {}).get("videoId")
            for item in search_data.get("items", [])
            if item.get("id", {}).get("videoId")
        ]
        if not video_ids:
            return []

        videos_data = self.get_json(
            YOUTUBE_VIDEOS_URL,
            {
                "part": "snippet,contentDetails,statistics,status",
                "id": ",".join(video_ids),
            },
        )
        by_id = {item.get("id"): item for item in videos_data.get("items", []) if item.get("id")}
        return [by_id[video_id] for video_id in video_ids if video_id in by_id]


def score_video(item: dict[str, Any], video: dict[str, Any]) -> tuple[int, list[str]]:
    snippet = video.get("snippet", {})
    status = video.get("status", {})
    statistics = video.get("statistics", {})
    title = normalize_text(snippet.get("title"))
    description = normalize_text(snippet.get("description"))
    haystack = f"{title} {description}"

    score = 0
    reasons: list[str] = []

    if status.get("privacyStatus") != "public":
        return -100, ["not_public"]
    if status.get("embeddable") is False:
        return -100, ["not_embeddable"]

    product_matches = 0
    for token in select_product_tokens(str(item.get("product_name", ""))):
        if token in haystack:
            score += 2
            product_matches += 1
    if product_matches:
        reasons.append(f"product_tokens:{product_matches}")

    switch_label = normalize_key_part(select_switch_label(item))
    switch_matches = 0
    if switch_label and switch_label in normalize_key_part(haystack):
        score += 5
        switch_matches += 1
    else:
        for token in tokenize(switch_label):
            if token in haystack:
                score += 3
                switch_matches += 1
    if switch_matches:
        reasons.append(f"switch_tokens:{switch_matches}")

    for token in MEDIA_HINT_TOKENS:
        if token in haystack:
            score += 2
            reasons.append(f"media_hint:{token}")
            break

    try:
        view_count = int(statistics.get("viewCount", "0"))
    except ValueError:
        view_count = 0
    if view_count >= 1000:
        score += 1
        reasons.append("views:1000+")

    if product_matches == 0:
        score -= 4
        reasons.append("missing_product_token")
    if switch_label and switch_matches == 0:
        score -= 3
        reasons.append("missing_switch_token")

    return score, reasons


def select_best_video(item: dict[str, Any], videos: list[dict[str, Any]]) -> dict[str, Any] | None:
    scored = []
    for index, video in enumerate(videos):
        score, reasons = score_video(item, video)
        scored.append((score, -index, reasons, video))
    if not scored:
        return None

    score, _, reasons, video = max(scored, key=lambda entry: (entry[0], entry[1]))
    if score < MIN_ACCEPT_SCORE:
        return None

    snippet = video.get("snippet", {})
    statistics = video.get("statistics", {})
    video_id = video["id"]
    return {
        "status": "matched",
        "media_url": youtube_watch_url(video_id),
        "video_id": video_id,
        "title": snippet.get("title"),
        "channel_title": snippet.get("channelTitle"),
        "published_at": snippet.get("publishedAt"),
        "view_count": statistics.get("viewCount"),
        "score": score,
        "score_reasons": reasons,
    }


def apply_cache_entry(item: dict[str, Any], entry: dict[str, Any]) -> None:
    media_url = entry.get("media_url")
    if entry.get("status") == "matched" and media_url:
        item["media_url"] = media_url
        item["media_url_is_placeholder"] = False
    else:
        item["media_url"] = None
        item["media_url_is_placeholder"] = True


def make_not_found_entry(query: str, videos: list[dict[str, Any]]) -> dict[str, Any]:
    top_video = videos[0] if videos else {}
    snippet = top_video.get("snippet", {})
    return {
        "status": "not_found",
        "query": query,
        "media_url": None,
        "top_title": snippet.get("title"),
        "top_video_id": top_video.get("id"),
        "updated_at": utc_now_iso(),
    }


def enrich_items_with_youtube(
    items: list[dict[str, Any]],
    *,
    api_key: str,
    cache_path: Path,
    report_path: Path,
    search_limit: int,
    refresh: bool = False,
    delay_sec: float = 0.2,
    session: requests.Session | None = None,
) -> dict[str, int]:
    cache = load_cache(cache_path)
    entries = cache["entries"]
    client = YouTubeClient(api_key, session=session)
    report: list[dict[str, Any]] = []
    stats = {
        "items": len(items),
        "cache_hits": 0,
        "api_searches": 0,
        "matched": 0,
        "not_found": 0,
        "skipped": 0,
        "limited": 0,
        "errors": 0,
    }

    for item in items:
        cache_key = build_cache_key(item)
        query = build_youtube_query(item)
        if not cache_key or not query:
            stats["skipped"] += 1
            report.append(
                {
                    "status": "skipped",
                    "product_name": item.get("product_name"),
                    "raw_switch_name": item.get("raw_switch_name"),
                    "switch_name": item.get("switch_name"),
                    "reason": "missing_switch_label_or_product_name",
                }
            )
            continue

        if cache_key in entries and not refresh:
            stats["cache_hits"] += 1
            entry = entries[cache_key]
            apply_cache_entry(item, entry)
            if entry.get("status") == "matched":
                stats["matched"] += 1
            elif entry.get("status") == "not_found":
                stats["not_found"] += 1
            continue

        if stats["api_searches"] >= search_limit:
            stats["limited"] += 1
            continue

        try:
            videos = client.search_videos(query)
        except YouTubeApiError as error:
            stats["errors"] += 1
            report.append(
                {
                    "status": "error",
                    "query": query,
                    "cache_key": cache_key,
                    "error": str(error),
                    "status_code": error.status_code,
                }
            )
            if error.status_code == 403:
                break
            continue
        except requests.RequestException as error:
            stats["errors"] += 1
            report.append(
                {
                    "status": "error",
                    "query": query,
                    "cache_key": cache_key,
                    "error": str(error),
                }
            )
            continue

        stats["api_searches"] += 1
        best = select_best_video(item, videos)
        if best:
            entry = {
                **best,
                "query": query,
                "updated_at": utc_now_iso(),
            }
            stats["matched"] += 1
        else:
            entry = make_not_found_entry(query, videos)
            stats["not_found"] += 1

        entries[cache_key] = entry
        apply_cache_entry(item, entry)
        report.append(
            {
                "cache_key": cache_key,
                "product_name": item.get("product_name"),
                "raw_switch_name": item.get("raw_switch_name"),
                "switch_name": item.get("switch_name"),
                **entry,
            }
        )

        if delay_sec > 0:
            time.sleep(delay_sec)

    cache["updated_at"] = utc_now_iso()
    save_json(cache_path, cache)
    save_json(
        report_path,
        {
            "generated_at": utc_now_iso(),
            "stats": stats,
            "entries": report,
        },
    )
    return stats
