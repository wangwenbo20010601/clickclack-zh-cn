export * from "./office-types";
import {
  OFFICE_PARSE_TIMEOUT_MS,
  type OfficeKind,
  type OfficePreview,
  type OfficeWorkerRequest,
  type OfficeWorkerResponse,
  type PresentationPreview,
  type SpreadsheetPreview,
} from "./office-types";

export function parseOfficeInWorker(
  kind: "spreadsheet",
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<SpreadsheetPreview>;
export function parseOfficeInWorker(
  kind: "presentation",
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<PresentationPreview>;
export function parseOfficeInWorker(
  kind: OfficeKind,
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<OfficePreview> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/office.worker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException("Office 预览已取消。", "AbortError")));
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error("Office 预览耗时过长，已停止。"))),
      OFFICE_PARSE_TIMEOUT_MS,
    );

    worker.onmessage = (event: MessageEvent<OfficeWorkerResponse>) => {
      const data = event.data;
      if ("error" in data) {
        finish(() => reject(new Error(data.error)));
        return;
      }
      if (data.kind !== kind) {
        finish(() => reject(new Error("Office 预览返回了异常结果。")));
        return;
      }
      finish(() => resolve(data.preview));
    };
    worker.onerror = () => finish(() => reject(new Error("无法安全解析此 Office 文件。")));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    const payload =
      bytes.byteOffset === 0 &&
      bytes.buffer instanceof ArrayBuffer &&
      bytes.byteLength === bytes.buffer.byteLength
        ? (bytes as Uint8Array<ArrayBuffer>)
        : bytes.slice();
    const request: OfficeWorkerRequest = { kind, bytes: payload };
    worker.postMessage(request, [payload.buffer]);
  });
}
