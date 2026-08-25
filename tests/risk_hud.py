from playwright.sync_api import sync_playwright
from browser_helpers import mount, candidate_shot, fire_drag


def test_heat_hud_exposes_risk_tier_and_bonus_after_physical_misses():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.clock.install()
        mount(page)
        started = page.evaluate('performance.now()')
        page.locator('#daily-btn').click()

        for _ in range(9):
            elapsed = page.evaluate('(t) => performance.now() - t', started)
            candidate = candidate_shot(page, elapsed, want_hit=False)
            assert candidate is not None, 'expected a deterministic miss direction'
            fire_drag(page, candidate['drag'])
            page.clock.fast_forward(int(candidate['settleAtMs'] + 60))

        assert page.locator('#arena').get_attribute('data-heat') == 'hot'
        assert page.locator('#heat-status').inner_text() == 'HOT'
        assert page.locator('#risk-bonus').inner_text() == 'RISK PAYOUT +10%'
        browser.close()


if __name__ == '__main__':
    test_heat_hud_exposes_risk_tier_and_bonus_after_physical_misses()
    print('risk hud: PASS')
