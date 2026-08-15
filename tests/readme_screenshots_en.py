import copy
import json
import re
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8765/Weekflow.html"
ZH_OUTPUT = ROOT / "readme配图"
EN_OUTPUT = ROOT / "readme-images-en"

GROUP_TRANSLATIONS = {
    "服务研发": "Service Development",
    "组内运营": "Team Operations",
    "AI开发": "AI Development",
    "质检": "Quality Review",
    "Kaizen": "Kaizen",
}

FLOW_TRANSLATIONS = {
    "个人研发": "Individual Development",
    "团队研发管理": "Team Development Management",
    "AI研发项目": "AI Development Projects",
    "项目质检复核": "Project Quality Review",
}

TASK_TRANSLATIONS = {
    "SWP修改": "SWP Revision",
    "SOP研发": "SOP Development",
    "BPD材料研发": "BPD Materials Development",
    "培训材料研发": "Training Materials Development",
    "徽章考题研发": "Badge Exam Development",
    "Jack交付物研发": "Jack Deliverables Development",
    "Lucy交付物研发": "Lucy Deliverables Development",
    "完成招聘任务": "Complete Recruitment",
    "订单下定审批完成": "Complete Order Approval",
    "组内订单分单": "Allocate Team Orders",
    "定期拉通": "Weekly Team Alignment",
    "客户需求智能分类助手研发": "Customer Request Classifier Development",
    "审计文档自动检查工具研发": "Audit Document Checker Development",
    "培训材料生成Agent研发": "Training Materials Agent Development",
    "A项目质检复核": "Project A Quality Review",
    "B项目质检复核": "Project B Quality Review",
    "C项目质检复核": "Project C Quality Review",
    "A3 Report编制": "Prepare A3 Report",
    "Kaizen改进方案设计": "Design Kaizen Improvement Plan",
    "改进措施落地实施上线": "Implement and Launch Improvements",
}


def build_chinese_sample():
    today = date(2026, 8, 15)
    stamp = "2026-08-15T02:00:00.000Z"
    colors = ["#665CFF", "#0AA6B5", "#9B5DE5", "#FF7A45", "#2CA77B"]
    group_names = ["服务研发", "组内运营", "AI开发", "质检", "Kaizen"]
    groups = [
        {
            "id": f"sample_group_{index + 1}",
            "name": name,
            "color": colors[index],
            "order": index + 1,
            "collapsed": False,
            "createdAt": stamp,
            "updatedAt": stamp,
        }
        for index, name in enumerate(group_names)
    ]
    flow_specs = [
        ("个人研发", 0, 1),
        ("团队研发管理", 0, 2),
        ("AI研发项目", 2, 1),
        ("项目质检复核", 3, 1),
    ]
    flows = [
        {
            "id": f"sample_flow_{index + 1}",
            "groupId": groups[group_index]["id"],
            "name": name,
            "color": groups[group_index]["color"],
            "order": order,
            "collapsed": False,
            "createdAt": stamp,
            "updatedAt": stamp,
        }
        for index, (name, group_index, order) in enumerate(flow_specs)
    ]
    report_to = ["Lucy Chen", "Jack Wang", "Lucy Chen", "Jack Wang", "Amy Liu"]
    managed_person = ["Daniel Wu", "Amy Liu", "Kevin Zhou", "Emily Wang", "Michael Zhang"]
    task_specs = [
        ("SWP修改", 0, 0, -18, "high", "completed", "SWP修改定稿包", "SWP修改记录及定稿.xlsx", "deliverable", "SWP修改已完成，复核意见已全部回复。"),
        ("SOP研发", 0, 0, -5, "high", "pending", "SOP研发成果包", "SOP研发初稿.docx", "document", "主体流程已完成，正在补充操作截图和 Review Checklist。"),
        ("BPD材料研发", 0, 0, 4, "medium", "pending", "BPD研发材料包", "BPD材料研发包.zip", "deliverable", ""),
        ("培训材料研发", 0, 0, 12, "medium", "pending", "培训课件与讲师稿", "培训材料研发课件.pptx", "deliverable", ""),
        ("徽章考题研发", 0, 0, 20, "medium", "pending", "徽章考题题库与答案", "徽章考题研发题库.xlsx", "deliverable", ""),
        ("Jack交付物研发", 0, 1, 7, "high", "pending", "Jack交付物研发成果包", "Jack交付物研发清单.xlsx", "control", ""),
        ("Lucy交付物研发", 0, 1, 16, "high", "pending", "Lucy交付物研发成果包", "Lucy交付物研发清单.xlsx", "control", ""),
        ("完成招聘任务", 1, None, -7, "high", "pending", "招聘完成情况与候选人入职清单", "招聘任务完成记录.xlsx", "control", ""),
        ("订单下定审批完成", 1, None, -2, "high", "completed", "审批完成的订单下定单", "订单下定审批单.pdf", "deliverable", ""),
        ("组内订单分单", 1, None, 5, "medium", "pending", "组内订单分单结果表", "组内订单分单表.xlsx", "control", ""),
        ("定期拉通", 1, None, 0, "medium", "pending", "周例会纪要与行动项清单", "定期拉通会议纪要.docx", "document", "已收集本周议题，待会议后更新负责人和完成时间。"),
        ("客户需求智能分类助手研发", 2, 2, 9, "high", "pending", "需求分类助手原型与测试报告", "客户需求智能分类助手设计说明.docx", "document", ""),
        ("审计文档自动检查工具研发", 2, 2, 23, "high", "pending", "自动检查工具可运行版本与验收记录", "审计文档自动检查工具验收报告.xlsx", "deliverable", "核心规则已完成，正在执行浏览器兼容性验收和误报样本复核。"),
        ("培训材料生成Agent研发", 2, 2, 37, "medium", "pending", "培训材料生成Agent原型与提示词说明", "培训材料生成Agent研发说明.docx", "document", ""),
        ("A项目质检复核", 3, 3, -4, "high", "pending", "A项目复核结论与问题清单", "A项目质检复核记录.xlsx", "control", "已完成首轮质检，发现项正在与项目负责人确认。"),
        ("B项目质检复核", 3, 3, 6, "high", "pending", "B项目复核结论与问题清单", "B项目质检复核记录.xlsx", "control", ""),
        ("C项目质检复核", 3, 3, 13, "medium", "pending", "C项目复核结论与问题清单", "C项目质检复核记录.xlsx", "control", ""),
        ("A3 Report编制", 4, None, -10, "medium", "completed", "A3 Report定稿", "Kaizen_A3_Report.xlsx", "deliverable", ""),
        ("Kaizen改进方案设计", 4, None, 11, "high", "pending", "Kaizen改进方案评审版", "Kaizen改进方案.docx", "document", ""),
        ("改进措施落地实施上线", 4, None, 31, "high", "pending", "改进措施上线版本与验收记录", "改进措施上线验收报告.xlsx", "deliverable", ""),
    ]
    tasks = []
    materials = []
    flow_orders = {}
    for index, spec in enumerate(task_specs, 1):
        name, group_index, flow_index, offset, urgency, status, deliverable, material_title, material_type, progress = spec
        ddl = (today + timedelta(days=offset)).isoformat()
        flow_id = f"sample_flow_{flow_index + 1}" if flow_index is not None else ""
        if flow_id:
            flow_orders[flow_id] = flow_orders.get(flow_id, 0) + 1
        cadence = "weekly" if name == "定期拉通" else "none"
        task_id = f"sample_task_{index}"
        tasks.append(
            {
                "id": task_id,
                "groupId": groups[group_index]["id"],
                "flowId": flow_id,
                "flowOrder": flow_orders.get(flow_id) if flow_id else None,
                "name": name,
                "reportTo": report_to[group_index],
                "managedObject": managed_person[group_index],
                "deliverable": deliverable,
                "ddl": ddl,
                "urgency": urgency,
                "status": status,
                "completedAt": f"{ddl}T09:00:00.000Z" if status == "completed" else None,
                "recurrenceCadence": cadence,
                "recurrenceStart": (today - timedelta(days=28)).isoformat() if cadence == "weekly" else None,
                "recurrenceEnd": (today + timedelta(days=84)).isoformat() if cadence == "weekly" else None,
                "recurrenceCompletions": [],
                "progressNote": progress,
                "progressUpdatedAt": stamp if progress else None,
                "createdAt": stamp,
                "updatedAt": stamp,
            }
        )
        materials.append(
            {
                "id": f"sample_material_{index}",
                "title": material_title,
                "url": f"https://sharepoint.example.com/weekflow/document-{index}",
                "type": material_type,
                "taskIds": [task_id],
                "flowIds": [flow_id] if flow_id else [],
                "groupIds": [groups[group_index]["id"]],
                "note": "相关 Task 的主要工作资料。",
                "openEvents": [],
                "createdAt": stamp,
                "updatedAt": stamp,
            }
        )
    return {
        "version": 4,
        "groups": groups,
        "flows": flows,
        "tasks": tasks,
        "materials": materials,
        "notes": [],
        "updatedAt": stamp,
    }


def translate_sample(sample):
    data = copy.deepcopy(sample)
    task_names = {}
    for group in data["groups"]:
        group["name"] = GROUP_TRANSLATIONS[group["name"]]
    for flow in data["flows"]:
        flow["name"] = FLOW_TRANSLATIONS[flow["name"]]
    for task in data["tasks"]:
        translated_name = TASK_TRANSLATIONS[task["name"]]
        task_names[task["id"]] = translated_name
        task["name"] = translated_name
        task["deliverable"] = f"{translated_name} deliverable package"
        if task.get("progressNote"):
            task["progressNote"] = (
                "Completed and reviewed with stakeholders."
                if task.get("status") == "completed"
                else "Current work is progressing as planned; the next checkpoint is confirmed."
            )
    type_labels = {
        "document": "Working Document",
        "deliverable": "Deliverable",
        "control": "Control Sheet",
        "folder": "Folder",
    }
    for material in data["materials"]:
        original_title = material.get("title", "")
        extension = Path(original_title).suffix or ".url"
        related_name = next(
            (task_names[task_id] for task_id in material.get("taskIds", []) if task_id in task_names),
            "Shared Resource",
        )
        material["title"] = f"{related_name} {type_labels.get(material.get('type'), 'Document')}{extension}"
        material["note"] = "Primary working document for the related Task."
    serialized = json.dumps(data, ensure_ascii=False)
    remaining = sorted(set(re.findall(r"[\u4e00-\u9fff]+", serialized)))
    if remaining:
        raise AssertionError(f"Untranslated sample content: {remaining}")
    return data


def note_payload(language):
    if language == "en":
        return [
            {
                "id": "note-next-week",
                "title": "Next Week's Task Notes",
                "contentHtml": (
                    "<p>2026-08-19 — Submit the <span style=\"background-color:#C7D2FE\">analysis report</span>.</p>"
                    "<p>2026-08-21 — Hold the report-out meeting and prepare the "
                    "<span style=\"color:#15803D\">meeting materials</span>.</p>"
                ),
                "conversions": [],
                "createdAt": "2026-08-15T03:30:00.000Z",
                "updatedAt": "2026-08-15T03:30:00.000Z",
            },
            {
                "id": "note-schedule",
                "title": "Staff Roster",
                "contentText": "Every Thursday, Joy completes the weekly staff roster.",
                "conversions": [],
                "createdAt": "2026-08-15T03:12:00.000Z",
                "updatedAt": "2026-08-15T03:12:00.000Z",
            },
            {
                "id": "note-progress",
                "title": "Report Materials Progress",
                "contentText": (
                    "Requirements research and data analysis are complete.\n"
                    "Two assumptions in the proposed solution still need validation."
                ),
                "conversions": [],
                "createdAt": "2026-08-15T02:45:00.000Z",
                "updatedAt": "2026-08-15T02:45:00.000Z",
            },
        ]
    return [
        {
            "id": "note-next-week",
            "title": "下周任务记录",
            "contentHtml": (
                "<p>下周三，上交<span style=\"background-color:#C7D2FE\">分析报告</span>。</p>"
                "<p>下周五，需要开汇报会议，提前准备<span style=\"color:#15803D\">会议材料</span>。</p>"
            ),
            "conversions": [],
            "createdAt": "2026-08-15T03:30:00.000Z",
            "updatedAt": "2026-08-15T03:30:00.000Z",
        },
        {
            "id": "note-schedule",
            "title": "排班",
            "contentText": "每周四 Joy 需要完成当周的排班工作。",
            "conversions": [],
            "createdAt": "2026-08-15T03:12:00.000Z",
            "updatedAt": "2026-08-15T03:12:00.000Z",
        },
        {
            "id": "note-progress",
            "title": "汇报材料进度",
            "contentText": "已完成需求调研和数据分析。\n解决方案中有两个假设尚未验证。",
            "conversions": [],
            "createdAt": "2026-08-15T02:45:00.000Z",
            "updatedAt": "2026-08-15T02:45:00.000Z",
        },
    ]


def capture(page, path, width, height, locator=None):
    page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(300)
    target = page.locator(locator) if locator else page
    target.screenshot(path=str(path), animations="disabled")


def close_reminder(page):
    button = page.locator('[data-action="close-ddl-reminder"]')
    if button.count() and button.is_visible():
        button.click()


def visible_han_text(page):
    return page.evaluate(
        r"""() => {
          const values = new Set();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.closest('script, style, [data-language="zh-CN"]')) continue;
            const style = getComputedStyle(parent);
            const rect = parent.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
            const value = (node.nodeValue || '').trim();
            if (/\p{Script=Han}/u.test(value)) values.add(value);
          }
          return [...values].sort();
        }"""
    )


def seed_current_app(page, sample, language):
    notes = note_payload(language)
    progress_task_name = (
        "Design Kaizen Improvement Plan" if language == "en" else "Kaizen改进方案设计"
    )
    progress_entries = (
        [
            {
                "id": "progress-kaizen-1",
                "contentText": "Improvement opportunities have been identified and prioritized.",
                "sourceType": "manual",
                "createdAt": "2026-08-12T02:15:00.000Z",
                "updatedAt": "2026-08-12T02:15:00.000Z",
            },
            {
                "id": "progress-kaizen-2",
                "contentText": (
                    "Requirements research and data analysis are complete.\n"
                    "Two assumptions in the proposed solution still need validation."
                ),
                "sourceType": "quick-note",
                "sourceNoteId": "note-progress",
                "createdAt": "2026-08-15T04:25:00.000Z",
                "updatedAt": "2026-08-15T04:25:00.000Z",
            },
        ]
        if language == "en"
        else [
            {
                "id": "progress-kaizen-1",
                "contentText": "已完成改进机会识别和优先级排序。",
                "sourceType": "manual",
                "createdAt": "2026-08-12T02:15:00.000Z",
                "updatedAt": "2026-08-12T02:15:00.000Z",
            },
            {
                "id": "progress-kaizen-2",
                "contentText": "已完成需求调研和数据分析。\n解决方案中有两个假设尚未验证。",
                "sourceType": "quick-note",
                "sourceNoteId": "note-progress",
                "createdAt": "2026-08-15T04:25:00.000Z",
                "updatedAt": "2026-08-15T04:25:00.000Z",
            },
        ]
    )
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    saved = page.evaluate(
        r"""payload => {
          const checked = App.storage.validateData(payload.sample);
          if (!checked.valid) throw new Error(checked.errors.join('\n'));
          const data = checked.data;
          data.notes = payload.notes;
          data.preferences = {
            documentLibrary: {
              layout: 'list',
              columns: 4,
              groupOrder: [
                'sample_group_4',
                'sample_group_1',
                'sample_group_2',
                'sample_group_3',
                'sample_group_5',
                '__ungrouped__'
              ]
            }
          };
          data.materials.forEach((material, index) => {
            material.openEvents = index < 2
              ? ['2026-08-10T01:00:00.000Z', '2026-08-14T01:00:00.000Z']
              : [];
          });
          const task = data.tasks.find(item => item.name === payload.progressTaskName);
          if (!task) throw new Error('Progress screenshot Task was not found.');
          task.progressEntries = payload.progressEntries;
          task.progressNote = payload.progressEntries[payload.progressEntries.length - 1].contentText;
          task.progressUpdatedAt = payload.progressEntries[payload.progressEntries.length - 1].updatedAt;
          return App.storage.save(data);
        }""",
        {
            "sample": sample,
            "notes": notes,
            "progressTaskName": progress_task_name,
            "progressEntries": progress_entries,
        },
    )
    page.evaluate(
        "language => localStorage.setItem('weekflow-v2.4:language', language)",
        "en" if language == "en" else "zh-CN",
    )
    page.reload()
    page.wait_for_load_state("networkidle")
    close_reminder(page)
    progress_task = next(task for task in saved["tasks"] if task["name"] == progress_task_name)
    return progress_task["id"]


def capture_core(page, language, progress_task_id):
    labels = (
        {
            "home": ZH_OUTPUT / "主页.png",
            "timeline": ZH_OUTPUT / "时间轴看板.png",
            "task": ZH_OUTPUT / "新建task.png",
            "flow": ZH_OUTPUT / "编辑Flow.png",
            "library": ZH_OUTPUT / "资料库.png",
            "dashboard": ZH_OUTPUT / "整体看板.png",
            "report": ZH_OUTPUT / "整体看板-按汇报对象导出.png",
        }
        if language == "zh"
        else {
            "home": EN_OUTPUT / "home.png",
            "timeline": EN_OUTPUT / "task-by-week.png",
            "task": EN_OUTPUT / "create-task.png",
            "flow": EN_OUTPUT / "edit-flow.png",
            "library": EN_OUTPUT / "document-library.png",
            "dashboard": EN_OUTPUT / "overall-dashboard.png",
            "report": EN_OUTPUT / "dashboard-report-to.png",
        }
    )
    page.locator('[data-view="home"]').first.click()
    capture(page, labels["home"], 1435, 618)

    page.locator('[data-view="timeline"]').first.click()
    page.wait_for_timeout(450)
    close_reminder(page)
    capture(page, labels["timeline"], 1600 if language == "en" else 1424, 630)

    page.set_viewport_size({"width": 1435, "height": 648})
    page.locator('[data-action="new-task"]:visible').first.click()
    page.locator("#task-dialog[open]").wait_for(state="visible")
    page.locator("#task-dialog").evaluate("node => { node.scrollTop = 82; }")
    page.wait_for_timeout(250)
    page.locator("#task-dialog").screenshot(path=str(labels["task"]), animations="disabled")
    page.locator('#task-dialog [data-action="close-task-dialog"]').first.click()

    page.locator('[data-view="timeline"]').first.click()
    page.wait_for_timeout(300)
    page.locator('[data-flow-id="sample_flow_1"] .flow-edit').click()
    page.locator("#flow-dialog[open]").wait_for(state="visible")
    capture(page, labels["flow"], 1435, 650, "#flow-dialog")
    page.locator('#flow-dialog [data-action="close-flow-dialog"]').first.click()

    page.locator('[data-view="materials"]').first.click()
    page.wait_for_timeout(350)
    page.locator('[data-action="materials-layout-list"]').click()
    checkbox = page.locator('[data-material-select="true"]').first
    checkbox.check()
    capture(page, labels["library"], 1432, 649)

    page.locator('[data-view="dashboard"]').first.click()
    page.wait_for_timeout(300)
    page.locator('[data-dashboard-module="group"]').click()
    page.wait_for_timeout(300)
    capture(page, labels["dashboard"], 1430, 592)

    page.locator('[data-dashboard-module="reportTo"]').click()
    page.wait_for_timeout(300)
    page.locator("#report-overview-title").scroll_into_view_if_needed()
    page.evaluate("window.scrollBy(0, -78)")
    capture(page, labels["report"], 1434, 628)

    if language == "en":
        capture_english_features(page, progress_task_id)


def capture_english_features(page, progress_task_id):
    page.locator('[data-view="notes"]').first.click()
    page.locator('[data-note-id="note-next-week"]').click()
    capture(page, EN_OUTPUT / "quick-notes.png", 1435, 737)

    page.locator('[data-note-id="note-progress"]').click()
    page.locator('[data-action="note-to-progress"]').click()
    page.locator("#note-progress-dialog[open]").wait_for(state="visible")
    page.locator("#note-progress-group").select_option("sample_group_5")
    page.locator("#note-progress-task").select_option(progress_task_id)
    capture(page, EN_OUTPUT / "note-to-progress.png", 1435, 700, "#note-progress-dialog")
    page.locator('#note-progress-dialog [data-action="close-note-progress"]').first.click()

    page.locator('[data-view="timeline"]').first.click()
    page.wait_for_timeout(350)
    page.locator(f'[data-task-id="{progress_task_id}"] .progress-button').dblclick()
    page.locator("#progress-dialog[open]").wait_for(state="visible")
    capture(page, EN_OUTPUT / "progress-history.png", 1435, 730, "#progress-dialog")
    page.locator('#progress-dialog [data-action="close-progress-dialog"]').first.click()

    page.locator('[data-view="materials"]').first.click()
    selected = page.locator('[data-material-select="true"]:checked')
    if selected.count():
        selected.first.uncheck()
    page.locator('[data-action="materials-layout-group"]').click()
    page.wait_for_timeout(350)
    page.locator("#toast-region").evaluate("node => node.replaceChildren()")
    capture(page, EN_OUTPUT / "document-library-group.png", 1425, 639)

    page.locator('[data-view="notes"]').first.click()
    page.locator('[data-note-id="note-next-week"]').click()
    page.locator('[data-action="note-to-task-drafts"]').click()
    page.locator("#task-dialog[open]").wait_for(state="visible")
    capture(page, EN_OUTPUT / "task-draft-conversion.png", 1401, 632)


def main():
    ZH_OUTPUT.mkdir(exist_ok=True)
    EN_OUTPUT.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        sample_zh = build_chinese_sample()
        sample_en = translate_sample(sample_zh)

        for language, sample, locale in (
            ("zh", sample_zh, "zh-CN"),
            ("en", sample_en, "en-US"),
        ):
            context = browser.new_context(
                viewport={"width": 1435, "height": 650},
                device_scale_factor=2,
                color_scheme="light",
                locale=locale,
            )
            page = context.new_page()
            errors = []
            page.on(
                "console",
                lambda message: errors.append(message.text) if message.type == "error" else None,
            )
            page.on("pageerror", lambda error: errors.append(str(error)))
            progress_task_id = seed_current_app(page, sample, language)
            capture_core(page, language, progress_task_id)
            if language == "en":
                han = visible_han_text(page)
                if han:
                    raise AssertionError(f"Visible untranslated English UI/data: {han}")
            if errors:
                raise AssertionError(f"Browser errors while capturing {language}: {errors}")
            context.close()
        browser.close()
    print("Bilingual README screenshots captured successfully")


if __name__ == "__main__":
    main()
