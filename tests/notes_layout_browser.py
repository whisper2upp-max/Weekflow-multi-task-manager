"""Isolated layout regression; smaller CSS viewports cover desktop browser zoom."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('WEEKFLOW_TEST_URL', 'http://127.0.0.1:8765/Weekflow.html')


def check_footer(page):
    result = page.evaluate('''() => {
      const r = n => { const b = n.getBoundingClientRect(); return {x:b.x, y:b.y, right:b.right, bottom:b.bottom, height:b.height}; };
      return { width:innerWidth, height:innerHeight, pageHeight:document.documentElement.scrollHeight,
        footer:r(document.querySelector('.note-actions')),
        controls:Array.from(document.querySelectorAll('.note-actions button,.note-actions label')).filter(n => n.getClientRects().length).map(r) };
    }''')
    assert result['pageHeight'] <= result['height'] + 1, result
    for rect in [result['footer'], *result['controls']]:
        assert rect['y'] >= 0 and rect['bottom'] <= result['height'] + 1, result
        assert rect['x'] >= 0 and rect['right'] <= result['width'] + 1, result
    return result['footer']


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        for language in ['zh-CN', 'en']:
            context = browser.new_context(viewport={'width': 1280, 'height': 720})
            page = context.new_page()
            page.set_default_timeout(5000)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(URL)
            page.evaluate("language => localStorage.setItem('weekflow-v2.4:language', language)", language)
            page.reload()
            reminder = page.locator('[data-action="close-ddl-reminder"]')
            if reminder.is_visible():
                reminder.click()
            page.locator('nav [data-view="notes"]').click()
            page.locator('.notes-toolbar [data-action="new-note"]').click()
            page.locator('#note-title').fill('Layout regression')
            content = '\n'.join('Line %d: editable content keeps its original font size.' % n for n in range(160))
            page.locator('#note-editor').fill(content)
            for width, height in [(1440, 900), (1280, 720), (1024, 600), (960, 540), (800, 450), (640, 400), (512, 320)]:
                page.set_viewport_size({'width': width, 'height': height})
                print(language, width, height, flush=True)
                initial = check_footer(page)
                page.locator('#note-editor').evaluate('(n) => { n.scrollTop = n.scrollHeight; }')
                assert check_footer(page) == initial
                assert page.locator('#note-editor').evaluate('(n) => getComputedStyle(n).fontSize') == '14px'
                assert page.locator('#note-editor').evaluate('(n) => n.scrollTop > 0')
                # Clicking Save must not require scrolling the page to reveal the footer.
                page.locator('#note-save-button').click()
                check_footer(page)
                assert page.evaluate("JSON.parse(localStorage.getItem('weekflow-v2.4:data:v4')).notes[0].contentText").strip() == content
            # Long conversion metadata and the optional AI comparison also stay above the footer.
            page.evaluate('''() => {
              const summary = document.querySelector('#note-conversion-summary');
              summary.hidden = false; summary.textContent = 'Saved conversions '.repeat(80);
              document.querySelector('#note-editor-shell').classList.add('is-comparing');
              document.querySelector('#note-ai-original-panel').hidden = false;
              document.querySelector('#note-ai-original-content').textContent = 'Original text\\n'.repeat(200);
            }''')
            check_footer(page)
            page.set_viewport_size({'width': 960, 'height': 540})
            check_footer(page)
            page.screenshot(path='/tmp/weekflow-notes-layout-' + language + '.png')
            page.reload()
            reminder = page.locator('[data-action="close-ddl-reminder"]')
            if reminder.is_visible():
                reminder.click()
            page.locator('nav [data-view="notes"]').click()
            page.locator('.note-list-item').first.click()
            check_footer(page)
            assert page.locator('#note-editor').inner_text().strip() == content
            page.locator('nav [data-view="home"]').click()
            assert page.evaluate("getComputedStyle(document.querySelector('.app-shell')).display") != 'grid'
            assert not errors, errors
            context.close()
        print('PASS: note footer visible at 7 window/zoom-equivalent sizes in both languages; editor scroll, Save/reload, comparison/metadata, and leaving Notes.')
    finally:
        browser.close()
