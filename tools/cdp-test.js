/* =========================================================
   余烬回廊 · 真实浏览器验证（CDP，Edge headless）
   逐屏截图 + 战斗模拟 + 控制台错误收集
   用法：node tools/cdp-test.js
   ========================================================= */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'tools', 'shots');
const PORT = 9222;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(ws) {
  let id = 0;
  const pend = new Map();
  const problems = [];
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map((a) => (a.value != null ? a.value : (a.description || a.type))).join(' ');
      if (m.params.type === 'error') problems.push('[console.error] ' + txt);
      else if (m.params.type === 'warning') problems.push('[console.warn] ' + txt);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      problems.push('[exception] ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      problems.push('[log] ' + m.params.entry.text);
    }
  });
  return {
    problems: problems,
    send(method, params) {
      const i = ++id;
      return new Promise((resolve, reject) => {
        pend.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method: method, params: params || {} }));
        setTimeout(() => { if (pend.has(i)) { pend.delete(i); reject(new Error('CDP 超时 ' + method)); } }, 25000);
      });
    },
    async eval(expr) {
      const r = await this.send('Runtime.evaluate', {
        expression: '(function(){try{' + expr + '}catch(e){return "__ERR__" + ((e && e.stack) || e.message)}})()',
        returnByValue: true, awaitPromise: true
      });
      const v = r && r.result ? r.result.value : undefined;
      if (typeof v === 'string' && v.indexOf('__ERR__') === 0) throw new Error(v.slice(7));
      return v;
    },
    async shot(name) {
      const r = await this.send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(SHOT_DIR, name + '.png');
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return f;
    }
  };
}

(async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const profile = path.join(os.tmpdir(), 'ember-cdp-' + Date.now());
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 50; i++) {
    try { version = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); }
  }
  if (!version) { console.log('无法启动浏览器调试端口'); proc.kill(); process.exit(1); }
  console.log('浏览器：' + version['Browser']);

  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = cdpConnect(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await cdp.send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);

  const lines = [];
  async function step(name, expr, wait, shotName) {
    let out;
    try { out = await cdp.eval(expr); }
    catch (e) { lines.push('FAIL ' + name + ' → ' + e.message.split('\n')[0]); return null; }
    await sleep(wait == null ? 650 : wait);
    if (shotName) await cdp.shot(shotName);
    lines.push('ok   ' + name + (out != null && out !== '' ? '  → ' + String(out).replace(/\n/g, ' | ').slice(0, 150) : ''));
    return out;
  }

  /* 预置一份演示存档：等级、武器、衣物、材料 */
  await step('预置演示存档', `
    if (G.State.state.ownedWeapons.length < 4) {
      ['w_iron_falchion','w_ember_bow','w_flame_gauntlet','w_ash_greatsword'].forEach(function(id,i){
        var w = JSON.parse(JSON.stringify(G.Weapons.get(id))); w.uid='demo'+i; w.instName=w.prefix ? (w.prefix+w.name) : w.name; G.State.addWeapon(w);
      });
      ['head','body','legs','cloak'].forEach(function(s,i){
        var pool = G.Clothing.bySlot(s); var src = pool[Math.min(i+1, pool.length-1)];
        var c = JSON.parse(JSON.stringify(src)); c.uid='democ'+i; G.State.addClothing(c); G.State.equipCloth(c.uid);
      });
      G.State.equipWeapon('demo0');
      G.State.state.account.lvl = 9;
      G.State.state.account.exp = 120;
      G.State.addItem('i_ember_dust', 14); G.State.addItem('i_scrap', 26);
      G.State.addItem('i_core_fragment', 5); G.State.addItem('i_void_shard', 2);
      G.State.acceptQuest('q_m1'); G.State.acceptQuest('q_s2'); G.State.acceptQuest('q_b3');
      G.State.state.stats.rooms = 3; G.State.state.stats.killBy['e_rust_hound'] = 4;
      G.State.syncQuestProgress();
      G.State.saveNow();
    }
    return '武器' + G.State.state.ownedWeapons.length + ' 衣物' + G.State.state.ownedClothing.length + ' 等级' + G.State.state.account.lvl;
  `, 300);

  await step('登录 → 主界面', `
    var i = document.querySelector('.login-panel input.input');
    if (i) { i.value = '灰烬行者'; document.querySelector('.login-panel .btn.primary').click(); }
    return '登录界面存在=' + !!i;
  `, 1500, '02-home');

  await step('主界面元素', `
    var s = G.Screen.screen;
    return '界面=' + G.Screen.current + ' 菜单=' + s.querySelectorAll('.menu-item').length +
      ' 立绘=' + !!s.querySelector('.hero-canvas') + ' 追踪任务=' + s.querySelectorAll('.track-item').length;
  `);

  await step('大厅（营地）', "G.Screen.go('lobby',{type:'hub'});return 'go';", 1500, '03-lobby');
  await step('大厅元素', `
    var s = G.Screen.screen;
    return '互动点=' + s.querySelectorAll('.hotspot').length + ' 装备槽=' + s.querySelectorAll('.ir-tx').length +
      ' 纸娃娃=' + !!s.querySelector('.doll-canvas-wrap canvas');
  `);

  await step('关卡选择', "G.Screen.go('lobby',{type:'stages'});return 'go';", 1400, '04-stages');

  await step('角色与衣物', "G.Screen.go('character',{});return 'go';", 1500, '05-character');
  await step('衣柜渲染', `
    var s = G.Screen.screen;
    return '衣柜件数=' + s.querySelectorAll('.wardrobe-grid .slot').length + ' 槽位行=' + s.querySelectorAll('.interact-row').length +
      ' 属性条=' + s.querySelectorAll('.statline').length + ' 立绘=' + !!s.querySelector('.avatar-big canvas');
  `);

  await step('背包 + 武器详情', "G.Screen.go('inventory',{});return 'go';", 1400);
  await step('选中武器', `
    var scr = G.Screen.screen; var slots = scr.querySelectorAll('.bag-scroll .slot');
    if (slots.length) slots[0].click();
    var t = scr.querySelector('.detail-title');
    return '格子=' + slots.length + ' 详情标题=' + (t ? t.textContent : '无');
  `, 700, '06-inventory');

  await step('任务界面', "G.Screen.go('quests',{});return 'go';", 1400, '07-quests');
  await step('任务交互', `
    var scr = G.Screen.screen; var cards = scr.querySelectorAll('.quest-card');
    if (cards.length) cards[1].click();
    return '任务卡=' + cards.length + ' 详情=' + (scr.querySelector('.detail-title') ? scr.querySelector('.detail-title').textContent : '无');
  `, 700);

  await step('铁砧 · 强化', "G.Screen.go('mods',{tab:'forge'});return 'go';", 1300, '08-forge');
  await step('强化一次武器', `
    var btns = [].filter.call(document.querySelectorAll('.panel-body .btn'), function(b){ return /强化一次/.test(b.textContent); });
    if (btns[0]) btns[0].click();
    var w = G.State.weapon();
    return '强化后 +' + (w.plus||0) + ' 攻击=' + w.atk;
  `, 800, '09-forge-after');
  await step('铁砧 · 天赋', "G.Screen.go('mods',{tab:'talent'});return 'go';", 1100, '10-talent');
  await step('铁砧 · 商店', "G.Screen.go('mods',{tab:'shop'});return 'go';", 1300, '11-shop');
  await step('购买第一件商品', `
    var c = G.Screen.screen.querySelector('.shop-card');
    var before = G.State.coins();
    if (c) c.click();
    return '余烬币 ' + before + ' → ' + G.State.coins();
  `, 800);

  /* ---------------- 开放世界（俯视角沙盒） ---------------- */
  await step('进入开放世界', "G.Screen.go('world',{});return 'go';", 2400, '20-world');
  await step('世界初始化', `
    var w = G.__world;
    if (!w) return '未创建';
    return '世界=' + w.world.size + '² 装饰=' + w.world.props.length + ' 画布=' + w.W + '×' + w.H +
      ' 出生=(' + Math.floor(w.player.x/16) + ',' + Math.floor(w.player.y/16) + ') 敌人=' + w.mobs.length;
  `);

  await step('自由漫游（按住 D 走 2 秒 + 相机跟随）', `
    var w = G.__world, x0 = w.player.x, c0 = w.cam.x;
    w.keys['d'] = true;
    for (var i = 0; i < 120; i++) { w.update(1/60); if (i % 10 === 0) w.render(); }
    w.keys['d'] = false; w.render();
    return '位移=' + Math.round(w.player.x - x0) + 'px 相机跟随=' + (Math.abs(w.cam.x - c0) > 10) +
      ' 地形=' + G.tInfo(G.tileAt(w.world, Math.floor(w.player.x/16), Math.floor(w.player.y/16))).name;
  `, 600, '21-world-roam');

  await step('遭遇战与掉落（打死一只精英）', `
    var w = G.__world, p = w.player;
    w.mobs.length = 0;
    w.mobs.push({ x: p.x + 19, y: p.y, face: -1, ph: 0, def: G.Enemies.list[0], etype: G.Enemies.list[0].kind,
      color: G.Enemies.list[0].color, size: 18, hp: 24, maxHp: 24, atk: 5, spd: 0.5, cd: 99,
      hurtT: 0, hitT: 0, elite: true, lvl: 4 });
    p.stamina = 9999; p.aim = 0;              /* 明确朝右，敌人在右侧 */
    var k0 = p.kills, l0 = p.looted;
    for (var i = 0; i < 40; i++) { p.atkT = 0; p.aim = 0; w.attack(); for (var j = 0; j < 6; j++) w.update(1/60); }
    for (var i2 = 0; i2 < 150; i2++) { w.update(1/60); if (i2 % 15 === 0) w.render(); }
    w.render();
    return '击杀=' + (p.kills - k0) + ' 拾取=' + (p.looted - l0) + ' 地上剩余=' + w.loot.length +
      ' 余烬=' + p.ember + ' HP=' + Math.round(p.hp) + '/' + p.maxHp;
  `, 700, '22-world-combat');

  await step('M 键世界地图（缩放 + 拖动）', `
    var w = G.__world;
    w.toggleMap();
    var mv = G.MapView;
    mv.setZoom(0.62); mv.cx += 26; mv.cy -= 14;
    return '打开=' + mv.isOpen + ' 缩放=' + mv.zoom.toFixed(2) + ' 按钮=' + document.querySelectorAll('.map-btn').length +
      ' 图例=' + document.querySelectorAll('.map-legend i').length;
  `, 900, '23-world-map');

  await step('地图全局视图', `
    G.MapView.fitAll();
    return '缩放到=' + G.MapView.zoom.toFixed(3);
  `, 800, '24-world-map-far');

  await step('关闭地图 + 暂停面板', `
    G.__world.toggleMap();
    var closed = !G.MapView.isOpen && !document.querySelector('.map-overlay');
    G.__world.paused = true; G.__world.syncPause();
    var el = document.getElementById('w-pause');
    return '地图已关闭=' + closed + ' 暂停面板=' + (el && !el.classList.contains('hide'));
  `, 700, '25-world-pause');

  /* ---------------- 战斗 ---------------- */
  await step('进入战斗（第一层）', "G.Screen.go('game',{stageId:'st1'});return 'go';", 2200, '12-battle');
  await step('战斗初始化', `
    var g = G.__game;
    if (!g) return '未创建';
    return '运行=' + g.running + ' 敌人=' + g.enemies.length + ' 房间=' + (g.room+1) + '/' + g.totalRooms +
      ' 波次=' + g.wave + '/' + g.waves + ' 武器=' + (g.tot.weapon ? g.tot.weapon.name : '无') + ' HP=' + Math.round(g.player.hp);
  `);

  await step('真实战斗模拟（敌人拉到近身，模拟 6 秒）', `
    var g = G.__game, p = g.player, summary = [];
    for (var i = 0; i < 360; i++) {
      g.enemies.forEach(function(e){ if (!e.dead && Math.random() < 0.06) { e.x = p.x + (Math.random() < 0.5 ? -46 : 46); } });
      g.mouse.x = (p.x + p.face * 60); g.mouse.y = 300;
      g.keys['d'] = (i % 120 < 60);
      if (i % 26 === 0) g.tryAttack(false);
      if (i % 90 === 0) g.tryAttack(true);
      if (i === 150) g.castSkill();
      if (i === 260) g.useItem();
      if (i % 200 === 0) g.keys[' '] = true; else if (i % 200 === 4) g.keys[' '] = false;
      g.update(1/60);
      if (i % 12 === 0) g.render();
    }
    g.render();
    return '击杀=' + g.kills + ' 伤害=' + g.dmgDone + ' 受伤=' + g.dmgTaken + ' HP=' + Math.round(g.player.hp) + '/' + g.player.maxHp +
      ' 剩余敌人=' + g.enemies.filter(function(e){return !e.dead;}).length + ' 掉落物=' + g.loot.length + ' 已拾取=' + JSON.stringify(g.gained);
  `, 900, '13-battle-fight');

  await step('结算界面（胜利）', `
    var g = G.__game; g.result = 'win'; g.over = true; g.showResult(true);
    var t = document.querySelector('.result-title');
    return t ? t.textContent : '无结算';
  `, 900, '14-result');

  await step('返回大厅', "G.Screen.go('lobby',{type:'hub'});return '存档=' + (localStorage.getItem(G.State.KEY) ? '已写入' : '缺失');", 1200);

  const errs = cdp.problems.filter((p) => /exception|console\.error|\[log\]/.test(p));
  console.log('\n============ 浏览器检查结果 ============');
  lines.forEach((l) => console.log(l));
  console.log('\n控制台输出 ' + cdp.problems.length + ' 条：');
  cdp.problems.slice(0, 20).forEach((p) => console.log(' - ' + p.replace(/\n/g, ' ').slice(0, 260)));
  console.log('\n截图：' + SHOT_DIR);
  console.log(errs.length ? '结论：发现 ' + errs.length + ' 个页面级错误' : '结论：无页面级错误，全部流程通过');

  try { ws.close(); } catch (e) { }
  proc.kill();
  await sleep(300);
  process.exitCode = errs.length ? 1 : 0;
})().catch((e) => { console.error('测试异常：', e); process.exit(1); });
