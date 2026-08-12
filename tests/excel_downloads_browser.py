from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
OUTPUT = Path("/tmp/weekflow-browser-downloads")
OUTPUT.mkdir(parents=True, exist_ok=True)

DATA = {
    "version": 3,
    "groups": [{"id": "g1", "name": "Service Delivery", "color": "#665CFF", "order": 1, "collapsed": False}],
    "flows": [{"id": "f1", "groupId": "g1", "name": "Review Flow", "color": "#665CFF", "order": 1, "collapsed": False}],
    "tasks": [{
        "id": "t1", "groupId": "g1", "flowId": "f1", "flowOrder": 1,
        "name": "Review Package", "reportTo": "Lucy Chen", "managedObject": "Jack Wang",
        "deliverable": "Approved package", "ddl": "2026-08-14", "urgency": "high",
        "status": "pending", "completedAt": None, "recurrenceCadence": "none",
        "recurrenceStart": None, "recurrenceEnd": None, "recurrenceCompletions": [],
        "progressNote": "Ready for review",
    }],
    "materials": [{
        "id": "m1", "title": "Review Guide", "url": "https://example.com/guide",
        "type": "document", "taskIds": ["t1"], "flowIds": ["f1"], "groupIds": ["g1"],
        "note": "Reference", "openEvents": [],
    }],
}


def download(page, trigger, expected_prefix):
    with page.expect_download() as info:
        trigger()
    item = info.value
    assert item.suggested_filename.startswith(expected_prefix), item.suggested_filename
    target = OUTPUT / item.suggested_filename
    item.save_as(target)
    return target


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL)
    page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v3', JSON.stringify(payload))", DATA)
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.reload()
    page.wait_for_load_state("networkidle")

    page.get_by_role("button", name="Timeline", exact=True).click()
    page.wait_for_timeout(200)
    page.locator('.more-menu > summary').click()
    task_template = download(
        page,
        lambda: page.get_by_text("Download Excel Import Template", exact=True).click(),
        "Weekflow_Task_Import_Template_EN",
    )
    page.locator('.more-menu > summary').click()
    current_data = download(
        page,
        lambda: page.locator('[data-action="export-import-data"]').click(),
        "Weekflow_Current_Task_Data_",
    )
    dashboard = download(
        page,
        lambda: page.get_by_role("button", name="Export Dashboard Report").click(),
        "Task_Dashboard_",
    )

    page.get_by_role("button", name="Overall Dashboard", exact=True).click()
    page.get_by_role("button", name="Managed Person", exact=True).click()
    page.wait_for_timeout(200)
    managed = download(
        page,
        lambda: page.get_by_role("button", name='Export Task status for Managed Person “Jack Wang”').first.click(),
        "Managed_Person_Jack_Wang_Task_Status_",
    )
    page.get_by_role("button", name="Report To", exact=True).click()
    page.wait_for_timeout(200)
    report_to = download(
        page,
        lambda: page.get_by_role("button", name='Export Task status for Report To “Lucy Chen”').first.click(),
        "Report_To_Lucy_Chen_Task_Status_",
    )

    page.get_by_role("button", name="Document Library", exact=True).click()
    page.get_by_text("Download", exact=True).click()
    materials_template = download(
        page,
        lambda: page.locator('[data-template-kind="materials"]').click(),
        "Weekflow_Document_Import_Template_EN",
    )
    page.get_by_text("Download", exact=True).click()
    materials_library = download(
        page,
        lambda: page.locator('[data-action="export-materials"]').click(),
        "Weekflow_Document_Library_",
    )

    assert not errors, errors
    browser.close()
    print("Browser downloads passed:", *(p.name for p in [task_template, current_data, dashboard, managed, report_to, materials_template, materials_library]))
