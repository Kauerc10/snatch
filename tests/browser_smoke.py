from playwright.sync_api import sync_playwright
from browser_helpers import mount


def test_browser_smoke():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        mount(page)
        assert page.title() == 'SNATCH! | The Claw Update'
        assert page.get_by_role('heading', name='SNATCH!').is_visible()
        page.get_by_role('button', name='FREE RUN').click()
        assert page.locator('#game-screen').get_attribute('aria-hidden') == 'false'
        assert page.locator('#game-canvas').is_visible()
        assert page.locator('#timer').inner_text().endswith('s')
        assert page.locator('#cashout-btn').is_visible()
        assert errors == [], errors
        browser.close()


if __name__ == '__main__':
    test_browser_smoke()
    print('browser smoke: PASS')
