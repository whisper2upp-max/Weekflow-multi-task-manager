from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
OUTPUT = ROOT / "readme-images-en"


def build_data():
    groups = [
        {"id": "g-strategy", "name": "Strategy & Operations", "color": "#665CFF", "order": 1, "collapsed": False},
        {"id": "g-product", "name": "Products & Projects", "color": "#0AA6B5", "order": 2, "collapsed": False},
        {"id": "g-client", "name": "Client Delivery", "color": "#FF7A45", "order": 3, "collapsed": False},
        {"id": "g-team", "name": "Team & Talent", "color": "#9B5DE5", "order": 4, "collapsed": False},
        {"id": "g-growth", "name": "Personal Development", "color": "#2CA77B", "order": 5, "collapsed": False},
    ]
    flows = [
        {"id": "f-leadership", "groupId": "g-strategy", "name": "Leadership Rhythm", "color": "#665CFF", "order": 1, "collapsed": False},
        {"id": "f-release", "groupId": "g-product", "name": "Product Release", "color": "#0AA6B5", "order": 1, "collapsed": False},
        {"id": "f-northstar", "groupId": "g-client", "name": "Northstar Delivery", "color": "#FF7A45", "order": 1, "collapsed": False},
        {"id": "f-hiring", "groupId": "g-team", "name": "Hiring Sprint", "color": "#9B5DE5", "order": 1, "collapsed": False},
    ]

    task_specs = [
        ("Quarterly Risk Update", "g-strategy", "f-leadership", "2026-08-07", "completed", "high", "Lucy Chen", "Jack Wang"),
        ("Q3 Operating Review", "g-strategy", "f-leadership", "2026-08-14", "pending", "high", "Lucy Chen", "Jack Wang"),
        ("Resource Allocation Plan", "g-strategy", "f-leadership", "2026-08-21", "pending", "medium", "Lucy Chen", "Emma Liu"),
        ("Weekly Leadership Brief", "g-strategy", "f-leadership", "2026-08-14", "pending", "medium", "Lucy Chen", "Jack Wang"),
        ("FY27 Planning Assumptions", "g-strategy", "", "2026-08-28", "pending", "low", "Lucy Chen", "Sophia Zhao"),
        ("Confirm Product Requirements", "g-product", "f-release", "2026-07-31", "completed", "high", "David Wu", "Emma Liu"),
        ("Complete UX Prototype", "g-product", "f-release", "2026-08-07", "completed", "medium", "David Wu", "Emma Liu"),
        ("Build Core Workflow", "g-product", "f-release", "2026-08-14", "pending", "high", "David Wu", "Emma Liu"),
        ("User Acceptance Testing", "g-product", "f-release", "2026-08-21", "pending", "medium", "David Wu", "Sophia Zhao"),
        ("Production Launch", "g-product", "f-release", "2026-08-28", "pending", "high", "David Wu", "Sophia Zhao"),
        ("Customer Feedback Digest", "g-product", "", "2026-08-13", "pending", "medium", "David Wu", "Jack Wang"),
        ("Northstar Project Kickoff", "g-client", "f-northstar", "2026-08-04", "completed", "medium", "Sophia Zhao", "Jack Wang"),
        ("Northstar Data Validation", "g-client", "f-northstar", "2026-08-11", "pending", "high", "Sophia Zhao", "Jack Wang"),
        ("Northstar Draft Readout", "g-client", "f-northstar", "2026-08-18", "pending", "medium", "Sophia Zhao", "Emma Liu"),
        ("Northstar Final Delivery", "g-client", "f-northstar", "2026-08-25", "pending", "high", "Sophia Zhao", "Emma Liu"),
        ("Client Steering Update", "g-client", "", "2026-08-14", "pending", "low", "Sophia Zhao", "Jack Wang"),
        ("Publish Role Description", "g-team", "f-hiring", "2026-08-03", "completed", "low", "Emma Liu", "Sophia Zhao"),
        ("Complete Candidate Screen", "g-team", "f-hiring", "2026-08-10", "pending", "medium", "Emma Liu", "Sophia Zhao"),
        ("Panel Interview Round", "g-team", "", "2026-08-17", "pending", "high", "Emma Liu", "David Wu"),
        ("New Joiner Onboarding Plan", "g-team", "", "2026-08-24", "pending", "medium", "Emma Liu", "David Wu"),
        ("Complete Analytics Course", "g-growth", "", "2026-08-06", "completed", "low", "Jack Wang", "Jack Wang"),
        ("Leadership Reading Notes", "g-growth", "", "2026-08-15", "pending", "low", "Jack Wang", "Jack Wang"),
        ("Practice Product Demo", "g-growth", "", "2026-08-22", "pending", "medium", "Jack Wang", "Jack Wang"),
        ("Prepare Certification Case", "g-growth", "", "2026-08-29", "pending", "medium", "Jack Wang", "Jack Wang"),
    ]

    tasks = []
    flow_steps = {}
    for index, spec in enumerate(task_specs, 1):
        name, group_id, flow_id, ddl, status, urgency, report_to, managed_person = spec
        if flow_id:
            flow_steps[flow_id] = flow_steps.get(flow_id, 0) + 1
        task = {
            "id": f"t{index}",
            "groupId": group_id,
            "flowId": flow_id,
            "flowOrder": flow_steps.get(flow_id, 0) if flow_id else None,
            "name": name,
            "reportTo": report_to,
            "managedObject": managed_person,
            "deliverable": f"Approved {name} package",
            "ddl": ddl,
            "urgency": urgency,
            "status": status,
            "completedAt": ddl if status == "completed" else None,
            "recurrenceCadence": "none",
            "recurrenceStart": None,
            "recurrenceEnd": None,
            "recurrenceCompletions": [],
            "progressNote": "Work is on track; next checkpoint is confirmed." if status == "pending" else "Completed and shared with stakeholders.",
            "progressUpdatedAt": "2026-08-11T09:30:00.000Z",
        }
        tasks.append(task)

    recurring = next(task for task in tasks if task["name"] == "Weekly Leadership Brief")
    recurring.update({
        "recurrenceCadence": "weekly",
        "recurrenceStart": "2026-07-13",
        "recurrenceEnd": "2026-09-25",
        "recurrenceCompletions": [],
    })

    material_specs = [
        ("Q3 Operating Review Deck", "deliverable", ["t2"], ["f-leadership"], ["g-strategy"]),
        ("Leadership Briefing Folder", "folder", ["t4"], ["f-leadership"], ["g-strategy"]),
        ("Product Requirements Document", "document", ["t6", "t8"], ["f-release"], ["g-product"]),
        ("Release Readiness Checklist", "control", ["t8", "t9", "t10"], ["f-release"], ["g-product"]),
        ("UX Prototype Review", "deliverable", ["t7"], ["f-release"], ["g-product"]),
        ("Northstar Client Workspace", "folder", ["t12", "t13", "t14", "t15"], ["f-northstar"], ["g-client"]),
        ("Northstar Validation Log", "control", ["t13"], ["f-northstar"], ["g-client"]),
        ("Candidate Interview Guide", "document", ["t18", "t19"], ["f-hiring"], ["g-team"]),
        ("Onboarding Plan", "deliverable", ["t20"], [], ["g-team"]),
        ("Analytics Course Notes", "document", ["t21"], [], ["g-growth"]),
        ("Product Demo Recording", "deliverable", ["t23"], [], ["g-growth"]),
        ("Company Knowledge Hub", "folder", [], [], []),
    ]
    materials = []
    for index, spec in enumerate(material_specs, 1):
        title, material_type, task_ids, flow_ids, group_ids = spec
        materials.append({
            "id": f"m{index}",
            "title": title,
            "url": f"https://contoso.sharepoint.com/sites/weekflow/{index}",
            "type": material_type,
            "taskIds": task_ids,
            "flowIds": flow_ids,
            "groupIds": group_ids,
            "note": "Primary working document" if index % 2 else "Shared with the project team",
            "openEvents": ["2026-08-08T08:00:00.000Z"] if index <= 7 else [],
        })
    return {"version": 3, "groups": groups, "flows": flows, "tasks": tasks, "materials": materials}


def close_reminder(page):
    close_button = page.locator('[data-action="close-ddl-reminder"]')
    if close_button.is_visible():
        close_button.click()


def resize(page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(250)


def capture(page, filename, width, height, locator=None):
    resize(page, width, height)
    page.wait_for_timeout(250)
    target = page.locator(locator) if locator else page
    target.screenshot(path=str(OUTPUT / filename), animations="disabled")


def main():
    OUTPUT.mkdir(exist_ok=True)
    data = build_data()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1435, "height": 650},
            device_scale_factor=2,
            color_scheme="light",
        )
        page = context.new_page()
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("payload => localStorage.setItem('weekflow-v2.4:data:v4', JSON.stringify(payload))", data)
        page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
        page.reload()
        page.wait_for_load_state("networkidle")
        close_reminder(page)

        capture(page, "home.png", 1435, 618)

        page.get_by_role("button", name="Timeline", exact=True).click()
        page.wait_for_timeout(500)
        close_reminder(page)
        capture(page, "task-by-week.png", 1424, 630)

        resize(page, 1435, 648)
        page.locator('[data-action="new-task"]:visible').click()
        page.locator("#task-dialog[open]").wait_for(state="visible")
        page.wait_for_timeout(250)
        page.locator("#task-dialog").evaluate("node => { node.scrollTop = 82; }")
        page.locator("#task-dialog").screenshot(
            path=str(OUTPUT / "create-task.png"), animations="disabled"
        )
        page.locator('[data-action="close-task-dialog"]').first.click()

        page.get_by_role("button", name="Timeline", exact=True).click()
        page.wait_for_timeout(350)
        page.locator('[data-flow-id="f-hiring"] .flow-edit').click()
        page.locator("#flow-dialog[open]").wait_for(state="visible")
        page.wait_for_timeout(250)
        capture(page, "edit-flow.png", 1435, 650, "#flow-dialog")
        page.locator('[data-action="close-flow-dialog"]').first.click()

        page.get_by_role("button", name="Document Library", exact=True).click()
        page.wait_for_timeout(400)
        page.locator('[data-material-id="m3"] [data-material-select="true"]').check()
        capture(page, "document-library.png", 1432, 649)

        page.get_by_role("button", name="Overall Dashboard", exact=True).click()
        page.wait_for_timeout(350)
        page.get_by_role("button", name="Group Progress", exact=True).click()
        page.wait_for_timeout(350)
        capture(page, "overall-dashboard.png", 1430, 592)

        page.get_by_role("button", name="Report To", exact=True).click()
        page.wait_for_timeout(350)
        page.locator("#report-overview-title").scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -78)")
        page.wait_for_timeout(250)
        capture(page, "dashboard-report-to.png", 1434, 628)

        browser.close()


if __name__ == "__main__":
    main()
