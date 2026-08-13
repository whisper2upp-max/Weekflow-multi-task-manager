/* 弹窗表单字段错误：等价原 app.js:2968 setFieldError / clearFieldErrors。
   出错控件加 .is-invalid，对应 small.field-error[data-error-for] 显示文案；
   提交前清空旧错误，校验失败聚焦第一个 .is-invalid 控件。 */
import { useCallback, useState } from "react";

export interface FormErrors {
  /** fieldId → 错误文案；无错误的字段不出现在表中 */
  errors: Record<string, string>;
  setFieldError: (fieldId: string, message: string) => void;
  clearFieldErrors: () => void;
  /** 有错误时返回 "is-invalid"，否则 undefined（控件 className 用） */
  invalidClass: (fieldId: string) => string | undefined;
  /** 聚焦容器内第一个 .is-invalid 控件（延迟到本轮渲染之后） */
  focusFirstInvalid: (container: ParentNode | null) => void;
}

export function useFormErrors(): FormErrors {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setFieldError = useCallback((fieldId: string, message: string) => {
    setErrors((prev) => ({ ...prev, [fieldId]: message }));
  }, []);
  const clearFieldErrors = useCallback(() => setErrors({}), []);
  const invalidClass = useCallback(
    (fieldId: string) => (errors[fieldId] ? "is-invalid" : undefined),
    [errors]
  );
  const focusFirstInvalid = useCallback((container: ParentNode | null) => {
    setTimeout(() => {
      const first = container?.querySelector<HTMLElement>(".is-invalid");
      if (first) first.focus();
    }, 0);
  }, []);
  return { errors, setFieldError, clearFieldErrors, invalidClass, focusFirstInvalid };
}
