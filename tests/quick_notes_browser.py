from pathlib import Path
import json

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
STORAGE_KEY = "weekflow-v2.4:data:v4"


DATA = {
    "version": 4,
    "groups": [
        {
            "id": "g1",
            "name": "Service Development",
            "color": "#665CFF",
            "order": 1,
            "collapsed": False,
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
    ],
    "flows": [
        {
            "id": "f1",
            "groupId": "g1",
            "name": "Personal Development",
            "color": "#665CFF",
            "order": 1,
            "collapsed": False,
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
    ],
    "tasks": [
        {
            "id": "t1",
            "groupId": "g1",
            "flowId": "f1",
            "flowOrder": 1,
            "name": "Existing Browser Task",
            "reportTo": "Lucy Chen",
            "managedObject": "Jack Wang",
            "deliverable": "Existing deliverable",
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
    "materials": [
        {
            "id": "m-unlinked",
            "title": "Unlinked browser document",
            "url": "https://example.com/unlinked-browser-document",
            "type": "document",
            "taskIds": [],
            "flowIds": [],
            "groupIds": [],
            "note": "Must remain in a complete JSON backup",
            "openEvents": [],
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
        }
    ],
    "notes": [],
    "preferences": {
        "documentLibrary": {
            "layout": "list",
            "columns": 4,
            "groupOrder": ["g1", "__ungrouped__"],
        }
    },
}


TASK_DRAFT_NOTE = """1. Task: Browser Draft A
- Group: Service Development
- Flow: Personal Development
- DDL: 2026-08-20
- Urgency: High
- Report To: Lucy Chen
- Managed Person: Jack Wang
- Deliverable: Browser output A

2. Task: Browser Draft B
- Group: Service Development
- Flow: Personal Development
- DDL: 2026-08-21
- Urgency: Medium
- Report To: Lucy Chen
- Managed Person: Jack Wang
- Deliverable: Browser output B"""


def stored(page):
    return page.evaluate(
        "key => JSON.parse(localStorage.getItem(key))",
        STORAGE_KEY,
    )


def set_editor_html(page, selector, html):
    page.locator(selector).evaluate(
        """(node, value) => {
          node.innerHTML = value;
          node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }""",
        html,
    )


def select_editor_contents(page, selector):
    page.locator(selector).evaluate(
        """node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
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
    assert page.get_by_role("heading", name="Quick Notes", exact=True).is_visible()
    page.get_by_role("button", name="New Note", exact=True).first.click()
    page.locator("#note-title").fill("Browser release note")
    editor = page.locator("#note-editor")
    editor.fill("Release status https://contoso.sharepoint.com/sites/weekflow")
    select_editor_contents(page, "#note-editor")
    page.locator('[data-action="rich-command"][data-command="bold"][data-editor="note-editor"]').click()
    assert any(tag in editor.inner_html().lower() for tag in ("<b", "<strong")), editor.inner_html()

    note_toolbar = page.locator("#notes-view .rich-text-toolbar")
    assert note_toolbar.locator('input[type="color"]').count() == 0
    select_editor_contents(page, "#note-editor")
    note_text_trigger = note_toolbar.locator(
        '[data-action="toggle-color-palette"][data-color-mode="text"]'
    )
    note_text_trigger.click()
    note_text_palette = note_toolbar.locator('[data-color-palette][data-color-mode="text"]')
    assert note_text_palette.is_visible()
    assert note_text_palette.locator(".preset-color-swatch").count() == 20
    page.screenshot(path="/tmp/weekflow-v3.2-note-color-palette.png", full_page=False)
    note_text_palette.locator('[data-color-value="#2563EB"]').click()
    assert not note_text_palette.is_visible()

    select_editor_contents(page, "#note-editor")
    note_highlight_trigger = note_toolbar.locator(
        '[data-action="toggle-color-palette"][data-color-mode="highlight"]'
    )
    note_highlight_trigger.click()
    note_highlight_palette = note_toolbar.locator(
        '[data-color-palette][data-color-mode="highlight"]'
    )
    assert note_highlight_palette.is_visible()
    assert note_highlight_palette.locator(".preset-color-swatch").count() == 20
    page.locator("#note-title").click()
    assert not note_highlight_palette.is_visible()
    select_editor_contents(page, "#note-editor")
    note_highlight_trigger.click()
    note_highlight_palette.locator('[data-color-value="#FFF1A8"]').click()
    formatted_note_html = editor.inner_html().lower().replace(" ", "")
    assert "<fontcolor=" in formatted_note_html or "style=\"color:" in formatted_note_html, formatted_note_html
    assert "background-color:" in formatted_note_html, formatted_note_html
    page.get_by_role("button", name="Save Note", exact=True).click()

    saved = stored(page)
    assert len(saved["notes"]) == 1, saved["notes"]
    assert "sharepoint.com" in saved["notes"][0]["contentText"]
    assert any(tag in saved["notes"][0]["contentHtml"].lower() for tag in ("<b", "<strong"))

    page.get_by_role("button", name="Add to Progress History", exact=True).click()
    progress_dialog = page.locator("#note-progress-dialog")
    assert progress_dialog.is_visible()
    assert progress_dialog.locator("#note-progress-group").input_value() == "g1"
    progress_dialog.locator("#note-progress-flow").select_option("f1")
    assert progress_dialog.locator("#note-progress-task").input_value() == "t1"
    progress_dialog.get_by_role("button", name="Add Record", exact=True).click()

    saved = stored(page)
    task = next(item for item in saved["tasks"] if item["id"] == "t1")
    assert len(task["progressEntries"]) == 1
    assert task["progressEntries"][0]["sourceType"] == "quick-note"
    assert task["progressEntries"][0]["sourceNoteId"] == saved["notes"][0]["id"]

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.locator('[data-task-id="t1"] .progress-button').dblclick()
    assert page.locator("#progress-dialog").is_visible()
    assert page.locator("#progress-entry-list .progress-entry-item").count() == 1
    assert "From Quick Notes" in page.locator("#progress-dialog-updated").inner_text()
    page.locator('[data-action="new-progress-entry"]').click()
    set_editor_html(page, "#progress-note", "<p><i>Manual browser progress</i></p>")
    progress_toolbar = page.locator("#progress-dialog .rich-text-toolbar")
    assert progress_toolbar.locator('input[type="color"]').count() == 0
    select_editor_contents(page, "#progress-note")
    progress_text_trigger = progress_toolbar.locator(
        '[data-action="toggle-color-palette"][data-color-mode="text"]'
    )
    progress_text_trigger.click()
    progress_text_palette = progress_toolbar.locator(
        '[data-color-palette][data-color-mode="text"]'
    )
    assert progress_text_palette.locator(".preset-color-swatch").count() == 20
    progress_text_palette.locator('[data-color-value="#9333EA"]').click()
    progress_html = page.locator("#progress-note").inner_html().lower().replace(" ", "")
    assert "<fontcolor=" in progress_html or "style=\"color:" in progress_html, progress_html
    page.get_by_role("button", name="Save Progress", exact=True).click()

    saved = stored(page)
    task = next(item for item in saved["tasks"] if item["id"] == "t1")
    assert len(task["progressEntries"]) == 2
    assert task["progressEntries"][0]["contentText"] or task["progressEntries"][1]["contentText"]
    page.locator('[data-task-id="t1"] .progress-button').dblclick()
    assert page.locator("#progress-entry-list .progress-entry-item").count() == 2
    assert "Manual browser progress" in page.locator("#progress-note").inner_text()
    page.screenshot(path="/tmp/weekflow-v3.2-progress-history-en.png", full_page=False)
    page.locator('[data-action="close-progress-dialog"]').last.click()

    page.get_by_role("button", name="Quick Notes", exact=True).click()
    page.locator("#note-title").fill("Three Task candidates")
    set_editor_html(page, "#note-editor", "<p>" + TASK_DRAFT_NOTE.replace("\n", "<br>") + "</p>")
    page.get_by_role("button", name="Save Note", exact=True).click()
    page.get_by_role("button", name="Convert to Task Drafts", exact=True).click()

    task_dialog = page.locator("#task-dialog")
    assert task_dialog.is_visible()
    assert page.locator("#task-draft-position").inner_text() == "Detected 2 potential Tasks · Editing 1"
    assert page.locator("#task-name").input_value() == "Browser Draft A"
    assert page.locator("#task-group").input_value() == "g1"
    assert page.locator("#task-flow").input_value() == "f1"
    assert page.locator("#task-ddl").input_value() == "2026-08-20"
    assert page.locator("#task-urgency").input_value() == "high"
    assert page.locator("#task-draft-source-content").is_visible()
    assert "Browser Draft B" in page.locator("#task-draft-source-content").inner_text()
    page.screenshot(path="/tmp/weekflow-v3.2-task-conversion-en.png", full_page=False)

    page.get_by_role("button", name="Save & Continue", exact=True).click()
    assert page.locator("#task-name").input_value() == "Browser Draft B"
    page.get_by_role("button", name="Save & Continue", exact=True).click()
    assert "0 pending · 2 saved" in page.locator("#task-draft-status-summary").inner_text()

    page.locator('[data-action="task-draft-add"]').click()
    assert page.locator("#task-draft-position").inner_text() == "Detected 3 potential Tasks · Editing 3"
    page.locator("#task-name").fill("Manually added browser draft")
    page.locator("#task-group").select_option("g1")
    page.locator("#task-flow").select_option("f1")
    page.locator("#task-ddl").fill("2026-08-22")
    page.locator("#task-urgency").select_option("low")
    page.locator("#task-report-to").fill("Lucy Chen")
    page.locator("#task-managed-object").fill("Jack Wang")
    page.locator("#task-deliverable").fill("Manual browser output")
    page.get_by_role("button", name="Save & Continue", exact=True).click()
    assert "0 pending · 3 saved" in page.locator("#task-draft-status-summary").inner_text()
    complete = page.get_by_role("button", name="Complete Conversion", exact=True)
    assert complete.is_enabled()
    complete.click()
    assert not task_dialog.is_visible()

    saved = stored(page)
    assert len(saved["tasks"]) == 4
    note = saved["notes"][0]
    task_conversions = [item for item in note["conversions"] if item["type"] == "task"]
    assert len(task_conversions) == 1
    assert len(task_conversions[0]["taskIds"]) == 3
    assert task_conversions[0]["skippedCount"] == 0

    page.locator("#note-title").fill("Natural recurring drafts")
    set_editor_html(
        page,
        "#note-editor",
        "<p>1 每周三完成团队周报<br>2 每月5日完成质量复核<br>3 准备一次性会议材料</p>",
    )
    page.get_by_role("button", name="Save Note", exact=True).click()
    page.get_by_role("button", name="Convert to Task Drafts", exact=True).click()
    assert page.locator("#task-draft-position").inner_text() == "Detected 3 potential Tasks · Editing 1"
    assert page.locator("#task-name").input_value() == "完成团队周报"
    assert page.locator("#task-recurrence").input_value() == "weekly"
    expected_weekly = page.evaluate(
        """() => {
          const now = new Date();
          const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const day = monday.getDay();
          monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1) + 9);
          return [monday.getFullYear(), String(monday.getMonth() + 1).padStart(2, '0'), String(monday.getDate()).padStart(2, '0')].join('-');
        }"""
    )
    assert page.locator("#task-ddl").input_value() == expected_weekly
    assert page.locator("#task-recurrence-start").input_value() == expected_weekly

    page.locator('[data-action="task-draft-next"]').click()
    assert page.locator("#task-draft-position").inner_text() == "Detected 3 potential Tasks · Editing 2"
    assert page.locator("#task-name").input_value() == "完成质量复核"
    assert page.locator("#task-recurrence").input_value() == "monthly"
    expected_monthly = page.evaluate(
        """() => {
          const now = new Date();
          const due = new Date(now.getFullYear(), now.getMonth() + 1, 5);
          return [due.getFullYear(), String(due.getMonth() + 1).padStart(2, '0'), String(due.getDate()).padStart(2, '0')].join('-');
        }"""
    )
    assert page.locator("#task-ddl").input_value() == expected_monthly
    assert page.locator("#task-recurrence-start").input_value() == expected_monthly

    page.locator('[data-action="task-draft-next"]').click()
    assert page.locator("#task-draft-position").inner_text() == "Detected 3 potential Tasks · Editing 3"
    assert page.locator("#task-name").input_value() == "准备一次性会议材料"
    assert page.locator("#task-recurrence").input_value() == "none"
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator('[data-action="close-task-dialog"]').first.click()
    assert not task_dialog.is_visible()

    page.locator("#note-title").fill("Date-prefixed multiline Tasks")
    set_editor_html(
        page,
        "#note-editor",
        "<p>下周二，徽章考题必须kickoff<br>下周五，固定资产的徽章考题得写完<br>8月25日，无形资产的徽章考题完事</p>",
    )
    page.get_by_role("button", name="Save Note", exact=True).click()
    page.get_by_role("button", name="Convert to Task Drafts", exact=True).click()
    assert page.locator("#task-draft-position").inner_text() == "Detected 3 potential Tasks · Editing 1"
    expected_prefixed_dates = page.evaluate(
        """() => {
          const now = new Date();
          const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const day = monday.getDay();
          monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
          const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
          const nextTuesday = new Date(monday);
          nextTuesday.setDate(nextTuesday.getDate() + 8);
          const nextFriday = new Date(monday);
          nextFriday.setDate(nextFriday.getDate() + 11);
          let monthDay = new Date(now.getFullYear(), 7, 25);
          if (iso(monthDay) < iso(now)) monthDay = new Date(now.getFullYear() + 1, 7, 25);
          return [iso(nextTuesday), iso(nextFriday), iso(monthDay)];
        }"""
    )
    assert page.locator("#task-name").input_value() == "徽章考题必须kickoff"
    assert page.locator("#task-ddl").input_value() == expected_prefixed_dates[0]
    page.locator('[data-action="task-draft-next"]').click()
    assert page.locator("#task-name").input_value() == "固定资产的徽章考题得写完"
    assert page.locator("#task-ddl").input_value() == expected_prefixed_dates[1]
    page.locator('[data-action="task-draft-next"]').click()
    assert page.locator("#task-name").input_value() == "无形资产的徽章考题完事"
    assert page.locator("#task-ddl").input_value() == expected_prefixed_dates[2]
    page.screenshot(path="/tmp/weekflow-v3.2-date-prefixed-drafts.png", full_page=False)
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator('[data-action="close-task-dialog"]').first.click()
    assert not task_dialog.is_visible()

    page.locator("#note-search").fill("date-prefixed")
    page.wait_for_timeout(150)
    assert page.locator("#note-list .note-list-item").count() == 1
    remaining_han = page.evaluate(
        """() => {
          const values = new Set();
          const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
            if (parent.closest('.language-switch button[data-language="zh-CN"]')) continue;
            if (parent.closest('[data-user-content], .note-list-item')) continue;
            const value = (node.nodeValue || '').trim();
            if (/\\p{Script=Han}/u.test(value)) values.add(value);
          }
          return [...values].sort();
        }"""
    )
    assert not remaining_han, remaining_han
    page.screenshot(path="/tmp/weekflow-v3.2-quick-notes-en.png", full_page=False)

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.locator(".more-menu > summary").click()
    with page.expect_download() as backup_info:
        page.locator('[data-action="export-json"]').click()
    backup_path = Path("/tmp/weekflow-v3.2-full-backup.json")
    backup_info.value.save_as(backup_path)
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert backup["version"] == 4
    assert len(backup["notes"]) == 1
    assert any(item["id"] == "m-unlinked" and not item["taskIds"] for item in backup["materials"])
    assert sum(len(item.get("progressEntries", [])) for item in backup["tasks"]) == 2
    assert backup["preferences"]["documentLibrary"]["layout"] == "list"

    page.locator('.language-switch button[data-language="zh-CN"]').click()
    page.wait_for_load_state("networkidle")
    assert page.locator("html").get_attribute("lang") == "zh-CN"
    assert page.get_by_role("button", name="随手记", exact=True).is_visible()
    assert len(stored(page)["notes"]) == 1
    assert not errors, errors

    browser.close()
    print("Quick Notes and progress-history browser workflow passed")
    print(Path("/tmp/weekflow-v3.2-quick-notes-en.png"))
