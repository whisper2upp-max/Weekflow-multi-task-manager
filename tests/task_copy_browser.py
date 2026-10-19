"""Copy Tasks through the UI in isolated browser storage; never touches user data."""
import copy
import json
import subprocess
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8765/Weekflow.html"
KEY = "weekflow-v2.4:data:v4"
STAMP = "2026-01-01T00:00:00.000Z"
TODAY = date.today().isoformat()
TASK = dict(id="t1", groupId="g1", flowId="f1", flowOrder=1,
            name="Original Task", ddl=TODAY, urgency="high", status="completed",
            completedAt=TODAY, reportTo="Lucy", managedObject="Jack",
            deliverable="Original output", recurrenceCadence="none",
            progressEntries=[dict(id="p1", contentText="Original progress",
                contentHtml="<p>Original progress</p>", createdAt=STAMP, updatedAt=STAMP)],
            createdAt=STAMP, updatedAt=STAMP)
DATA = dict(version=4, groups=[dict(id="g1", name="Project")],
            flows=[dict(id="f1", groupId="g1", name="Flow")],
            tasks=[TASK, dict(TASK, id="t2", name="Recurring Task", flowOrder=2,
                recurrenceCadence="weekly", recurrenceStart=TODAY[:4]+"-01-01",
                recurrenceEnd=TODAY[:4]+"-12-31", recurrenceCompletions=[dict(periodKey=(date.today() - timedelta(days=date.today().weekday())).isoformat(), occurrenceDdl=TODAY, completedAt=TODAY)])],
            materials=[dict(id="m1", title="Source document", url="https://example.com/source",
                type="document", taskIds=["t1", "t2"], flowIds=["f1"], groupIds=["g1"],
                note="Keep this note", openEvents=[], createdAt=STAMP, updatedAt=STAMP)], notes=[])


def stored(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


def open_task(page, task_id):
    page.locator(f'.task-row[data-task-id="{task_id}"] .task-title').click()
    assert page.locator('#task-copy-button').is_visible()
    assert not page.locator('#task-copy-hint').is_visible()


def cancel(page):
    page.locator('#task-dialog-cancel-button').click()


def save(page):
    page.locator('#task-save-button').click()
    page.wait_for_function("!document.querySelector('#task-dialog').open")


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for language in ["zh-CN", "en"]:
        context = browser.new_context(viewport=dict(width=1440, height=1000))
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL)
        fixture = copy.deepcopy(DATA)
        fixture['tasks'].append(dict(TASK, id='long', name='长' * 160, flowOrder=3))
        fixture = json.loads(subprocess.check_output([
            'node', '-e', "const fs=require('fs'); const s=require('./js/storage.js'); const r=s.validateData(JSON.parse(fs.readFileSync(0,'utf8'))); if(!r.valid)throw Error(r.errors); process.stdout.write(JSON.stringify(r.data));"
        ], input=json.dumps(fixture), text=True))
        page.evaluate("""({key, fixture, language}) => {
          localStorage.setItem(key, JSON.stringify(fixture));
          localStorage.setItem('weekflow-v2.4:language', language);
        }""", dict(key=KEY, fixture=fixture, language=language))
        page.reload()
        page.locator('nav [data-view="timeline"]').click()
        if page.locator('[data-action="close-ddl-reminder"]').is_visible():
            page.locator('[data-action="close-ddl-reminder"]').click()
        baseline = stored(page)
        suffix = '（副本）' if language == 'zh-CN' else ' (Copy)'
        title = '复制为新 Task' if language == 'zh-CN' else 'Copy as New Task'
        open_task(page, 't1')
        page.locator('#task-deliverable').fill('Unsaved copy output')
        page.locator('#task-copy-button').click()
        assert page.locator('#task-name').input_value() == 'Original Task' + suffix
        assert page.locator('#task-dialog-title').inner_text() == title
        assert page.locator('#task-copy-hint').is_visible()
        assert page.locator('#task-id').input_value() == ''
        assert page.locator('#task-status').input_value() == 'pending'
        assert page.locator('#task-completed-at').input_value() == ''
        assert page.locator('#task-deliverable').input_value() == 'Unsaved copy output'
        assert not page.locator('#task-delete-button').is_visible()
        assert not page.locator('#task-copy-button').is_visible()
        assert stored(page) == baseline
        cancel(page)
        assert stored(page) == baseline
        page.locator('[data-action="new-task"]').click()
        assert not page.locator('#task-copy-hint').is_visible()
        assert not page.locator('#task-copy-button').is_visible()
        assert page.locator('#task-materials .material-link-row').count() == 0
        cancel(page)
        open_task(page, 't1')
        page.locator('#task-copy-button').click()
        page.locator('#task-report-to').fill('')
        page.locator('#task-save-button').click()
        assert stored(page) == baseline
        page.locator('#task-report-to').fill('New owner')
        page.locator('#task-materials [data-material-field="title"]').fill('Copy document')
        save(page)
        saved = stored(page)
        assert saved['tasks'][:3] == baseline['tasks']
        new = saved['tasks'][-1]
        assert new['id'] not in [t['id'] for t in baseline['tasks']]
        assert new['name'] == 'Original Task' + suffix
        assert new['status'] == 'pending' and new['completedAt'] is None
        assert new['progressEntries'] == [] and new['recurrenceCompletions'] == []
        assert not new['progressNote'] and not new['archivedAt'] and not new['archiveBatchId']
        assert new['flowOrder'] == 4 and new['flowId'] == 'f1' and new['groupId'] == 'g1'
        assert new['ddl'] == TODAY and new['urgency'] == 'high' and new['managedObject'] == 'Jack'
        assert new['reportTo'] == 'New owner' and new['createdAt'] != STAMP
        assert saved['materials'][0] == baseline['materials'][0]
        material = saved['materials'][-1]
        assert material['title'] == 'Copy document' and material['id'] != 'm1'
        assert material['taskIds'] == [new['id']]
        assert not material['flowIds'] and not material['groupIds'] and not material['openEvents']
        assert material['note'] == 'Keep this note'
        assert page.locator(f'.task-row[data-task-id="{new["id"]}"] .task-title').inner_text() == new['name']
        # Copy remains identifiable after reloading; edits to it never change its source.
        page.reload()
        page.locator('nav [data-view="timeline"]').click()
        if page.locator('[data-action="close-ddl-reminder"]').is_visible():
            page.locator('[data-action="close-ddl-reminder"]').click()
        open_task(page, new['id'])
        page.locator('#task-deliverable').fill('Only the copy changes')
        save(page)
        assert stored(page)['tasks'][0] == baseline['tasks'][0]
        open_task(page, 't1')
        page.locator('#task-copy-button').click()
        assert page.locator('#task-name').input_value() == ('Original Task（副本 2）' if language == 'zh-CN' else 'Original Task (Copy 2)')
        cancel(page)
        open_task(page, 'long')
        page.locator('#task-copy-button').click()
        assert len(page.locator('#task-name').input_value()) == 160
        assert page.locator('#task-name').input_value().endswith(suffix)
        cancel(page)
        open_task(page, 't2')
        page.locator('#task-copy-button').click()
        assert page.locator('#task-recurrence').input_value() == 'weekly'
        save(page)
        recurring = stored(page)['tasks'][-1]
        assert recurring['recurrenceCadence'] == 'weekly'
        assert recurring['recurrenceStart'] == TODAY[:4] + '-01-01'
        assert recurring['recurrenceEnd'] == TODAY[:4] + '-12-31'
        assert recurring['recurrenceCompletions'] == []
        assert recurring['progressEntries'] == [] and recurring['status'] == 'pending'
        assert stored(page)['tasks'][1] == baseline['tasks'][1]
        assert not errors, errors
        context.close()
        print(language + ': copy identification, cancel, validation, independent documents, reload, repeated copies and recurrence passed')
    browser.close()
