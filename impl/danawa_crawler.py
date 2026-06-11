"""다나와 키보드 검색 결과 1회성 크롤러.

검색 목록 페이지(상세 미순회)에서 인기순으로 약 100개 제품의
기본정보(제품명/브랜드/가격/이미지)와 스펙(스위치/연결/배열/키압)을
추출해 JSON, CSV 로 저장한다.

robots.txt(https://search.danawa.com/robots.txt)는 /dsearch.php 를 막지
않으나 Crawl-delay: 10 을 명시하므로 기본 요청 간격을 10초로 둔다.
개인/학습용 전제이며, 상업/배포 시 약관을 재검토할 것.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---- 설정 ---------------------------------------------------------------
SEARCH_URL = "https://search.danawa.com/dsearch.php"
KEYWORD = "키보드"
SORT = "saveDESC"  # 인기순(많이 찾는 순)
PER_PAGE = 40
TARGET_COUNT = 100
REQUEST_DELAY_SEC = 10.0  # robots.txt Crawl-delay 준수
TIMEOUT_SEC = 20
MAX_PAGES = 10  # 안전장치(끝 페이지 도달 시 그 전에 중단됨)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
OUT_DIR = Path(__file__).resolve().parent / "output"

# 스펙 토큰 매칭용 키워드 (다나와 목록 스펙은 '/' 구분 평문)
LAYOUT_KEYWORDS = ["풀배열", "텐키리스", "미니배열", "미니", "일체형", "84키", "87키", "104키"]
CONNECTION_KEYWORDS = ["유선+무선", "유선/무선", "유선", "무선", "블루투스", "전용동글", "전용 동글", "USB"]
SWITCH_TYPE_KEYWORDS = ["기계식", "멤브레인", "무접점", "펜타그래프", "플런저", "광축"]


@dataclass
class Product:
    name: str
    brand: str
    price: str
    image_url: str
    switch: str
    connection: str
    layout: str
    key_force: str
    product_url: str = ""
    raw_spec: str = field(default="")


def fetch_list_page(session: requests.Session, page: int) -> str:
    params = {
        "k1": KEYWORD,
        "module": "goods",
        "act": "dispMain",
        "sort": SORT,
        "page": str(page),
        "limit": str(PER_PAGE),
    }
    resp = session.get(SEARCH_URL, params=params, timeout=TIMEOUT_SEC)
    resp.raise_for_status()
    return resp.text


def parse_spec(spec_text: str) -> dict:
    """슬래시 구분 스펙 평문에서 스위치/연결/배열/키압 추출. 결측은 빈 문자열."""
    tokens = [t.strip() for t in spec_text.split("/") if t.strip()]

    def first_match(keywords: list[str]) -> str:
        for tok in tokens:
            for kw in keywords:
                if kw in tok:
                    return tok
        return ""

    layout = first_match(LAYOUT_KEYWORDS)
    connection = first_match(CONNECTION_KEYWORDS)

    # 스위치: 타입 토큰 + 축 토큰을 합쳐 표현
    switch_type = first_match(SWITCH_TYPE_KEYWORDS)
    axis = next((t for t in tokens if "축" in t), "")
    switch = " ".join(p for p in [switch_type, axis] if p).strip()

    # 키압: '키압'/'gf' 명시 토큰만 채택(무게 'g' 토큰 오인 방지). 목록엔 드묾.
    key_force = ""
    for tok in tokens:
        if "압" in tok or re.search(r"\d+\s*gf\b", tok):
            key_force = tok
            break

    return {"switch": switch, "connection": connection, "layout": layout, "key_force": key_force}


def parse_product(li) -> Product | None:
    name_el = li.select_one(".prod_name a")
    if not name_el:
        return None
    name = name_el.get_text(strip=True)
    product_url = name_el.get("href", "")

    price_el = li.select_one(".price_sect strong")
    price = price_el.get_text(strip=True) if price_el else ""

    img_el = li.select_one(".thumb_image img")
    image_url = ""
    if img_el:
        image_url = img_el.get("data-original") or img_el.get("src") or ""
        if image_url.startswith("//"):
            image_url = "https:" + image_url

    spec_el = li.select_one(".spec_list")
    raw_spec = spec_el.get_text("/", strip=True) if spec_el else ""
    spec = parse_spec(raw_spec)

    # 브랜드: 제품명 첫 토큰(목록에 별도 브랜드 필드가 없어 근사 추출)
    brand = name.split(" ", 1)[0] if name else ""

    return Product(
        name=name,
        brand=brand,
        price=price,
        image_url=image_url,
        product_url=product_url,
        raw_spec=raw_spec,
        **spec,
    )


def crawl() -> list[Product]:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})

    products: list[Product] = []
    for page in range(1, MAX_PAGES + 1):
        if page > 1:
            time.sleep(REQUEST_DELAY_SEC)
        print(f"[page {page}] 요청 중...", flush=True)
        html = fetch_list_page(session, page)
        soup = BeautifulSoup(html, "lxml")
        items = [
            li
            for li in soup.select("ul.product_list > li.prod_item")
            if li.get("id", "").startswith("productItem")
        ]
        if not items:
            print(f"[page {page}] 상품 없음 -> 끝 페이지로 판단, 중단", flush=True)
            break

        page_count = 0
        for li in items:
            p = parse_product(li)
            if p:
                products.append(p)
                page_count += 1
                if len(products) >= TARGET_COUNT:
                    break
        print(f"[page {page}] {page_count}개 수집 (누적 {len(products)})", flush=True)
        if len(products) >= TARGET_COUNT:
            break

    return products[:TARGET_COUNT]


def save(products: list[Product]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [asdict(p) for p in products]

    json_path = OUT_DIR / "keyboards.json"
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_path = OUT_DIR / "keyboards.csv"
    fields = ["name", "brand", "price", "image_url", "switch", "connection", "layout", "key_force", "product_url", "raw_spec"]
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n저장 완료: {len(products)}개")
    print(f"  - {json_path}")
    print(f"  - {csv_path}")


def main() -> int:
    products = crawl()
    if not products:
        print("수집된 제품이 없습니다.", file=sys.stderr)
        return 1
    save(products)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
