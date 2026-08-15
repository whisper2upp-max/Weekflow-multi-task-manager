import { useEffect, useMemo, useState } from "react";
import { useDataStore } from "../../store/dataStore";
import { useUiStore } from "../../store/uiStore";
import { useModalDialog } from "../../lib/useModalDialog";
import RichTextView from "../RichTextView";

export default function NoteProgressDialog() {
  const dialog = useUiStore((state) => state.dialog?.type === "noteProgress" ? state.dialog : null);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const data = useDataStore((state) => state.data);
  const [groupId, setGroupId] = useState("");
  const [flowId, setFlowId] = useState("all");
  const [taskId, setTaskId] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useModalDialog(Boolean(dialog), closeDialog);
  const note = dialog ? data?.notes.find((item) => item.id === dialog.noteId) : undefined;
  const groups = useMemo(() => (data?.groups || []).slice().sort((a, b) => Number(a.order) - Number(b.order)), [data?.groups]);
  const flows = useMemo(() => (data?.flows || []).filter((flow) => flow.groupId === groupId).sort((a, b) => Number(a.order) - Number(b.order)), [data?.flows, groupId]);
  const tasks = useMemo(() => (data?.tasks || []).filter((task) => {
    if (task.groupId !== groupId) return false;
    if (flowId === "none") return !task.flowId;
    return flowId === "all" || task.flowId === flowId;
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true })), [data?.tasks, groupId, flowId]);

  useEffect(() => {
    if (!dialog) return;
    const current = useDataStore.getState().data;
    const firstGroup = current?.groups.slice().sort((a, b) => Number(a.order) - Number(b.order))[0];
    setGroupId(firstGroup?.id || "");
    setFlowId("all");
    setTaskId("");
    setSaving(false);
  }, [dialog]);

  useEffect(() => {
    setTaskId((current) => tasks.some((task) => task.id === current) ? current : tasks[0]?.id || "");
  }, [tasks]);

  if (!dialog || !note) return null;
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!taskId || saving) return;
    setSaving(true);
    void useDataStore.getState().convertNoteToProgress(note.id, taskId).then((ok) => {
      setSaving(false);
      if (ok) closeDialog();
    });
  };

  return (
    <dialog ref={ref} id="note-progress-dialog" className="modal">
      <form method="dialog" noValidate onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">Progress record</p><h2>添加到 Task 进度记录</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>×</button></div>
        <p className="modal-context"><span data-user-content="true">{note.title}</span><span> · 将按当前时间新增一条独立记录。</span></p>
        <RichTextView className="note-progress-preview rich-text-preview" html={note.contentHtml} />
        <div className="form-grid note-progress-fields">
          <label className="form-field"><span>分组 <em>*</em></span><select value={groupId} onChange={(event) => { setGroupId(event.target.value); setFlowId("all"); }}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
          <label className="form-field"><span>Flow</span><select value={flowId} onChange={(event) => setFlowId(event.target.value)}><option value="all">全部 Flow</option><option value="none">未加入 Flow</option>{flows.map((flow) => <option value={flow.id} key={flow.id}>{flow.name}</option>)}</select></label>
          <label className="form-field form-field-wide"><span>Task <em>*</em></span><select value={taskId} onChange={(event) => setTaskId(event.target.value)}>{tasks.map((task) => <option value={task.id} key={task.id}>{task.name} · DDL {task.ddl}</option>)}</select><small>{tasks.length ? `可选择 ${tasks.length} 个 Task` : "当前范围下没有可选择的 Task。"}</small></label>
        </div>
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={closeDialog}>取消</button><button className="button button-primary" type="submit" disabled={!taskId || saving}>添加记录</button></div>
      </form>
    </dialog>
  );
}
