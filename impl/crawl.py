"""다나와 키보드 검색 결과 목록 페이지 크롤러.

인기순(기본 정렬) 검색 결과를 1페이지부터 순회하며 최대 100개 키보드 제품의
기본정보(제품명/브랜드/가격/이미지)와 스펙(스위치/연결/배열/키압)을 목록에서만 추출해
JSON과 CSV로 저장한다. 상세 페이지는 순회하지 않으며, 목록에서 확인 불가한 스펙은 빈 값으로 둔다.
"""

import csv
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://search.danawa.com/dsearch.php"
KEYWORD = "키보드"
TARGET = 100
MAX_PAGES = 40  # 안전장치(무한 루프 방지)
DELAY_SEC = 1.5  # 페이지 간 요청 간격(1-2초)
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

# 완전한 레코드 판정에 필요한 필드(모두 값이 있어야 함)
# engraving/backlight는 명시 없을 때 "정보없음"/"없음"으로 채워지므로 항상 비어있지 않음
REQUIRED_FIELDS = ("product_name", "brand", "price", "image_url",
                   "switch_type", "connection", "layout", "key_force",
                   "weight_g", "wireless_type", "engraving", "backlight")


def is_complete(item: dict) -> bool:
    return all(item.get(f) not in (None, "") for f in REQUIRED_FIELDS)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Referer": "https://www.danawa.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

# 스펙 토큰 분류용 패턴
CONNECTION_TOKENS = ("유선+무선", "유선", "무선", "블루투스", "2.4GHz", "동글")
SWITCH_MECH_TOKENS = ("기계식", "멤브레인", "무접점", "광축", "펜타그래프", "정전용량")
SWITCH_AXIS = re.compile(r"(적축|청축|갈축|황축|흑축|백축|은축|저소음\s*\w*축|\w+축)")
LAYOUT_TOKENS = ("풀배열", "텐키리스", "미니배열", "미니")
LAYOUT_KEYCOUNT = re.compile(r"^\d{2,3}키$")
# "키압 : 43g" / "키압: 43g" 형태에서 값 추출
KEYFORCE = re.compile(r"키압\s*[:：]?\s*([0-9]+\s*g(?:f)?|구분압|균등압|\S+)", re.IGNORECASE)
# 무게: "1020g" 또는 "1.02kg" 같은 단독 토큰(키압/배터리mAh와 구분)
WEIGHT = re.compile(r"^([0-9]+(?:\.[0-9]+)?)\s*(kg|g)$", re.IGNORECASE)
# 무선연결 타입 후보
WIRELESS_KEYS = ("전용동글", "동글", "리시버", "블루투스", "2.4GHz", "RF")
# 각인: "한/영 정각", "영문 정각", "한/영 음각" 등(정각/음각/각인/무각 포함 토큰)
ENGRAVING_TOKENS = ("정각", "음각", "각인", "무각")
# 백라이트: "RGB 백라이트", "단색 백라이트", "LED" 등
BACKLIGHT_TOKENS = ("백라이트", "LED")

# spec 항목 구분자: " / "(앞뒤 공백 있는 슬래시)만 분리해 "한/영", "S/W매크로" 보존
SPEC_SPLIT = re.compile(r"\s+/\s+")


def parse_spec(spec_text: str) -> dict:
    """전체 spec 문자열에서 스위치/연결/배열/키압/무게/무선타입을 추출한다."""
    tokens = [t.strip() for t in SPEC_SPLIT.split(spec_text) if t.strip()]
    connection = ""
    layout = ""
    key_force = ""
    weight_g = None
    mech = ""
    axis = ""
    wireless = []
    engraving = ""
    backlight = ""

    for tok in tokens:
        if tok == "키보드":
            continue
        if not connection:
            for c in CONNECTION_TOKENS:
                if tok == c or tok.startswith(c):
                    connection = tok
                    break
        if not layout:
            if tok in LAYOUT_TOKENS or LAYOUT_KEYCOUNT.match(tok):
                layout = tok
        if not mech:
            for m in SWITCH_MECH_TOKENS:
                if m in tok:
                    mech = m
                    break
        if not axis:
            am = SWITCH_AXIS.search(tok)
            if am:
                axis = am.group(1)
        if not key_force:
            km = KEYFORCE.search(tok)
            if km:
                key_force = km.group(1).strip()
        if weight_g is None:
            wm = WEIGHT.match(tok)
            if wm:
                val = float(wm.group(1))
                grams = val * 1000 if wm.group(2).lower() == "kg" else val
                # 키보드 무게는 보통 100g 이상 -> 키압(수십 g) 오인 방지
                if grams >= 100:
                    weight_g = int(round(grams))
        # 무선연결 타입은 여러 개 누적
        for wk in WIRELESS_KEYS:
            if wk in tok and tok not in wireless:
                wireless.append(tok)
                break
        if not engraving and any(e in tok for e in ENGRAVING_TOKENS):
            engraving = tok
        if not backlight and any(b in tok for b in BACKLIGHT_TOKENS):
            backlight = tok

    switch = " ".join(p for p in (mech, axis) if p).strip()

    # 멤브레인/펜타그래프는 키압을 제공하지 않으므로 0g으로 설정
    if not key_force and mech in ("멤브레인", "펜타그래프"):
        key_force = "0g"

    # 무선 타입: 토큰이 있으면 그대로, 유선 전용이면 "유선", 그 외(무선인데 미파악)는 빈 값
    if wireless:
        wireless_type = ", ".join(wireless)
    elif connection == "유선":
        wireless_type = "유선"
    else:
        wireless_type = ""

    # 각인/백라이트: 명시 없으면 각각 "정보없음"/"없음"으로 채움(사용자 결정)
    engraving = engraving or "정보없음"
    backlight = backlight or "없음"

    return {
        "switch_type": switch,
        "connection": connection,
        "layout": layout,
        "key_force": key_force,
        "weight_g": weight_g,
        "wireless_type": wireless_type,
        "engraving": engraving,
        "backlight": backlight,
    }


def parse_price(price_text: str):
    digits = re.sub(r"[^\d]", "", price_text or "")
    return int(digits) if digits else None


def extract_brand(name: str) -> str:
    return name.split()[0] if name else ""


def parse_item(li) -> dict | None:
    name_el = li.select_one(".prod_name a")
    if not name_el:
        return None
    name = name_el.get_text(strip=True)
    if not name:
        return None

    price_el = li.select_one(".price_sect strong")
    price = parse_price(price_el.get_text(strip=True) if price_el else "")

    img_el = li.select_one(".thumb_image img")
    image_url = ""
    if img_el:
        # lazyload: 실제 이미지는 data-src/data-original 에 있고 src 는 noImg placeholder
        image_url = (img_el.get("data-src") or img_el.get("data-original")
                     or img_el.get("src") or "")
        if "noImg" in image_url or "noData" in image_url:
            image_url = ""  # placeholder -> 결측 처리(완전성 필터가 제외)
        if image_url.startswith("//"):
            image_url = "https:" + image_url

    # 전체 스펙(키압/치수/무게 포함)은 div.spec-box--full 안에 있음. 없으면 짧은 spec_list로 폴백.
    spec_el = li.select_one("div.spec-box--full") or li.select_one(".spec_list")
    empty = {"switch_type": "", "connection": "", "layout": "", "key_force": "",
             "weight_g": None, "wireless_type": "",
             "engraving": "정보없음", "backlight": "없음"}
    spec = parse_spec(spec_el.get_text(" ", strip=True)) if spec_el else empty

    return {
        "product_name": name,
        "brand": extract_brand(name),
        "price": price,
        "image_url": image_url,
        "switch_type": spec["switch_type"],
        "connection": spec["connection"],
        "layout": spec["layout"],
        "key_force": spec["key_force"],
        "weight_g": spec["weight_g"],
        "wireless_type": spec["wireless_type"],
        "engraving": spec["engraving"],
        "backlight": spec["backlight"],
    }


def fetch_page(page: int) -> list:
    params = {"k1": KEYWORD, "module": "goods", "act": "dispMain", "page": str(page)}
    try:
        r = requests.get(SEARCH_URL, params=params, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"  [page {page}] 요청 실패: {e} -> 다음 페이지로 진행")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    results = []
    for li in soup.select("li.prod_item"):
        # 광고/연관상품(prod_main_info 없는 항목) 제외
        if not li.select_one(".prod_main_info"):
            continue
        try:
            item = parse_item(li)
        except Exception as e:  # 한 항목 파싱 실패가 전체를 멈추지 않게
            print(f"  [page {page}] 항목 파싱 실패: {e}")
            continue
        if item:
            results.append(item)
    return results


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    collected = []      # 완전한 레코드만 보관
    seen = set()
    skipped_incomplete = 0
    page = 1
    while len(collected) < TARGET and page <= MAX_PAGES:
        items = fetch_page(page)
        if not items:
            # 빈 페이지 = 마지막 페이지 도달로 간주하고 중단(무한 루프 방지)
            print(f"page {page}: 0개 -> 마지막 페이지로 간주, 중단")
            break
        added = 0
        for it in items:
            key = it["product_name"]
            if key in seen:
                continue
            seen.add(key)
            if not is_complete(it):
                skipped_incomplete += 1
                continue
            collected.append(it)
            added += 1
            if len(collected) >= TARGET:
                break
        print(f"page {page}: +{added} 완전 (누적 {len(collected)}, 불완전 누적제외 {skipped_incomplete})")
        if len(collected) >= TARGET:
            break
        page += 1
        time.sleep(DELAY_SEC)

    collected = collected[:TARGET]

    json_path = OUTPUT_DIR / "keyboards.json"
    csv_path = OUTPUT_DIR / "keyboards.csv"
    fields = ["product_name", "brand", "price", "image_url",
              "switch_type", "connection", "layout", "key_force",
              "weight_g", "wireless_type", "engraving", "backlight"]

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(collected, f, ensure_ascii=False, indent=2)

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(collected)

    print(f"\n총 {len(collected)}개 수집 완료")
    print(f"JSON: {json_path}")
    print(f"CSV : {csv_path}")


if __name__ == "__main__":
    main()
