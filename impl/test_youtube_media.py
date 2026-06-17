import json
import tempfile
import unittest
from pathlib import Path

from impl import youtube_media


def make_item(**overrides):
    item = {
        "product_name": "TESTBOARD K87 기계식 키보드",
        "raw_switch_name": "적축",
        "switch_name": "MX Red",
        "product_code": "12345",
        "media_url": None,
        "media_url_is_placeholder": True,
    }
    item.update(overrides)
    return item


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, params, timeout):
        self.calls.append({"url": url, "params": params, "timeout": timeout})
        if not self.responses:
            raise AssertionError("unexpected request")
        return self.responses.pop(0)


class YouTubeQueryTest(unittest.TestCase):
    def test_builds_query_from_product_name_and_raw_switch_name(self):
        item = make_item(product_name="AULA F99", raw_switch_name="저소음 바다축")

        self.assertEqual(youtube_media.build_youtube_query(item), "aula f99 저소음 바다축")

    def test_skips_when_switch_label_is_missing(self):
        item = make_item(raw_switch_name=None, switch_name=None)

        self.assertIsNone(youtube_media.build_youtube_query(item))

    def test_cache_key_prefers_product_code(self):
        item = make_item(product_name="이름이 바뀔 수 있음", product_code="98765")

        self.assertEqual(
            youtube_media.build_cache_key(item),
            "product_code:98765::switch:적축",
        )


class YouTubeEnrichmentTest(unittest.TestCase):
    def test_applies_cached_match_without_api_call(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "cache.json"
            report_path = Path(temp_dir) / "report.json"
            cache_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "entries": {
                            "product_code:12345::switch:적축": {
                                "status": "matched",
                                "media_url": "https://www.youtube.com/watch?v=abc",
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )
            item = make_item()
            fake_session = FakeSession([])

            stats = youtube_media.enrich_items_with_youtube(
                [item],
                api_key="test",
                cache_path=cache_path,
                report_path=report_path,
                search_limit=10,
                session=fake_session,
            )

            self.assertEqual(item["media_url"], "https://www.youtube.com/watch?v=abc")
            self.assertFalse(item["media_url_is_placeholder"])
            self.assertEqual(stats["cache_hits"], 1)
            self.assertEqual(fake_session.calls, [])

    def test_searches_and_caches_best_video(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "cache.json"
            report_path = Path(temp_dir) / "report.json"
            fake_session = FakeSession(
                [
                    FakeResponse(
                        {
                            "items": [
                                {"id": {"videoId": "video1"}},
                                {"id": {"videoId": "video2"}},
                            ]
                        }
                    ),
                    FakeResponse(
                        {
                            "items": [
                                {
                                    "id": "video1",
                                    "snippet": {
                                        "title": "TESTBOARD K87 적축 타건",
                                        "description": "키보드 typing sound",
                                        "channelTitle": "tester",
                                        "publishedAt": "2026-01-01T00:00:00Z",
                                    },
                                    "status": {
                                        "privacyStatus": "public",
                                        "embeddable": True,
                                    },
                                    "statistics": {"viewCount": "2000"},
                                },
                                {
                                    "id": "video2",
                                    "snippet": {
                                        "title": "다른 제품 리뷰",
                                        "description": "",
                                    },
                                    "status": {
                                        "privacyStatus": "public",
                                        "embeddable": True,
                                    },
                                    "statistics": {"viewCount": "1"},
                                },
                            ]
                        }
                    ),
                ]
            )
            item = make_item()

            stats = youtube_media.enrich_items_with_youtube(
                [item],
                api_key="test",
                cache_path=cache_path,
                report_path=report_path,
                search_limit=10,
                delay_sec=0,
                session=fake_session,
            )

            self.assertEqual(item["media_url"], "https://www.youtube.com/watch?v=video1")
            self.assertFalse(item["media_url_is_placeholder"])
            self.assertEqual(stats["api_searches"], 1)
            self.assertEqual(stats["matched"], 1)

            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            entry = cache["entries"]["product_code:12345::switch:적축"]
            self.assertEqual(entry["status"], "matched")
            self.assertEqual(entry["video_id"], "video1")

    def test_caches_not_found_when_top_video_scores_too_low(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "cache.json"
            report_path = Path(temp_dir) / "report.json"
            fake_session = FakeSession(
                [
                    FakeResponse({"items": [{"id": {"videoId": "wrong"}}]}),
                    FakeResponse(
                        {
                            "items": [
                                {
                                    "id": "wrong",
                                    "snippet": {
                                        "title": "전혀 다른 제품",
                                        "description": "",
                                    },
                                    "status": {
                                        "privacyStatus": "public",
                                        "embeddable": True,
                                    },
                                    "statistics": {"viewCount": "100"},
                                }
                            ]
                        }
                    ),
                ]
            )
            item = make_item()

            stats = youtube_media.enrich_items_with_youtube(
                [item],
                api_key="test",
                cache_path=cache_path,
                report_path=report_path,
                search_limit=10,
                delay_sec=0,
                session=fake_session,
            )

            self.assertIsNone(item["media_url"])
            self.assertTrue(item["media_url_is_placeholder"])
            self.assertEqual(stats["not_found"], 1)

            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            self.assertEqual(
                cache["entries"]["product_code:12345::switch:적축"]["status"],
                "not_found",
            )


if __name__ == "__main__":
    unittest.main()
