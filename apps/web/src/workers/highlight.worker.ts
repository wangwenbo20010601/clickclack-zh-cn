import highlighter from "highlight.js";

type HighlightWorkerRequest = { source: string; language: string; outputLimit: number };
type HighlightWorkerResponse = { html: string } | { error: string };

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<HighlightWorkerRequest>) => void) | null;
  postMessage: (message: HighlightWorkerResponse) => void;
};

worker.onmessage = ({ data }) => {
  try {
    if (!highlighter.getLanguage(data.language)) {
      worker.postMessage({ error: "不支持此语法高亮语言。" });
      return;
    }
    const html = highlighter.highlight(data.source, {
      language: data.language,
      ignoreIllegals: true,
    }).value;
    if (html.length > data.outputLimit) {
      worker.postMessage({ error: "语法高亮结果超出安全限制。" });
      return;
    }
    worker.postMessage({ html });
  } catch {
    worker.postMessage({ error: "无法为此源代码添加语法高亮。" });
  }
};
