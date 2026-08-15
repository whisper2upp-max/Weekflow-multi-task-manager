import { useEffect, useMemo, useState } from "react";
import type { RecurrenceCadence, TaskStatus, Urgency } from "../../../shared/types";
import * as dates from "../../../shared/date-utils";
import * as parser from "../../../shared/task-draft-parser";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import { tConfirm } from "../../lib/i18n";
import DateInput from "../DateInput";
import RichTextView from "../RichTextView";

interface DraftForm {
  name: string;
  groupId: string;
  flowId: string;
  ddl: string;
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string;
  recurrenceEnd: string;
  urgency: Urgency | "";
  reportTo: string;
  managedObject: string;
  deliverable: string;
}
interface Candidate {
  id: string;
  sourceText: string;
  recognizedFields: string[];
  suggestions: parser.DraftSuggestion[];
  status: "pending" | "saved" | "skipped";
  taskId: string | null;
  form: DraftForm;
}

function blankForm(groupId = ""): DraftForm {
  return {
    name: "", groupId, flowId: "", ddl: "", recurrenceCadence: "none",
    recurrenceStart: "", recurrenceEnd: "", urgency: "", reportTo: "", managedObject: "", deliverable: ""
  };
}

export default function TaskDraftsDialog() {
  const dialog = useUiStore((state) => state.dialog?.type === "taskDrafts" ? state.dialog : null);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const data = useDataStore((state) => state.data);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const requestClose = (): void => {
    if (candidates.length && !tConfirm("Task 草稿转换尚未完成，退出后已创建的 Task 会保留，但本次转换进度不会记录。仍要退出吗？")) return;
    closeDialog();
  };
  const ref = useModalDialog(Boolean(dialog), requestClose);
  const note = dialog ? data?.notes.find((item) => item.id === dialog.noteId) : undefined;
  const current = candidates[index];
  const flows = useMemo(() => (data?.flows || []).filter((flow) => flow.groupId === current?.form.groupId).sort((a, b) => Number(a.order) - Number(b.order)), [data?.flows, current?.form.groupId]);
  const reportToOptions = useMemo(
    () => useDataStore.getState().getPersonSuggestions("reportTo"),
    [data?.tasks]
  );
  const managedObjectOptions = useMemo(
    () => useDataStore.getState().getPersonSuggestions("managedObject"),
    [data?.tasks]
  );

  useEffect(() => {
    if (!dialog) return;
    const currentData = useDataStore.getState().data;
    const currentNote = currentData?.notes.find((item) => item.id === dialog.noteId);
    if (!currentData || !currentNote || !currentData.groups.length) {
      useUiStore.getState().pushToast("请先创建分组，并保存有效笔记。", "warning");
      closeDialog();
      return;
    }
    const reportToValues = useDataStore.getState().getPersonSuggestions("reportTo");
    const managedObjectValues = useDataStore.getState().getPersonSuggestions("managedObject");
    const parsed = parser.parse(currentNote.contentText, {
      groups: currentData.groups,
      flows: currentData.flows,
      reportToValues,
      managedObjectValues,
      referenceDate: new Date()
    });
    const firstGroup = currentData.groups.slice().sort((a, b) => Number(a.order) - Number(b.order))[0].id;
    setCandidates(parsed.map((item) => ({
      id: crypto.randomUUID(),
      sourceText: item.sourceText,
      recognizedFields: item.recognizedFields,
      suggestions: item.suggestions,
      status: "pending",
      taskId: null,
      form: {
        name: item.taskName,
        groupId: item.groupId || firstGroup,
        flowId: item.flowId,
        ddl: item.ddl,
        recurrenceCadence: item.recurrenceCadence,
        recurrenceStart: item.recurrenceStart,
        recurrenceEnd: item.recurrenceEnd,
        urgency: item.urgency,
        reportTo: item.reportTo,
        managedObject: item.managedObject,
        deliverable: item.deliverable
      }
    })));
    setIndex(0);
    setSaving(false);
  }, [dialog, closeDialog]);

  if (!dialog || !note || !data || !current) return null;
  const patchForm = (patch: Partial<DraftForm>): void => {
    setCandidates((all) => all.map((candidate, candidateIndex) => candidateIndex === index
      ? { ...candidate, form: { ...candidate.form, ...patch }, status: candidate.status === "skipped" ? "pending" : candidate.status }
      : candidate));
  };
  const nextPending = (from: number): number => {
    for (let cursor = from + 1; cursor < candidates.length; cursor += 1) if (candidates[cursor].status === "pending") return cursor;
    for (let cursor = 0; cursor < from; cursor += 1) if (candidates[cursor].status === "pending") return cursor;
    return -1;
  };
  const counts = candidates.reduce((result, item) => ({ ...result, [item.status]: result[item.status] + 1 }), { pending: 0, saved: 0, skipped: 0 });

  const saveCurrent = (event: React.FormEvent): void => {
    event.preventDefault();
    if (saving) return;
    const form = current.form;
    if (!form.name.trim() || !form.groupId || !dates.formatDate(form.ddl) || !form.urgency || !form.reportTo.trim() || !form.deliverable.trim()) {
      useUiStore.getState().pushToast("请补齐 Task name、分组、DDL、紧急程度、汇报对象和交付物。", "error");
      return;
    }
    if (form.recurrenceCadence !== "none" && (!dates.formatDate(form.recurrenceStart) || !dates.formatDate(form.recurrenceEnd))) {
      useUiStore.getState().pushToast("周期 Task 必须填写周期开始和周期结束日期。", "error");
      return;
    }
    setSaving(true);
    const existingTaskIds = new Set(useDataStore.getState().data?.tasks.map((task) => task.id) || []);
    const taskStatus: TaskStatus = "pending";
    void useDataStore.getState().saveTask({
      id: current.taskId || undefined,
      groupId: form.groupId,
      flowId: form.flowId || null,
      name: form.name.trim(),
      reportTo: form.reportTo.trim(),
      managedObject: form.managedObject.trim(),
      deliverable: form.deliverable.trim(),
      ddl: dates.formatDate(form.ddl),
      urgency: form.urgency as Urgency,
      status: taskStatus,
      completedAt: null,
      recurrenceCadence: form.recurrenceCadence,
      recurrenceStart: form.recurrenceCadence === "none" ? null : dates.formatDate(form.recurrenceStart),
      recurrenceEnd: form.recurrenceCadence === "none" ? null : dates.formatDate(form.recurrenceEnd)
    }).then((ok) => {
      setSaving(false);
      if (!ok) return;
      const tasksAfterSave = useDataStore.getState().data?.tasks || [];
      const task = current.taskId
        ? tasksAfterSave.find((item) => item.id === current.taskId)
        : tasksAfterSave.find((item) => !existingTaskIds.has(item.id));
      setCandidates((all) => all.map((candidate, candidateIndex) => candidateIndex === index
        ? { ...candidate, taskId: task?.id || candidate.taskId, status: "saved" }
        : candidate));
      const next = nextPending(index);
      if (next >= 0) setIndex(next);
      else useUiStore.getState().pushToast("所有草稿均已处理，可复核后点击“完成转换”。");
    });
  };

  const addCandidate = (): void => {
    const groupId = current.form.groupId || data.groups[0]?.id || "";
    setCandidates((all) => all.concat({ id: crypto.randomUUID(), sourceText: "手动增加的 Task 草稿", recognizedFields: [], suggestions: [], status: "pending", taskId: null, form: blankForm(groupId) }));
    setIndex(candidates.length);
  };
  const skip = (): void => {
    setCandidates((all) => all.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, status: candidate.status === "skipped" ? "pending" : "skipped" } : candidate));
    const next = nextPending(index);
    if (next >= 0) setIndex(next);
  };
  const complete = (): void => {
    if (candidates.some((candidate) => candidate.status === "pending")) {
      useUiStore.getState().pushToast("请先保存或明确跳过全部 Task 草稿。", "warning");
      return;
    }
    const taskIds = candidates.map((candidate) => candidate.taskId).filter((id): id is string => Boolean(id));
    void useDataStore.getState().recordNoteTaskConversion(note.id, taskIds, counts.skipped).then((ok) => { if (ok) closeDialog(); });
  };

  const recognition = current.recognizedFields.length
    ? `已预填：${current.recognizedFields.join("、")}`
    : "未识别到可可靠预填的字段，请根据原笔记补充必填信息。";

  return (
    <dialog ref={ref} id="task-drafts-dialog" className="modal modal-large task-dialog task-draft-dialog is-note-conversion">
      <aside className="task-draft-source-pane">
        <div className="task-draft-source-head">
          <div><p className="eyebrow">Source note</p><h3 data-user-content="true">{note.title}</h3></div>
          <span>可选择并复制原文</span>
        </div>
        <RichTextView className="task-draft-source-content" html={note.contentHtml} />
      </aside>
      <form method="dialog" noValidate onSubmit={saveCurrent}>
          <div className="modal-head"><div><p className="eyebrow">Task draft</p><h2>{current.taskId ? "复核已创建 Task" : "确认 Task 草稿"}</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={requestClose}>×</button></div>
          <div className="task-draft-conversion-bar">
            <div><strong>识别到 {candidates.length} 个潜在 Task，正在编辑第 {index + 1} 个</strong><span>{counts.pending} 个待处理 · {counts.saved} 个已保存 · {counts.skipped} 个已跳过</span></div>
            <div className="task-draft-nav-actions"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一个</button><button type="button" disabled={index === candidates.length - 1} onClick={() => setIndex(index + 1)}>下一个 →</button><button type="button" onClick={addCandidate}>＋ 增加 Task</button></div>
          </div>
          <p className="task-draft-recognition">{recognition}{current.suggestions.map((suggestion) => ` · 可能的 ${suggestion.field}：${suggestion.value}`).join("")}</p>
          <div className="form-grid task-draft-form-grid">
            <label className="form-field form-field-wide"><span>Task name <em>*</em></span><input maxLength={160} value={current.form.name} onChange={(event) => patchForm({ name: event.target.value })} /></label>
            <label className="form-field"><span>分组 <em>*</em></span><select value={current.form.groupId} onChange={(event) => patchForm({ groupId: event.target.value, flowId: "" })}>{data.groups.slice().sort((a, b) => Number(a.order) - Number(b.order)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="form-field"><span>Flow</span><select value={current.form.flowId} onChange={(event) => patchForm({ flowId: event.target.value })}><option value="">不加入 Flow</option>{flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
            <label className="form-field"><span>DDL <em>*</em></span><DateInput value={current.form.ddl} onChange={(event) => patchForm({ ddl: event.target.value })} /></label>
            <label className="form-field"><span>周期生成</span><select value={current.form.recurrenceCadence} onChange={(event) => patchForm({ recurrenceCadence: event.target.value as RecurrenceCadence })}><option value="none">不重复</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label>
            {current.form.recurrenceCadence === "none" ? null : <><label className="form-field"><span>周期开始 <em>*</em></span><DateInput value={current.form.recurrenceStart} onChange={(event) => patchForm({ recurrenceStart: event.target.value })} /></label><label className="form-field"><span>周期结束 <em>*</em></span><DateInput value={current.form.recurrenceEnd} onChange={(event) => patchForm({ recurrenceEnd: event.target.value })} /></label></>}
            <label className="form-field"><span>紧急程度 <em>*</em></span><select value={current.form.urgency} onChange={(event) => patchForm({ urgency: event.target.value as Urgency | "" })}><option value="">请选择</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
            <label className="form-field"><span>汇报对象 <em>*</em></span><input id="task-draft-report-to" list="task-draft-report-to-options" maxLength={120} required autoComplete="off" value={current.form.reportTo} onChange={(event) => patchForm({ reportTo: event.target.value })} /><datalist id="task-draft-report-to-options">{reportToOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
            <label className="form-field"><span>管理对象</span><input id="task-draft-managed-object" list="task-draft-managed-object-options" maxLength={160} autoComplete="off" value={current.form.managedObject} onChange={(event) => patchForm({ managedObject: event.target.value })} /><datalist id="task-draft-managed-object-options">{managedObjectOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
            <label className="form-field form-field-wide"><span>交付物 <em>*</em></span><textarea rows={2} maxLength={500} value={current.form.deliverable} onChange={(event) => patchForm({ deliverable: event.target.value })} /></label>
          </div>
          <div className="modal-actions split-actions"><button className="button button-quiet" type="button" onClick={requestClose}>退出转换</button><button className="button button-danger-quiet" type="button" disabled={current.status === "saved"} onClick={skip}>{current.status === "skipped" ? "恢复待处理" : current.status === "saved" ? "已保存" : "跳过本条"}</button><span></span><button className="button button-quiet" type="button" disabled={candidates.some((candidate) => candidate.status === "pending")} onClick={complete}>完成转换</button><button className="button button-primary" type="submit" disabled={saving}>{current.taskId ? "更新并继续" : "保存并继续"}</button></div>
      </form>
    </dialog>
  );
}
