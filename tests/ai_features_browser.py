import json

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
DATA_KEY = "weekflow-v2.4:data:v4"
AI_KEY = "weekflow:ai-settings:v1"


def note(note_id, title, text):
    return {
        "id": note_id,
        "title": title,
        "contentHtml": "<p>" + text + "</p>",
        "contentText": text,
        "conversions": [],
        "createdAt": "2026-08-01T00:00:00.000Z",
        "updatedAt": "2026-08-01T00:00:00.000Z",
    }


DATA = {
    "version": 4,
    "groups": [],
    "flows": [],
    "tasks": [],
    "materials": [],
    "notes": [
        note("note-1", "First note", "SAVED VERSION"),
        note("note-2", "Second note", "SECOND NOTE MUST STAY"),
    ],
    "preferences": {
        "documentLibrary": {
            "layout": "list",
            "columns": 4,
            "groupOrder": ["__ungrouped__"],
        }
    },
}

AI_SETTINGS = {
    "enabled": True,
    "noteAiEnabled": True,
    "provider": "custom",
    "apiKey": "browser-test-key",
    "baseUrl": "https://mock-ai.invalid/v1",
    "model": "browser-test-model",
}


def set_editor_html(page, html):
    page.locator("#note-editor").evaluate(
        """(node, value) => {
          node.innerHTML = value;
          node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }""",
        html,
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1500, "height": 920})
    errors = []
    requests = []
    pending_routes = []
    mode = {"value": "immediate"}
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("dialog", lambda dialog: dialog.accept())

    def handle_ai(route, request):
        payload = request.post_data_json
        requests.append(payload)
        if mode["value"] == "hold":
            pending_routes.append(route)
            return
        source = payload["messages"][-1]["content"]
        table_tokens = ["[[" + part.split("]]", 1)[0] + "]]" for part in source.split("[[") if part.startswith("WEEKFLOW_TABLE_")]
        if table_tokens and mode["value"] == "table-preserve":
            response_text = "REWRITTEN INTRO\n\n" + "\n\n".join(table_tokens) + "\n\nREWRITTEN END"
        elif table_tokens and mode["value"] == "table-missing":
            response_text = "REWRITE THAT DROPPED THE TABLE"
        else:
            response_text = "REWRITTEN CURRENT VERSION"
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"choices": [{"message": {"content": response_text}}]}),
        )

    page.route("**/chat/completions", handle_ai)
    page.goto(BASE_URL)
    page.evaluate("([key, value]) => localStorage.setItem(key, JSON.stringify(value))", [DATA_KEY, DATA])
    page.evaluate("localStorage.setItem('weekflow-v2.4:language', 'en')")
    page.evaluate("([key, value]) => localStorage.setItem(key, JSON.stringify(value))", [AI_KEY, AI_SETTINGS])
    page.reload()
    page.wait_for_load_state("networkidle")
    page.locator('[data-action="open-ai-settings"]').click()
    page.locator("#ai-provider").select_option("deepseek")
    assert page.locator("#ai-base-url").input_value() == "https://api.deepseek.com"
    page.locator("#ai-provider").select_option("custom")
    assert page.locator("#ai-base-url").input_value() == ""
    page.locator('[data-action="close-ai-settings"]').first.click()
    page.get_by_role("button", name="Quick Notes", exact=True).click()
    page.locator('[data-action="edit-note"][data-note-id="note-1"]').click()

    set_editor_html(page, "<p>UNSAVED CURRENT VERSION</p>")
    page.locator('[data-action="note-ai-rewrite"]').click()
    page.wait_for_function("document.querySelector('#note-editor').innerText.includes('REWRITTEN CURRENT VERSION')")
    assert requests[-1]["messages"][-1]["content"] == "UNSAVED CURRENT VERSION"
    assert page.locator("#note-ai-original-content").inner_text() == "UNSAVED CURRENT VERSION"
    page.locator('[data-action="restore-ai-original"]').click()
    assert page.locator("#note-editor").inner_text() == "UNSAVED CURRENT VERSION"
    page.get_by_role("button", name="Save Note", exact=True).click()

    table_html = (
        "<p>Original intro</p><table><tbody>"
        '<tr><td rowspan="2">Owner</td><td colspan="2">Status</td></tr>'
        "<tr><td>Open</td><td>Closed</td></tr>"
        "</tbody></table><p>Original ending</p>"
    )
    set_editor_html(page, table_html)
    mode["value"] = "table-preserve"
    page.wait_for_function("document.querySelector('[data-action=\"note-ai-rewrite\"]')?.disabled === false")
    page.locator('[data-action="note-ai-rewrite"]').click()
    page.wait_for_function("document.querySelector('#note-editor').innerText.includes('REWRITTEN END')")
    assert "[[WEEKFLOW_TABLE_" in requests[-1]["messages"][-1]["content"]
    assert "[[WEEKFLOW_TABLE_" in requests[-1]["messages"][0]["content"]
    assert "Owner" not in requests[-1]["messages"][-1]["content"]
    assert page.locator('#note-editor table').count() == 1
    assert page.locator('#note-editor td[rowspan="2"]').count() == 1
    assert page.locator('#note-editor td[colspan="2"]').count() == 1
    preserved_table_text = page.locator('#note-editor table').inner_text()
    assert all(value in preserved_table_text for value in ["Owner", "Status", "Open", "Closed"])
    assert page.locator('#note-ai-original-content table').count() == 1

    page.locator('[data-action="restore-ai-original"]').click()
    set_editor_html(page, table_html)
    unchanged_html = page.locator("#note-editor").inner_html()
    mode["value"] = "table-missing"
    page.wait_for_function("document.querySelector('[data-action=\"note-ai-rewrite\"]')?.disabled === false")
    page.locator('[data-action="note-ai-rewrite"]').click()
    page.wait_for_function(
        "document.querySelector('#toast-region').innerText.toLowerCase().includes('cancelled')"
    )
    assert page.locator("#note-editor").inner_html() == unchanged_html
    assert page.locator('#note-editor table').count() == 1

    mode["value"] = "hold"
    page.locator('[data-action="note-ai-rewrite"]').click()
    page.wait_for_timeout(100)
    assert len(pending_routes) == 1
    page.locator('[data-action="edit-note"][data-note-id="note-2"]').click()
    assert page.locator("#note-editor").inner_text() == "SECOND NOTE MUST STAY"
    pending_routes[0].fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({"choices": [{"message": {"content": "REWRITE OF FIRST NOTE"}}]}),
    )
    page.wait_for_timeout(150)
    assert page.locator(".note-list-item.is-active strong").inner_text() == "Second note"
    assert page.locator("#note-editor").inner_text() == "SECOND NOTE MUST STAY"
    assert "not applied" in page.locator("#toast-region").inner_text().lower()
    assert not errors, errors
    browser.close()

print("AI_FEATURES_BROWSER_OK")
