/* 日期输入：英文模式下渲染 .localized-date-shell 壳（占位符 + 图标）。
   原版由 i18n.js setupEnglishDateInputs 运行时注入壳；React 下改由本组件直接渲染——
   运行中给受控 input 换父节点会在弹窗卸载时触发 removeChild 冲突。
   is-empty 由受控 value 推导（等价原版 refreshDateInput 的 input/change/blur 监听），
   中文模式渲染裸 input，UI 与原版完全一致。语言在会话内恒定（切换即整页 reload），
   因此 isEnglish() 非响应式读取是安全的。 */
import type { InputHTMLAttributes } from "react";
import { isEnglish } from "../lib/i18n";

type DateInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function DateInput(props: DateInputProps) {
  if (!isEnglish()) {
    return <input type="date" {...props} />;
  }
  const empty = !props.value;
  return (
    <span className={"localized-date-shell" + (empty ? " is-empty" : "")}>
      <input type="date" lang="en-US" {...props} />
      <span className="localized-date-placeholder" aria-hidden="true">
        MM / DD / YYYY
      </span>
      <span className="localized-date-icon" aria-hidden="true" />
    </span>
  );
}
