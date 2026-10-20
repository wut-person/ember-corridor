'use strict';
/* 探针：检查称号阶梯、技能位与 HUD 徽章 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9303;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-probe-' + Date.now()),
    '--window-size=1280,800', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn, arg) => {
    const r = await send('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')',
      returnByValue: true
    });
    if (r && r.exceptionDetails) {
      return 'EXC: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text);
    }
    return r ? r.result.value : 'NORESULT';
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);
  await ev(function () { document.querySelector('.login-panel input.input').value = '测试'; document.querySelector('.login-panel .btn.primary').click(); return 1; });
  await sleep(1500);

  console.log(await ev(function () {
    const st = window.G && window.G.State ? window.G.State.state : null;
    return JSON.stringify({
      hasG: !!window.G,
      hasTitles: !!(window.G && window.G.TITLES),
      ember: st ? st.wallet.i_ember : 'no-state',
      titleIdx: window.G && window.G.titleIndexFor ? window.G.titleIndexFor(st ? st.wallet.i_ember : 0) : 'no-fn'
    });
  }));

  await ev(function () { window.G.State.state.wallet.i_ember = 30000; window.G.State.saveNow(); return 1; });
  await ev(function () { window.G.Screen.go('game', { stageId: 'st1' }); return 1; });
  await sleep(2400);

  console.log(await ev(function () {
    const g = window.G.__game;
    if (!g) return 'no-game';
    const badge = document.querySelector('#h-title-badge');
    const names = [].map.call(document.querySelectorAll('#h-skills .sk-name'), function (n) { return n.textContent; });
    return JSON.stringify({
      title: g.title && g.title.name,
      titleIdx: g.player.titleIdx,
      rmb: g.player.skillRmb && g.player.skillRmb.name,
      q: g.player.skillQ && g.player.skillQ.name,
      shift: g.player.skillShift && g.player.skillShift.name,
      passive: g.player.passive && g.player.passive.name,
      badge: badge ? badge.textContent.trim() : 'no-badge',
      slots: names,
      skillsHTML: (document.querySelector('#h-skills') || {}).innerHTML ? document.querySelector('#h-skills').innerHTML.slice(0, 420) : 'empty'
    }, null, 1);
  }));
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
