import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 仅开发模式生效：@vitejs/plugin-react 的 Fast Refresh preamble 是内联 <script>，
// index.html 的 CSP（script-src 回落到 default-src 'self'）会拦截它，导致 dev 白屏；
// vite HMR 的 WebSocket 也需要 connect-src 放行 ws:。这里在 serve 时放宽；
// 生产构建不受影响，index.html 中的 CSP 保持原样。
function devRelaxCspForHmr(): Plugin {
  return {
    name: "weekflow:dev-relax-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        'content="default-src',
        'content="script-src \'self\' \'unsafe-inline\'; connect-src ws:; default-src',
      );
    },
  };
}

// 渲染层：root 指向 src/renderer，入口 src/renderer/index.html。
// outDir 相对 root 解析，指回项目根的 dist/（tauri.conf.json 的 frontendDist 指向它）。
// Tauri 约定 dev 端口 1420 且严格占用。
export default defineConfig({
  root: "src/renderer",
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  plugins: [react(), devRelaxCspForHmr()],
});
