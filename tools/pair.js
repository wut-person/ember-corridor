'use strict';
/* 并排渲染前两套外观（对应两张参考立绘），用于确认最终效果 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9204;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-pair-' + Date.now()),
    '--window-size=760,680', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: '(function(){try{' + expr + '}catch(e){return "ERR:"+((e&&e.stack)||e.message)}})()', returnByValue: true });
    return r && r.result ? r.result.value : undefined;
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 660, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3000);
  const out = await ev(`(function(){
    var s = 8, W = 760, H = 640;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:' + W + 'px;height:' + H + 'px';
    document.body.appendChild(cv);
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#111726'); g.addColorStop(1, '#0a0d15');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var info = [];
    [['lk_a', 190], ['lk_b', 570]].forEach(function(pair){
      var look = G.getLook(pair[0]), cx = pair[1], cy = 560;
      c.globalAlpha = 0.32; c.fillStyle = '#000';
      c.beginPath(); c.ellipse(cx, cy + 5, 46, 8, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      G.Sprites.hero(c, { x: cx, y: cy, s: s, ph: 1.0, moving: false, action: 'idle',
        atkT: null, aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
      c.fillStyle = '#e9eef7'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
      c.fillText(look.name, cx, 596);
      c.fillStyle = '#8b97a8'; c.font = '12px sans-serif';
      c.fillText(look.title + '  ' + look.build, cx, 616);
      info.push(look.id);
    });
    return info.join(',');
  })()`);
  console.log('渲染：' + out);
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 760, height: 632, scale: 1 } });
  fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'pair-final.png'), Buffer.from(shot.data, 'base64'));
  console.log('已保存 pair-final.png');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
