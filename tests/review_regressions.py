from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from browser_helpers import mount, candidate_shot, fire_drag


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
        assert page.locator('#share-grid').inner_text().startswith(f'SNATCH #{old_day}')
        assert page.evaluate('(k) => localStorage.getItem(k)', f'snatch.daily.{old_date}') == '1'
        assert page.evaluate('(k) => localStorage.getItem(k)', f'snatch.daily.{new_date}') is None
        browser.close()


def test_collision_matches_visible_9_by_16_radius():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        mount(page, onboarded=True)
        miss_case = page.evaluate("SnatchCore.segmentCircleHit({x:.1,y:.5},{x:.9,y:.5},{x:.5,y:.52},.03)")
        hit_case = page.evaluate("SnatchCore.segmentCircleHit({x:.1,y:.5},{x:.9,y:.5},{x:.5,y:.515},.03)")
        assert miss_case is False
        assert hit_case is True
        browser.close()


def test_late_bust_still_reaches_round_end():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.clock.install(time=datetime(2026, 8, 25, 12, 0, 0, tzinfo=timezone.utc))
        mount(page, onboarded=True)
        started = page.evaluate('performance.now()')
        page.locator('#daily-btn').click()

        # Build 96 HEAT using physical misses. Fast-forward each resolved shot instead of sleeping in wall time.
        for _ in range(12):
            elapsed = page.evaluate('(t) => performance.now() - t', started)
            candidate = candidate_shot(page, elapsed, want_hit=False)
            assert candidate is not None
            fire_drag(page, candidate['drag'])
            page.clock.fast_forward(int(candidate['settleAtMs'] + 40))
        assert page.locator('#heat-value').inner_text() == '96'

        # Approach the end while leaving enough time to commit one final miss.
        current_elapsed = page.evaluate('(t) => performance.now() - t', started)
        page.clock.fast_forward(int(max(0, 58900 - current_elapsed)))
        elapsed = page.evaluate('(t) => performance.now() - t', started)
        candidate = candidate_shot(page, elapsed, want_hit=False)
        assert candidate is not None
        fire_drag(page, candidate['drag'])
        page.clock.fast_forward(int(candidate['settleAtMs'] + 80))
        assert page.locator('#lockdown').get_attribute('aria-hidden') == 'false'
        page.clock.fast_forward(2000)
        assert page.locator('#result-modal').get_attribute('aria-hidden') == 'false'
        browser.close()


if __name__ == '__main__':
    test_ranked_daily_is_reserved_at_start()
    test_daily_keeps_start_date_across_utc_midnight()
    test_collision_matches_visible_9_by_16_radius()
    test_late_bust_still_reaches_round_end()
    print('review regressions: PASS')
