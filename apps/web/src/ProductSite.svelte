<script lang="ts">
  import "./product.css";
  import { productAppURLForHost } from "./productLinks";

  const docsURL = "https://docs.clickclack.chat";
  const appURL = productAppURLForHost(window.location.hostname);
  const repoURL = "https://github.com/openclaw/clickclack";

  // The hero keyboard: the product name as two rows of keycaps. The C keys
  // carry the signal cyan, echoing the pressed key in the logo mark.
  const keyRows = [
    ["C", "L", "I", "C", "K"],
    ["C", "L", "A", "C", "K"],
  ];

  const stats = [
    { key: "1", label: "个二进制文件，无需额外服务" },
    { key: "SQLite", label: "默认数据库，同时支持Postgres" },
    { key: "OpenAPI", label: "契约与TypeScript SDK" },
    { key: "MIT", label: "许可证，自托管优先" },
  ];

  const features = [
    {
      icon: "box",
      legend: "打包",
      title: "一个二进制文件，无需额外服务",
      body: "单个Go二进制文件，内嵌Svelte应用、数据库迁移和静态资源。默认使用SQLite和本地上传，无需运行其他服务。",
    },
    {
      icon: "bolt",
      legend: "实时",
      title: "持久化实时通信",
      body: "WebSocket负责传输，数据库保存真实状态。每个事件都会写入持久化日志，客户端凭游标重新连接，不遗漏任何事件。",
    },
    {
      icon: "thread",
      legend: "话题",
      title: "保持单层的话题",
      body: "Slack风格的话题，仅有一层。对话可以分支展开，无需在层层嵌套的回复中翻找。",
    },
    {
      icon: "robot",
      legend: "机器人",
      title: "智能体是一等公民",
      body: "机器人、智能体和人类使用相同的公共API：CLI、OpenAPI契约、TypeScript SDK、Webhook和斜杠命令。",
    },
    {
      icon: "server",
      legend: "数据库",
      title: "自托管优先",
      body: "SQLite是默认数据库，而非仅供演示，支持WAL、FTS5搜索和在线备份。Postgres也可通过相同的存储接口接入。",
    },
    {
      icon: "shield",
      legend: "管理",
      title: "从容管理",
      body: "支持免密链接认证、可选的GitHub OAuth，以及内置审批、超时和封禁功能的访客等候室。",
    },
  ];

  const terminalLines = [
    { prompt: true, text: "clickclack serve --data ./data" },
    { prompt: false, text: "listening on :8080 · sqlite ./data/clickclack.db" },
    { prompt: true, text: 'clickclack send --channel general "deploy started"' },
    { prompt: false, text: "msg_01j9x sent to #general" },
    { prompt: true, text: "clickclack threads reply msg_01j9x --stdin <notes.md" },
    { prompt: false, text: "reply posted · thread depth 1" },
  ];

  const quickstart = [
    { step: "安装", code: "pnpm install && pnpm build" },
    { step: "启动服务", code: "go run ./apps/api/cmd/clickclack serve" },
    { step: "聊天", code: "open http://localhost:8080" },
  ];

  // Self-hosted instances keep App links on the local /app route, so the
  // card label has to follow the real target instead of the hosted domain.
  const appDestination = appURL.startsWith("http")
    ? { href: appURL, host: "app.clickclack.chat", label: "托管应用界面" }
    : { href: appURL, host: "/app", label: "当前实例上的应用" };

  const destinations = [
    { href: docsURL, host: "docs.clickclack.chat", label: "架构、API和部署指南" },
    appDestination,
    { href: repoURL, host: "github.com/openclaw/clickclack", label: "源码、问题和发行版本" },
  ];
</script>

<svelte:head>
  <title>ClickClack——人类与智能体的团队聊天工具</title>
  <meta
    name="description"
    content="ClickClack是一款可自托管、单二进制文件的聊天应用，提供Slack风格的话题、持久化实时通信、SQLite、便于智能体使用的CLI、OpenAPI和TypeScript SDK。"
  />
  <meta name="color-scheme" content="light dark" />
</svelte:head>

<div class="product-site">
  <header class="site-nav-wrap">
    <nav class="site-nav" aria-label="产品导航">
      <a class="brand" href="/">
        <img class="brand-mark" src="/favicon.svg" alt="" width="34" height="34" />
        <span class="brand-name">ClickClack</span>
      </a>
      <div class="nav-links">
        <a href="#features">功能</a>
        <a href="#agents">智能体</a>
        <a href={docsURL}>文档</a>
        <a href={repoURL}>GitHub</a>
      </div>
      <a class="btn btn-primary nav-cta" href={appURL}>打开应用</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-legend">开源·MIT·单个Go二进制文件</p>
        <h1>人类与智能体的团队聊天工具。</h1>
        <p class="lede">
          ClickClack是一款可自托管的聊天应用，提供Slack风格的话题、持久化实时通信，以及可供机器人、CI任务和智能体通过Shell调用的API。
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href={appURL}>打开应用</a>
          <a class="btn btn-ghost" href={docsURL}>阅读文档</a>
        </div>
        <code class="hero-install" aria-label="快速开始命令">
          <span aria-hidden="true">$</span> go run ./apps/api/cmd/clickclack serve
        </code>
      </div>

      <div class="hero-board" role="img" aria-label="用两排键盘键帽拼出ClickClack">
        {#each keyRows as row, r}
          <div class="key-row" class:row-2={r === 1}>
            {#each row as letter, i}
              <span
                class="cap"
                class:cap-signal={letter === "C" && i === 0}
                style="--press-delay: {(r * 5 + i) * 70}ms"
              >{letter}</span>
            {/each}
          </div>
        {/each}
      </div>

      <div class="app-frame" role="img" aria-label="ClickClack应用预览，展示频道时间线和已打开的话题">
        <div class="app-titlebar" aria-hidden="true">
          <span class="tl-dot"></span>
          <span class="tl-dot"></span>
          <span class="tl-dot"></span>
          <span class="tl-title">clickclack — #release-room</span>
        </div>
        <div class="app-body" aria-hidden="true">
          <aside class="app-sidebar">
            <div class="ws-name">openclaw<span>工作区</span></div>
            <p class="side-label">频道</p>
            <ul>
              <li># general</li>
              <li class="active"># release-room</li>
              <li># ops</li>
              <li># support</li>
            </ul>
            <p class="side-label">私聊</p>
            <ul>
              <li><span class="ps-presence"></span>Mira</li>
              <li><span class="ps-presence bot"></span>build-bot</li>
              <li><span class="ps-presence"></span>Peter</li>
            </ul>
          </aside>
          <div class="app-timeline">
            <div class="ps-timeline-head">
              <strong># release-room</strong>
              <span>准备发布v0.1——检查、文档、部署</span>
            </div>
            <div class="ps-msg">
              <span class="ps-avatar a-mira">M</span>
              <div>
                <p class="ps-msg-meta"><b>Mira</b><time>09:41</time></p>
                <p>端到端测试和文档检查通过后，就发布v0.1。</p>
              </div>
            </div>
            <div class="ps-msg">
              <span class="ps-avatar a-bot">⌘</span>
              <div>
                <p class="ps-msg-meta"><b>build-bot</b><span class="ps-bot-tag">机器人</span><time>09:42</time></p>
                <p><code>pnpm test:e2e</code>已通过——84项测试，无跳过。</p>
                <p class="ps-thread-hint">↳ 2条回复</p>
              </div>
            </div>
            <div class="ps-msg">
              <span class="ps-avatar a-peter">P</span>
              <div>
                <p class="ps-msg-meta"><b>Peter</b><time>09:44</time></p>
                <p>在话题中补充部署说明和Hetzner目标。</p>
              </div>
            </div>
            <div class="ps-composer">向#release-room发送消息</div>
          </div>
          <aside class="app-thread">
            <div class="ps-thread-head">话题</div>
            <div class="ps-msg">
              <span class="ps-avatar a-bot">⌘</span>
              <div>
                <p class="ps-msg-meta"><b>build-bot</b><time>09:42</time></p>
                <p>构建产物已上传。二进制文件为24&nbsp;MB，已内嵌静态资源。</p>
              </div>
            </div>
            <div class="ps-msg">
              <span class="ps-avatar a-peter">P</span>
              <div>
                <p class="ps-msg-meta"><b>Peter</b><time>09:45</time></p>
                <p>只有一层，没有嵌套。发布吧。🦀</p>
              </div>
            </div>
            <div class="ps-composer">在话题中回复</div>
          </aside>
        </div>
      </div>
    </section>

    <section class="stat-strip" aria-label="产品信息">
      {#each stats as s}
        <div class="stat">
          <span class="stat-key">{s.key}</span>
          <span class="stat-label">{s.label}</span>
        </div>
      {/each}
    </section>

    <section class="pillars" aria-label="产品概览">
      <p class="section-kicker">为什么选择ClickClack</p>
      <h2>即使连接中断，聊天基础设施也依然稳定。</h2>
      <p class="section-lede">
        每条持久化消息、话题回复、表情回应和频道更新，都能通过HTTP凭游标恢复，客户端和智能体可平稳重新连接。
      </p>
    </section>

    <section class="feature-grid" id="features" aria-label="功能亮点">
      {#each features as feature}
        <article>
          <div class="feature-head">
            <span class="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                {#if feature.icon === "box"}
                  <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" />
                {:else if feature.icon === "bolt"}
                  <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                {:else if feature.icon === "thread"}
                  <path d="M21 11a8 8 0 0 1-8 8H4l3-3" /><path d="M3 11a8 8 0 0 1 8-8h1" /><circle cx="17" cy="5" r="1.6" /><circle cx="7" cy="19" r="1.6" />
                {:else if feature.icon === "robot"}
                  <rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M12 4v4" /><circle cx="12" cy="3" r="1" /><path d="M9 13h.01M15 13h.01" /><path d="M9.5 16.5h5" />
                {:else if feature.icon === "server"}
                  <rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" />
                {:else}
                  <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" />
                {/if}
              </svg>
            </span>
            <span class="feature-legend" aria-hidden="true">{feature.legend}</span>
          </div>
          <h3>{feature.title}</h3>
          <p>{feature.body}</p>
        </article>
      {/each}
    </section>

    <section class="agent-band" id="agents" aria-label="智能体与CLI工作流">
      <div class="agent-copy">
        <p class="section-kicker">智能体接入</p>
        <h2>易用的CLI，不内置大语言模型。</h2>
        <p>
          外部智能体、CI任务和人类都能调用与Web应用相同的公共API。令牌和工作区默认设置按服务器隔离，切换主机时不会泄露凭证或沿用过期ID。
        </p>
        <ul class="agent-list">
          <li>每个端点均有OpenAPI契约</li>
          <li>不依赖框架的TypeScript SDK</li>
          <li>Mattermost风格的Webhook和斜杠命令</li>
          <li>持久化事件游标，支持停机后回放</li>
        </ul>
      </div>
      <div class="terminal" aria-label="CLI会话示例">
        <div class="terminal-bar" aria-hidden="true">
          <span class="tl-dot"></span>
          <span class="tl-dot"></span>
          <span class="tl-dot"></span>
          <span class="tl-title">agent@ci — zsh</span>
        </div>
        <pre>{#each terminalLines as line}<span class={line.prompt ? "t-prompt" : "t-out"}>{line.prompt ? "$ " : "  "}{line.text}
</span>{/each}<span class="t-caret" aria-hidden="true"></span></pre>
      </div>
    </section>

    <section class="quickstart" aria-label="快速开始">
      <p class="section-kicker">快速开始</p>
      <h2>三条命令即可运行。</h2>
      <ol class="quickstart-steps">
        {#each quickstart as item, i}
          <li>
            <span class="step-no">{i + 1}</span>
            <div>
              <h3>{item.step}</h3>
              <code>{item.code}</code>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <section class="destinations" aria-label="文档与应用入口">
      <div class="dest-intro">
        <p class="section-kicker">相关入口</p>
        <h2>所需内容，都在你预期的位置。</h2>
      </div>
      <div class="dest-list">
        {#each destinations as dest}
          <a href={dest.href}>
            <strong>{dest.host}</strong>
            <span>{dest.label}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7" /><path d="M9 7h8v8" /></svg>
          </a>
        {/each}
      </div>
    </section>

    <section class="enter-band" aria-label="开始使用">
      <p class="section-kicker">准备就绪</p>
      <h2>按下Enter，开始使用。</h2>
      <a class="enter-key" href={appURL}>
        <span>打开ClickClack</span>
        <span class="enter-glyph" aria-hidden="true">↵</span>
      </a>
    </section>
  </main>

  <footer class="site-footer">
    <p>ClickClack——长着钳子的可自托管聊天工具。采用MIT许可证。</p>
    <div>
      <a href={docsURL}>文档</a>
      <a href={appURL}>应用</a>
      <a href={repoURL}>GitHub</a>
    </div>
  </footer>
</div>
