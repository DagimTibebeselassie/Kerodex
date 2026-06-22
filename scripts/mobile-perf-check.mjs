const port = Number(process.env.CHROME_DEBUG_PORT || 9226);
const routes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/cars', '/vehicle/demo_ga_014', '/profile', '/sell'];

const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('localhost:4100'))
  || pages.find((item) => item.type === 'page' && item.url === 'about:blank')
  || pages.find((item) => item.type === 'page');
if (!page) throw new Error(`No Chrome page found on debugging port ${port}.`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Performance.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2.75,
  mobile: true,
});
await send('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  platform: 'Android',
});
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
await send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
  connectionType: 'cellular4g',
});

for (const route of routes) {
  await send('Performance.disable');
  await send('Performance.enable');
  await send('Network.clearBrowserCache');
  const targetUrl = `http://localhost:4100${route}`;
  const navigation = await send('Page.navigate', { url: targetUrl });
  if (navigation.errorText) throw new Error(`${targetUrl}: ${navigation.errorText}`);
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const expression = `(async () => {
    await document.fonts.ready;
    let lcp = 0;
    let cls = 0;
    try {
      const lcpEntries = await new Promise((resolve) => {
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => { observer.disconnect(); resolve(entries); }, 100);
      });
      lcp = lcpEntries.at(-1)?.startTime || 0;
      const layoutEntries = await new Promise((resolve) => {
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => { observer.disconnect(); resolve(entries); }, 100);
      });
      cls = layoutEntries.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0);
    } catch {}
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const longTasks = performance.getEntriesByType('longtask');
    return {
      requestedRoute: ${JSON.stringify(route)},
      route: location.pathname,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      lcp,
      cls,
      domContentLoaded: nav?.domContentLoadedEventEnd || 0,
      load: nav?.loadEventEnd || 0,
      transferKb: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      jsKb: Math.round(resources.filter((entry) => entry.name.includes('/assets/') && entry.name.endsWith('.js')).reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      cssKb: Math.round(resources.filter((entry) => entry.name.endsWith('.css')).reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      resourceCount: resources.length,
      conversationRequests: resources.filter((entry) => entry.name.includes('/api/conversations')).length,
      listingDetailRequests: resources.filter((entry) => entry.name.includes('/api/listings/') && !entry.name.includes('/related')).length,
      ibmPlexMonoRequests: resources.filter((entry) => entry.name.includes('ibm-plex-mono')).length,
      domNodes: document.getElementsByTagName('*').length,
      vehicleCards: document.querySelectorAll('[data-vehicle-id]').length,
      longTasks: longTasks.length,
      blockingMs: Math.round(longTasks.reduce((sum, entry) => sum + Math.max(0, entry.duration - 50), 0)),
    };
  })()`;
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const performanceMetrics = await send('Performance.getMetrics');
  const metrics = Object.fromEntries(performanceMetrics.metrics.map((metric) => [metric.name, metric.value]));
  console.log(JSON.stringify({
    ...result.result.value,
    taskMs: Math.round((metrics.TaskDuration || 0) * 1000),
    scriptMs: Math.round((metrics.ScriptDuration || 0) * 1000),
    layoutMs: Math.round((metrics.LayoutDuration || 0) * 1000),
  }));
}

socket.close();
