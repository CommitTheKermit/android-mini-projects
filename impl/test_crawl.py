import unittest
from unittest.mock import patch

from impl import crawl


def make_complete_record(name: str, product_code: str) -> dict:
    return {
        "product_name": name,
        "brand": "TEST",
        "price": 10000,
        "image_url": "https://example.com/keyboard.jpg",
        "switch_type": "기계식",
        "connection": "유선",
        "layout": "풀배열",
        "key_force": "45g",
        "weight_g": 1000,
        "wireless_type": "유선",
        "engraving": "한/영 정각",
        "backlight": "없음",
        "raw_switch_name": "적축",
        "product_code": product_code,
    }


class NormalizeDanawaUrlTest(unittest.TestCase):
    def test_allows_danawa_subdomains(self):
        for url in (
            "https://prod.danawa.com/info/?pcode=1",
            "https://compare.danawa.com/info/?pcode=2",
            "https://www.danawa.com/info/?pcode=3",
            "https://danawa.com/info/?pcode=4",
        ):
            with self.subTest(url=url):
                self.assertEqual(crawl.normalize_danawa_url(url), url)

    def test_rejects_non_danawa_hosts_and_non_http_schemes(self):
        for url in (
            "https://danawa.com.evil.example/info/?pcode=1",
            "https://example.com/info/?pcode=2",
            "javascript:alert(1)",
        ):
            with self.subTest(url=url):
                self.assertIsNone(crawl.normalize_danawa_url(url))


class ParsePageTest(unittest.TestCase):
    def test_skips_a_product_when_parse_item_raises(self):
        html = """
        <div class="main_prodlist">
          <li class="prod_item" id="broken"><div class="prod_main_info"></div></li>
          <li class="prod_item" id="valid"><div class="prod_main_info"></div></li>
        </div>
        """
        valid_records = [make_complete_record("정상 상품", "2")]

        with patch.object(
            crawl,
            "parse_item",
            side_effect=[AttributeError("잘못된 상품"), valid_records],
        ):
            self.assertEqual(crawl.parse_page(html, {}, {}), [valid_records])


class SelectRecordsForRemainingSlotsTest(unittest.TestCase):
    def test_limits_the_last_product_to_the_remaining_slots(self):
        records = [make_complete_record(f"상품 {index}", str(index)) for index in range(4)]

        selected, skipped, truncated = crawl.select_records_for_remaining_slots(
            records,
            seen=set(),
            remaining=3,
        )

        self.assertEqual([item["product_code"] for _, item in selected], ["0", "1", "2"])
        self.assertEqual(skipped, 0)
        self.assertEqual(truncated, 1)

    def test_excludes_incomplete_and_duplicate_records(self):
        first = make_complete_record("상품", "1")
        duplicate = dict(first)
        incomplete = make_complete_record("불완전 상품", "2")
        incomplete["image_url"] = ""

        selected, skipped, truncated = crawl.select_records_for_remaining_slots(
            [first, duplicate, incomplete],
            seen=set(),
            remaining=3,
        )

        self.assertEqual(len(selected), 1)
        self.assertEqual(skipped, 1)
        self.assertEqual(truncated, 0)


class BuildLinksTest(unittest.TestCase):
    def test_keeps_media_url_null_until_real_media_is_available(self):
        self.assertEqual(
            crawl.build_links("https://prod.danawa.com/info/?pcode=1"),
            {
                "media_url": None,
                "price_compare_url": "https://prod.danawa.com/info/?pcode=1",
                "media_url_is_placeholder": True,
            },
        )


if __name__ == "__main__":
    unittest.main()
