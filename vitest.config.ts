import { defineConfig } from "vitest/config";

// 单元测试只覆盖 tests/unit（shared 纯逻辑 + Excel 解析）；
// 与 vite.config.ts 分开，避免 vite root=src/renderer 影响测试发现。
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
