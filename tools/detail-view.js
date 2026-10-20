'use strict';
/* 单角色整身大图（含动作），用于逐项检查建模细节 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9212;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const lookId = process.argv[2] || 'lk_a';
const scale = parseInt(process.argv[3] || '8', 10);
const outName = process.argv[4] || ('look-' + lookId);
const animName = process.argv[5] || 'idle';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-detail-' + Date.now()),
    '--window-size=560,820', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn, arg) => {
    const r = await send('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')',
      returnByValue: true
    });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r && r.result ? r.result.value : 'NORESULT';
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 540, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3000);
  const out = await ev(function (cfg) {
    const look = G.getLook(cfg.look);
    const s = cfg.scale, H = 780, W = 520;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:' + W + 'px;height:' + H + 'px';
    document.body.appendChild(cv);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2f3644'); g.addColorStop(1, '#262c38');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    /* 脚底位置：整身高度约 62 单位 × s，留出上下边距 */
    const footY = H - 60;
    const cx = W / 2;
    c.globalAlpha = 0.28; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(cx, footY + 4, 46, 9, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    const a = cfg.anim === 'idle' ? 'idle' : 'attack';
    G.Sprites.hero(c, {
      x: cx, y: footY, s: s, ph: cfg.anim === 'run' ? 3 : 1,
      moving: cfg.anim === 'run', action: a,
      atkT: a === 'attack' ? 0.45 : null, aim: 0, look: look, equip: {},
      wtype: 'blade', reach: 46, comboStep: cfg.anim === 'combo3' ? 3 : 1
    });
    c.fillStyle = '#e9eef7'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
    c.fillText(look.name + '　' + cfg.anim + '　×' + s, cx, 26);
    return 'ok';
  }, { look: lookId, scale: scale, anim: animName });
  if (out !== 'ok') console.log('渲染返回：' + out);
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 520, height: 780, scale: 1 } });
  fs.writeFileSync(path.join(ROOT, 'tools', 'shots', outName + '.png'), Buffer.from(shot.data, 'base64'));
  console.log('已保存 tools/shots/' + outName + '.png');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
