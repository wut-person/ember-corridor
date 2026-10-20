'use strict';
/* 风格对比：用 ?style=old 与 ?style=fine 各跑一遍，同一场景截图 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const cleanup = require('./lib/cleanup');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shotStyle(style, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylecmp-'));
  cleanup.begin();
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20') + '?style=' + style;
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + dir,
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn) => { const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true, awaitPromise: true }); if (r && r.exceptionDetails) return 'EXC'; return r ? r.result.value : null; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: url }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '风格'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2600);
  const info = await ev(function () { const d = G.Sprites.sheetDebug(); return d.style + ' | ' + d.dir; });
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'style-' + style + '.png'), Buffer.from(s.data, 'base64'));
  ws.close(); proc.kill();
  await sleep(400);
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
  return info;
}

(async function () {
  console.log('旧版：' + await shotStyle('old', 9601));
  console.log('精细版：' + await shotStyle('fine', 9602));
  cleanup.end(true);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });