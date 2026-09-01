import { useEffect, useMemo, useState } from "react";
import * as ai from "../../../shared/ai-provider";
import { isEnglish, tConfirm } from "../../lib/i18n";
import { useModalDialog } from "../../lib/useModalDialog";
import { useUiStore } from "../../store/uiStore";

type Status = { message: string; type: "" | "ok" | "error" };

export default function AiSettingsDialog() {
  const dialog = useUiStore((state) => state.dialog?.type === "aiSettings" ? state.dialog : null);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const [settings, setSettings] = useState(ai.defaultSettings());
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [status, setStatus] = useState<Status>({ message: "", type: "" });
  const [testing, setTesting] = useState(false);
  const ref = useModalDialog(Boolean(dialog), closeDialog);
  const provider = ai.getProvider(settings.provider);
  const models = useMemo(() => Array.from(provider.models), [provider]);

  useEffect(() => {
    if (!dialog) return;
    const current = ai.getSettings();
    const known = ai.getProvider(current.provider).models.includes(current.model as never);
    setSettings(current);
    setUseCustomModel(Boolean(current.model && !known));
    setCustomModel(known ? "" : current.model);
    setStatus({ message: "", type: "" });
    setTesting(false);
  }, [dialog]);

  if (!dialog) return null;
  const english = isEnglish();
  const effective = (): ai.AiSettings => ({ ...settings, model: useCustomModel ? customModel.trim() : settings.model.trim() });
  const statusText = status.message || (ai.isConfigured(effective())
    ? effective().enabled
      ? (english ? `Connected and enabled: ${effective().provider} / ${effective().model}` : `已接入并启用 ${effective().provider} / ${effective().model}`)
      : (english ? "Connection saved; AI is currently disabled." : "已保存连接，但当前未启用 AI")
    : (english ? "AI is not configured." : "尚未接入 AI"));
  const providerLabel = (key: ai.AiProviderKey): string => {
    if (!english) return ai.PROVIDERS[key].label;
    if (key === "bailian") return "DashScope / Alibaba Cloud";
    if (key === "glm") return "GLM / Z.ai";
    if (key === "custom") return "Custom / OpenAI-compatible";
    return ai.PROVIDERS[key].label;
  };

  const changeProvider = (providerKey: ai.AiProviderKey): void => {
    const config = ai.getProvider(providerKey);
    setSettings((current) => ({ ...current, provider: providerKey, baseUrl: config.baseUrl, model: config.models[0] || "" }));
    setUseCustomModel(false);
    setCustomModel("");
    setStatus({ message: "", type: "" });
  };
  const validate = (): ai.AiSettings | null => {
    const current = effective();
    if (current.enabled && !current.apiKey) {
      useUiStore.getState().pushToast(isEnglish() ? "Enter an API Key to enable AI." : "启用 AI 需要先填写 API Key。", "error");
      return null;
    }
    if (current.enabled && !current.baseUrl) {
      useUiStore.getState().pushToast(isEnglish() ? "Enter an API Base URL." : "请填写 API Base URL。", "error");
      return null;
    }
    if (current.enabled && !current.model) {
      useUiStore.getState().pushToast(isEnglish() ? "Enter a model name." : "请填写模型名称。", "error");
      return null;
    }
    return current;
  };
  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    const current = validate();
    if (!current) return;
    ai.saveSettings(current);
    useUiStore.getState().pushToast(isEnglish() ? "AI settings saved." : "AI 设置已保存");
    closeDialog();
  };
  const test = async (): Promise<void> => {
    const current = validate();
    if (!current) return;
    setTesting(true);
    setStatus({ message: isEnglish() ? "Testing connection…" : "正在测试连接…", type: "" });
    try {
      await ai.testConnection(current);
      setStatus({ message: isEnglish() ? "Connection successful." : "连接成功。", type: "ok" });
    } catch (error) {
      setStatus({ message: `${isEnglish() ? "Connection failed: " : "连接失败："}${ai.errorMessage(error, isEnglish())}`, type: "error" });
    } finally { setTesting(false); }
  };
  const clear = (): void => {
    if (!tConfirm(isEnglish() ? "Clear the saved AI connection and API Key?" : "确认清除已保存的 AI 连接和 API Key？")) return;
    const empty = ai.clearSettings();
    setSettings(empty); setCustomModel(""); setUseCustomModel(false);
    setStatus({ message: isEnglish() ? "AI connection cleared." : "AI 连接已清除。", type: "" });
  };

  return (
    <dialog ref={ref} className="modal ai-settings-dialog">
      <form method="dialog" noValidate onSubmit={save}>
        <div className="modal-head"><div><p className="eyebrow">AI assistant</p><h2>AI 接入设置</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>×</button></div>
        <div className="ai-settings-body">
          <p className="modal-context">{english ? "Choose a provider and enter an API Key. The connection is remembered until you clear it. The API Key is excluded from business JSON." : "选择服务商并填入 API Key，连接一次后会自动记住；手动清除后才会移除。API Key 不进入业务 JSON。"}</p>
          <div className="ai-settings-toggle-row"><span className="ai-settings-toggle-label">接入 AI</span><label className="ai-check-line"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /><span>启用 AI 能力（Task 草稿解析 / 笔记改写）</span></label></div>
          <div className="ai-settings-grid">
            <label className="form-field"><span>服务商</span><select value={settings.provider} onChange={(event) => changeProvider(event.target.value as ai.AiProviderKey)}>{(Object.keys(ai.PROVIDERS) as ai.AiProviderKey[]).map((key) => <option key={key} value={key}>{providerLabel(key)}</option>)}</select></label>
            <label className="form-field"><span>模型</span><select value={useCustomModel ? "__custom__" : settings.model} onChange={(event) => { if (event.target.value === "__custom__") { setUseCustomModel(true); setCustomModel(""); } else { setUseCustomModel(false); setSettings((current) => ({ ...current, model: event.target.value })); } }}><option value="">请选择模型</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}<option value="__custom__">自定义模型…</option></select>{useCustomModel ? <input type="text" autoComplete="off" placeholder="输入自定义模型名称" value={customModel} onChange={(event) => setCustomModel(event.target.value)} /> : null}</label>
            <label className="form-field"><span>API Key</span><input type="password" autoComplete="off" placeholder="sk-..." value={settings.apiKey} onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))} /></label>
            <label className="form-field"><span>API Base URL</span><input type="url" autoComplete="off" placeholder="https://api.example.com/v1" value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
          </div>
          <div className={`ai-settings-status${status.type ? ` is-${status.type}` : ""}`} aria-live="polite">{statusText}</div>
        </div>
        <div className="modal-actions ai-modal-actions"><button className="button button-danger-quiet" type="button" onClick={clear}>清除连接</button><span></span><button className="button button-quiet" type="button" disabled={testing} onClick={() => void test()}>{testing ? "测试中…" : "测试连接"}</button><button className="button button-quiet" type="button" onClick={closeDialog}>取消</button><button className="button button-primary" type="submit">保存设置</button></div>
      </form>
    </dialog>
  );
}
