from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"


def seed_data():
    groups = []
    flows = []
    tasks = []
    materials = []
    for index in range(18):
        group_id = f"g{index + 1}"
        flow_id = f"f{index + 1}"
        task_id = f"t{index + 1}"
        material_id = f"m{index + 1}"
        groups.append({
            "id": group_id,
            "name": f"Group {index + 1}",
            "color": "#665CFF",
            "order": index + 1,
            "collapsed": False,
        })
        flows.append({
            "id": flow_id,
            "groupId": group_id,
            "name": f"Flow {index + 1}",
            "color": "#665CFF",
            "order": index + 1,
            "collapsed": False,
        })
        tasks.append({
            "id": task_id,
            "groupId": group_id,
            "flowId": flow_id,
            "flowOrder": 1,
            "name": f"Task {index + 1}",
            "reportTo": "Lucy Chen",
            "managedObject": "Jack Wang",
            "deliverable": f"Deliverable {index + 1}",
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
        materials.append({
            "id": material_id,
            "title": f"Material {index + 1}",
            "url": f"https://example.com/material-{index + 1}",
            "type": "document",
            "taskIds": [task_id],
            "flowIds": [],
            "groupIds": [],
            "note": "Reference",
            "openEvents": [],
        })
    return {"version": 3, "groups": groups, "flows": flows, "tasks": tasks, "materials": materials}


def viewport_snapshot(page, selector):
    return page.locator(selector).evaluate(
        """node => ({
          pageY: window.scrollY,
          timelineTop: document.querySelector('#timeline-scroll')?.scrollTop || 0,
          timelineLeft: document.querySelector('#timeline-scroll')?.scrollLeft || 0,
          materialsTop: document.querySelector('.materials-table-wrap')?.scrollTop || 0,
          nodeTop: node.getBoundingClientRect().top
        })"""
    )


def assert_viewport_stable(before, after, label):
    assert abs(after["pageY"] - before["pageY"]) < 3, (label, before, after)
    assert abs(after["nodeTop"] - before["nodeTop"]) < 8, (label, before, after)


def assert_timeline_viewport_stable(before, after, label):
    assert_viewport_stable(before, after, label)
    assert abs(after["timelineLeft"] - before["timelineLeft"]) < 3, (label, before, after)


def assert_material_viewport_stable(before, after, label):
    assert_viewport_stable(before, after, label)
    assert abs(after["materialsTop"] - before["materialsTop"]) < 3, (label, before, after)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = context.new_page()
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))

    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    dialog_messages = []
    page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.dismiss()))
    assert page.locator("html").get_attribute("lang") == "en"
    assert page.get_by_role("button", name="Home").is_visible()
    assert page.get_by_role("button", name="Document Library", exact=True).is_visible()
    assert page.locator('.language-switch button[data-language="en"]').get_attribute("aria-pressed") == "true"
    page.locator('[data-action="open-user-guide"]').click()
    guide = page.locator("#user-guide-dialog")
    assert guide.get_by_text("Group Layout:", exact=False).is_visible()
    assert guide.get_by_text("Latest release (v2.7): August 15, 2026", exact=True).is_visible()
    page.locator('[data-action="close-user-guide"]').first.click()
    page.locator('[data-action="open-changelog"]').click()
    changelog = page.locator("#changelog-dialog")
    assert changelog.locator(".release-heading").first.get_by_text(
        "v2.7 Quick Notes and Progress History", exact=True
    ).is_visible()
    page.locator('[data-action="close-changelog"]').first.click()
    layout = page.evaluate(
        """() => ({
          bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          actionsRight: document.querySelector('#header-actions').getBoundingClientRect().right,
          viewportWidth: document.documentElement.clientWidth,
          navRight: document.querySelector('.language-switch').getBoundingClientRect().right,
          actionsLeft: document.querySelector('#header-actions').getBoundingClientRect().left,
        })"""
    )
    assert layout["bodyOverflow"] <= 1, layout
    assert layout["viewportWidth"] - layout["actionsRight"] < 30, layout
    assert layout["actionsLeft"] > layout["navRight"], layout

    data = seed_data()
    page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v4', JSON.stringify(payload))", data)
    page.reload()
    page.wait_for_load_state("networkidle")

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.wait_for_timeout(300)
    target_task = page.locator('[data-task-id="t18"]')
    target_task.scroll_into_view_if_needed()
    before_task = viewport_snapshot(page, '[data-task-id="t18"]')
    target_task.locator('input[type="checkbox"]').check()
    page.wait_for_timeout(350)
    after_task = viewport_snapshot(page, '[data-task-id="t18"]')
    assert_timeline_viewport_stable(before_task, after_task, "Task by Week completion")

    page.get_by_role("button", name="Home", exact=True).click()
    page.wait_for_timeout(150)
    page.get_by_role("button", name="Timeline", exact=True).click()
    page.wait_for_timeout(700)
    page.get_by_role("button", name="Go to This Week").click()
    page.wait_for_timeout(500)

    target_group = page.locator('[data-group-id="g12"]')
    target_group.scroll_into_view_if_needed()
    before_group = viewport_snapshot(page, '[data-group-id="g12"]')
    target_group.locator('.collapse-button').click(force=True)
    page.wait_for_timeout(350)
    after_group = viewport_snapshot(page, '[data-group-id="g12"]')
    assert_timeline_viewport_stable(before_group, after_group, "Group collapse")
    page.locator('[data-group-id="g12"] .collapse-button').click(force=True)
    page.wait_for_timeout(250)

    target_flow = page.locator('[data-flow-id="f12"]')
    target_flow.scroll_into_view_if_needed()
    before_flow = viewport_snapshot(page, '[data-flow-id="f12"]')
    target_flow.locator('.collapse-button').click(force=True)
    page.wait_for_timeout(350)
    after_flow = viewport_snapshot(page, '[data-flow-id="f12"]')
    assert_timeline_viewport_stable(before_flow, after_flow, "Flow collapse")
    page.locator('[data-flow-id="f12"] .collapse-button').click(force=True)
    page.wait_for_timeout(250)

    current_week_header = page.locator('.week-head.is-current')
    current_week_header.dblclick()
    page.wait_for_timeout(350)
    assert page.get_by_role("heading", name="Task by Day").is_visible()
    day_task = page.locator('[data-task-id="t17"]')
    day_task.scroll_into_view_if_needed()
    before_day_task = viewport_snapshot(page, '[data-task-id="t17"]')
    day_task.locator('input[type="checkbox"]').check()
    page.wait_for_timeout(350)
    after_day_task = viewport_snapshot(page, '[data-task-id="t17"]')
    assert_timeline_viewport_stable(before_day_task, after_day_task, "Task by Day completion")
    page.get_by_role("button", name="Return to Task by Week").click()
    page.wait_for_timeout(250)

    page.get_by_role("button", name="Document Library", exact=True).click()
    page.wait_for_timeout(300)
    last_material = page.locator('[data-material-id="m18"]')
    last_material.scroll_into_view_if_needed()
    before_material = viewport_snapshot(page, '[data-material-id="m18"]')
    last_material.locator('[data-material-select="true"]').check()
    page.wait_for_timeout(250)
    after_material = viewport_snapshot(page, '[data-material-id="m18"]')
    assert_material_viewport_stable(before_material, after_material, "Material checkbox")
    assert last_material.locator('[data-material-select="true"]').is_checked()

    last_material.locator('.material-name-button').click()
    page.wait_for_timeout(100)
    page.get_by_role("button", name="Delete Document", exact=True).click()
    page.wait_for_timeout(100)
    assert dialog_messages, "Deleting a material did not open a confirmation dialog"
    assert "Delete document" in dialog_messages[-1], dialog_messages[-1]
    assert not any("\u4e00" <= character <= "\u9fff" for character in dialog_messages[-1]), dialog_messages[-1]
    page.locator('[data-action="close-material-dialog"]').first.click()

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.get_by_role("button", name="New Task", exact=True).click()
    page.get_by_role("button", name="Save Task", exact=True).click()
    page.wait_for_timeout(100)
    validation_message = page.locator('[data-error-for="task-name"]').inner_text()
    assert validation_message == "Enter a Task Name.", validation_message
    page.locator('[data-action="close-task-dialog"]').first.click()
    page.get_by_role("button", name="Document Library", exact=True).click()

    downloads = []
    page.get_by_text("Download", exact=True).click()
    with page.expect_download() as download_info:
        page.get_by_text("Download Blank Template", exact=True).click()
    download = download_info.value
    downloads.append(download.suggested_filename)
    assert download.suggested_filename == "Weekflow_Document_Import_Template_EN.xlsx"

    han_text = page.evaluate(
        """
        () => {
          const results = new Set();
          const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
            if (parent.closest('.language-switch button[data-language="zh-CN"]')) continue;
            if (parent.closest('.group-card-copy strong, .person-table-name, [data-user-content]')) continue;
            const value = (node.nodeValue || '').trim();
            if (/\\p{Script=Han}/u.test(value)) results.add(value);
          }
          document.querySelectorAll('*').forEach((element) => {
            ['aria-label', 'title', 'placeholder', 'content'].forEach((name) => {
              const value = (element.getAttribute(name) || '').trim();
              if (/\\p{Script=Han}/u.test(value)) results.add(`${name}: ${value}`);
            });
          });
          return [...results].sort();
        }
        """
    )
    if han_text:
        print("Chinese system text remaining in English mode:")
        print("\n".join(han_text))
    assert not han_text, han_text

    english_output = Path("/tmp/weekflow-bilingual-smoke-en.png")
    page.screenshot(path=str(english_output), full_page=False)

    page.locator('.language-switch button[data-language="zh-CN"]').click()
    page.wait_for_load_state("networkidle")
    assert page.locator("html").get_attribute("lang") == "zh-CN"
    assert page.get_by_role("button", name="主页").is_visible()
    assert page.locator('.language-switch button[data-language="zh-CN"]').get_attribute("aria-pressed") == "true"
    assert not console_errors, console_errors

    output = Path("/tmp/weekflow-bilingual-smoke.png")
    page.screenshot(path=str(output), full_page=False)
    browser.close()
    print("Bilingual browser smoke passed; downloads:", downloads)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v4', JSON.stringify(payload))", seed_data())
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.reload()
    page.wait_for_load_state("networkidle")
    header_layout = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          actionsRight: document.querySelector('#header-actions').getBoundingClientRect().right,
          viewportWidth: document.documentElement.clientWidth,
          languageRight: document.querySelector('.language-switch').getBoundingClientRect().right,
          actionsLeft: document.querySelector('#header-actions').getBoundingClientRect().left,
        })"""
    )
    assert header_layout["overflow"] <= 1, header_layout
    assert header_layout["viewportWidth"] - header_layout["actionsRight"] < 24, header_layout
    assert header_layout["actionsLeft"] > header_layout["languageRight"], header_layout
    page.get_by_role("button", name="Document Library", exact=True).click()
    page.wait_for_timeout(250)
    materials_layout = page.evaluate(
        """() => {
          const title = document.querySelector('.materials-title-block').getBoundingClientRect();
          const actions = document.querySelector('.materials-actions').getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            titleTop: title.top,
            actionsTop: actions.top,
            actionsRight: actions.right,
            viewportWidth: document.documentElement.clientWidth,
          };
        }"""
    )
    assert materials_layout["overflow"] <= 1, materials_layout
    assert abs(materials_layout["titleTop"] - materials_layout["actionsTop"]) < 8, materials_layout
    assert materials_layout["viewportWidth"] - materials_layout["actionsRight"] < 24, materials_layout
    browser.close()
    print("Windows-width layout regression passed")
