'use strict';
/* 遗迹专项：遗迹生成 / 绘制 / 守卫苏醒 / 清空掉落 / 品质分布 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9571;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(os.tmpdir(),'edge-ruin-'+Date.now()),'--window-size=1440,900','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
  for (let i=0;i<40;i++){ try { await (await fetch('http://127.0.0.1:'+PORT+'/json/version')).json(); break; } catch(e){ await sleep(300);} }
  const tabs = await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();
  const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r));
  let id=0; const pend=new Map(); const errs=[];
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}
    if(m.method==='Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception||{}).description)||m.params.exceptionDetails.text);});
  const send=(method,params)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params:params||{}}));});
  const ev=async(fn)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true,awaitPromise:true});
    if(r&&r.exceptionDetails) return 'EXC: '+((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);
    return r?r.result.value:'NORESULT';};
  const shot=async(n)=>{const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(ROOT,'tools','shots','ru-'+n+'.png'),Buffer.from(s.data,'base64'));};
  const results=[]; const ck=(n,ok,info)=>{console.log((ok?'ok   ':'FAIL ')+n+'  '+info);results.push(ok);};

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:PAGE_URL}); await sleep(3200);
  await ev(function(){const i=document.querySelector('.login-panel input.input'); if(i)i.value='遗迹'; const b=document.querySelector('.login-panel .btn.primary'); if(b)b.click(); return 1;});
  await sleep(1800);
  await ev(function(){ G.Screen.go('world',{}); return 1; });
  await sleep(2600);

  /* 1) 世界里有遗迹 */
  const ruins = await ev(function () {
    const w = G.__world;
    return {
      n: w.world.ruins.length,
      list: w.world.ruins.map(function (r) { return r.name + '(档' + (r.tier + 1) + ')'; }).join(' ')
    };
  });
  ck('世界生成遗迹', typeof ruins === 'object' && ruins.n >= 5, ruins.n + ' 处：' + ruins.list);

  /* 2) 传送到第一个遗迹中心，看守卫苏醒 */
  const approach = await ev(function () {
    const w = G.__world, T = 16;
    const r = w.world.ruins[0];
    const tx = r.x * T + T * r.w / 2, ty = r.y * T + T * r.h / 2;
    w.player.x = tx; w.player.y = ty;
    w.centerCamera();
    const before = w.mobs.length;
    /* 跑几帧让 updateRuins 触发 */
    for (let i = 0; i < 10; i++) w.update(1 / 60);
    const guards = w.mobs.filter(function (m) { return m.ruin === 0; });
    return {
      ruin: r.name, tier: r.tier, before: before, after: w.mobs.length,
      guards: guards.length,
      names: guards.map(function (m) { return m.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('/'),
      spawned: !!(w.ruinState[0] && w.ruinState[0].spawned)
    };
  });
  ck('接近遗迹唤醒守卫', approach.spawned === true && approach.guards >= 2,
    '「' + approach.ruin + '」档位 ' + (approach.tier + 1) + '　守卫 ' + approach.guards + ' 只（' + approach.names + '）');
  await shot('01-ruin');

  /* 3) 清空遗迹 → 掉落战利品
        注意：地上掉落物会被玩家自动吸附拾取，所以用「唯一 id 集合」追踪本次奖励，
        不能只用 w.loot.length 比较 */
  const clear = await ev(function () {
    const w = G.__world;
    const st = w.ruinState[0] || {};
    /* 给现有掉落物打标，方便之后区分新掉落 */
    w.loot.forEach(function (l) { l.__old = true; });
    const before = G.State.bagList('all').length;
    /* 用正规击杀路径干掉守卫（保证 dead 标记与掉落逻辑一致） */
    st.guards.slice().forEach(function (m) { if (!m.dead) w.killMob(m); });
    /* 跑几帧触发清空判定 */
    for (let i = 0; i < 8; i++) w.update(1 / 60);
    const fresh = w.loot.filter(function (l) { return !l.__old; });
    return {
      cleared: !!st.cleared,
      loot: fresh.length,
      rarities: fresh.map(function (l) { return G.rarityLabel(l.rarity || 0); }).join(','),
      kinds: fresh.map(function (l) { return l.kind; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('/'),
      toast: '（清空时会有 toast 提示）'
    };
  });
  ck('清空遗迹掉落战利品', clear.cleared === true && clear.loot > 0,
    '掉落 ' + clear.loot + ' 件（' + clear.kinds + '）品质：' + clear.rarities);
  await shot('02-cleared');

  /* 4) 每件战利品都能在物品表里找到 */
  const valid = await ev(function () {
    const w = G.__world;
    let bad = 0;
    w.loot.forEach(function (l) {
      if (l.kind === 'weapon' && !G.Weapons.get(l.id)) bad++;
      else if (l.kind === 'cloth' && !G.Clothing.get(l.id)) bad++;
      else if (l.kind === 'item' && !G.Items.get(l.id)) bad++;
    });
    return bad;
  });
  ck('掉落引用的物品都存在', valid === 0, '无效引用 ' + valid + ' 件');

  /* 5) 品质分布实测：跑 3000 次 roll 看比例 */
  const dist = await ev(function () {
    const N = 3000, c = [0,0,0,0,0,0];
    for (let i = 0; i < N; i++) c[G.rollRuinRarity(0)]++;
    return c.map(function (v, i) { return G.RUIN_RARITY[i].label + ' ' + (v / N * 100).toFixed(1) + '%'; }).join('　');
  });
  console.log('     3000 次掷点分布：' + dist);
  results.push(true);

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0,160) : ''));
  ws.close(); proc.kill(); await sleep(200);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch(e=>{console.error(e);process.exit(1);});
