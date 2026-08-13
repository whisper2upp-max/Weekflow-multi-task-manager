import { createRoot } from "react-dom/client";
import App from "./App";
import { installTauriBridge } from "./lib/tauri-bridge";
import "./styles/weekflow.css";

// 渲染前把 window.weekflow 挂好（等价 Electron 版的 preload）
installTauriBridge();

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到 #root 挂载点");
}

createRoot(container).render(<App />);
