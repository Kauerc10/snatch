from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
import re

ROOT = Path(__file__).resolve().parents[1]


def mount(page, onboarded=True):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', html)
    html = re.sub(r'<script>window\.SnatchRisk\.install\(window\.SnatchCore\);</script>', '', html)
    html = re.sub(r'<link[^>]+href="\.\/(styles|v02)\.css"[^>]*>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'styles.css').read_text(encoding='utf-8'))
    page.add_style_tag(content=(ROOT / 'v02.css').read_text(encoding='utf-8'))
    for script in [ROOT / 'src/core.js', ROOT / 'src/risk.js']:
        page.add_script_tag(content=script.read_text(encoding='utf-8'))
    page.evaluate('SnatchRisk.install(SnatchCore)')
    page.add_script_tag(content=(ROOT / 'src/input.js').read_text(encoding='utf-8'))
    entries = [['snatch.onboarded', '1']] if onboarded else []
    page.add_script_tag(content=f"""Object.defineProperty(window, 'localStorage', {{ value: (() => {{ const m = new Map({entries}); return {{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}}; }})(), configurable: true }});""")
    page.add_script_tag(content=(ROOT / 'app.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(ROOT / 'polish.js').read_text(encoding='utf-8'))


def miss(page):
    box = page.locator('#game-canvas').bounding_box()
    page.mouse.move(box['x'] + box['width'] * .12, box['y'] + box['height'] * .72)
    page.mouse.down()
    page.mouse.move(box['x'] + box['width'] * .14, box['y'] + box['height'] * .80)
    page.mouse.up()
    page.wait_for_timeout(20)


def test_ranked_daily_is_reserved_at_start():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        mount(page, onboarded=True)
        date_id = page.evaluate("new Date().toISOString().slice(0,10)")
        key = f'snatch.daily.{date_id}'
        assert page.evaluate('(k) => localStorage.getItem(k)', key) is None
        page.locator('#daily-btn').click()
        assert page.evaluate('(k) => localStorage.getItem(k)', key) == '1'
        browser.close()


def test_daily_keeps_start_date_across_utc_midnight():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.clock.install(time=datetime(2026, 8, 25, 23, 59, 59, tzinfo=timezone.utc))
        mount(page, onboarded=True)
        old_date = '2026-08-25'
        new_date = '2026-08-26'
        old_day = page.evaluate("Math.floor((Date.parse('2026-08-25T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1")
        page.locator('#daily-btn').click()
        page.clock.fast_forward(61000)
        assert page.locator('#result-modal').get_attribute('aria-hidden') == 'false'
        share = page.locator('#share-grid').inner_text()
        assert share.startswith(f'SNATCH #{old_day}'), share
        assert page.evaluate('(k) => localStorage.getItem(k)', f'snatch.daily.{old_date}') == '1'
        assert page.evaluate('(k) => localStorage.getItem(k)', f'snatch.daily.{new_date}') is None
        browser.close()


def test_collision_matches_visible_9_by_16_radius():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        mount(page, onboarded=True)
        miss_case = page.evaluate("SnatchCore.segmentCircleHit({x:.1,y:.5},{x:.9,y:.5},{x:.5,y:.54},.048)")
        hit_case = page.evaluate("SnatchCore.segmentCircleHit({x:.1,y:.5},{x:.9,y:.5},{x:.5,y:.525},.048)")
        assert miss_case is False
        assert hit_case is True
        browser.close()


def test_late_bust_still_reaches_round_end():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.clock.install(time=datetime(2026, 8, 25, 12, 0, 0, tzinfo=timezone.utc))
        mount(page, onboarded=True)
        page.locator('#daily-btn').click()
        for _ in range(12):
            miss(page)
        assert page.locator('#heat-value').inner_text() == '96'
        page.clock.fast_forward(58500)
        miss(page)
        assert page.locator('#lockdown').get_attribute('aria-hidden') == 'false'
        page.clock.fast_forward(2500)
        assert page.locator('#result-modal').get_attribute('aria-hidden') == 'false'
        browser.close()


if __name__ == '__main__':
    test_ranked_daily_is_reserved_at_start()
    test_daily_keeps_start_date_across_utc_midnight()
    test_collision_matches_visible_9_by_16_radius()
    test_late_bust_still_reaches_round_end()
    print('review regressions: PASS')
