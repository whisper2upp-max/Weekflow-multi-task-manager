from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
OUTPUT = Path("/tmp/weekflow-english-ui")
OUTPUT.mkdir(parents=True, exist_ok=True)


DATA = {
    "version": 3,
    "groups": [{"id": "g1", "name": "Service Development", "color": "#665CFF", "order": 1, "collapsed": False}],
    "flows": [{"id": "f1", "groupId": "g1", "name": "Personal Development", "color": "#665CFF", "order": 1, "collapsed": False}],
    "tasks": [{
        "id": "t1", "groupId": "g1", "flowId": "f1", "flowOrder": 1,
        "name": "Training Material Development", "reportTo": "Lucy Chen", "managedObject": "Jack Wang",
        "deliverable": "Training package", "ddl": "2026-08-06", "urgency": "medium",
        "status": "pending", "completedAt": None, "recurrenceCadence": "weekly",
        "recurrenceStart": "2026-07-20", "recurrenceEnd": "2026-09-30",
        "recurrenceCompletions": [], "progressNote": "", "progressUpdatedAt": None,
    }, {
        "id": "t2", "groupId": "g1", "flowId": "f1", "flowOrder": 2,
        "name": "Overdue Review", "reportTo": "Lucy Chen", "managedObject": "Jack Wang",
        "deliverable": "Review record", "ddl": "2026-08-06", "urgency": "medium",
        "status": "pending", "completedAt": None, "recurrenceCadence": "none",
        "recurrenceStart": None, "recurrenceEnd": None,
        "recurrenceCompletions": [], "progressNote": "", "progressUpdatedAt": None,
    }],
    "materials": [],
}


def han_values(page):
    return page.evaluate(
        """
        () => {
          const values = new Set();
          const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
            if (parent.closest('.language-switch button[data-language="zh-CN"]')) continue;
            if (parent.closest('[data-user-content], .task-title, .group-name, .flow-name')) continue;
            const value = (node.nodeValue || '').trim();
            if (/\\p{Script=Han}/u.test(value)) values.add(value);
          }
          document.querySelectorAll('*').forEach((element) => {
            ['aria-label', 'title', 'placeholder'].forEach((name) => {
              const value = (element.getAttribute(name) || '').trim();
              if (/\\p{Script=Han}/u.test(value)) values.add(`${name}: ${value}`);
            });
          });
          return [...values].sort();
        }
        """
    )


def assert_no_han(page, label):
    values = han_values(page)
    assert not values, (label, values)


print("Starting English UI screenshot regressions", flush=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    # A Chinese browser locale reproduces the native date placeholder reported by users.
    context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN")
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    print("Opening page", flush=True)
    page.goto(BASE_URL)
    print("Seeding data", flush=True)
    page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v4', JSON.stringify(payload))", DATA)
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.reload()
    page.wait_for_load_state("networkidle")
    print("Page ready", flush=True)

    nav_reference = page.locator(".nav-tab").evaluate_all(
        """nodes => nodes.map(node => {
          const box = node.getBoundingClientRect();
          return {
            view: node.dataset.view,
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
            whiteSpace: getComputedStyle(node).whiteSpace,
          };
        })"""
    )
    assert all(item["whiteSpace"] == "nowrap" for item in nav_reference), nav_reference
    assert all(item["scrollWidth"] <= item["clientWidth"] + 1 for item in nav_reference), nav_reference
    for view in ("timeline", "dashboard", "materials", "notes", "home"):
        page.locator(f'.nav-tab[data-view="{view}"]').click()
        page.wait_for_timeout(100)
        current = page.locator(".nav-tab").evaluate_all(
            """nodes => nodes.map(node => {
              const box = node.getBoundingClientRect();
              return {view: node.dataset.view, left: box.left, top: box.top, width: box.width, height: box.height};
            })"""
        )
        for expected, actual in zip(nav_reference, current):
            assert expected["view"] == actual["view"]
            for key in ("left", "top", "width", "height"):
                assert abs(expected[key] - actual[key]) <= 1, (view, key, expected, actual)
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
    page.screenshot(path=str(OUTPUT / "stable-header.png"), full_page=False)
    print("Header navigation geometry checked across all views", flush=True)

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.wait_for_timeout(250)
    print("Checking timeline", flush=True)
    corner = page.locator(".timeline-corner")
    labels = corner.locator("span").all_inner_texts()
    assert labels == ["TASK / DDL", "URGENCY", "PROGRESS", "DOCUMENTS", "EDIT"], labels
    dimensions = corner.locator("span").evaluate_all(
        "nodes => nodes.map(node => ({text: node.innerText, scroll: node.scrollWidth, client: node.clientWidth}))"
    )
    assert all(item["scroll"] <= item["client"] + 1 for item in dimensions), dimensions
    print("Header widths checked", flush=True)
    current_week_layout = page.locator(".week-head.is-current").first.evaluate(
        """
        node => {
          const badge = node.querySelector('.week-current-badge').getBoundingClientRect();
          const rangeNode = node.querySelector('.week-range');
          const rangeText = document.createRange();
          rangeText.selectNodeContents(rangeNode);
          const range = rangeText.getBoundingClientRect();
          const date = node.querySelector('.week-date').getBoundingClientRect();
          return {
            badgeBottom: badge.bottom,
            rangeTop: range.top,
            dateTop: date.top,
            badgeInside:
              badge.left >= node.getBoundingClientRect().left &&
              badge.right <= node.getBoundingClientRect().right,
          };
        }
        """
    )
    assert current_week_layout["badgeInside"], current_week_layout
    assert current_week_layout["badgeBottom"] <= current_week_layout["rangeTop"] + 1, current_week_layout
    assert current_week_layout["badgeBottom"] < current_week_layout["dateTop"], current_week_layout
    print("This Week badge spacing checked", flush=True)
    badge = page.locator('.urgency-badge.medium').first
    assert badge.inner_text().strip() == "● Medium"
    assert badge.evaluate("node => node.scrollWidth <= node.clientWidth + 1")
    print("Urgency checked", flush=True)
    overdue_label = page.locator('[data-task-id="t2"] .status-label.overdue')
    assert overdue_label.text_content().strip() == "⚠ Overdue"
    print("Overdue checked", flush=True)
    assert_no_han(page, "timeline")
    print("Timeline text checked", flush=True)
    page.screenshot(path=str(OUTPUT / "timeline.png"), full_page=False)
    print("Timeline captured", flush=True)

    page.evaluate("document.querySelector('.week-head[data-week=\"2026-10-16\"]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))")
    page.wait_for_timeout(200)
    assert page.get_by_role("heading", name="Task by Day").is_visible()
    assert page.get_by_role("heading", name="No Task Deadlines This Week").is_visible()
    assert "double-click another week header" in page.locator(".empty-state p").inner_text()
    assert_no_han(page, "day timeline")
    print("Day timeline checked", flush=True)

    page.get_by_role("button", name="Document Library", exact=True).click()
    page.wait_for_timeout(180)
    assert page.locator(".materials-empty-cell").inner_text() == "No documents yet. Add one manually or upload a file."
    assert_no_han(page, "materials empty state")
    print("Document Library checked", flush=True)

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.locator('[data-action="new-group"]').click()
    assert page.get_by_role("heading", name="New Group").is_visible()
    page.locator('[data-action="close-group-dialog"]').first.click()

    page.locator('[data-action="new-flow"]').click()
    assert page.get_by_role("heading", name="New Flow").is_visible()
    assert "After creating the Flow" in page.locator(".flow-order-empty").inner_text()
    assert_no_han(page, "new Flow")
    print("New Flow checked", flush=True)
    page.locator('[data-action="close-flow-dialog"]').first.click()

    page.locator('[data-group-id="g1"] .group-edit').click()
    assert page.get_by_role("heading", name="Edit Group").is_visible()
    assert_no_han(page, "edit Group")
    print("Edit Group checked", flush=True)
    page.locator('[data-action="close-group-dialog"]').first.click()

    page.locator('[data-flow-id="f1"] .flow-edit').click()
    assert page.get_by_role("heading", name="Edit Flow").is_visible()
    assert_no_han(page, "edit Flow")
    page.screenshot(path=str(OUTPUT / "edit-flow.png"), full_page=False)
    page.locator('[data-action="close-flow-dialog"]').first.click()

    page.locator('[data-task-id="t1"] .task-title').click()
    completed_date = page.locator("#task-completed-at")
    assert completed_date.get_attribute("lang") == "en-US"
    completed_date_shell = completed_date.locator("xpath=..")
    assert "is-empty" in (completed_date_shell.get_attribute("class") or "")
    date_placeholder = completed_date_shell.locator(".localized-date-placeholder")
    assert date_placeholder.inner_text() == "MM / DD / YYYY"
    assert date_placeholder.is_visible()
    date_geometry = page.evaluate(
        """
        () => {
          const input = document.querySelector('#task-completed-at');
          const placeholder = input.nextElementSibling;
          const inputBox = input.getBoundingClientRect();
          const placeholderBox = placeholder.getBoundingClientRect();
          return {
            inputOpacity: getComputedStyle(input).opacity,
            placeholderTransform: getComputedStyle(placeholder).textTransform,
            placeholderText: placeholder.innerText,
            placeholderInsideInput:
              placeholderBox.left >= inputBox.left && placeholderBox.right <= inputBox.right &&
              placeholderBox.top >= inputBox.top && placeholderBox.bottom <= inputBox.bottom,
          };
        }
        """
    )
    assert date_geometry == {
        "inputOpacity": "0",
        "placeholderTransform": "uppercase",
        "placeholderText": "MM / DD / YYYY",
        "placeholderInsideInput": True,
    }, date_geometry
    page.screenshot(path=str(OUTPUT / "edit-task.png"), full_page=False)
    page.locator("#task-recurrence").select_option("none")
    page.locator("#task-status").select_option("completed")
    assert completed_date.input_value()
    assert "is-empty" not in (completed_date_shell.get_attribute("class") or "")
    assert not date_placeholder.is_visible()
    page.locator("#task-status").select_option("pending")
    assert completed_date.input_value() == ""
    assert "is-empty" in (completed_date_shell.get_attribute("class") or "")
    assert date_placeholder.is_visible()
    print("Date locale checked", flush=True)
    page.locator('[data-action="close-task-dialog"]').first.click()

    page.locator('[data-task-id="t1"] .progress-button').dblclick()
    assert "Each update is stored as an independent timestamped record" in page.locator("#progress-dialog-task").inner_text()
    assert_no_han(page, "progress dialog")
    print("Progress checked", flush=True)
    page.locator('[data-action="close-progress-dialog"]').first.click()

    page.locator('[data-task-id="t1"] .material-button').dblclick()
    assert "Documents are grouped by type" in page.locator("#link-dialog-task").inner_text()
    assert_no_han(page, "related documents dialog")
    print("Related documents checked", flush=True)
    page.locator('[data-action="close-link-dialog"]').first.click()

    assert not errors, errors
    browser.close()
    print("English UI screenshot regressions passed", flush=True)
