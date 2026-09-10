/* Bulk workbench: selection, explicit previews and archive browsing. */
(function () {
  "use strict";
  window.App.bulkUi = { mount: mount };
  function mount(options) {
    var App = window.App, utils = App.utils, bulk = App.bulkActions;
    var host = document.getElementById("bulk-view");
    var archived = false, kind = "task", selected = new Set(), rows = [];
    var search = "", groupId = "", status = "", recurrence = "";
    var plan = null, dialogBody = null;
    function t(zh, en) { return App.i18n.isEnglish() ? en : zh; }
    function el(tag, cls, text) { return utils.el(tag, cls || "", text); }
    function button(text, action, cls) {
      var node = el("button", cls || "button button-quiet", text);
      node.type = "button"; node.addEventListener("click", action); return node;
    }
    function label(text, input) { var node = el("label", "bulk-field"); node.append(el("span", "", text), input); return node; }
    function select(items, value, change) {
      var node = el("select");
      items.forEach(function (item) { var opt = el("option", "", item[1]); opt.value = item[0]; node.append(opt); });
      node.value = value;
      if (change) node.addEventListener("change", function () { change(node.value); selected.clear(); renderRows(); });
      return node;
    }
    var title = el("h1");
    var toolbar = el("div", "view-toolbar");
    var intro = el("div"); intro.append(title, el("p", "bulk-help", t("查看归档的 Task、Flow 或分组，也可复选后批量恢复。", "Review archived Tasks, Flows or Groups, and select records to restore.")));
    toolbar.append(intro, button(t("返回 Task 看板复选", "Select on Task Board"), function () { options.switchView("timeline"); }));
    var filterBar = el("div", "bulk-filters");
    var kindInput = select([["task", "Task"], ["flow", "Flow"], ["group", t("分组", "Group")]], kind, function (v) { kind = v; });
    var searchInput = el("input"); searchInput.type = "search"; searchInput.placeholder = t("搜索名称、人员、进度或资料", "Search names, people, progress or documents");
    searchInput.addEventListener("input", function () { search = searchInput.value; selected.clear(); renderRows(); });
    var groupInput = select([], "", function (v) { groupId = v; });
    var statusInput = select([["", t("全部状态", "All Statuses")], ["pending", t("未完成", "Incomplete")], ["completed", t("已完成", "Completed")]], "", function (v) { status = v; });
    var recurrenceInput = select([["", t("全部周期", "All Recurrences")], ["none", t("非周期 Task", "Non-recurring Tasks")], ["recurring", t("周期 Task", "Recurring Tasks")]], "", function (v) { recurrence = v; });
    filterBar.append(label(t("选择层级", "Select Level"), kindInput), label(t("搜索", "Search"), searchInput), label(t("分组", "Group"), groupInput), label(t("Task 状态", "Task Status"), statusInput), label(t("Task 周期", "Task Recurrence"), recurrenceInput));
    var scopeHelp = el("p", "bulk-help");
    var actionBar = el("div", "bulk-action-bar");
    var count = el("strong"); count.setAttribute("aria-live", "polite");
    var selectAll = el("input"); selectAll.type = "checkbox";
    var allLabel = label(t("全选当前结果", "Select All Results"), selectAll);
    selectAll.addEventListener("change", function () { selected.clear(); if (selectAll.checked) rows.filter(selectable).forEach(function (row) { selected.add(row.id); }); renderRows(); });
    var clear = button(t("取消选择", "Clear Selection"), function () { selected.clear(); renderRows(); });
    var edit = button(t("批量修改", "Bulk Edit"), openEdit);
    var archive = button("", openArchive, "button button-primary");
    actionBar.append(allLabel, count, clear, edit, archive);
    var tableWrap = el("div", "table-wrap bulk-table-wrap");
    var table = el("table", "bulk-table"), head = el("thead"), body = el("tbody");
    table.append(head, body); tableWrap.append(table);
    var empty = el("p", "bulk-empty", t("没有符合条件的记录。", "No matching records."));
    host.append(toolbar, filterBar, scopeHelp, actionBar, tableWrap, empty);
    var dialog = el("dialog", "modal modal-large bulk-dialog");
    dialog.setAttribute("aria-labelledby", "bulk-dialog-title");
    document.body.append(dialog);
    function showError(error) {
      var messages = {
        "invalid-selection": t("选择已失效，请重新选择。", "The selection changed. Please select again."),
        "restore-parent-first": t("请先恢复所属分组或 Flow。", "Restore the parent Group or Flow first."),
        "already-archived": t("所选记录已归档，请刷新选择。", "A selected record is archived. Refresh the selection."),
        "invalid-date": t("请填写有效的 DDL。", "Enter a valid DDL."),
        "invalid-shift": t("平移天数须为 -3650 至 3650 的整数。", "Enter a whole number of days between -3650 and 3650."),
        "invalid-person": t("管理对象最多 160 个字符。", "Managed person must be at most 160 characters."),
        "invalid-urgency": t("请选择有效的紧急程度。", "Select a valid urgency."),
        "stale-preview": t("数据已变化，请关闭并重新预览。", "Data changed. Close this dialog and preview again.")
      };
      var text = messages[error.message];
      if (error.message.indexOf("recurring-ddl:") === 0) text = t("周期 Task 的 DDL 请逐条编辑，以核对周期范围和完成记录。请取消所选周期 Task 后再批量改期：", "Edit recurring DDLs individually to review their schedule and completion history. Deselect recurring Tasks before changing dates: ") + error.message.slice(14);
      options.toast(text || error.message, "warning", 7000);
    }
    function selectable(item) { return !archived || !bulk.parentArchived(options.getData(), kind, item); }
    function renderRows() {
      var data = options.getData();
      var key = { task: "tasks", flow: "flows", group: "groups" }[kind];
      rows = data[key].filter(function (item) {
        if (bulk.isArchived(data, kind, item) !== archived) return false;
        if (groupId && (kind === "group" ? item.id : item.groupId) !== groupId) return false;
        if (kind === "task" && status && item.status !== status) return false;
        if (kind === "task" && recurrence && App.dateUtils.isRecurringTask(item) !== (recurrence === "recurring")) return false;
        var group = data.groups.find(function (g) { return g.id === item.groupId; });
        var flow = data.flows.find(function (f) { return f.id === item.flowId; });
        var docs = data.materials.filter(function (m) { return kind === "task" ? m.taskIds.includes(item.id) : kind === "flow" ? m.flowIds.includes(item.id) : m.groupIds.includes(item.id); });
        var haystack = [item.name, item.reportTo, item.managedObject, item.deliverable, group && group.name, flow && flow.name, (item.progressEntries || []).map(function (p) { return p.contentText; }).join(" "), docs.map(function (m) { return m.title + " " + m.url; }).join(" ")].join(" ");
        return utils.normalizeText(haystack).includes(utils.normalizeText(search));
      });
      selected = new Set(Array.from(selected).filter(function (id) { return rows.some(function (row) { return row.id === id && selectable(row); }); }));
      statusInput.disabled = recurrenceInput.disabled = kind !== "task";
      var available = rows.filter(selectable).length;
      count.textContent = t("已选 ", "Selected ") + selected.size + " / " + rows.length;
      selectAll.checked = available > 0 && selected.size === available;
      selectAll.indeterminate = selected.size > 0 && selected.size < available;
      selectAll.disabled = !available;
      edit.hidden = archived; edit.disabled = archive.disabled = clear.disabled = !selected.size;
      archive.textContent = archived ? t("批量恢复", "Restore Selected") : t("批量归档", "Archive Selected");
      scopeHelp.textContent = archived
        ? t("归档保留进度与资料，且不参与日常统计和临期提醒。灰色选择框表示需先恢复所属分组或 Flow；恢复父级不会恢复此前单独归档的内容。", "Archives retain progress and documents and are excluded from daily statistics and reminders. Disabled selections require restoring their parent first. Previously archived children remain archived when a parent is restored.")
        : t("选择分组或 Flow 会包含其当前未归档的下级内容；批量修改只作用于其中的 Task。筛选变化后会清空选择。", "Selecting a Group or Flow includes its active children; bulk edits apply to its Tasks. Changing filters clears the selection.");
      utils.clear(head); var hr = el("tr");
      [t("选择", "Select"), t("名称 / 所属层级", "Name / Hierarchy"), kind === "task" ? "DDL" : t("Task 数量", "Task Count"), t("状态", "Status"), t("管理对象 / 紧急程度", "Managed Person / Urgency"), archived ? t("归档时间", "Archived At") : t("查看", "View")].forEach(function (text) { hr.append(el("th", "", text)); }); head.append(hr);
      utils.clear(body);
      rows.forEach(function (item) {
        var row = el("tr"); row.classList.toggle("is-selected", selected.has(item.id));
        var checkCell = el("td"), check = el("input"); check.type = "checkbox"; check.checked = selected.has(item.id); check.disabled = !selectable(item); check.setAttribute("aria-label", t("选择 ", "Select ") + item.name);
        check.addEventListener("change", function () { if (check.checked) selected.add(item.id); else selected.delete(item.id); renderRows(); }); checkCell.append(check);
        var nameCell = el("td");
        nameCell.append(button(item.name, function () { if (archived) openDetails(item); else options.openItem(kind, item.id); }, "bulk-name"));
        var group = data.groups.find(function (g) { return g.id === item.groupId; });
        var flow = data.flows.find(function (f) { return f.id === item.flowId; });
        nameCell.append(el("small", "bulk-meta", [group && group.name, flow && flow.name].filter(Boolean).join(" / ")));
        if (!selectable(item)) nameCell.append(el("small", "bulk-meta", t("请先恢复所属分组 / Flow", "Restore parent Group / Flow first")));
        var taskCount = data.tasks.filter(function (task) { return (kind === "group" ? task.groupId === item.id : task.flowId === item.id) && bulk.isArchived(data, "task", task) === archived; }).length;
        var due = el("td", "", kind === "task" ? item.ddl : String(taskCount));
        if (kind === "task" && App.dateUtils.isRecurringTask(item)) due.append(el("small", "bulk-meta", t("周期 Task", "Recurring Task")));
        var state = el("td", "", kind === "task" ? App.i18n.statusLabels()[item.status] : "—");
        var person = el("td", "", kind === "task" ? (item.managedObject || "—") + " / " + App.i18n.urgencyLabels()[item.urgency] : "—");
        var actions = el("td");
        if (archived) actions.append(el("small", "", item.archivedAt ? new Date(item.archivedAt).toLocaleString(App.i18n.getLanguage()) : t("随父级归档", "Archived with parent")));
        if (kind === "task") {
          actions.append(button(t("进度", "Progress"), function () { options.openProgress(item.id); }, "text-button"), button(t("资料", "Documents"), function () { options.openDocuments(item.id); }, "text-button"));
        }
        row.append(checkCell, nameCell, due, state, person, actions); body.append(row);
      });
      empty.hidden = rows.length !== 0; tableWrap.hidden = !rows.length;
    }
    function openDetails(item) {
      resetDialog(item.name);
      var data = options.getData();
      if (kind === "task") {
        var fields = el("dl", "bulk-detail-fields");
        [["DDL", item.ddl], [t("汇报对象", "Report To"), item.reportTo], [t("管理对象", "Managed Person"), item.managedObject], [t("交付物", "Deliverable"), item.deliverable]].forEach(function (field) {
          fields.append(el("dt", "", field[0]), el("dd", "", field[1] || "—"));
        });
        dialogBody.append(fields, el("h3", "", t("进度历史", "Progress History")));
        (item.progressEntries || []).forEach(function (entry) {
          var content = el("div", "rich-text-content bulk-detail-progress");
          content.innerHTML = App.richText.sanitizeHtml(entry.contentHtml);
          dialogBody.append(el("small", "bulk-meta", new Date(entry.updatedAt).toLocaleString(App.i18n.getLanguage())), content);
        });
      } else {
        dialogBody.append(el("p", "bulk-help", t("下级 Task（包含此前单独归档的任务）", "Child Tasks (including previously archived Tasks)")));
        data.tasks.filter(function (task) { return kind === "group" ? task.groupId === item.id : task.flowId === item.id; }).forEach(function (task) {
          dialogBody.append(el("p", "", task.name + " · " + task.ddl));
        });
      }
      dialogBody.append(button(t("关闭", "Close"), function () { dialog.close(); }));
      dialog.showModal();
    }
    function resetDialog(text) {
      utils.clear(dialog); plan = null;
      var heading = el("div", "modal-head"), h = el("h2", "", text); h.id = "bulk-dialog-title";
      heading.append(h, button("×", function () { dialog.close(); }, "icon-button")); heading.lastChild.setAttribute("aria-label", t("关闭", "Close"));
      dialogBody = el("div", "bulk-dialog-body");
      dialog.append(heading, dialogBody);
    }
    function preview(value, container, apply) {
      plan = value; utils.clear(container);
      (plan.skipped || []).forEach(function (item) {
        container.append(el("p", "bulk-help", item.name + " — " + (item.reason === "completed"
          ? t("已完成，保持原完成日期", "Already completed; completion date preserved")
          : t("当前无可完成周期，已跳过", "No completable period right now; skipped"))));
      });
      if (!plan.changes.length) { container.append(el("p", "", t("没有需要修改的内容。", "No changes to apply."))); apply.disabled = true; return; }
      var counts = { group: 0, flow: 0, task: 0 }, pending = 0;
      plan.changes.forEach(function (c) { counts[c.kind]++; if (c.kind === "task" && c.before.status !== "completed") pending++; });
      container.append(el("p", "bulk-preview-summary", t("将影响：", "Will affect: ") + counts.group + " Group · " + counts.flow + " Flow · " + counts.task + " Task"));
      if (plan.type === "archive" && pending) container.append(el("p", "bulk-preview-warning", t("其中有 ", "Includes ") + pending + t(" 条未完成 Task；归档不会将它们标记为完成。", " incomplete Tasks; archiving will not mark them completed.")));
      var wrap = el("div", "table-wrap bulk-preview-table"), table = el("table"), body = el("tbody");
      plan.changes.forEach(function (change) {
        var row = el("tr"); row.append(el("th", "", change.kind + " · " + change.name));
        var details = el("td");
        if (plan.type === "edit") {
          [["ddl", "DDL"], ["urgency", t("紧急程度", "Urgency")], ["managedObject", t("管理对象", "Managed Person")]].forEach(function (field) {
            var a = change.before[field[0]], b = change.after[field[0]];
            if (a === b) return;
            if (field[0] === "urgency") { a = App.i18n.urgencyLabels()[a]; b = App.i18n.urgencyLabels()[b]; }
            details.append(el("div", "", field[1] + ": " + (a || "—") + " → " + (b || "—")));
          });
        } else if (plan.type === "complete") {
          details.textContent = change.recurring
            ? t("完成本期 DDL：", "Complete current DDL: ") + change.occurrenceDdl + t("（同时补齐此前各期）", " (including earlier periods)")
            : t("未完成 → 已完成 · ", "Incomplete → Completed · ") + change.after.completedAt;
        } else if (plan.type === "delete") {
          details.textContent = (change.before.archivedAt ? t("已归档 · ", "Archived · ") : "") + (change.kind === "task"
            ? t("永久删除 Task 及其进度记录", "Permanently delete Task and its progress history")
            : t("永久删除此层级", "Permanently delete this level"));
        } else details.textContent = plan.type === "archive" ? t("当前工作 → 已归档", "Active → Archived") : t("已归档 → 当前工作", "Archived → Active");
        row.append(details); body.append(row);
      });
      table.append(body); wrap.append(table); container.append(wrap); apply.disabled = false;
    }
    function applyPreview() {
      if (!plan || !plan.changes.length) return;
      try {
        var next = bulk.applyPlan(options.getData(), plan);
        if (!options.commit(next, t("批量操作已保存。", "Bulk changes saved."))) return;
        dialog.close(); selected.clear();
        if (options.onApplied) options.onApplied();
        renderRows();
      } catch (error) { showError(error); }
    }
    function openArchive() {
      resetDialog(archived ? t("预览批量恢复", "Preview Restore") : t("预览批量归档", "Preview Archive"));
      var content = el("div"), actions = el("div", "modal-actions");
      var apply = button(t("确认应用", "Apply Changes"), applyPreview, "button button-primary");
      actions.append(button(t("取消", "Cancel"), function () { dialog.close(); }), apply); dialogBody.append(content); dialog.append(actions);
      try {
        preview(bulk.planArchive(options.getData(), kind, Array.from(selected), archived, new Date().toISOString(), utils.uid("archive")), content, apply); dialog.showModal();
      } catch (error) { showError(error); }
    }
    function openTaskAction(action) {
      var deleting = action === "delete";
      resetDialog(deleting ? t("预览批量删除", "Preview Bulk Delete") : t("预览批量完成", "Preview Bulk Completion"));
      var content = el("div"), actions = el("div", "modal-actions");
      var apply = button(deleting ? t("确认永久删除", "Delete Permanently") : t("确认完成", "Confirm Completion"), applyPreview,
        deleting ? "button button-danger" : "button button-primary");
      var confirm = null;
      if (deleting) {
        dialogBody.append(el("p", "bulk-preview-warning", t(
          "将永久删除以下记录及任务进度，无法撤销。删除分组或 Flow 会包括其全部下级任务（含已归档项）。资料库条目和随手记保留，仅移除已删除记录的资料关联。",
          "These records and Task progress will be permanently deleted. Deleting a Group or Flow includes all its child Tasks, including archives. Document Library entries and Quick Notes are kept; links to deleted records are removed.")));
        confirm = el("input"); confirm.type = "checkbox";
        actions.append(label(t("我确认永久删除上述记录", "I confirm permanent deletion of these records"), confirm));
        confirm.addEventListener("change", function () { apply.disabled = !confirm.checked || !plan || !plan.changes.length; });
      }
      actions.append(button(t("取消", "Cancel"), function () { dialog.close(); }), apply);
      dialogBody.append(content); dialog.append(actions);
      try {
        var nextPlan = deleting
          ? bulk.planDelete(options.getData(), kind, Array.from(selected))
          : bulk.planComplete(options.getData(), kind, Array.from(selected), new Date());
        preview(nextPlan, content, apply);
        if (confirm) apply.disabled = true;
        dialog.showModal();
      } catch (error) { showError(error); }
    }
    function openEdit() {
      resetDialog(t("批量修改 Task", "Bulk Edit Tasks"));
      var fields = el("div", "bulk-edit-fields");
      var dateMode = select([["keep", t("不修改 DDL", "Keep DDL")], ["set", t("设为同一天", "Set Same Date")], ["shift", t("按天数平移", "Shift by Days")]], "keep");
      var date = el("input"); date.type = "date"; date.disabled = true;
      var days = el("input"); days.type = "number"; days.step = "1"; days.min = "-3650"; days.max = "3650"; days.value = "0"; days.disabled = true;
      var urgency = select([["", t("不修改", "Keep Unchanged")], ["high", t("高", "High")], ["medium", t("中", "Medium")], ["low", t("低", "Low")]], "");
      var personMode = select([["keep", t("不修改", "Keep Unchanged")], ["set", t("替换为", "Replace With")], ["clear", t("清空管理对象", "Clear Managed Person")]], "keep");
      var person = el("input"); person.maxLength = 160; person.disabled = true;
      person.setAttribute("list", "task-managed-object-options");
      fields.append(label(t("DDL 操作", "DDL Action"), dateMode), label("DDL", date), label(t("平移天数（负数为提前）", "Days (negative = earlier)"), days), label(t("紧急程度", "Urgency"), urgency), label(t("管理对象操作", "Managed Person Action"), personMode), label(t("管理对象", "Managed Person"), person));
      var content = el("div"); content.setAttribute("aria-live", "polite");
      var actions = el("div", "modal-actions");
      var apply = button(t("确认应用", "Apply Changes"), applyPreview, "button button-primary"); apply.disabled = true;
      var previewButton = button(t("预览修改", "Preview Changes"), function () {
        try {
          var patch = { ddlMode: dateMode.value, ddl: date.value, days: days.value === "" ? NaN : Number(days.value), urgency: urgency.value };
          if (personMode.value === "set") {
            if (!person.value.trim()) throw new Error(t("请填写管理对象；如需清空，请选择“清空管理对象”。", "Enter a managed person, or select Clear Managed Person."));
            patch.managedObject = person.value;
          } else if (personMode.value === "clear") patch.managedObject = "";
          preview(bulk.planEdit(options.getData(), kind, Array.from(selected), patch, new Date().toISOString()), content, apply);
        } catch (error) { plan = null; apply.disabled = true; utils.clear(content); showError(error); }
      });
      function invalidate() { plan = null; apply.disabled = true; utils.clear(content); date.disabled = dateMode.value !== "set"; days.disabled = dateMode.value !== "shift"; person.disabled = personMode.value !== "set"; }
      fields.addEventListener("input", invalidate); fields.addEventListener("change", invalidate);
      actions.append(button(t("取消", "Cancel"), function () { dialog.close(); }), previewButton, apply);
      dialogBody.append(fields, el("p", "bulk-help", t("周期 Task 可批量修改紧急程度和管理对象；DDL 请逐条编辑以核对周期与完成记录。", "Bulk edit urgency and managed person for recurring Tasks. Edit their DDL individually to review recurrence and completion history.")), content); dialog.append(actions); dialog.showModal();
    }
    return {
      openSelection: function (action, level, ids) {
        if (!ids.length || dialog.open) return;
        archived = false;
        kind = level;
        selected = new Set(ids);
        if (action === "edit") openEdit();
        else if (action === "complete" || action === "delete") openTaskAction(action);
        else openArchive();
      },
      render: function (view) {
        var nextArchived = view === "archived";
        if (archived !== nextArchived) { selected.clear(); search = ""; searchInput.value = ""; groupId = ""; status = ""; statusInput.value = ""; recurrence = ""; recurrenceInput.value = ""; }
        archived = nextArchived;
        kindInput.value = kind;
        title.textContent = archived ? t("已归档", "Archived") : t("批量操作", "Bulk Actions");
        var previousGroup = groupId; utils.clear(groupInput);
        [["", t("全部分组", "All Groups")]].concat(options.getData().groups.map(function (g) { return [g.id, g.name]; })).forEach(function (item) { var option = el("option", "", item[1]); option.value = item[0]; groupInput.append(option); });
        groupInput.value = previousGroup; if (groupInput.selectedIndex < 0) { groupId = ""; groupInput.value = ""; }
        renderRows();
      }
    };
  }
})();
