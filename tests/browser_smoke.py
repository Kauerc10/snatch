from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def test_browser_smoke():
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8") if html_path.exists() else "<html><body></body></html>"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.set_content(html)
        css = ROOT / "styles.css"
        if css.exists(): page.add_style_tag(content=css.read_text(encoding="utf-8"))
        for script in [ROOT / "src/core.js", ROOT / "src/input.js", ROOT / "app.js"]:
            if script.exists(): page.add_script_tag(content=script.read_text(encoding="utf-8"))
        assert page.get_by_role("heading", name="SNATCH!").is_visible()
        page.get_by_role("button", name="FREE RUN").click()
        assert page.locator("#game-screen").get_attribute("aria-hidden") == "false"
        assert page.locator("#game-canvas").is_visible()
        assert page.locator("#timer").inner_text().endswith("s")
        assert page.locator("#cashout-btn").is_visible()
        browser.close()

if __name__ == "__main__":
    test_browser_smoke()
    print("browser smoke: PASS")
