/* Task 弹窗草稿（模块级，不进 uiStore）：从 Task 弹窗跳去「创建新的 Flow…」时
   uiStore.dialog 被 Flow 弹窗占用，Task 弹窗卸载；草稿保存在这里，
   Flow 弹窗保存/取消后重开 Task 弹窗时原样恢复（等价原版两弹窗并存的状态）。
   Task 弹窗真正关闭（取消 / 保存 / 删除）时清除。 */
import type { MaterialDraft } from "../../store/dataStore";
import type { RecurrenceCadence, TaskStatus, Urgency } from "../../../shared/types";

export interface TaskDraftValues {
  name: string;
  groupId: string;
  /** Flow 下拉当前列出哪个分组的 Flow（新建 Flow 返回时可能异于 groupId，照原版） */
  flowGroupId: string;
  /** "" = 不加入 Flow */
  flowId: string;
  ddl: string;
  recurrenceCadence: RecurrenceCadence;
  recurrenceStart: string;
  recurrenceEnd: string;
  urgency: Urgency | "";
  status: TaskStatus;
  completedAt: string;
  reportTo: string;
  managedObject: string;
  deliverable: string;
}

export interface TaskDraft {
  /** null = 新建 Task */
  taskId: string | null;
  values: TaskDraftValues;
  materials: MaterialDraft[];
}

let draft: TaskDraft | null = null;
let preselectFlowId: string | null = null;

export const taskDraftStore = {
  save(next: TaskDraft): void {
    draft = next;
  },
  load(): TaskDraft | null {
    return draft;
  },
  clear(): void {
    draft = null;
    preselectFlowId = null;
  },
  /** Flow 弹窗 returnToTask 保存成功后写入，Task 弹窗恢复时消费一次 */
  setPreselectFlow(flowId: string): void {
    preselectFlowId = flowId;
  },
  consumePreselectFlow(): string | null {
    const id = preselectFlowId;
    preselectFlowId = null;
    return id;
  }
};
