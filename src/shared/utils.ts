/* 通用工具：等价原 js/utils.js（去掉 DOM 相关函数 el/clear/setAttrs/downloadBlob/safeOpen），
   并补充从原 js/app.js 提取的 materialUrlKey。 */

export function uid(prefix?: string): string {
  let value: string;
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    value = cryptoApi.randomUUID();
  } else {
    value = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  }
  return (prefix || "id") + "_" + value;
}

export function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function clone<T>(value: T): T {
  const structuredCloneApi = (
    globalThis as { structuredClone?: <V>(input: V) => V }
  ).structuredClone;
  if (typeof structuredCloneApi === "function") return structuredCloneApi(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export function truncate(value: unknown, maxLength: number): string {
  const text = String(value || "");
  return text.length <= maxLength ? text : text.slice(0, Math.max(1, maxLength - 1)) + "…";
}

export function isHexColor(value: unknown): boolean {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!isHexColor(hex)) return { r: 83, g: 104, b: 216 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
}

export function blendWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  const ratio = Math.min(1, Math.max(0, Number(amount)));
  function channel(value: number): string {
    return Math.round(value + (255 - value) * ratio)
      .toString(16)
      .padStart(2, "0");
  }
  return "#" + channel(rgb.r) + channel(rgb.g) + channel(rgb.b);
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: A) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

export function sanitizeFilename(value: unknown): string {
  return String(value || "download")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/* 资料去重键：协议+host 小写，pathname/search/hash 原样；非法 URL 返回 trim 后的原串。
   提取自原 js/app.js materialUrlKey。 */
export function materialUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol.toLocaleLowerCase() +
      "//" +
      parsed.host.toLocaleLowerCase() +
      parsed.pathname +
      parsed.search +
      parsed.hash
    );
  } catch {
    return String(url || "").trim();
  }
}
