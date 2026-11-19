<script lang="ts">
  import DOMPurify from "dompurify";
  import { onDestroy } from "svelte";
  import type {
    PDFDocumentLoadingTask,
    PDFDocumentProxy,
    PDFPageProxy,
    PDFWorker,
    RenderTask,
    TextContent,
  } from "pdfjs-dist";
  import {
    artifactKindLabel,
    artifactLanguage,
    artifactPreviewLimit,
    classifyArtifact,
    type ArtifactKind,
  } from "../../lib/artifacts";
  import { markdown } from "../../lib/format";
  import { highlightCodeInWorker } from "../../lib/highlight";
  import {
    parseOfficeInWorker,
    type PresentationPreview,
    type SpreadsheetPreview,
  } from "../../lib/office";
  import {
    assertSafePDFCanvas,
    PDF_CANVAS_PIXEL_LIMIT,
    PDF_LOAD_TIMEOUT_MS,
    PDF_RENDER_TIMEOUT_MS,
  } from "../../lib/pdf";
  import type { Upload } from "../../lib/types";
  import { formatBytes, uploadURL } from "../../lib/uploads";
  import pdfWorkerURL from "pdfjs-dist/build/pdf.worker.mjs?url";

  type Props = {
    upload: Upload;
    onClose: () => void;
  };

  let { upload, onClose }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let kind: ArtifactKind = $derived(classifyArtifact(upload));
  let mode: "preview" | "source" = $state("preview");
  let status: "idle" | "loading" | "ready" | "error" = $state("idle");
  let errorMessage = $state("");
  let source = $state("");
  let renderedHTML = $state("");
  let structuredPreviewAvailable = $state(false);
  let highlightedSource = $state("");
  let pdfDocument: PDFDocumentProxy | null = $state(null);
  let pdfPage = $state(1);
  let pdfScale = $state(1);
  let pdfRendering = $state(false);
  let pdfText = $state("");
  let cleanupPDF: (() => void) | null = null;
  let pdfImageLimitExceeded = false;
  let spreadsheet: SpreadsheetPreview | null = $state(null);
  let activeSheet = $state(0);
  let presentation: PresentationPreview | null = $state(null);
  let activeSlide = $state(0);

  const STRUCTURED_TOKEN_LIMIT = 10_000;
  const STRUCTURED_SOURCE_LIMIT = 64 * 1024;
  const RENDERED_HTML_LIMIT = 4 * 1024 * 1024;
  const PDF_TEXT_CHARACTER_LIMIT = 64 * 1024;
  const PDF_TEXT_ITEM_LIMIT = 5_000;

  class StructuredPreviewLimitError extends Error {}

  let label = $derived(artifactKindLabel(kind));
  let url = $derived(uploadURL(upload));
  let canToggleSource = $derived(
    (kind === "markdown" || kind === "html") &&
      status === "ready" &&
      structuredPreviewAvailable,
  );

  function previewTooLargeMessage(limit: number): string {
    return `此${label.toLowerCase()}大小为 ${formatBytes(upload.byte_size)}，预览限制为 ${formatBytes(limit)}。`;
  }

  function htmlDocument(body: string): string {
    assertStructuredComplexity(body);
    const template = document.createElement("template");
    template.innerHTML = body;
    const sanitizedContent = DOMPurify.sanitize(template.content, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true },
      FORBID_TAGS: [
        "base",
        "embed",
        "form",
        "iframe",
        "link",
        "meta",
        "object",
        "script",
        "style",
      ],
      FORBID_ATTR: ["action", "formaction", "srcset", "style", "xlink:href"],
    });
    for (const element of sanitizedContent.querySelectorAll<HTMLElement>("*")) {
      for (const attribute of Array.from(element.attributes)) {
        element.removeAttribute(attribute.name);
      }
    }
    const container = document.createElement("div");
    container.append(sanitizedContent);
    const safeBody = container.innerHTML;
    assertRenderedComplexity(safeBody);
    return `<!doctype html>${safeBody}`;
  }

  function markdownDocument(body: string): string {
    assertStructuredComplexity(body);
    const rendered = markdown(body);
    assertRenderedComplexity(rendered);
    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: [
        "blockquote",
        "br",
        "code",
        "del",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
      ],
      ALLOWED_ATTR: [],
    });
  }

  function assertStructuredComplexity(value: string) {
    if (value.length > STRUCTURED_SOURCE_LIMIT) {
      throw new StructuredPreviewLimitError("结构化预览超出源内容安全限制。");
    }
    let tokens = 0;
    for (const character of value) {
      if ("<[]>*_`-+.!#>|~".includes(character)) {
        tokens += 1;
        if (tokens > STRUCTURED_TOKEN_LIMIT) {
          throw new StructuredPreviewLimitError("结构化预览超出复杂度安全限制。");
        }
      }
    }
  }

  function assertRenderedComplexity(value: string) {
    if (value.length > RENDERED_HTML_LIMIT) {
      throw new StructuredPreviewLimitError("渲染后的预览超出输出安全限制。");
    }
    let elements = 0;
    for (const character of value) {
      if (character === "<" && ++elements > STRUCTURED_TOKEN_LIMIT * 2) {
        throw new StructuredPreviewLimitError("渲染后的预览超出元素数量安全限制。");
      }
    }
  }

  function resourceLimitMessage(limit: number): string {
    return `预览数据超出 ${formatBytes(limit)} 的安全限制。`;
  }

  async function responseBytes(signal: AbortSignal, limit: number): Promise<Uint8Array> {
    const response = await fetch(url, { credentials: "include", signal });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("你已无权访问此文件。");
      }
      if (response.status === 404) throw new Error("此文件已不可用。");
      throw new Error(`无法加载此文件（${response.status}）。`);
    }
    const declaredLength = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > limit) {
      throw new Error(resourceLimitMessage(limit));
    }
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > limit) throw new Error(resourceLimitMessage(limit));
      return bytes;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
          await reader.cancel();
          throw new Error(resourceLimitMessage(limit));
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  async function loadText(signal: AbortSignal, limit: number): Promise<string> {
    return new TextDecoder("utf-8", { fatal: false }).decode(await responseBytes(signal, limit));
  }

  async function loadArtifact(signal: AbortSignal) {
    cleanupPDF?.();
    cleanupPDF = null;
    pdfDocument = null;
    source = "";
    renderedHTML = "";
    structuredPreviewAvailable = false;
    highlightedSource = "";
    pdfPage = 1;
    pdfScale = 1;
    pdfText = "";
    pdfImageLimitExceeded = false;
    spreadsheet = null;
    activeSheet = 0;
    presentation = null;
    activeSlide = 0;
    mode = "preview";
    errorMessage = "";

    const limit = artifactPreviewLimit(kind);
    if (limit !== undefined && upload.byte_size > limit) {
      status = "error";
      errorMessage = previewTooLargeMessage(limit);
      return;
    }
    if (kind === "unsupported") {
      status = "ready";
      return;
    }

    status = "loading";
    try {
      if (kind === "pdf") {
        const pdfjs = await import("pdfjs-dist");
        if (signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerURL;
        const pdfController = new AbortController();
        const abortPDF = () => pdfController.abort();
        signal.addEventListener("abort", abortPDF, { once: true });
        let pdfWorker: PDFWorker | null = null;
        let loadTimer = 0;
        const loadTimeout = new Promise<never>((_, reject) => {
          loadTimer = window.setTimeout(() => {
            pdfController.abort();
            pdfWorker?.destroy();
            reject(new Error("PDF 预览耗时过长，已停止。"));
          }, PDF_LOAD_TIMEOUT_MS);
        });
        let bytes: Uint8Array;
        try {
          bytes = await Promise.race([responseBytes(pdfController.signal, limit!), loadTimeout]);
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          pdfWorker = new pdfjs.PDFWorker();
          await Promise.race([pdfWorker.promise, loadTimeout]);
        } catch (error) {
          clearTimeout(loadTimer);
          signal.removeEventListener("abort", abortPDF);
          throw error;
        }
        if (signal.aborted || !pdfWorker) {
          clearTimeout(loadTimer);
          signal.removeEventListener("abort", abortPDF);
          pdfWorker?.destroy();
          return;
        }
        const workerPort = pdfWorker.port;
        const onWorkerMessage = (event: MessageEvent<unknown>) => {
          const message = event.data;
          if (
            typeof message === "object" &&
            message !== null &&
            "reason" in message &&
            typeof message.reason === "object" &&
            message.reason !== null &&
            "message" in message.reason &&
            message.reason.message === "Image exceeded maximum allowed size and was removed."
          ) {
            pdfImageLimitExceeded = true;
            cleanupPDF?.();
            status = "error";
            errorMessage =
              "无法在安全限制内完整渲染 PDF 页面内容。";
          }
        };
        workerPort.addEventListener("message", onWorkerMessage);
        let loadingTask: PDFDocumentLoadingTask | null = null;
        let pdfCleaned = false;
        cleanupPDF = () => {
          if (pdfCleaned) return;
          pdfCleaned = true;
          workerPort.removeEventListener("message", onWorkerMessage);
          if (loadingTask) void loadingTask.destroy();
          pdfWorker.destroy();
          pdfDocument = null;
        };
        const task = pdfjs.getDocument({
          data: bytes,
          maxImageSize: PDF_CANVAS_PIXEL_LIMIT,
          canvasMaxAreaInBytes: PDF_CANVAS_PIXEL_LIMIT * 4,
          stopAtErrors: true,
          worker: pdfWorker,
        }) as PDFDocumentLoadingTask;
        loadingTask = task;
        try {
          pdfDocument = await Promise.race([task.promise, loadTimeout]);
        } finally {
          clearTimeout(loadTimer);
          signal.removeEventListener("abort", abortPDF);
        }
      } else if (kind === "spreadsheet" || kind === "presentation") {
        const bytes = await responseBytes(signal, limit!);
        if (signal.aborted) return;
        if (kind === "spreadsheet") {
          const preview = await parseOfficeInWorker(kind, bytes, signal);
          if (signal.aborted) return;
          spreadsheet = preview;
        } else {
          const preview = await parseOfficeInWorker(kind, bytes, signal);
          if (signal.aborted) return;
          presentation = preview;
        }
      } else {
        source = await loadText(signal, limit!);
        if (signal.aborted) return;
        if (kind === "code") {
          highlightedSource = await highlightCodeInWorker(source, artifactLanguage(upload), signal);
        }
        try {
          if (kind === "markdown") {
            renderedHTML = markdownDocument(source);
            structuredPreviewAvailable = true;
          }
          if (kind === "html") {
            renderedHTML = htmlDocument(source);
            structuredPreviewAvailable = true;
          }
        } catch (error) {
          if (!(error instanceof StructuredPreviewLimitError)) throw error;
          renderedHTML = "";
          mode = "source";
        }
      }
      if (!signal.aborted) status = "ready";
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      cleanupPDF?.();
      cleanupPDF = null;
      status = "error";
      errorMessage = error instanceof Error ? error.message : "无法预览此文件。";
    }
  }

  $effect(() => {
    const controller = new AbortController();
    void loadArtifact(controller.signal);
    return () => controller.abort();
  });

  $effect(() => {
    if (kind !== "pdf" || !pdfDocument || !canvasEl || status !== "ready") return;
    const document = pdfDocument;
    const pageNumber = pdfPage;
    const scale = pdfScale;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    let textReader: ReadableStreamDefaultReader<TextContent> | null = null;
    let renderTimer = 0;
    pdfRendering = true;
    pdfText = "";

    const render = async () => {
      try {
        renderTimer = window.setTimeout(() => {
          if (cancelled) return;
          renderTask?.cancel();
          void textReader?.cancel();
          cleanupPDF?.();
          status = "error";
          errorMessage = "PDF 页面渲染耗时过长，已停止。";
        }, PDF_RENDER_TIMEOUT_MS);
        page = await document.getPage(pageNumber);
        if (cancelled || !canvasEl) return;
        let extractedText = "";
        let textItems = 0;
        textReader = page.streamTextContent().getReader();
        try {
          while (!cancelled) {
            const { done, value } = await textReader.read();
            if (done) break;
            for (const item of value.items) {
              textItems += 1;
              if (textItems > PDF_TEXT_ITEM_LIMIT) {
                await textReader.cancel();
                extractedText = `${extractedText}…`;
                break;
              }
              if (!("str" in item) || !item.str) continue;
              const next = `${extractedText}${extractedText ? " " : ""}${item.str}`;
              if (next.length > PDF_TEXT_CHARACTER_LIMIT) {
                await textReader.cancel();
                extractedText = `${next.slice(0, PDF_TEXT_CHARACTER_LIMIT)}…`;
                break;
              }
              extractedText = next;
            }
            if (textItems > PDF_TEXT_ITEM_LIMIT || extractedText.endsWith("…")) break;
          }
        } finally {
          textReader.releaseLock();
          textReader = null;
        }
        if (cancelled) return;
        pdfText = extractedText || "此页面没有可提取的文本。";
        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const backingWidth = Math.max(1, Math.floor(viewport.width * dpr));
        const backingHeight = Math.max(1, Math.floor(viewport.height * dpr));
        assertSafePDFCanvas(backingWidth, backingHeight);
        const context = canvasEl.getContext("2d");
        if (!context) throw new Error("PDF 画布不可用。");
        canvasEl.width = backingWidth;
        canvasEl.height = backingHeight;
        canvasEl.style.width = `${viewport.width}px`;
        canvasEl.style.height = `${viewport.height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (pdfImageLimitExceeded) {
          throw new Error("无法在安全限制内完整渲染 PDF 页面内容。");
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          cleanupPDF?.();
          status = "error";
          errorMessage =
            error instanceof Error ? error.message : "无法渲染此 PDF 页面。";
        }
      } finally {
        clearTimeout(renderTimer);
        page?.cleanup();
        page = null;
        if (!cancelled) pdfRendering = false;
      }
    };

    void render();
    return () => {
      cancelled = true;
      clearTimeout(renderTimer);
      renderTask?.cancel();
      void textReader?.cancel();
    };
  });

  onDestroy(() => cleanupPDF?.());

  function columnNumber(reference: string): number {
    const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
    let value = 0;
    for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
    return value;
  }

  function rowNumber(reference: string): number {
    return Number(reference.match(/\d+$/)?.[0] || 1);
  }

  function columnName(value: number): string {
    let name = "";
    for (let current = value; current > 0; current = Math.floor((current - 1) / 26)) {
      name = String.fromCharCode(65 + ((current - 1) % 26)) + name;
    }
    return name;
  }

  let spreadsheetGrid = $derived.by(() => {
    const sheet = spreadsheet?.sheets[activeSheet];
    if (!sheet)
      return {
        columns: [] as string[],
        rows: [] as { number: number; values: string[] }[],
        clipped: false,
      };
    const actualMaxColumn = Math.max(
      1,
      ...sheet.cells.map((cell) => columnNumber(cell.reference)),
    );
    const actualMaxRow = Math.max(1, ...sheet.cells.map((cell) => rowNumber(cell.reference)));
    const maxColumn = Math.min(100, actualMaxColumn);
    const maxRow = Math.min(1_000, Math.floor(10_000 / maxColumn), actualMaxRow);
    const values = new Map(sheet.cells.map((cell) => [cell.reference.toUpperCase(), cell.value]));
    const columns = Array.from({ length: maxColumn }, (_, index) => columnName(index + 1));
    const rows = Array.from({ length: maxRow }, (_, index) => ({
      number: index + 1,
      values: columns.map((column) => values.get(`${column}${index + 1}`) || ""),
    }));
    return {
      columns,
      rows,
      clipped: actualMaxColumn > maxColumn || actualMaxRow > maxRow,
    };
  });
</script>

<header class="artifact-viewer__header">
  <div class="artifact-viewer__identity">
    <span>{label}</span>
    <strong title={upload.filename}>{upload.filename}</strong>
    <small>{formatBytes(upload.byte_size)}</small>
  </div>
  <div class="artifact-viewer__actions">
    {#if canToggleSource}
      <div class="artifact-viewer__segmented" aria-label={`${label}视图`}>
        <button type="button" class:active={mode === "preview"} aria-pressed={mode === "preview"} onclick={() => (mode = "preview")}>预览</button>
        <button type="button" class:active={mode === "source"} aria-pressed={mode === "source"} onclick={() => (mode = "source")}>源内容</button>
      </div>
    {/if}
    <a href={url} download={upload.filename} aria-label={`下载 ${upload.filename}`} title="下载">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
    </a>
    <button type="button" aria-label="关闭文件查看器" title="关闭" onclick={onClose}>×</button>
  </div>
</header>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable dialog content must be keyboard-focusable) -->
<div
  class="artifact-viewer__body"
  class:is-pdf={kind === "pdf"}
  class:is-office={kind === "spreadsheet" || kind === "presentation"}
  role="region"
  tabindex="0"
  aria-label="文件内容"
>
  {#if status === "loading"}
    <div class="artifact-viewer__state" role="status">
      <span class="artifact-viewer__spinner" aria-hidden="true"></span>
      <strong>正在打开{label.toLowerCase()}</strong>
      <p>正在准备安全预览。</p>
    </div>
  {:else if status === "error"}
    <div class="artifact-viewer__state artifact-viewer__state--error" role="alert">
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v5m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <strong>预览不可用</strong>
      <p>{errorMessage}</p>
      <a href={url} download={upload.filename}>下载原文件</a>
    </div>
  {:else if kind === "unsupported"}
    <div class="artifact-viewer__state">
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
      <strong>此文件类型不支持预览</strong>
      <p>你仍可下载原文件。</p>
      <a href={url} download={upload.filename}>下载原文件</a>
    </div>
  {:else if kind === "pdf" && pdfDocument}
    <div class="artifact-viewer__pdf-toolbar" aria-label="PDF 控件">
      <button type="button" disabled={pdfPage <= 1 || pdfRendering} onclick={() => (pdfPage -= 1)}>上一页</button>
      <span>第 {pdfPage} 页，共 {pdfDocument.numPages} 页</span>
      <button type="button" disabled={pdfPage >= pdfDocument.numPages || pdfRendering} onclick={() => (pdfPage += 1)}>下一页</button>
      <span class="artifact-viewer__toolbar-divider" aria-hidden="true"></span>
      <button type="button" aria-label="缩小" disabled={pdfScale <= 0.6 || pdfRendering} onclick={() => (pdfScale = Math.max(0.6, pdfScale - 0.2))}>−</button>
      <span>{Math.round(pdfScale * 100)}%</span>
      <button type="button" aria-label="放大" disabled={pdfScale >= 2 || pdfRendering} onclick={() => (pdfScale = Math.min(2, pdfScale + 0.2))}>+</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (zoomed PDF stage must be keyboard-scrollable) -->
    <div
      class="artifact-viewer__pdf-stage"
      class:is-rendering={pdfRendering}
      role="region"
      tabindex="0"
      aria-label={`PDF 第 ${pdfPage} 页的视觉预览`}
    >
      <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
      <section class="artifact-viewer__pdf-text" aria-label={`PDF 第 ${pdfPage} 页的文本`}>
        {pdfText}
      </section>
    </div>
  {:else if kind === "spreadsheet" && spreadsheet}
    <div class="artifact-viewer__office-toolbar" aria-label="工作簿控件">
      <span>{spreadsheet.sheets.length} 张工作表</span>
      <span>显示原始缓存值，省略数字和日期格式</span>
      {#if spreadsheet.hiddenSheets > 0}<span>已省略 {spreadsheet.hiddenSheets} 张隐藏工作表</span>{/if}
      {#if spreadsheet.unsupportedSheets > 0}<span>已省略 {spreadsheet.unsupportedSheets} 张非工作表类型的表</span>{/if}
    </div>
    <div class="artifact-viewer__spreadsheet" role="region" aria-label={`${spreadsheet.sheets[activeSheet].name} 工作表`} tabindex="0">
      <table>
        <thead><tr><th class="row-heading" aria-label="行号"></th>{#each spreadsheetGrid.columns as column}<th scope="col">{column}</th>{/each}</tr></thead>
        <tbody>{#each spreadsheetGrid.rows as row}<tr><th class="row-heading" scope="row">{row.number}</th>{#each row.values as value}<td>{value}</td>{/each}</tr>{/each}</tbody>
      </table>
      {#if spreadsheetGrid.clipped || spreadsheet.sheets[activeSheet].truncated}
        <p class="artifact-viewer__grid-note">预览最多显示 10,000 个单元格、前 1,000 行和前 100 列。下载原文件以查看省略的单元格。</p>
      {/if}
    </div>
    <div class="artifact-viewer__sheet-tabs" role="tablist" aria-label="工作表">
      {#each spreadsheet.sheets as sheet, index}
        <button type="button" role="tab" aria-selected={activeSheet === index} class:active={activeSheet === index} onclick={() => (activeSheet = index)}>{sheet.name}</button>
      {/each}
    </div>
  {:else if kind === "presentation" && presentation}
    <div class="artifact-viewer__office-toolbar" aria-label="幻灯片控件">
      <button type="button" disabled={activeSlide === 0} onclick={() => (activeSlide -= 1)}>上一页</button>
      <span>第 {activeSlide + 1} 张，共 {presentation.slides.length} 张</span>
      <button type="button" disabled={activeSlide >= presentation.slides.length - 1} onclick={() => (activeSlide += 1)}>下一页</button>
    </div>
    <div class="artifact-viewer__slide-stage">
      <article class="artifact-viewer__slide" aria-label={`第 ${activeSlide + 1} 张幻灯片：${presentation.slides[activeSlide].title}`}>
        {#each presentation.slides[activeSlide].paragraphs as paragraph, index}
          {#if index === 0}<h2>{paragraph}</h2>{:else}<p>{paragraph}</p>{/if}
        {/each}
      </article>
      <p class="artifact-viewer__office-note">仅显示文本大纲，省略视觉元素、布局、动画和演讲者备注。</p>
      {#if presentation.hiddenSlides > 0}<p class="artifact-viewer__office-note">已省略 {presentation.hiddenSlides} 张隐藏幻灯片。</p>{/if}
      {#if presentation.truncated}<p class="artifact-viewer__office-note">部分幻灯片内容因预览限制而省略。</p>{/if}
    </div>
  {:else if kind === "html" && mode === "preview" && renderedHTML}
    <article class="artifact-viewer__document artifact-viewer__html">{@html renderedHTML}</article>
  {:else if kind === "markdown" && mode === "preview"}
    <article class="artifact-viewer__document artifact-viewer__markdown">{@html renderedHTML}</article>
  {:else if kind === "code"}
    <pre class="artifact-viewer__source"><code class="hljs">{@html highlightedSource}</code></pre>
  {:else}
    <pre class="artifact-viewer__source"><code>{source}</code></pre>
  {/if}
</div>
