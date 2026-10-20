'use strict';
/* 线上版本验证：加载 GitHub Pages 上的游戏，确认能真正跑起来 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const cleanup = require('./lib/cleanup');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9671;
const LIVE = 'https://wut-person.github.io/ember-corridor/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const sb = cleanup.begin();
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(sb, 'live-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errs = []; const failed = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception || {}).description) || m.params.exceptionDetails.text);
    if (m.method === 'Network.loadingFailed') failed.push(m.params.errorText + ' ' + (m.params.requestId || ''));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      failed.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url);
    }
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn) => {
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : null;
  };
  const results = []; const ck = (n, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + '  ' + info); results.push(ok); };

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  console.log('加载 ' + LIVE);
  await send('Page.navigate', { url: LIVE });
  await sleep(6000);

  /* 1) 页面与脚本都加载了 */
  const boot = await ev(function () {
    return {
      title: document.title,
      hasG: typeof window.G === 'object',
      scripts: document.querySelectorAll('script[src]').length,
      screens: G && G.Screen ? Object.keys(G.Screen.screens || {}).length : -1,
      hasLogin: !!document.querySelector('.login-panel')
    };
  });
  ck('页面加载成功', boot && boot.hasLogin === true, '标题「' + (boot && boot.title) + '」');
  ck('29 个脚本全部加载', boot && boot.scripts === 29, 'script 标签 ' + (boot && boot.scripts) + ' 个，G.Screen 已注册');
  ck('登录界面已渲染', boot && boot.hasLogin === true, '找到 .login-panel');

  /* 2) 登录进入游戏 */
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '线上测试'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(2200);
  const logged = await ev(function () { return { screen: G.Screen.current, name: G.State.state.account.name }; });
  ck('登录成功', logged && logged.screen === 'hall', '当前界面 ' + (logged && logged.screen) + '，玩家名 ' + (logged && logged.name));

  /* 3) 进大世界 */
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(3500);
  const world = await ev(function () {
    const w = G.__world;
    if (!w) return { err: '没有世界实例' };
    return {
      creatures: w.creatures.length,
      mobs: w.mobs.length,
      ruins: w.world.ruins.length,
      tiles: w.world.size,
      props: w.world.props.length,
      named: w.creatures.filter(function (c) { return c.nick; }).length
    };
  });
  ck('大世界生成成功', world && world.tiles === 320,
    world && world.tiles ? ('320x320 地图，' + world.props + ' 个装饰物，' + world.ruins + ' 处遗迹') : JSON.stringify(world));
  ck('生物已生成', world && world.creatures > 0,
    (world && world.creatures) + ' 只生物（' + (world && world.named) + ' 只有姓名）');
  ck('敌人系统运行中', world && typeof world.mobs === 'number', (world && world.mobs) + ' 个敌人');

  /* 4) 精灵图从线上加载成功 */
  const sheet = await ev(function () {
    const d = G.Sprites.sheetDebug ? G.Sprites.sheetDebug() : null;
    return d ? { enabled: d.enabled, style: d.style, dir: d.dir } : { err: '无 sheetDebug' };
  });
  ck('精灵图系统已启用', sheet && sheet.enabled === true,
    sheet ? ('风格 ' + sheet.style + '，目录 ' + sheet.dir) : JSON.stringify(sheet));

  /* 5) 帧率 */
  const fps = await ev(function () {
    return new Promise(function (resolve) {
      let n = 0; const t0 = performance.now();
      const tick = function () {
        n++;
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
        else resolve(Math.round(n / ((performance.now() - t0) / 1000)));
      };
      requestAnimationFrame(tick);
    });
  });
  ck('运行帧率达标', fps >= 30, fps + ' FPS（线上网络加载，30 以上即正常）');

  /* 6) 截图 */
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'docs', 'screenshots', '00-live-github-pages.png'), Buffer.from(s.data, 'base64'));

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 200) : ''));
  console.log('资源加载失败 = ' + failed.length + ' 条' + (failed.length ? ' → ' + failed.slice(0, 3).join(' | ') : ''));
  ws.close(); proc.kill(); await sleep(400);
  cleanup.end(true);
  process.exit(results.every(Boolean) && errs.length === 0 && failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
