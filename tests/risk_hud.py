from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT = Path(__file__).resolve().parents[1]

def mount(page):
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
    page.add_script_tag(content="""Object.defineProperty(window, 'localStorage', { value: (() => { const m = new Map(); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}; })(), configurable: true });""")
    page.add_script_tag(content=(ROOT / 'app.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(ROOT / 'polish.js').read_text(encoding='utf-8'))

def test_heat_hud_exposes_risk_tier_and_bonus():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        mount(page)
        page.locator('#daily-btn').click()
        box = page.locator('#game-canvas').bounding_box()
        for _ in range(9):
            page.mouse.move(box['x'] + box['width'] * .18, box['y'] + box['height'] * .72)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] * .25, box['y'] + box['height'] * .78)
            page.mouse.up()
        page.wait_for_timeout(100)
        assert page.locator('#arena').get_attribute('data-heat') == 'hot'
        assert page.locator('#heat-status').inner_text() == 'HOT'
        assert page.locator('#risk-bonus').inner_text() == 'RISK PAYOUT +10%'
        browser.close()

if __name__ == '__main__':
    test_heat_hud_exposes_risk_tier_and_bonus()
    print('risk hud: PASS')
