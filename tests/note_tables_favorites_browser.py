"""Browser regression for Quick Note tables and Favorites.

Run through scripts/with_server.py so the test uses the shipped Weekflow page.
"""

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
STORAGE_KEY = "weekflow-v2.4:data:v4"


DATA = {
    "version": 4,
    "groups": [],
    "flows": [],
    "tasks": [],
    "materials": [],
    "notes": [],
    "preferences": {
        "documentLibrary": {
            "layout": "list",
            "columns": 4,
            "groupOrder": ["__ungrouped__"],
        }
    },
}


EXCEL_HTML = """
<html><body>
  <table style="border-collapse:collapse" onclick="alert('unsafe')">
    <tr><td rowspan="2" style="background-color:#FFF1A8">Owner</td><td colspan="2">Status</td></tr>
    <tr><td>Open</td><td>Closed</td></tr>
  </table>
  <script>alert('unsafe')</script>
</body></html>
"""


def stored(page):
    return page.evaluate(
        "key => JSON.parse(localStorage.getItem(key))",
        STORAGE_KEY,
    )


def put_caret_at_end(page, selector):
    page.locator(selector).evaluate(
        """node => {
          node.focus();
          const range = document.createRange();
          range.selectNodeContents(node);
          range.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
        }"""
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1600, "height": 960})
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(BASE_URL)
    page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v4', JSON.stringify(payload))", DATA)
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.reload()
    page.wait_for_load_state("networkidle")

    page.get_by_role("button", name="Quick Notes", exact=True).click()
    page.get_by_role("button", name="New Note", exact=True).first.click()
    page.locator("#note-title").fill("Table planning note")
    page.locator("#note-editor").click()

    table_trigger = page.locator('[data-action="toggle-note-table-menu"]')
    table_trigger.click()
    assert page.locator("#note-table-menu").is_visible()
    assert page.locator("#note-table-size-grid .note-table-size-cell").count() == 80
    page.screenshot(path="/tmp/weekflow-note-table-menu.png", full_page=False)
    page.locator(
        '#note-table-size-grid [data-action="insert-note-table"][data-rows="2"][data-columns="2"]'
    ).click()
    created = page.locator("#note-editor table").first
    assert created.locator("tr").count() == 2
    assert created.locator("td").count() == 4

    created.locator("td").nth(0).fill("Merged heading")
    created.locator("td").nth(1).fill("Second heading")
    created.locator("td").nth(0).click()
    created.locator("td").nth(1).click(modifiers=["Shift"])
    assert created.locator(".is-table-selected").count() == 2
    table_trigger.click()
    merge_button = page.locator(
        '[data-action="edit-note-table"][data-table-operation="merge-cells"]'
    )
    assert merge_button.is_enabled()
    merge_button.click()
    assert created.locator('td[colspan="2"]').count() == 1
    assert "Merged heading" in created.locator('td[colspan="2"]').inner_text()
    assert "Second heading" in created.locator('td[colspan="2"]').inner_text()

    created.locator('td[colspan="2"]').click()
    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="insert-row"]'
    ).click()
    assert created.locator("tr").count() == 3

    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="insert-column"]'
    ).click()
    assert created.locator("tr").nth(1).locator("td, th").count() == 3

    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="delete-column"]'
    ).click()
    assert created.locator("tr").nth(1).locator("td, th").count() == 2

    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="delete-row"]'
    ).click()
    assert created.locator("tr").count() == 2

    put_caret_at_end(page, "#note-editor")
    paste_result = page.locator("#note-editor").evaluate(
        r"""(node, html) => {
          const transfer = new DataTransfer();
          transfer.setData('text/html', html);
          transfer.setData('text/plain', 'Owner\tStatus\t\n\tOpen\tClosed');
          const event = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer
          });
          return { dispatched: node.dispatchEvent(event), prevented: event.defaultPrevented };
        }""",
        EXCEL_HTML,
    )
    assert paste_result["prevented"] is True
    assert page.locator("#note-editor table").count() == 2
    pasted = page.locator("#note-editor table").nth(1)
    assert pasted.locator('td[rowspan="2"]').count() == 1
    assert pasted.locator('td[colspan="2"]').count() == 1
    assert page.locator("#note-editor script").count() == 0
    assert page.locator("#note-editor [onclick]").count() == 0

    pasted.locator('td[rowspan="2"]').click()
    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="insert-row"]'
    ).click()
    assert pasted.locator("tr").count() == 3
    assert pasted.locator('td[rowspan="3"]').count() == 1
    table_trigger.click()
    page.locator(
        '[data-action="edit-note-table"][data-table-operation="delete-row"]'
    ).click()
    assert pasted.locator("tr").count() == 2
    assert pasted.locator('td[rowspan="2"]').count() == 1

    page.get_by_role("button", name="Save Note", exact=True).click()
    page.locator("#note-favorite-toggle").click()
    saved = stored(page)
    assert len(saved["notes"]) == 1
    assert saved["notes"][0]["favorite"] is True
    assert 'rowspan="2"' in saved["notes"][0]["contentHtml"]
    assert 'colspan="2"' in saved["notes"][0]["contentHtml"]

    page.get_by_role("button", name="New Note", exact=True).first.click()
    page.locator("#note-title").fill("Ordinary note")
    page.locator("#note-editor").fill("Not starred")
    page.get_by_role("button", name="Save Note", exact=True).click()
    page.locator('#note-filter-favorites').click()
    assert page.locator("#note-list .note-list-item").count() == 1
    assert page.locator("#note-list .note-list-item strong").inner_text() == "Table planning note"
    assert page.locator("#note-favorite-count").inner_text() == "1"

    pasted = page.locator("#note-editor table").nth(1)
    clipboard = pasted.evaluate(
        """table => {
          const range = document.createRange();
          range.selectNode(table);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          const transfer = new DataTransfer();
          const event = new ClipboardEvent('copy', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer
          });
          table.closest('[contenteditable="true"]').dispatchEvent(event);
          return {
            html: transfer.getData('text/html'),
            text: transfer.getData('text/plain'),
            prevented: event.defaultPrevented
          };
        }"""
    )
    assert clipboard["prevented"] is True
    assert "<table" in clipboard["html"].lower()
    assert 'rowspan="2"' in clipboard["html"].lower()
    assert 'colspan="2"' in clipboard["html"].lower()
    assert "Owner" in clipboard["text"] and "Status" in clipboard["text"]

    merge_count = page.evaluate(
        """html => {
          const template = document.createElement('template');
          template.innerHTML = html;
          const worksheet = XLSX.utils.table_to_sheet(template.content.querySelector('table'));
          return (worksheet['!merges'] || []).length;
        }""",
        clipboard["html"],
    )
    assert merge_count == 2

    page.locator('[data-language="zh-CN"]').click()
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="随手记", exact=True).click()
    assert "收藏夹" in page.locator("#note-filter-favorites").inner_text()
    assert page.locator("#note-favorite-count").inner_text() == "1"
    assert page.locator('[data-action="toggle-note-table-menu"]').get_attribute("aria-label") == "表格工具"

    page.screenshot(path="/tmp/weekflow-note-tables-favorites.png", full_page=False)
    assert not errors, errors
    browser.close()
