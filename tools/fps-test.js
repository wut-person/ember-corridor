'use strict';
/* 实测：角色动画帧率（60 FPS 目标） */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9521;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'edge-fps-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception || {}).description) || m.params.exceptionDetails.text);
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn) => {
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : 'NORESULT';
  };
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'fps-' + n + '.png'), Buffer.from(s.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '帧率'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);

  /* --- 1) 角色页立绘：点「播放动作」后测动画帧率 --- */
  await ev(function () { G.Screen.go('character', {}); return 1; });
  await sleep(2000);
  await ev(function () {
    const bs = document.querySelectorAll('.avatar-actions .btn');
    for (const b of bs) if (b.textContent.indexOf('播放动作') >= 0) { b.click(); return 1; }
    return 0;
  });
  await sleep(500);
  const doll = await ev(function () {
    return new Promise(function (resolve) {
      const cv = document.querySelector('canvas[data-role="char-doll"]');
      if (!cv) { resolve('未找到立绘画布'); return; }
      const c = cv.getContext('2d');
      let frames = 0;
      const orig = c.clearRect.bind(c);
      c.clearRect = function () { frames++; return orig.apply(null, arguments); };
      const t0 = performance.now();
      setTimeout(function () {
        const sec = (performance.now() - t0) / 1000;
        c.clearRect = orig;
        resolve('立绘重绘 ' + frames + ' 帧 / ' + sec.toFixed(2) + ' 秒 = ' + (frames / sec).toFixed(1) + ' FPS');
      }, 2000);
    });
  });
  console.log('1) 角色立绘：' + doll);
  await shot('01-doll');

  /* --- 2) 大世界里的角色（主循环）--- */
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2500);
  await ev(function () { G.__world.keys['a'] = true; return 1; });
  await sleep(500);
  const world = await ev(function () {
    return new Promise(function (resolve) {
      const cv = document.getElementById('world-canvas');
      if (!cv) { resolve('未找到世界画布'); return; }
      const c = cv.getContext('2d');
      let frames = 0;
      const orig = c.drawImage.bind(c);
      c.drawImage = function () { frames++; return orig.apply(null, arguments); };
      const t0 = performance.now();
      setTimeout(function () {
        const sec = (performance.now() - t0) / 1000;
        c.drawImage = orig;
        resolve('角色绘制 ' + frames + ' 次 / ' + sec.toFixed(2) + ' 秒 = ' + (frames / sec).toFixed(1) + ' FPS');
      }, 2000);
    });
  });
  console.log('2) 大世界角色：' + world);
  await shot('02-world');

  /* --- 3) 动画帧号是否在推进（走路 8 帧循环）--- */
  const seq = await ev(function () {
    return new Promise(function (resolve) {
      const out = [];
      let n = 0;
      const timer = setInterval(function () {
        out.push(Math.floor(G.__world.player.ph / 3) % 8);
        if (++n >= 12) { clearInterval(timer); resolve('走路帧序列：' + out.join(' → ')); }
      }, 50);
    });
  });
  console.log('3) ' + seq);
  await ev(function () { G.__world.keys['a'] = false; return 1; });
  await sleep(400);
  console.log('');
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 160) : ''));
  ws.close(); proc.kill(); await sleep(200); process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
