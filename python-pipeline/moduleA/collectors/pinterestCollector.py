"""
pinterestCollector.py

Pinterest XHR 인터셉션 방식으로 키워드 검색 결과 이미지 수집.
- Playwright 비동기 API
- Pinterest 내부 API 응답(JSON) 가로채기
- 핀 데이터: 이미지 URL, 타이틀, 설명, 원본 링크
"""

import asyncio
import json
import re
from typing import Optional
from playwright.async_api import async_playwright, Response


# ── Pinterest 응답에서 핀 데이터 추출 ─────────────────────────
def _extract_pins(data: dict) -> list[dict]:
    pins = []

    # 구조: resource_response.data.results (BaseSearchResource 실제 응답)
    rr = data.get("resource_response") or {}
    if isinstance(rr, dict):
        inner = rr.get("data") or {}
        if isinstance(inner, dict):
            candidates = inner.get("results") or []
            if isinstance(candidates, list):
                pins.extend(candidates)

    # fallback: 최상위 data 배열
    if not pins:
        top = data.get("data") or []
        if isinstance(top, list):
            pins.extend(top)
        elif isinstance(top, dict):
            pins.extend(top.get("results") or [])

    results = []
    for p in pins:
        if not isinstance(p, dict):
            continue

        # 이미지 URL 우선순위: 736x > orig > 474x
        images = p.get("images") or {}
        img_url = (
            (images.get("736x") or {}).get("url") or
            (images.get("orig")  or {}).get("url") or
            (images.get("474x") or {}).get("url") or
            p.get("image_url") or
            ""
        )
        if not img_url or "pinimg.com" not in img_url:
            continue

        results.append({
            "id":          p.get("id", ""),
            "title":       (p.get("title") or p.get("grid_title") or "").strip(),
            "description": (p.get("description") or "").strip()[:200],
            "link":        p.get("link") or f"https://www.pinterest.com/pin/{p.get('id', '')}/",
            "image_url":   img_url,
            "dominant_color": p.get("dominant_color") or "",
        })

    return results


# ── 단일 키워드 수집 ──────────────────────────────────────────
async def collect_pinterest(
    keyword: str,
    limit: int = 10,
    market: str = "GLOBAL",
    headless: bool = True,
    timeout_ms: int = 15000,
) -> list[dict]:
    """
    keyword: 검색어 (영문 권장)
    market: "JP" → pinterest.co.jp 사용, 나머지 → pinterest.com
    """
    search_url = f"https://www.pinterest.com/search/pins/?q={keyword.replace(' ', '+')}&rs=typed"

    collected: list[dict] = []
    seen_ids: set[str] = set()

    async def handle_response(response: Response):
        url = response.url
        # Pinterest 내부 API 엔드포인트 필터링
        if not any(p in url for p in [
            "/resource/", "/api/v3/", "/api/v5/",
            "BaseSearch", "SearchResource",
        ]):
            return
        try:
            body = await response.body()
            data = json.loads(body)
            pins = _extract_pins(data)
            for pin in pins:
                if pin["id"] not in seen_ids and pin["image_url"]:
                    seen_ids.add(pin["id"])
                    collected.append(pin)
        except Exception:
            pass

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="ja-JP" if market == "JP" else "en-US",
        )
        page = await ctx.new_page()
        page.on("response", handle_response)

        try:
            await page.goto(search_url, timeout=timeout_ms, wait_until="domcontentloaded")
            # 초기 렌더링 대기
            await page.wait_for_timeout(3000)

            # 더 많은 결과가 필요하면 스크롤
            scrolls = 0
            while len(collected) < limit and scrolls < 4:
                await page.evaluate("window.scrollBy(0, window.innerHeight * 2)")
                await page.wait_for_timeout(1500)
                scrolls += 1

        except Exception as e:
            print(f"[PINTEREST] 페이지 로드 오류: {e}")
        finally:
            await browser.close()

    return collected[:limit]


# ── 복수 키워드 병렬 수집 ─────────────────────────────────────
async def collect_pinterest_batch(
    keywords: list[str],
    limit_per_keyword: int = 5,
    market: str = "GLOBAL",
) -> list[dict]:
    """여러 키워드를 병렬 수집 후 합산 (중복 image_url 제거)"""
    tasks = [
        collect_pinterest(kw, limit=limit_per_keyword, market=market)
        for kw in keywords
    ]
    results_per_kw = await asyncio.gather(*tasks, return_exceptions=True)

    seen_urls: set[str] = set()
    merged = []
    for kw, res in zip(keywords, results_per_kw):
        if isinstance(res, Exception):
            print(f"[PINTEREST] {kw} 수집 실패: {res}")
            continue
        for pin in res:
            if pin["image_url"] not in seen_urls:
                seen_urls.add(pin["image_url"])
                pin["source_keyword"] = kw
                merged.append(pin)

    return merged


# ── 직접 실행 테스트 ─────────────────────────────────────────
if __name__ == "__main__":
    import sys

    keyword = sys.argv[1] if len(sys.argv) > 1 else "japanese cafe interior earthy"
    market  = sys.argv[2] if len(sys.argv) > 2 else "JP"

    async def main():
        print(f"[TEST] keyword='{keyword}' market={market}")
        pins = await collect_pinterest(keyword, limit=10, market=market, headless=False)
        print(f"[TEST] 수집된 핀: {len(pins)}개")
        for i, p in enumerate(pins):
            print(f"  [{i+1}] {p['title'] or '(no title)'}")
            print(f"       URL: {p['link']}")
            print(f"       IMG: {p['image_url'][:80]}...")

    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    asyncio.run(main())
