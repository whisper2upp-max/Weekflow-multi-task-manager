/* 已激活筛选 chips：渲染在时间轴 toolbar 的 #active-filters 容器内（TimelineView 负责挂载）。
   复刻 app.js:951-979 renderActiveFilters："筛选中"标签 + 各筛选条件 chip，
   无筛选时容器去掉 has-filters 类（CSS 隐藏）。 */
import { useDataStore } from "../store/dataStore";
import { useUiStore } from "../store/uiStore";

const STATUS_LABELS: Record<string, string> = { pending: "未完成", completed: "已完成" };
const URGENCY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function ActiveFilterChips() {
  const filters = useUiStore((state) => state.filters);
  const data = useDataStore((state) => state.data);

  const chips: string[] = [];
  if (filters.search) chips.push("关键词：" + filters.search);
  if (filters.groupIds.length) {
    const names = filters.groupIds
      .map((id) => {
        const group = data ? data.groups.find((item) => item.id === id) : null;
        return group ? group.name : "";
      })
      .filter(Boolean);
    chips.push("分组：" + names.join("、"));
  }
  if (filters.flowId === "none") {
    chips.push("Flow：未加入");
  } else if (filters.flowId !== "all") {
    const flow = data ? data.flows.find((item) => item.id === filters.flowId) : null;
    if (flow) chips.push("Flow：" + flow.name);
  }
  if (filters.status !== "all") chips.push("状态：" + STATUS_LABELS[filters.status]);
  if (filters.urgency !== "all") chips.push("紧急程度：" + URGENCY_LABELS[filters.urgency]);
  if (filters.overdueOnly) chips.push("仅看逾期");

  return (
    <div
      id="active-filters"
      className={chips.length ? "active-filters has-filters" : "active-filters"}
      aria-live="polite"
    >
      {chips.length > 0 && <span className="active-filter-label">筛选中</span>}
      {chips.map((text) => (
        <span className="filter-chip" key={text}>
          {text}
        </span>
      ))}
    </div>
  );
}
