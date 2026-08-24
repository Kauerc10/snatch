from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT = Path(__file__).resolve().parents[1]

def mount(page):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', html)
    html = re.sub(r'<link[^>]+href="\.\/styles\.css"[^>]*>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'styles.css').read_text(encoding='utf-8'))
    for script in [ROOT / 'src/core.js', ROOT / 'src/input.js']:
        page.add_script_tag(content=script.read_text(encoding='utf-8'))
    page.add_script_tag(content="""Object.defineProperty(window, 'localStorage', { value: (() => { const m = new Map(); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}; })(), configurable: true });""")
    page.add_script_tag(content=(ROOT / 'app.js').read_text(encoding='utf-8'))

def test_grab_and_cashout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        mount(page)
        page.locator('#daily-btn').click()
        page.wait_for_timeout(3600)

        target = page.evaluate('''() => {
          const c = SnatchCore.buildChallenge('training', 'onboarding-v1');
          const elapsed = 3600;
          const visible = c.spawns.map(s => ({s, p: SnatchCore.targetPosition(s, elapsed)}))
            .filter(x => x.s.atMs <= elapsed && x.p.x > 0.10 && x.p.x < 0.90)
            .sort((a,b) => b.p.y - a.p.y);
          return visible[0] ? visible[0].p : null;
        }''')
        assert target is not None

        box = page.locator('#game-canvas').bounding_box()
        claw = {'x': 0.5, 'y': 0.885}
        dx = target['x'] - claw['x']
        dy = target['y'] - claw['y']
        length = (dx*dx + dy*dy) ** 0.5
        ux, uy = dx/length, dy/length
        drag_x = max(0.02, min(0.98, claw['x'] - ux * 0.07))
        drag_y = max(0.02, min(0.98, claw['y'] - uy * 0.07))
        px = box['x'] + drag_x * box['width']
        py = box['y'] + drag_y * box['height']
        # Start on an unobstructed canvas area so pointer capture belongs to the canvas,
        # then drag into the slingshot position even if it overlaps the Cash Out control.
        page.mouse.move(box['x'] + box['width'] * 0.18, box['y'] + box['height'] * 0.70)
        page.mouse.down()
        page.mouse.move(px, py, steps=4)
        page.mouse.up()
        page.wait_for_timeout(250)

        bag_text = page.locator('#bag').inner_text()
        bag = int(bag_text.replace('$','').replace(',',''))
        assert bag > 0, f'expected a successful grab, got {bag_text}'

        cash = page.locator('#cashout-btn').bounding_box()
        page.mouse.move(cash['x'] + cash['width']/2, cash['y'] + cash['height']/2)
        page.mouse.down()
        page.wait_for_timeout(760)
        page.mouse.up()
        page.wait_for_timeout(120)

        banked_text = page.locator('#banked').inner_text()
        banked = int(banked_text.replace('$','').replace(',',''))
        bag_after = int(page.locator('#bag').inner_text().replace('$','').replace(',',''))
        assert banked > 0
        assert bag_after == 0
        browser.close()

if __name__ == '__main__':
    test_grab_and_cashout()
    print('browser interaction: PASS')
