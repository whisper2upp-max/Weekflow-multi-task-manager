import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8766/Weekflow.html"


def seed_data():
    groups = []
    tasks = []
    documents = []
    for group_index in range(6):
        group_id = f"g{group_index + 1}"
        groups.append({
            "id": group_id,
            "name": f"Group {group_index + 1}",
            "color": ["#665CFF", "#0AA6B5", "#2CA77B", "#FF7A45", "#9B5DE5", "#E94E89"][group_index],
            "order": group_index + 1,
            "collapsed": False,
        })
        task_count = 24 if group_index == 0 else 2
        for task_index in range(task_count):
            number = len(tasks) + 1
            task_id = f"t{number}"
            tasks.append({
                "id": task_id,
                "groupId": group_id,
                "flowId": None,
                "flowOrder": None,
                "name": f"Task {number:02d}",
                "reportTo": "Lucy Chen",
                "managedObject": "Jack Wang",
                "deliverable": f"Deliverable {number:02d}",
                "ddl": "2026-08-14",
                "urgency": "medium",
                "status": "pending",
                "completedAt": None,
                "recurrenceCadence": "none",
                "recurrenceStart": None,
                "recurrenceEnd": None,
                "recurrenceCompletions": [],
                "progressNote": "",
                "progressUpdatedAt": None,
            })
            documents.append({
                "id": f"m{number}",
                "title": f"Document {number:02d}",
                "url": f"https://example.com/document-{number}",
                "type": "document" if number % 2 else "deliverable",
                "taskIds": [task_id],
                "flowIds": [],
                "groupIds": [],
                "note": "",
                "openEvents": ["2026-08-13T09:00:00.000Z"] if number % 3 == 0 else [],
            })
    documents.append({
        "id": "m-ungrouped",
        "title": "Independent Guide",
        "url": "https://example.com/independent-guide",
        "type": "document",
        "taskIds": [],
        "flowIds": [],
        "groupIds": [],
        "note": "",
        "openEvents": [],
    })
    return {
        "version": 3,
        "groups": groups,
        "flows": [],
        "tasks": tasks,
        "materials": documents,
    }


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1600, "height": 900})
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.evaluate(
        "payload => localStorage.setItem('weekflow-v2.4:data:v3', JSON.stringify(payload))",
        seed_data(),
    )
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.reload()
    page.wait_for_load_state("networkidle")
    home_language_left = page.locator(".language-switch").evaluate(
        "node => node.getBoundingClientRect().left"
    )
    page.get_by_role("button", name="Document Library", exact=True).click()

    controls = page.locator("#materials-layout-controls")
    assert controls.is_visible()
    header_alignment = page.evaluate(
        """() => {
          const controls = document.querySelector('#materials-layout-controls').getBoundingClientRect();
          const language = document.querySelector('.language-switch').getBoundingClientRect();
          return {
            controlsTop: controls.top,
            languageTop: language.top,
            controlsLeft: controls.left,
            languageLeft: language.left,
            languageRight: language.right,
          };
        }"""
    )
    assert abs(header_alignment["controlsTop"] - header_alignment["languageTop"]) < 3, header_alignment
    assert abs(header_alignment["languageLeft"] - home_language_left) < 3, header_alignment
    assert header_alignment["languageRight"] < header_alignment["controlsLeft"], header_alignment

    page.get_by_role("button", name="Group", exact=True).click()
    page.wait_for_timeout(200)
    layout_control_order = page.evaluate(
        """() => {
          const settings = document.querySelector('#material-layout-settings-button').getBoundingClientRect();
          const switcher = document.querySelector('.materials-layout-switch').getBoundingClientRect();
          return {settingsRight: settings.right, switchLeft: switcher.left};
        }"""
    )
    assert layout_control_order["settingsRight"] < layout_control_order["switchLeft"], layout_control_order
    assert page.locator("#materials-table-section").is_hidden()
    assert page.locator("#materials-group-section").is_visible()
    assert page.locator("#material-type-filter").is_visible()
    assert page.locator("#material-group-filter").is_hidden()
    assert page.locator("#material-flow-filter").is_hidden()
    assert page.locator("#material-task-filter").is_hidden()
    assert page.locator(".material-scope-toggle").is_hidden()
    assert page.locator(".material-group-card").count() == 7

    card_positions = page.locator(".material-group-card").evaluate_all(
        "cards => cards.slice(0, 5).map(card => ({top: card.getBoundingClientRect().top, left: card.getBoundingClientRect().left}))"
    )
    assert max(abs(item["top"] - card_positions[0]["top"]) for item in card_positions[:4]) < 3, card_positions
    assert card_positions[4]["top"] > card_positions[0]["top"] + 100, card_positions

    first_list = page.locator('[data-material-group-scroll="g1"]')
    first_list.evaluate("node => node.scrollTop = node.scrollHeight")
    before_scroll = first_list.evaluate("node => ({top: node.scrollTop, pageY: window.scrollY})")
    target_checkbox = first_list.locator('[data-material-select="true"]').last
    target_checkbox.check()
    page.wait_for_timeout(100)
    after_scroll = first_list.evaluate("node => ({top: node.scrollTop, pageY: window.scrollY})")
    assert abs(after_scroll["top"] - before_scroll["top"]) < 3, (before_scroll, after_scroll)
    assert abs(after_scroll["pageY"] - before_scroll["pageY"]) < 3, (before_scroll, after_scroll)
    assert target_checkbox.is_checked()
    assert "1 selected" in page.locator("#material-selection-count").inner_text()

    first_list.locator(".material-group-name").last.click()
    assert page.get_by_role("heading", name="Edit Document").is_visible()
    page.locator('[data-action="close-material-dialog"]').first.click()

    page.get_by_role("button", name="Arrange Layout", exact=True).click()
    dialog = page.locator("#material-layout-dialog")
    assert dialog.is_visible()
    page.locator("#material-layout-columns").select_option("3")
    order_items = page.locator(".material-layout-order-item")
    first_key = order_items.first.get_attribute("data-material-group-key")
    order_items.first.drag_to(order_items.nth(2))
    draft_order = order_items.evaluate_all(
        "items => items.map(item => item.dataset.materialGroupKey)"
    )
    assert draft_order.index(first_key) > 0, draft_order
    page.get_by_role("button", name="Apply Layout", exact=True).click()
    page.wait_for_timeout(200)

    preferences = page.evaluate(
        """() => JSON.parse(localStorage.getItem('weekflow-v2.4:data:v3')).preferences.documentLibrary"""
    )
    assert preferences["layout"] == "group", preferences
    assert preferences["columns"] == 3, preferences
    assert preferences["groupOrder"].index(first_key) > 0, preferences
    three_column_positions = page.locator(".material-group-card").evaluate_all(
        "cards => cards.slice(0, 4).map(card => card.getBoundingClientRect().top)"
    )
    assert max(abs(top - three_column_positions[0]) for top in three_column_positions[:3]) < 3
    assert three_column_positions[3] > three_column_positions[0] + 100

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.locator(".more-menu > summary").click()
    with page.expect_download() as download_info:
        page.locator('.more-popover [data-action="export-json"]').click()
    backup_file = Path(download_info.value.path())
    backup_payload = json.loads(backup_file.read_text(encoding="utf-8"))
    assert backup_payload["preferences"]["documentLibrary"] == preferences

    page.get_by_role("button", name="Document Library", exact=True).click()
    page.get_by_role("button", name="List", exact=True).click()
    assert page.locator("#materials-table-section").is_visible()
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#json-file-input").set_input_files({
        "name": "weekflow-layout-backup.json",
        "mimeType": "application/json",
        "buffer": json.dumps(backup_payload).encode("utf-8"),
    })
    page.wait_for_timeout(250)
    assert page.locator("#materials-group-section").is_visible()
    restored_preferences = page.evaluate(
        """() => JSON.parse(localStorage.getItem('weekflow-v2.4:data:v3')).preferences.documentLibrary"""
    )
    assert restored_preferences == preferences

    page.reload()
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Document Library", exact=True).click()
    assert page.locator("#materials-group-section").is_visible()
    assert page.locator(".material-group-card").first.get_attribute("data-material-group-key") == preferences["groupOrder"][0]
    page.screenshot(path="/tmp/weekflow-material-group-layout.png", full_page=False)

    page.get_by_role("button", name="List", exact=True).click()
    assert page.locator("#materials-table-section").is_visible()
    assert page.locator("#material-group-filter").is_visible()
    assert page.locator("#material-flow-filter").is_visible()
    assert page.locator("#material-task-filter").is_visible()
    assert page.locator(".material-scope-toggle").is_visible()

    page.get_by_role("button", name="Group", exact=True).click()
    page.set_viewport_size({"width": 960, "height": 800})
    compact_header = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          controlsLeft: document.querySelector('#materials-layout-controls').getBoundingClientRect().left,
          languageRight: document.querySelector('.language-switch').getBoundingClientRect().right,
        })"""
    )
    assert compact_header["overflow"] <= 1, compact_header
    assert compact_header["languageRight"] < compact_header["controlsLeft"], compact_header
    assert not errors, errors

    browser.close()
    print("Document Library Group layout browser regression passed")
