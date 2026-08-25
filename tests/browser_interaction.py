from playwright.sync_api import sync_playwright
from browser_helpers import mount, money, candidate_shot, fire_drag


def test_physical_grab_settles_before_scoring_then_cashout_banks():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.clock.install()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        mount(page)
        page.locator('#daily-btn').click()
        page.clock.fast_forward(2400)
        elapsed = 2400
        candidate = candidate_shot(page, elapsed, want_hit=True)
        assert candidate is not None, 'expected at least one stable deterministic hit direction'

        fire_drag(page, candidate['drag'])
        page.clock.fast_forward(80)
        assert money(page, '#bag') == 0, 'loot must not score before the claw returns to base'
        page.clock.fast_forward(int(candidate['settleAtMs'] + 180))

        bag = money(page, '#bag')
        assert bag > 0, 'expected physical claw delivery to add loot to BAG'
        assert page.locator('#bag-tray .bag-chip').count() >= 1

        cash = page.locator('#cashout-btn').bounding_box()
        page.mouse.move(cash['x'] + cash['width']/2, cash['y'] + cash['height']/2)
        page.mouse.down()
        page.clock.fast_forward(760)
        page.mouse.up()
        page.clock.fast_forward(150)

        assert money(page, '#banked') > 0
        assert money(page, '#bag') == 0
        assert page.locator('#bag-tray .bag-chip').count() == 0
        assert errors == [], errors
        browser.close()


if __name__ == '__main__':
    test_physical_grab_settles_before_scoring_then_cashout_banks()
    print('browser physical claw interaction: PASS')
