'use strict';
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9511;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(os.tmpdir(),'edge-poses-'+Date.now()),'--window-size=1440,900','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
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
    fs.writeFileSync(path.join(ROOT,'tools','shots','pose-'+n+'.png'),Buffer.from(s.data,'base64'));};
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:PAGE_URL}); await sleep(3200);
  await ev(function(){const i=document.querySelector('.login-panel input.input'); if(i)i.value='动作'; const b=document.querySelector('.login-panel .btn.primary'); if(b)b.click(); return 1;});
  await sleep(1800);
  await ev(function(){ G.Screen.go('world',{}); return 1; });
  await sleep(2500);
  console.log('1) 精灵图加载  ' + await ev(function(){ return JSON.stringify(G.Sprites.sheetDebug()); }));
  /* 待机 */
  await shot('01-idle');
  /* 走路：按住 A */
  await ev(function(){ G.__world.keys['a']=true; return 1; });
  await sleep(900); await shot('02-walk');
  await ev(function(){ G.__world.keys['a']=false; return 1; });
  await sleep(400);
  /* 疾跑：按住 D + Shift */
  await ev(function(){ G.__world.keys['d']=true; G.__world.keys['shift']=true; return 1; });
  await sleep(900); await shot('03-run');
  await ev(function(){ G.__world.keys['d']=false; G.__world.keys['shift']=false; return 1; });
  await sleep(400);
  /* 三段普攻：连续挥砍，抓第 1/2/3 段 */
  for (let i = 1; i <= 3; i++) {
    await ev(function(){ const w=G.__world; w.player.atkT=0; w.attack(); return 1; });
    await sleep(140);
    const st = await ev(function(){ return 'comboStep=' + G.__world.player.comboStep; });
    await shot('0' + (3 + i) + '-atk' + i);
    console.log('   ' + i + ') 普攻 ' + st);
    await sleep(260);
  }
  /* 受击 */
  await ev(function(){ G.__world.player.hurtT = 0.5; return 1; });
  await sleep(120); await shot('07-hurt');
  /* 下蹲 */
  await ev(function(){ G.__world.player.crouch = true; G.__world.player.crouching = true; return 1; });
  await sleep(200); await shot('08-crouch');
  await sleep(600);
  console.log('');
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0,180) : ''));
  ws.close(); proc.kill(); await sleep(200); process.exit(errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});