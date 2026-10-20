'use strict';
/* 把当前的外观预设渲染成对比图，方便与参考立绘逐项核对 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9201;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-look-' + Date.now()),
    '--window-size=1000,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r && r.exceptionDetails) return 'EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 700);
    return r && r.result ? r.result.value : ('RAW:' + JSON.stringify(r).slice(0, 300));
  };
  const shot = async (n) => {
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1290, height: 730, scale: 1 } });
    fs.writeFileSync(path.join(ROOT, 'tools', 'shots', n + '.png'), Buffer.from(r.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 740, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3000);

  /* 用一个独立画布，把 4 套外观按同一比例画出来对比（含正面/奔跑/挥砍三态） */
  const out = await ev(`(function(){
    var ids = G.LOOKS.map(function(l){ return l.id; });
    var s = 9, colW = 320, H = 700;
    var W = colW * ids.length;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#0d1018';
    document.body.appendChild(cv);
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#0d1018'; c.fillRect(0, 0, W, H);
    ids.forEach(function(lid, i){
      var look = G.getLook(lid);
      var cx = colW / 2 + i * colW, cy = H - 70;
      c.globalAlpha = 0.3; c.fillStyle = '#000';
      c.beginPath(); c.ellipse(cx, cy + 2, 44, 8, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      /* 站立 */
      G.Sprites.hero(c, { x: cx - 46, y: cy, s: s, ph: 1.0, moving: false, action: 'idle',
        atkT: null, aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
      /* 奔跑 */
      G.Sprites.hero(c, { x: cx + 30, y: cy, s: s, ph: 3.0, moving: true, action: 'run',
        atkT: null, aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
      /* 挥砍 */
      G.Sprites.hero(c, { x: cx + 96, y: cy, s: s, ph: 1.0, moving: false, action: 'attack',
        atkT: 0.45, aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
      c.fillStyle = '#e9eef7'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
      c.fillText(look.name, cx, H - 40);
      c.fillStyle = '#7c8798'; c.font = '12px sans-serif';
      c.fillText(look.build + ' / ' + look.hairStyle + (look.detail && look.detail.beard ? ' / 有胡须' : ''), cx, H - 12);
    });
    return ids.join(',');
  })()`);
  console.log('已渲染外观：' + out);
  await sleep(300);
  await shot('looks-compare');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
