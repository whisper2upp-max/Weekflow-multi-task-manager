"""Regression coverage for backward rich-text selections.

Run through scripts/with_server.py so the test uses the shipped Weekflow page.
"""

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
STORAGE_KEY = "weekflow-v2.4:data:v4"


DATA = {
    "version": 4,
    "groups": [
        {
            "id": "g1",
            "name": "Regression Group",
            "color": "#665CFF",
            "order": 1,
            "collapsed": False,
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
    ],
    "flows": [],
    "tasks": [
        {
            "id": "t1",
            "groupId": "g1",
            "flowId": None,
            "flowOrder": None,
            "name": "Reverse selection regression",
            "reportTo": "Lucy Chen",
            "managedObject": "Jack Wang",
            "deliverable": "Regression result",
            "ddl": "2026-08-20",
            "urgency": "medium",
            "status": "pending",
            "completedAt": None,
            "recurrenceCadence": "none",
            "recurrenceStart": None,
            "recurrenceEnd": None,
            "recurrenceCompletions": [],
            "progressNote": "",
            "progressUpdatedAt": None,
            "progressEntries": [],
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
    ],
    "materials": [],
    "notes": [],
    "preferences": {
        "documentLibrary": {
            "layout": "list",
            "columns": 4,
            "groupOrder": ["g1", "__ungrouped__"],
        }
    },
}


def set_multiline_html(page, selector):
    page.locator(selector).evaluate(
        """node => {
          node.innerHTML = '<div>First line</div><div>Second line</div><div>Third line</div>';
          node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }"""
    )


def select_all_backwards_and_release_outside(page, selector):
    """Create a backward selection ending immediately before the editor."""
    selected = page.locator(selector).evaluate(
        """node => {
          const textNodes = [];
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) textNodes.push(walker.currentNode);
          const last = textNodes[textNodes.length - 1];
          const parent = node.parentNode;
          const editorIndex = Array.prototype.indexOf.call(parent.childNodes, node);
          node.focus();
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.setBaseAndExtent(last, last.data.length, parent, editorIndex);
          parent.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          return selection.toString();
        }"""
    )
    assert "First line" in selected, selected
    assert "Third line" in selected, selected


def assert_selection_is_backward(page):
    assert page.evaluate(
        """() => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) return false;
          const probe = document.createRange();
          probe.setStart(selection.anchorNode, selection.anchorOffset);
          probe.setEnd(selection.focusNode, selection.focusOffset);
          return probe.collapsed;
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
    page.locator("#note-title").fill("Backward selection")
    set_multiline_html(page, "#note-editor")
    select_all_backwards_and_release_outside(page, "#note-editor")
    assert_selection_is_backward(page)
    page.locator(
        '[data-action="rich-command"][data-command="bold"][data-editor="note-editor"]'
    ).click()
    note_html = page.locator("#note-editor").inner_html().lower()
    assert "<b" in note_html or "<strong" in note_html, note_html

    select_all_backwards_and_release_outside(page, "#note-editor")
    page.locator(
        '[data-action="toggle-color-palette"][data-editor="note-editor"][data-color-mode="text"]'
    ).click()
    page.locator(
        '[data-action="apply-preset-color"][data-editor="note-editor"][data-color-value="#2563EB"]'
    ).click()
    note_html = page.locator("#note-editor").inner_html().lower().replace(" ", "")
    assert "color:#2563eb" in note_html or 'color="#2563eb"' in note_html, note_html

    select_all_backwards_and_release_outside(page, "#note-editor")
    page.locator('[data-font-size][data-editor="note-editor"]').select_option("18")
    note_html = page.locator("#note-editor").inner_html().lower().replace(" ", "")
    assert "font-size:18px" in note_html, note_html

    page.get_by_role("button", name="Save Note", exact=True).click()
    saved_note_html = page.evaluate(
        "() => JSON.parse(localStorage.getItem('weekflow-v2.4:data:v4')).notes[0].contentHtml"
    ).lower().replace(" ", "")
    assert "font-size:18px" in saved_note_html, saved_note_html

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.locator('[data-task-id="t1"] .progress-button').dblclick()
    page.locator('[data-action="new-progress-entry"]').click()
    set_multiline_html(page, "#progress-note")
    select_all_backwards_and_release_outside(page, "#progress-note")
    assert_selection_is_backward(page)
    page.locator(
        '[data-action="rich-command"][data-command="italic"][data-editor="progress-note"]'
    ).click()
    progress_html = page.locator("#progress-note").inner_html().lower()
    assert "<i" in progress_html or "<em" in progress_html, progress_html

    select_all_backwards_and_release_outside(page, "#progress-note")
    page.locator(
        '[data-action="toggle-color-palette"][data-editor="progress-note"][data-color-mode="highlight"]'
    ).click()
    page.locator(
        '[data-action="apply-preset-color"][data-editor="progress-note"][data-color-value="#FFF1A8"]'
    ).click()
    progress_html = page.locator("#progress-note").inner_html().lower().replace(" ", "")
    assert (
        "background-color:#fff1a8" in progress_html
        or "background-color:rgb(255,241,168)" in progress_html
    ), progress_html

    select_all_backwards_and_release_outside(page, "#progress-note")
    page.locator('[data-font-size][data-editor="progress-note"]').select_option("22")
    progress_html = page.locator("#progress-note").inner_html().lower().replace(" ", "")
    assert "font-size:22px" in progress_html, progress_html
    page.get_by_role("button", name="Save Progress", exact=True).click()
    saved_progress_html = page.evaluate(
        """() => {
          const task = JSON.parse(localStorage.getItem('weekflow-v2.4:data:v4')).tasks.find(item => item.id === 't1');
          return task.progressEntries[0].contentHtml;
        }"""
    ).lower().replace(" ", "")
    assert "font-size:22px" in saved_progress_html, saved_progress_html

    assert not errors, errors
    browser.close()

print("RICH_TEXT_REVERSE_SELECTION_OK")
