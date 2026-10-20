'use strict';
/* 专项截图：登录界面（外观选择格）与角色页立绘 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9203;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-shots-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
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
  const shot = async (n, clip) => {
    const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip: clip } : { format: 'png' });
    fs.writeFileSync(path.join(ROOT, 'tools', 'shots', n + '.png'), Buffer.from(r.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);

  /* 1) 登录界面：清掉旧存档让界面回到初始状态，重点看外观选择格 */
  await ev("try{localStorage.removeItem(G.State.KEY);}catch(e){} 1");
  await send('Page.reload');
  await sleep(3000);
  console.log('外观格数量：' + await ev("document.querySelectorAll('.av-pick canvas').length"));
  console.log('外观件数：' + await ev("G.LOOKS.map(function(l){return l.id+':'+l.name;}).join(' | ')"));
  await shot('screen-login');
  await shot('screen-login-chips', { x: 960, y: 350, width: 460, height: 260, scale: 2 });

  /* 2) 登录后进入角色页看立绘 */
  await ev("document.querySelector('.login-panel input.input').value='灰烬行者';document.querySelector('.login-panel .btn.primary').click();1");
  await sleep(1600);
  await ev("G.Screen.go('character',{});1");
  await sleep(2200);
  await shot('screen-character');
  console.log('角色页立绘存在：' + await ev("!!document.querySelector('canvas[data-role=\"char-doll\"]')"));

  /* 3) 切到男角色外观再看一次 */
  await ev("G.State.state.account.look='lk_b';G.State.saveNow();G.Screen.go('character',{});1");
  await sleep(2200);
  await shot('screen-character-b');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
