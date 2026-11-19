<script lang="ts">
  import { Virtualizer } from "virtua/svelte";
  import {
    integrationsLoadErrorMessage,
    listEventDeliveries,
    type EventDeliveryAttempt,
  } from "../../../lib/integrations";

  type Props = {
    subscriptionID: string;
  };

  let { subscriptionID }: Props = $props();

  const PAGE_LIMIT = 50;
  const ROW_HEIGHT = 44;

  let deliveries = $state<EventDeliveryAttempt[]>([]);
  let nextCursor = $state<string | null>(null);
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state("");
  let expandedID = $state("");

  $effect(() => {
    void subscriptionID;
    deliveries = [];
    nextCursor = null;
    expandedID = "";
    void loadFirstPage();
  });

  async function loadFirstPage() {
    loading = true;
    error = "";
    try {
      const page = await listEventDeliveries(subscriptionID, { limit: PAGE_LIMIT });
      deliveries = page.deliveries;
      nextCursor = page.next_cursor;
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    error = "";
    try {
      const page = await listEventDeliveries(subscriptionID, {
        limit: PAGE_LIMIT,
        before: nextCursor,
      });
      deliveries = [...deliveries, ...page.deliveries];
      nextCursor = page.next_cursor;
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      loadingMore = false;
    }
  }

  function retryLoad() {
    if (deliveries.length === 0) {
      void loadFirstPage();
    } else {
      void loadMore();
    }
  }

  function statusLabel(delivery: EventDeliveryAttempt): string {
    if (delivery.error) return "失败";
    if (delivery.response_status >= 200 && delivery.response_status < 300) return "已送达";
    if (delivery.response_status > 0) return `HTTP ${delivery.response_status}`;
    return "失败";
  }

  function statusVariant(delivery: EventDeliveryAttempt): "ok" | "fail" {
    return !delivery.error && delivery.response_status >= 200 && delivery.response_status < 300
      ? "ok"
      : "fail";
  }

  function formatTimestamp(value: string): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function prettyJSON(raw: string | undefined): string {
    if (!raw) return "";
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
</script>

<div class="ws-intg__deliveries">
  {#if loading && deliveries.length === 0}
    <p class="ws-intg__panel-empty">正在加载投递记录…</p>
  {:else}
    {#if error}
      <div class="ws-intg__deliveries-retry">
        <p class="ws-bots__form-error" role="alert">{error}</p>
        <button type="button" class="ws-btn" onclick={retryLoad}>重试</button>
      </div>
    {/if}
    {#if deliveries.length === 0}
      {#if !error}
        <p class="ws-intg__panel-empty">
          暂无投递记录。事件触发后，投递尝试会显示在这里。
        </p>
      {/if}
    {:else}
      <div class="ws-intg__deliveries-scroll">
        <Virtualizer
          data={deliveries}
          getKey={(delivery: EventDeliveryAttempt) => delivery.id}
          itemSize={ROW_HEIGHT}
        >
          {#snippet children(delivery: EventDeliveryAttempt, _index: number)}
            <div class="ws-intg__delivery">
              <button
                type="button"
                class="ws-intg__delivery-row"
                aria-expanded={expandedID === delivery.id}
                onclick={() => (expandedID = expandedID === delivery.id ? "" : delivery.id)}
              >
                <span class="ws-intg__delivery-status ws-intg__delivery-status--{statusVariant(delivery)}">
                  {statusLabel(delivery)}
                </span>
                <code class="ws-intg__delivery-type">{delivery.event_type}</code>
                <span class="ws-intg__delivery-attempt">第 {delivery.attempt} 次尝试</span>
                <span class="ws-intg__delivery-time">{formatTimestamp(delivery.created_at)}</span>
              </button>
              {#if expandedID === delivery.id}
                <div class="ws-intg__delivery-detail">
                  {#if delivery.error}
                    <div class="ws-intg__delivery-block">
                      <span class="ws-intg__secret-label">错误</span>
                      <pre class="ws-bots__reveal-snippet"><code>{delivery.error}</code></pre>
                    </div>
                  {/if}
                  {#if delivery.request_json}
                    <div class="ws-intg__delivery-block">
                      <span class="ws-intg__secret-label">请求</span>
                      <pre class="ws-bots__reveal-snippet"><code>{prettyJSON(delivery.request_json)}</code></pre>
                    </div>
                  {/if}
                  {#if delivery.response_body}
                    <div class="ws-intg__delivery-block">
                      <span class="ws-intg__secret-label">
                        响应（{delivery.response_status}）
                      </span>
                      <pre class="ws-bots__reveal-snippet"><code>{delivery.response_body}</code></pre>
                    </div>
                  {/if}
                  <div class="ws-intg__item-meta">
                    开始于 {formatTimestamp(delivery.created_at)} · 完成于
                    {formatTimestamp(delivery.completed_at)}
                  </div>
                </div>
              {/if}
            </div>
          {/snippet}
        </Virtualizer>
      </div>
      {#if nextCursor && !error}
        <div class="ws-intg__deliveries-more">
          <button type="button" class="ws-btn" onclick={loadMore} disabled={loadingMore}>
            {loadingMore ? "正在加载…" : "加载更早的投递记录"}
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>
