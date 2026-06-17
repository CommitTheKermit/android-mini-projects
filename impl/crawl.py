"""다나와 키보드 카테고리 목록 페이지 크롤러.

인기순 목록을 순회하며 상품 기본 정보와 목록에 노출된 스위치 옵션을 수집한다.
상세 페이지는 요청하지 않는다. 한 상품에 스위치 옵션이 여러 개 있으면
제품-스위치 조합별 레코드로 펼쳐 JSON과 CSV에 저장한다.
"""

import csv
import json
import re
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

LIST_URL = "https://prod.danawa.com/list/"
LIST_AJAX_URL = "https://prod.danawa.com/list/ajax/getProductList.ajax.php"
CATEGORY_CODE = "112782"
TARGET_RECORDS = 600
MAX_PAGES = 40  # 안전장치(무한 루프 방지)
DELAY_SEC = 1.5  # 페이지 간 요청 간격. 상품별 추가 요청은 하지 않는다.

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
SWITCH_DATA_DIR = BASE_DIR / "keybuddy" / "frontend" / "src" / "data"
SWITCHES_PATH = SWITCH_DATA_DIR / "switches.json"
SWITCH_ALIASES_PATH = SWITCH_DATA_DIR / "switch_aliases.json"

# 기존 데이터셋의 완전성 기준은 유지한다. 새 스위치 필드는 결측을 허용한다.
REQUIRED_FIELDS = (
    "product_name",
    "brand",
    "price",
    "image_url",
    "switch_type",
    "connection",
    "layout",
    "key_force",
    "weight_g",
    "wireless_type",
    "engraving",
    "backlight",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Referer": "https://www.danawa.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

# 첫 목록 페이지에 포함된 다나와 목록 설정값이다. 2페이지부터는 브라우저와
# 동일하게 목록 AJAX 엔드포인트에 이 값을 POST한다.
LIST_AJAX_PARAMS = {
    "listCategoryCode": "782",
    "categoryCode": "782",
    "physicsCate1": "861",
    "physicsCate2": "881",
    "physicsCate3": "0",
    "physicsCate4": "0",
    "viewMethod": "LIST",
    "sortMethod": "",
    "listCount": "30",
    "group": "11",
    "depth": "2",
    "brandName": "",
    "makerName": "",
    "searchOptionName": "",
    "sDiscountProductRate": "0",
    "sInitialPriceDisplay": "N",
    "sPowerLinkKeyword": "LED키보드",
    "oCurrentCategoryCode": "a:2:{i:2;i:782;i:1;i:53473;}",
    "sMallMinPriceDisplayYN": "",
    "quickDeliveryCategoryYN": "N",
    "quickDeliveryDisplay": "",
    "priceUnitSort": "N",
    "priceUnitSortOrder": "A",
    "simpleDescriptionDisplayYN": "N",
    "simpleDescriptionOpen": "",
    "listPackageType": "3",
    "categoryMappingCode": "734",
    "priceUnit": "0",
    "priceUnitValue": "0",
    "priceUnitClass": "",
    "cmRecommendSort": "N",
    "cmRecommendSortDefault": "N",
    "bundleImagePreview": "N",
    "nPackageLimit": "5",
    "bMakerDisplayYN": "Y",
    "dnwSwitchOn": "",
    "isDpgZoneUICategory": "N",
    "isAssemblyGalleryCategory": "N",
    "addDelivery": "",
    "coupangMemberSort": "",
    "coupangMemberSortLayerType": "",
    "sProductListApi": "search",
}

# 스펙 토큰 분류용 패턴
CONNECTION_TOKENS = ("유선+무선", "유선", "무선", "블루투스", "2.4GHz", "동글")
SWITCH_MECH_TOKENS = ("기계식", "멤브레인", "무접점", "광축", "펜타그래프", "정전용량")
SWITCH_AXIS = re.compile(r"(적축|청축|갈축|황축|흑축|백축|은축|저소음\s*\w*축|\w+축)")
LAYOUT_TOKENS = ("풀배열", "텐키리스", "미니배열", "미니")
LAYOUT_KEYCOUNT = re.compile(r"^\d{2,3}키$")
KEYFORCE = re.compile(r"키압\s*[:：]?\s*([0-9]+\s*g(?:f)?|구분압|균등압|\S+)", re.IGNORECASE)
WEIGHT = re.compile(r"^([0-9]+(?:\.[0-9]+)?)\s*(kg|g)$", re.IGNORECASE)
WIRELESS_KEYS = ("전용동글", "동글", "리시버", "블루투스", "2.4GHz", "RF")
ENGRAVING_TOKENS = ("정각", "음각", "각인", "무각")
BACKLIGHT_TOKENS = ("백라이트", "LED")
SPEC_SPLIT = re.compile(r"\s+/\s+")
SWITCH_MANUFACTURER = re.compile(r"^스위치\s*[:：]\s*(.+)$")

# 목록의 옵션 영역에는 색상, 중고, 구성품도 섞인다. 사전/별칭에 없을 때는
# 기계식 계열 상품이면서 이름에 '축'이 있는 옵션만 스위치 후보로 인정한다.
SWITCH_OPTION_MECHANISMS = ("기계식", "무접점", "광축", "자석축")
IGNORED_OPTION_NAMES = {
    "중고",
    "해외구매",
    "제조사 축",
    "키스킨 포함",
    "키스킨 미포함",
}

CSV_FIELDS = [
    "product_name",
    "brand",
    "price",
    "image_url",
    "switch_type",
    "connection",
    "layout",
    "key_force",
    "weight_g",
    "wireless_type",
    "engraving",
    "backlight",
    "raw_switch_name",
    "switch_name",
    "switch_manufacturer",
    "product_code",
    "media_url",
    "price_compare_url",
    "media_url_is_placeholder",
]


def load_json_object(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        value = json.load(file)
    if not isinstance(value, dict):
        raise ValueError(f"JSON 객체가 필요합니다: {path}")
    return value


def load_switch_data() -> tuple[dict, dict]:
    switches = load_json_object(SWITCHES_PATH)
    alias_config = load_json_object(SWITCH_ALIASES_PATH)

    # 이전의 평면 별칭 객체도 읽을 수 있게 하되, 새 형식에서는 제조사별 별칭을
    # 분리해 "적축" 같은 공통 이름의 오매칭을 막는다.
    if "exact" in alias_config or "by_manufacturer" in alias_config:
        exact_aliases = alias_config.get("exact", {})
        manufacturer_aliases = alias_config.get("by_manufacturer", {})
    else:
        exact_aliases = alias_config
        manufacturer_aliases = {}

    if not isinstance(exact_aliases, dict) or not isinstance(manufacturer_aliases, dict):
        raise ValueError("switch_aliases.json의 exact/by_manufacturer는 JSON 객체여야 합니다.")

    aliases = {
        "exact": exact_aliases,
        "by_manufacturer": manufacturer_aliases,
    }

    invalid_aliases = {
        alias: canonical
        for alias, canonical in exact_aliases.items()
        if canonical not in switches
    }
    for manufacturer, values in manufacturer_aliases.items():
        if not isinstance(values, dict):
            raise ValueError(f"제조사별 별칭은 JSON 객체여야 합니다: {manufacturer}")
        invalid_aliases.update(
            {
                f"{manufacturer}::{alias}": canonical
                for alias, canonical in values.items()
                if canonical not in switches
            }
        )
    if invalid_aliases:
        raise ValueError(f"switches.json에 없는 별칭 대상: {invalid_aliases}")

    return switches, aliases


def is_complete(item: dict) -> bool:
    return all(item.get(field) not in (None, "") for field in REQUIRED_FIELDS)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_spec(spec_text: str) -> dict:
    """전체 spec 문자열에서 기존 키보드 필드와 스위치 제조사를 추출한다."""
    tokens = [clean_text(token) for token in SPEC_SPLIT.split(spec_text) if clean_text(token)]
    connection = ""
    layout = ""
    key_force = ""
    weight_g = None
    mechanism = ""
    axis = ""
    wireless = []
    engraving = ""
    backlight = ""
    switch_manufacturer = None

    for token in tokens:
        if token == "키보드":
            continue

        if not connection:
            for candidate in CONNECTION_TOKENS:
                if token == candidate or token.startswith(candidate):
                    connection = token
                    break

        if not layout and (token in LAYOUT_TOKENS or LAYOUT_KEYCOUNT.match(token)):
            layout = token

        if not mechanism:
            for candidate in SWITCH_MECH_TOKENS:
                if candidate in token:
                    mechanism = candidate
                    break

        if not axis:
            axis_match = SWITCH_AXIS.search(token)
            if axis_match:
                axis = axis_match.group(1)

        if not key_force:
            force_match = KEYFORCE.search(token)
            if force_match:
                key_force = force_match.group(1).strip()

        if weight_g is None:
            weight_match = WEIGHT.match(token)
            if weight_match:
                value = float(weight_match.group(1))
                grams = value * 1000 if weight_match.group(2).lower() == "kg" else value
                if grams >= 100:  # 수십 g 단위 키압을 무게로 오인하지 않는다.
                    weight_g = int(round(grams))

        for wireless_key in WIRELESS_KEYS:
            if wireless_key in token and token not in wireless:
                wireless.append(token)
                break

        if not engraving and any(candidate in token for candidate in ENGRAVING_TOKENS):
            engraving = token

        if not backlight and any(candidate in token for candidate in BACKLIGHT_TOKENS):
            backlight = token

        manufacturer_match = SWITCH_MANUFACTURER.match(token)
        if manufacturer_match:
            switch_manufacturer = clean_text(manufacturer_match.group(1)) or None

    switch_type = " ".join(part for part in (mechanism, axis) if part).strip()

    # 기존 데이터 구조와 동작을 유지한다.
    if not key_force and mechanism in ("멤브레인", "펜타그래프"):
        key_force = "0g"

    if wireless:
        wireless_type = ", ".join(wireless)
    elif connection == "유선":
        wireless_type = "유선"
    else:
        wireless_type = ""

    return {
        "switch_type": switch_type,
        "connection": connection,
        "layout": layout,
        "key_force": key_force,
        "weight_g": weight_g,
        "wireless_type": wireless_type,
        "engraving": engraving or "정보없음",
        "backlight": backlight or "없음",
        "switch_manufacturer": switch_manufacturer,
    }


def parse_price(price_text: str):
    digits = re.sub(r"[^\d]", "", price_text or "")
    return int(digits) if digits else None


def extract_brand(name: str) -> str:
    return name.split()[0] if name else ""


def extract_image_url(li) -> str:
    image = li.select_one(".thumb_image img")
    if not image:
        return ""

    image_url = image.get("data-src") or image.get("data-original") or image.get("src") or ""
    if "noImg" in image_url or "noData" in image_url:
        return ""
    if image_url.startswith("//"):
        return "https:" + image_url
    return image_url


def normalize_danawa_url(href: str | None) -> str | None:
    if not href:
        return None

    url = urljoin(LIST_URL, href.strip())
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https"):
        return None
    if hostname != "danawa.com" and not hostname.endswith(".danawa.com"):
        return None
    return url


def extract_product_code(url: str | None, element_id: str = "") -> str | None:
    if url:
        query = urlparse(url).query
        match = re.search(r"(?:^|&)pcode=(\d+)(?:&|$)", query)
        if match:
            return match.group(1)

    match = re.search(r"(\d+)$", element_id)
    return match.group(1) if match else None


def resolve_switch_name(
    raw_name: str,
    switch_manufacturer: str | None,
    switches: dict,
    aliases: dict,
) -> str | None:
    if raw_name in switches:
        return raw_name

    canonical_name = aliases["exact"].get(raw_name)
    if canonical_name in switches:
        return canonical_name

    if switch_manufacturer:
        manufacturer_aliases = aliases["by_manufacturer"].get(switch_manufacturer, {})
        canonical_name = manufacturer_aliases.get(raw_name)
        if canonical_name in switches:
            return canonical_name

    return None


def is_switch_option(raw_name: str, switch_type: str, switches: dict, aliases: dict) -> bool:
    if not raw_name or raw_name in IGNORED_OPTION_NAMES:
        return False
    if raw_name in switches or raw_name in aliases["exact"]:
        return True
    return "축" in raw_name and any(value in switch_type for value in SWITCH_OPTION_MECHANISMS)


def parse_switch_variants(
    li,
    switch_type: str,
    switch_manufacturer: str | None,
    switches: dict,
    aliases: dict,
) -> list[dict]:
    variants = []
    for option in li.select('.prod_pricelist li[id^="productInfoDetail_"]'):
        name_element = option.select_one(".memory_sect .text")
        if not name_element:
            continue

        raw_name = clean_text(name_element.get_text(" ", strip=True))
        if not is_switch_option(raw_name, switch_type, switches, aliases):
            continue

        price_element = option.select_one(".price_sect strong")
        price = parse_price(price_element.get_text(strip=True) if price_element else "")
        link_element = option.select_one(".price_sect a[href]")
        price_compare_url = normalize_danawa_url(
            link_element.get("href") if link_element else None
        )
        product_code = extract_product_code(price_compare_url, option.get("id", ""))

        variants.append(
            {
                "raw_switch_name": raw_name,
                "switch_name": resolve_switch_name(
                    raw_name,
                    switch_manufacturer,
                    switches,
                    aliases,
                ),
                "product_code": product_code,
                "price": price,
                "price_compare_url": price_compare_url,
            }
        )

    return variants


def build_links(price_compare_url: str | None) -> dict:
    return {
        "media_url": None,
        "price_compare_url": price_compare_url,
        "media_url_is_placeholder": True,
    }


def parse_item(li, switches: dict, aliases: dict) -> list[dict]:
    """상품 카드 하나를 제품-스위치 조합별 레코드로 변환한다."""
    name_element = li.select_one('.prod_name a[name="productName"]') or li.select_one(".prod_name a")
    if not name_element:
        return []

    product_name = clean_text(name_element.get_text(" ", strip=True))
    if not product_name:
        return []
    base_price_compare_url = normalize_danawa_url(name_element.get("href"))

    price_element = li.select_one(".price_sect strong")
    base_price = parse_price(price_element.get_text(strip=True) if price_element else "")
    image_url = extract_image_url(li)

    spec_element = li.select_one("div.spec-box--full .spec_list") or li.select_one(".spec_list")
    empty_spec = {
        "switch_type": "",
        "connection": "",
        "layout": "",
        "key_force": "",
        "weight_g": None,
        "wireless_type": "",
        "engraving": "정보없음",
        "backlight": "없음",
        "switch_manufacturer": None,
    }
    spec = parse_spec(spec_element.get_text(" ", strip=True)) if spec_element else empty_spec

    base_record = {
        "product_name": product_name,
        "brand": extract_brand(product_name),
        "price": base_price,
        "image_url": image_url,
        "switch_type": spec["switch_type"],
        "connection": spec["connection"],
        "layout": spec["layout"],
        "key_force": spec["key_force"],
        "weight_g": spec["weight_g"],
        "wireless_type": spec["wireless_type"],
        "engraving": spec["engraving"],
        "backlight": spec["backlight"],
        "switch_manufacturer": spec["switch_manufacturer"],
        **build_links(base_price_compare_url),
    }

    variants = parse_switch_variants(
        li,
        spec["switch_type"],
        spec["switch_manufacturer"],
        switches,
        aliases,
    )
    if variants:
        return [
            {
                **base_record,
                "price": variant["price"] if variant["price"] is not None else base_price,
                "raw_switch_name": variant["raw_switch_name"],
                "switch_name": variant["switch_name"],
                "product_code": variant["product_code"],
                **build_links(variant["price_compare_url"] or base_price_compare_url),
            }
            for variant in variants
        ]

    representative_id = li.get("id", "")
    product_code = extract_product_code(base_price_compare_url, representative_id)
    return [
        {
            **base_record,
            "raw_switch_name": None,
            "switch_name": None,
            "product_code": product_code,
        }
    ]


def parse_page(html: str, switches: dict, aliases: dict) -> list[list[dict]]:
    """목록 HTML을 상품별 레코드 묶음으로 반환한다."""
    soup = BeautifulSoup(html, "lxml")
    products = []
    for li in soup.select("div.main_prodlist li.prod_item"):
        if not li.select_one(".prod_main_info"):
            continue
        try:
            records = parse_item(li, switches, aliases)
        except Exception as error:
            product_id = li.get("id", "unknown")
            print(f"  [parse_item 실패] {product_id}: {error}")
            continue
        if records:
            products.append(records)
    return products


def fetch_page(
    page: int,
    switches: dict,
    aliases: dict,
    session: requests.Session | None = None,
) -> list[list[dict]]:
    client = session or requests
    try:
        if page == 1:
            response = client.get(
                LIST_URL,
                params={"cate": CATEGORY_CODE},
                headers=HEADERS,
                timeout=20,
            )
        else:
            ajax_headers = {
                **HEADERS,
                "Referer": f"{LIST_URL}?cate={CATEGORY_CODE}",
                "X-Requested-With": "XMLHttpRequest",
            }
            response = client.post(
                LIST_AJAX_URL,
                data={**LIST_AJAX_PARAMS, "page": str(page)},
                headers=ajax_headers,
                timeout=20,
            )
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"  [page {page}] 요청 실패: {error} -> 다음 페이지로 진행")
        return []
    return parse_page(response.text, switches, aliases)


def dedupe_key(item: dict) -> tuple:
    return (
        item["product_name"],
        item.get("raw_switch_name"),
        item.get("product_code"),
    )


def select_records_for_remaining_slots(
    records: list[dict],
    seen: set,
    remaining: int,
) -> tuple[list[tuple[tuple, dict]], int, int]:
    """완전하고 중복되지 않은 레코드를 남은 수집량만큼 반환한다."""
    complete_records = []
    pending_keys = set()
    skipped_incomplete = 0

    for item in records:
        if not is_complete(item):
            skipped_incomplete += 1
            continue

        key = dedupe_key(item)
        if key in seen or key in pending_keys:
            continue

        pending_keys.add(key)
        complete_records.append((key, item))

    truncated = max(0, len(complete_records) - remaining)
    return complete_records[:remaining], skipped_incomplete, truncated


def build_unmatched_switch_report(items: list[dict]) -> list[dict]:
    grouped = defaultdict(lambda: {"product_names": set(), "count": 0})
    for item in items:
        raw_name = item.get("raw_switch_name")
        if not raw_name or item.get("switch_name"):
            continue
        key = (raw_name, item.get("switch_manufacturer"))
        grouped[key]["product_names"].add(item["product_name"])
        grouped[key]["count"] += 1

    return [
        {
            "raw_switch_name": raw_name,
            "switch_manufacturer": manufacturer,
            "product_names": sorted(value["product_names"]),
            "count": value["count"],
        }
        for (raw_name, manufacturer), value in sorted(
            grouped.items(), key=lambda entry: (-entry[1]["count"], entry[0][0])
        )
    ]


def save_results(collected: list[dict]) -> None:
    json_path = OUTPUT_DIR / "keyboards.json"
    csv_path = OUTPUT_DIR / "keyboards.csv"
    unmatched_path = OUTPUT_DIR / "unmatched_switches.json"

    with json_path.open("w", encoding="utf-8") as file:
        json.dump(collected, file, ensure_ascii=False, indent=2)

    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(collected)

    unmatched = build_unmatched_switch_report(collected)
    with unmatched_path.open("w", encoding="utf-8") as file:
        json.dump(unmatched, file, ensure_ascii=False, indent=2)

    print(f"JSON: {json_path}")
    print(f"CSV : {csv_path}")
    print(f"미매칭 스위치: {unmatched_path} ({len(unmatched)}종)")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    switches, aliases = load_switch_data()

    collected = []
    seen = set()
    skipped_incomplete = 0
    truncated_options = 0
    product_count = 0
    page = 1

    with requests.Session() as session:
        while len(collected) < TARGET_RECORDS and page <= MAX_PAGES:
            product_groups = fetch_page(page, switches, aliases, session)
            if not product_groups:
                print(f"page {page}: 0개 -> 마지막 페이지로 간주, 중단")
                break

            added_products = 0
            added_records = 0
            for records in product_groups:
                if len(collected) >= TARGET_RECORDS:
                    break

                remaining = TARGET_RECORDS - len(collected)
                complete_records, incomplete_count, truncated_count = (
                    select_records_for_remaining_slots(records, seen, remaining)
                )
                skipped_incomplete += incomplete_count
                truncated_options += truncated_count

                if not complete_records:
                    continue

                if truncated_count:
                    product_name = records[0].get("product_name", "?")
                    print(
                        f"  [600개 제한] '{product_name}' 옵션 "
                        f"{truncated_count}개를 제외합니다."
                    )

                for key, item in complete_records:
                    seen.add(key)
                    collected.append(item)
                    added_records += 1
                product_count += 1
                added_products += 1

            print(
                f"page {page}: 상품 +{added_products}, 조합 +{added_records} "
                f"(상품 누적 {product_count}, 조합 누적 {len(collected)}, "
                f"불완전 누적제외 {skipped_incomplete}, "
                f"600개 경계 제외 {truncated_options})"
            )

            if len(collected) >= TARGET_RECORDS:
                break
            page += 1
            time.sleep(DELAY_SEC)

    save_results(collected)
    print(f"\n상품 {product_count}개에서 제품-스위치 조합 {len(collected)}개 수집 완료")


if __name__ == "__main__":
    main()
