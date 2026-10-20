'use strict';
/* 单角色大图对比：把某个外观按参考图同样的构图放大渲染 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9202;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const lookId = process.argv[2] || 'lk_a';
const scale = parseInt(process.argv[3] || '13', 10);
const outName = process.argv[4] || ('look-' + lookId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-one-' + Date.now()),
    '--window-size=520,760', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 740, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3000);
  const r = await ev(`(function(){
    var look = G.getLook('${lookId}');
    var s = ${scale}, H = 700;
    var cv = document.createElement('canvas');
    cv.width = 500; cv.height = H;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:500px;height:' + H + 'px';
    document.body.appendChild(cv);
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f1420'); g.addColorStop(1, '#0b0e17');
    c.fillStyle = g; c.fillRect(0, 0, 500, H);
    /* 画布中心对准人物：头高约 66*s/12，脚底在 600 */
    var cx = 250, cy = 620;
    c.globalAlpha = 0.35; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(cx, cy + 4, 46, 9, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    G.Sprites.hero(c, { x: cx, y: cy, s: s, ph: 1.0, moving: false, action: 'idle',
      atkT: null, aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
    c.fillStyle = '#e9eef7'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
    c.fillText(look.name + ' · ' + s + 'x', cx, 30);
    var d = c.getImageData(0, 0, 500, H).data;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var y = 0; y < H; y++) for (var x = 0; x < 500; x++) {
      if (d[(y * 500 + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return 'bbox x[' + minX + ',' + maxX + '] y[' + minY + ',' + maxY + '] 宽' + (maxX - minX + 1) + ' 高' + (maxY - minY + 1);
  })()`);
  console.log(r);
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 500, height: 740, scale: 1 } });
  fs.writeFileSync(path.join(ROOT, 'tools', 'shots', outName + '.png'), Buffer.from(shot.data, 'base64'));
  console.log('已保存 tools/shots/' + outName + '.png');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
