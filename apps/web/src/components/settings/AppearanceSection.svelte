<script lang="ts">
  import {
    BOARD_THEMES,
    COLOR_MODES,
    DENSITIES,
    MESSAGE_LAYOUTS,
    loadBoardTheme,
    loadColorMode,
    loadDensity,
    loadMessageLayout,
    setBoardTheme,
    setColorMode,
    setDensity,
    setMessageLayout,
    type BoardTheme,
    type ColorMode,
    type Density,
    type MessageLayout,
  } from "../../lib/appearance";
  import type { User } from "../../lib/types";

  let { user }: { user: User } = $props();

  const previewName = $derived(user.display_name || user.handle || "你");
  const previewInitial = $derived((previewName[0] ?? "Y").toUpperCase());

  let colorMode = $state<ColorMode>(loadColorMode());
  let boardTheme = $state<BoardTheme>(loadBoardTheme());
  let messageLayout = $state<MessageLayout>(loadMessageLayout());
  let density = $state<Density>(loadDensity());

  $effect(() => {
    void user.appearance_preferences;
    colorMode = loadColorMode();
    boardTheme = loadBoardTheme();
    messageLayout = loadMessageLayout();
    density = loadDensity();
  });

  function pickMode(mode: ColorMode) {
    colorMode = mode;
    setColorMode(mode);
  }

  function pickBoard(board: BoardTheme) {
    boardTheme = board;
    setBoardTheme(board);
  }

  function pickMessageLayout(layout: MessageLayout) {
    messageLayout = layout;
    setMessageLayout(layout);
  }

  function pickDensity(next: Density) {
    density = next;
    setDensity(next);
  }

  function moveRadioSelection(
    event: KeyboardEvent,
    optionCount: number,
    currentIndex: number,
    select: (index: number) => void,
  ) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % optionCount;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + optionCount) % optionCount;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = optionCount - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    select(nextIndex);
    const radios = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="radio"]',
    );
    radios?.item(nextIndex).focus();
  }
</script>

<header class="settings-page__header">
  <p class="settings-page__eyebrow">账户</p>
  <h2 class="settings-page__h1">外观</h2>
  <p class="settings-page__lead">
    更改立即生效，并随账户同步到所有设备。
  </p>
</header>

<div class="settings-form">
  <!-- Live preview: picks apply globally the moment they're made, so the strip
       inherits color mode + board tokens for free; layout and density are
       mirrored locally via data attributes so the sample messages restyle. -->
  <div
    class="appearance-preview"
    data-layout={messageLayout}
    data-density={density}
    aria-hidden="true"
  >
    <div class="appearance-preview__bar">
      <span class="appearance-preview__hash">#</span>
      <span>deploys</span>
      <span class="appearance-preview__topic">发布流水线讨论</span>
    </div>
    <div class="appearance-preview__chat">
      <div class="appearance-preview__msg">
        <span class="appearance-preview__avatar">{previewInitial}</span>
        <span class="appearance-preview__body">
          <span class="appearance-preview__head">
            <span class="appearance-preview__who">{previewName}</span>
            <span class="appearance-preview__when">下午 2:14</span>
          </span>
          <span class="appearance-preview__text">
            流水线又通过了，可以把 v0.2.2 部署到预发布环境吗？
          </span>
        </span>
      </div>
      <div class="appearance-preview__msg">
        <span class="appearance-preview__avatar is-agent">C</span>
        <span class="appearance-preview__body">
          <span class="appearance-preview__head">
            <span class="appearance-preview__who">Claw</span>
            <span class="bot-chip">机器人</span>
            <span class="appearance-preview__when">下午 2:15</span>
          </span>
          <span class="appearance-preview__activity">
            已执行 <code>make test && make deploy staging</code> · 34 项通过 · 12 秒
          </span>
          <span class="appearance-preview__answer">
            已完成，预发布环境已更新到 v0.2.2。冒烟测试通过，监控面板也没有异常。
          </span>
          <span class="appearance-preview__reactions">
            <span class="appearance-preview__reaction is-mine">🚀 2</span>
            <span class="appearance-preview__reaction">✅ 1</span>
          </span>
        </span>
      </div>
      <div class="appearance-preview__msg">
        <span class="appearance-preview__avatar">{previewInitial}</span>
        <span class="appearance-preview__body">
          <span class="appearance-preview__head">
            <span class="appearance-preview__who">{previewName}</span>
            <span class="appearance-preview__when">下午 2:16</span>
          </span>
          <span class="appearance-preview__text">太好了，午饭后部署到生产环境 🌮</span>
        </span>
      </div>
    </div>
  </div>
  <p class="appearance-preview__caption">实时预览，随选择即时更新</p>

  <div class="appearance-rows">
    <div class="appearance-row">
      <div class="appearance-row__meta">
        <span class="appearance-row__label">颜色模式</span>
        <span class="appearance-row__desc">“跟随系统”使用操作系统设置</span>
      </div>
      <div class="appearance-seg" role="radiogroup" aria-label="颜色模式">
        {#each COLOR_MODES as mode, index (mode.id)}
          <button
            type="button"
            class="appearance-seg__btn"
            class:is-active={colorMode === mode.id}
            role="radio"
            aria-checked={colorMode === mode.id}
            tabindex={colorMode === mode.id ? 0 : -1}
            onclick={() => pickMode(mode.id)}
            onkeydown={(event) =>
              moveRadioSelection(event, COLOR_MODES.length, index, (nextIndex) =>
                pickMode(COLOR_MODES[nextIndex].id),
              )}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="appearance-row">
      <div class="appearance-row__meta">
        <span class="appearance-row__label">界面主题</span>
        <span class="appearance-row__desc">设置界面、强调色和高亮的配色</span>
      </div>
      <div class="appearance-row__control">
        <span class="board-chips__name">
          {BOARD_THEMES.find((board) => board.id === boardTheme)?.label}
        </span>
        <div class="board-chips" role="radiogroup" aria-label="界面主题">
          {#each BOARD_THEMES as board, index (board.id)}
            <button
              type="button"
              class="board-chip"
              class:is-active={boardTheme === board.id}
              role="radio"
              aria-checked={boardTheme === board.id}
              tabindex={boardTheme === board.id ? 0 : -1}
              data-board={board.id}
              aria-label={`${board.label} — ${board.blurb}`}
              title={`${board.label} — ${board.blurb}`}
              onclick={() => pickBoard(board.id)}
              onkeydown={(event) =>
                moveRadioSelection(event, BOARD_THEMES.length, index, (nextIndex) =>
                  pickBoard(BOARD_THEMES[nextIndex].id),
                )}
            ></button>
          {/each}
        </div>
      </div>
    </div>

    <div class="appearance-row">
      <div class="appearance-row__meta">
        <span class="appearance-row__label">消息布局</span>
        <span class="appearance-row__desc">智能体活动在回复中的显示方式</span>
      </div>
      <div class="appearance-seg" role="radiogroup" aria-label="消息布局">
        {#each MESSAGE_LAYOUTS as layout, index (layout.id)}
          <button
            type="button"
            class="appearance-seg__btn"
            class:is-active={messageLayout === layout.id}
            role="radio"
            aria-checked={messageLayout === layout.id}
            tabindex={messageLayout === layout.id ? 0 : -1}
            title={layout.blurb}
            onclick={() => pickMessageLayout(layout.id)}
            onkeydown={(event) =>
              moveRadioSelection(event, MESSAGE_LAYOUTS.length, index, (nextIndex) =>
                pickMessageLayout(MESSAGE_LAYOUTS[nextIndex].id),
              )}
          >
            {layout.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="appearance-row">
      <div class="appearance-row__meta">
        <span class="appearance-row__label">密度</span>
        <span class="appearance-row__desc">紧凑模式可在屏幕上显示更多消息</span>
      </div>
      <div class="appearance-seg" role="radiogroup" aria-label="密度">
        {#each DENSITIES as option, index (option.id)}
          <button
            type="button"
            class="appearance-seg__btn"
            class:is-active={density === option.id}
            role="radio"
            aria-checked={density === option.id}
            tabindex={density === option.id ? 0 : -1}
            title={option.blurb}
            onclick={() => pickDensity(option.id)}
            onkeydown={(event) =>
              moveRadioSelection(event, DENSITIES.length, index, (nextIndex) =>
                pickDensity(DENSITIES[nextIndex].id),
              )}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
