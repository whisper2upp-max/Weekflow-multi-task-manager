import { describe, expect, it } from "vitest";
import { IPC } from "../../src/shared/ipc";

describe("IPC 契约常量", () => {
  it("包含全部 6 个通道", () => {
    expect(Object.keys(IPC).sort()).toEqual([
      "getDataInfo",
      "loadData",
      "openExternal",
      "openFileWithDialog",
      "saveData",
      "saveFileWithDialog",
    ]);
  });
});
