let WebSocketImpl = globalThis.WebSocket;
if (!WebSocketImpl) {
  const wsModule = await import('ws');
  WebSocketImpl = wsModule.default;
}

const url = process.env.WS_URL || 'ws://localhost:8000/api/readings';
const expected = Number(process.env.EXPECTED || 3);
const timeoutMs = Number(process.env.TIMEOUT_MS || 15000);

const latencies = [];
const received = [];

const ws = new WebSocketImpl(url);

const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, reason: 'timeout', received: received.length, latencies }));
  ws.close();
  process.exit(2);
}, timeoutMs);

ws.on('open', () => {
  console.log(`connected:${url}`);
});

ws.on('message', (raw) => {
  try {
    const now = Date.now();
    const data = JSON.parse(raw.toString());
    if (typeof data.ts_ms === 'number') {
      const latency = now - data.ts_ms;
      latencies.push(latency);
      received.push({ division_id: data.division_id ?? data.divisionId ?? null, latency_ms: latency, ts_ms: data.ts_ms });
      console.log(`msg latency_ms=${latency} division=${data.division_id ?? data.divisionId ?? 'n/a'}`);
    }

    if (received.length >= expected) {
      clearTimeout(timeout);
      ws.close();
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const max = Math.max(...latencies);
      console.log(JSON.stringify({ ok: true, received, avg_latency_ms: avg, max_latency_ms: max }));
      process.exit(0);
    }
  } catch (e) {
    // ignore non-json frames
  }
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.error(JSON.stringify({ ok: false, reason: 'ws_error', error: String(err) }));
  process.exit(1);
});
