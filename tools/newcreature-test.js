'use strict';
/* 新生物实测：攻击生物 / 友善援护 / 善良生物 都能生成、绘制、交互 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const cleanup = require('./lib/cleanup');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9651;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const sb = cleanup.begin();
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(sb, 'newcrt-' + Date.now()),
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
    return r ? r.result.value : null;
  };
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'new-' + n + '.png'), Buffer.from(s.data, 'base64')); };
  const results = []; const ck = (n, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + '  ' + info); results.push(ok); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '新生物'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2600);

  /* 1) 数据齐全 */
  const data = await ev(function () {
    const cr = G.Creature.list.map(function (c) { return c.name + '(' + c.temper + ')'; });
    const en = ['e_dark_wolf', 'e_vine_horror', 'e_tomb_skeleton'].map(function (id) {
      const e = G.Enemies.get(id); return e ? e.name + '[' + e.sprite + ']' : id + '缺失';
    });
    return { creatures: cr.join(' '), enemies: en.join(' ') };
  });
  ck('10 个生物数据齐全', String(data.creatures).split(' ').length === 10, data.creatures);
  ck('3 个攻击生物数据齐全', String(data.enemies).indexOf('缺失') < 0, data.enemies);

  /* 2) 手动生成三种新生物 + 三种攻击生物，看渲染不炸 */
  const placed = await ev(function () {
    const w = G.__world, T = 16;
    const p = w.player;
    const out = [];
    /* 清掉现有敌人，避免干扰 */
    w.mobs.length = 0;
    const spawnC = function (id, dx, dy) {
      const def = G.Creature.byId(id);
      const c = w.spawnCreature(p.x + dx * 40, p.y + dy * 40);
      return c;
    };
    /* 直接构造生物（绕过地形限制）便于截图 */
    const mk = function (def, dx, dy) {
      const c = {
        x: p.x + dx * 44, y: p.y + dy * 44, face: 1, ph: 0,
        species: def.id, def: def, name: def.name, nick: '测试',
        temper: def.temper, habitat: def.habitat,
        body: def.body, body2: def.body2, dark: def.dark, snout: def.snout, ear: def.ear,
        foot: def.foot, horn: def.horn, spot: def.spot, tusk: def.tusk, bristle: def.bristle,
        staff: def.staff, hat: def.hat, pack: def.pack, glow: def.glow, eye: def.eye,
        hp: def.hp, maxHp: def.hp, size: def.size, spd: def.spd / 60,
        moving: false, hurtT: 0, vx: 0, vy: 0, think: 99, dx: 0, dy: 0,
        tamed: 0, follow: 0, target: null, scanT: 0, atkCd: 0, attackT: 0, announced: true, range: 240
      };
      w.creatures.push(c);
      return c;
    };
    w.creatures.length = 0;
    const defs = ['cr_leafkin', 'cr_slime_buddy', 'cr_deer', 'cr_boar', 'cr_frog'];
    defs.forEach(function (id, i) {
      mk(G.Creature.byId(id), -3 + i * 1.5, -1.6);
    });
    /* 三种攻击生物摆在下方 */
    const kinds = ['e_dark_wolf', 'e_vine_horror', 'e_tomb_skeleton'];
    kinds.forEach(function (eid, i) {
      const def = G.Enemies.get(eid);
      w.mobs.push({
        x: p.x + (-2 + i * 2) * 44, y: p.y + 2.2 * 44, face: 1, ph: i,
        def: def, etype: def.kind, sprite: def.sprite, color: def.color, size: def.size,
        hp: def.hp, maxHp: def.hp, atk: def.atk, spd: def.spd / 60, cd: 0.5,
        hurtT: 0, hitT: 0, elite: false, lvl: 1, ruin: 0
      });
    });
    w.centerCamera();
    for (let i = 0; i < 4; i++) w.update(1 / 60);
    /* update() 会把生物补回 22 只，这里再清一次只留测试用的 5 只 */
    w.creatures = w.creatures.filter(function (c) { return c.nick === '测试'; });
    return { creatures: w.creatures.length, mobs: w.mobs.length };
  });
  ck('新生物已放入世界', placed && placed.creatures === 5 && placed.mobs >= 3,
    '测试用生物 ' + (placed && placed.creatures) + ' 只，敌人 ' + (placed && placed.mobs) + ' 只（含自动补充）');

  await sleep(900);
  await shot('01-all');

  /* 3) 友善援护会不会打攻击生物 */
  const fight = await ev(function () {
    const w = G.__world;
    const leaf = w.creatures.filter(function (c) { return c.temper === 'guardian'; })[0];
    if (!leaf) return { err: '没有援护生物' };
    /* 把一只攻击生物挪到援护生物旁边 */
    const wolf = w.mobs[0];
    leaf.x = wolf.x - 40; leaf.y = wolf.y; leaf.range = 240;
    const hpBefore = wolf.hp;
    /* 跑够时间让援护生物攻击 */
    for (let i = 0; i < 300; i++) w.update(1 / 60);
    return {
      got: leaf.target ? '已锁定目标' : '未锁定',
      hpBefore: hpBefore, hpAfter: wolf.hp,
      type: leaf.name
    };
  });
  ck('友善援护会攻击攻击生物', fight && fight.hpAfter < fight.hpBefore,
    fight ? (fight.type + ' ' + fight.got + '，目标血量 ' + fight.hpBefore + ' → ' + fight.hpAfter) : JSON.stringify(fight));
  await sleep(600);
  await shot('02-fight');

  /* 4) 玩家能攻击善良生物 */
  const hunt = await ev(function () {
    const w = G.__world;
    const deer = w.creatures.filter(function (c) { return c.species === 'cr_deer'; })[0];
    if (!deer) return { err: '没有鹿' };
    w.player.x = deer.x - 16; w.player.y = deer.y;
    w.player.aim = 0; w.player.aimWant = 0;
    const before = deer.hp;
    for (let k = 0; k < 5; k++) {
      /* 鹿被打一次就会逃，测试里每刀前把它拉回射程（同时验证「被打会逃」是有效的） */
      w.player.x = deer.x - 16; w.player.y = deer.y;
      w.player.aim = 0; w.player.aimWant = 0; w.player.face = 1;
      w.player.atkT = 0; w.player.comboT = 0; w.player.stamina = 999;
      w.attack();
      for (let j = 0; j < 6; j++) w.update(1 / 60);
    }
    return { before: before, after: deer.hp, dead: deer.dead === true };
  });
  ck('玩家能攻击善良生物（梅花鹿）', hunt && (hunt.after < hunt.before || hunt.dead),
    hunt ? ('鹿血量 ' + hunt.before + ' → ' + hunt.after) : JSON.stringify(hunt));

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 160) : ''));
  ws.close(); proc.kill(); await sleep(300);
  try { fs.rmSync(sb, { recursive: true, force: true }); } catch (e) { }
  cleanup.end(true);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
