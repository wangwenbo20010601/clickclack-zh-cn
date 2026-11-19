import { parsePresentation, parseSpreadsheet } from "../lib/office-parser";
import type { OfficeWorkerRequest, OfficeWorkerResponse } from "../lib/office-types";

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<OfficeWorkerRequest>) => void) | null;
  postMessage: (message: OfficeWorkerResponse) => void;
};

worker.onmessage = ({ data }) => {
  try {
    if (data.kind === "spreadsheet") {
      worker.postMessage({ kind: data.kind, preview: parseSpreadsheet(data.bytes) });
    } else if (data.kind === "presentation") {
      worker.postMessage({ kind: data.kind, preview: parsePresentation(data.bytes) });
    } else {
      worker.postMessage({ error: "不支持此 Office 预览类型。" });
    }
  } catch (error) {
    worker.postMessage({
      error: error instanceof Error ? error.message : "无法安全解析此 Office 文件。",
    });
  }
};
