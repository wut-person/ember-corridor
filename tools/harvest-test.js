'use strict';
/* 采集专项：砍树得木头 / 挖沙得沙子 / 取水得水袋 / 资源会消失并重生 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9561;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(os.tmpdir(),'edge-hv-'+Date.now()),'--window-size=1440,900','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
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
    fs.writeFileSync(path.join(ROOT,'tools','shots','hv-'+n+'.png'),Buffer.from(s.data,'base64'));};
  const results=[]; const ck=(n,ok,info)=>{console.log((ok?'ok   ':'FAIL ')+n+'  '+info);results.push(ok);};

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:PAGE_URL}); await sleep(3200);
  await ev(function(){const i=document.querySelector('.login-panel input.input'); if(i)i.value='采集'; const b=document.querySelector('.login-panel .btn.primary'); if(b)b.click(); return 1;});
  await sleep(1800);
  await ev(function(){ G.Screen.go('world',{}); return 1; });
  await sleep(2600);

  /* 传送到一棵树旁 */
  const treeInfo = await ev(function () {
    const w = G.__world, T = 16;
    /* 找一棵离玩家最近的树 */
    let best = -1, bd = 1e9;
    for (let i = 0; i < w.world.props.length; i++) {
      if (w.world.props[i].kind !== 'tree' && w.world.props[i].kind !== 'pine') continue;
      const cx = w.world.props[i].x * T + 8, cy = w.world.props[i].y * T + 8;
      const d = Math.hypot(cx - w.player.x, cy - w.player.y);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return null;
    const pr = w.world.props[best];
    /* 把玩家放到树左边 14px 处，朝右（朝向树） */
    w.player.x = pr.x * T + 8 - 14;
    w.player.y = pr.y * T + 8;
    w.player.aim = 0; w.player.aimWant = 0;
    w.centerCamera();
    return { idx: best, kind: pr.kind, tx: pr.x, ty: pr.y };
  });
  ck('找到可采集的树', treeInfo !== null, treeInfo ? ('索引 ' + treeInfo.idx + ' 种类 ' + treeInfo.kind) : '未找到');

  /* 采集前背包木头数 */
  const woodBefore = await ev(function () { return G.State.countItem('i_wood'); });
  /* 连砍 3 次 */
  const chopped = await ev(function () {
    const w = G.__world;
    const out = [];
    for (let i = 0; i < 4; i++) {
      w.player.atkT = 0; w.player.comboT = 0; w.player.stamina = 999;
      w.attack();
      const st = w.propState[w.__tIdx === undefined ? 0 : 0];
      out.push('挥' + (i + 1));
      for (let j = 0; j < 20; j++) w.update(1 / 60);
    }
    return out.join('→');
  });
  console.log('     ' + chopped);
  const woodAfter = await ev(function () { return G.State.countItem('i_wood'); });
  ck('砍树获得木头', woodAfter > woodBefore, '木头 ' + woodBefore + ' → ' + woodAfter);

  const gone = await ev(function () {
    const w = G.__world;
    let n = 0;
    for (const k in w.propState) if (w.propState[k].gone) n++;
    return n;
  });
  ck('被砍倒的资源会消失', gone >= 1, '已消失 ' + gone + ' 个');
  await shot('01-chopped');

  /* 挖沙 */
  const sand = await ev(function () {
    const w = G.__world, T = 16;
    /* 找一块沙滩 */
    for (let ty = 0; ty < w.world.size; ty++) {
      for (let tx = 0; tx < w.world.size; tx++) {
        const t = G.tInfo(G.tileAt(w.world, tx, ty));
        if (t.name === '沙滩') {
          w.player.x = tx * T + 8; w.player.y = ty * T + 8;
          w.harvestT = 0;
          const before = G.State.countItem('i_sand');
          const tgt = w.findHarvestTarget(1);
          if (!tgt) return { ok: false, why: 'findHarvestTarget 返回空', tile: t.name };
          const got = w.harvest(tgt, 1);
          return { ok: true, before: before, after: G.State.countItem('i_sand'), tile: t.name, got: got, kind: tgt.kind };
        }
      }
    }
    return { ok: false, why: '世界中没有沙滩' };
  });
  ck('沙地可采集', sand.ok === true && sand.kind === 'sand',
    sand.ok ? ('地块 ' + sand.tile + ' 目标 ' + sand.kind) : sand.why);

  /* 取水 */
  const water = await ev(function () {
    const w = G.__world, T = 16;
    for (let ty = 0; ty < w.world.size; ty++) {
      for (let tx = 0; tx < w.world.size; tx++) {
        const t = G.tInfo(G.tileAt(w.world, tx, ty));
        if (t.name === '浅水' || t.name === '深水') {
          w.player.x = tx * T + 8; w.player.y = ty * T + 8;
          w.harvestT = 0;
          const before = G.State.countItem('i_water');
          const tgt = w.findHarvestTarget(1);
          if (!tgt) return { ok: false, why: 'findHarvestTarget 返回空', tile: t.name };
          w.harvest(tgt, 1);
          return { ok: true, before: before, after: G.State.countItem('i_water'), tile: t.name, kind: tgt.kind };
        }
      }
    }
    return { ok: false, why: '世界中没有水域' };
  });
  ck('水域可取水', water.ok === true && water.kind === 'water',
    water.ok ? ('地块 ' + water.tile + ' 目标 ' + water.kind + '　水袋 ' + water.before + ' → ' + water.after) : water.why);

  /* 石块：找岩石 */
  const rock = await ev(function () {
    const w = G.__world, T = 16;
    for (let i = 0; i < w.world.props.length; i++) {
      if (w.world.props[i].kind !== 'rock') continue;
      const pr = w.world.props[i];
      w.player.x = pr.x * T + 8 - 14; w.player.y = pr.y * T + 8;
      w.player.aim = 0; w.player.aimWant = 0;
      const before = G.State.countItem('i_stone');
      for (let k = 0; k < 6; k++) {
        w.player.atkT = 0; w.player.comboT = 0; w.player.stamina = 999;
        w.attack();
        for (let j = 0; j < 20; j++) w.update(1 / 60);
      }
      return { before: before, after: G.State.countItem('i_stone') };
    }
    return null;
  });
  ck('岩石可开采得石块', rock && rock.after > rock.before,
    rock ? ('石块 ' + rock.before + ' → ' + rock.after) : '未找到岩石');

  /* 重生计时：把 gone 的 regrow 调小，看是否恢复 */
  const regrow = await ev(function () {
    const w = G.__world;
    let n = 0;
    for (const k in w.propState) {
      if (w.propState[k].gone) { w.propState[k].regrow = 0.05; n++; }
    }
    w.updateResources(0.2);
    let still = 0;
    for (const k in w.propState) if (w.propState[k].gone) still++;
    return { wasGone: n, stillGone: still };
  });
  ck('资源会重生', regrow.wasGone > 0 && regrow.stillGone === 0,
    '重生前 ' + regrow.wasGone + ' 个消失 → 计时后剩 ' + regrow.stillGone + ' 个');
  await shot('02-after');

  const inv = await ev(function () {
    return ['i_wood','i_sand','i_water','i_stone'].map(function (k) {
      const it = G.Items.get(k);
      return (it ? it.name : k) + '×' + G.State.countItem(k);
    }).join('　');
  });
  console.log('     背包采集物：' + inv);
  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0,160) : ''));
  ws.close(); proc.kill(); await sleep(200);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch(e=>{console.error(e);process.exit(1);});