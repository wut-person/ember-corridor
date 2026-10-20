'use strict';
/* 验证：人物选择 UI（性别切换 / 8 个角色 / 旋转动画） */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9461;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(os.tmpdir(),'edge-pick-'+Date.now()),'--window-size=1440,900','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
  for (let i=0;i<40;i++){ try { await (await fetch('http://127.0.0.1:'+PORT+'/json/version')).json(); break; } catch(e){ await sleep(300);} }
  const tabs = await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();
  const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r));
  let id=0; const pend=new Map(); const errs=[];
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}
    if(m.method==='Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception||{}).description)||m.params.exceptionDetails.text);});
  const send=(method,params)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params:params||{}}));});
  const ev=async(fn)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true});
    if(r&&r.exceptionDetails) return 'EXC: '+((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);
    return r?r.result.value:'NORESULT';};
  const shot=async(name)=>{const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(ROOT,'tools','shots',name+'.png'),Buffer.from(s.data,'base64'));};
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:PAGE_URL}); await sleep(3200);
  await ev(function(){const i=document.querySelector('.login-panel input.input'); if(i)i.value='选择'; const b=document.querySelector('.login-panel .btn.primary'); if(b)b.click(); return 1;});
  await sleep(1600);
  await ev(function(){ G.Screen.go('character',{}); return 1; });
  await sleep(1800);
  const r1 = await ev(function(){
    return '性别按钮='+document.querySelectorAll('.sex-btn').length+
           ' 角色卡='+document.querySelectorAll('.look-card').length+
           ' 选中='+document.querySelectorAll('.look-card.on').length+
           ' 信息块='+(document.querySelector('.look-info')?'有':'无');
  });
  console.log('1) 面板结构  ' + r1);
  await sleep(1200);
  console.log('1b) 精灵图加载  ' + await ev(function(){ return JSON.stringify(G.Sprites.sheetDebug()); }));
  await shot('30-pick-male');
  /* 切到女性 */
  await ev(function(){
    const bs=document.querySelectorAll('.sex-btn');
    for(const b of bs){ if(b.textContent.indexOf('女')>=0){ b.click(); return 1; } }
    return 0;
  });
  await sleep(900);
  const r2 = await ev(function(){
    return '性别按钮='+document.querySelectorAll('.sex-btn').length+
           ' 角色卡='+document.querySelectorAll('.look-card').length+
           ' 标签='+Array.from(document.querySelectorAll('.look-tag')).map(e=>e.textContent).join('/');
  });
  console.log('2) 切到女性  ' + r2);
  await shot('31-pick-female');
  /* 点第 3 张卡：应触发旋转 */
  const r3 = await ev(function(){
    const cards=document.querySelectorAll('.look-card');
    cards[2].click();
    return '点击第3张='+cards[2].querySelector('.look-tag').textContent+' 存档='+G.State.state.account.look+
           ' 旋转提示='+(document.querySelector('.spin-badge').style.display===''?'显示':'隐藏');
  });
  console.log('3) 选择角色  ' + r3);
  await sleep(400);
  await shot('32-spin-mid');
  await sleep(1500);
  const r4 = await ev(function(){
    return '旋转结束='+(document.querySelector('.spin-badge').style.display==='none')+
           ' 选中数='+document.querySelectorAll('.look-card.on').length+
           ' 当前='+G.State.state.account.look;
  });
  console.log('4) 旋转结束  ' + r4);
  await shot('33-pick-after');
  /* 切到男性并选剑士，验证配对 */
  await ev(function(){
    const bs=document.querySelectorAll('.sex-btn');
    for(const b of bs){ if(b.textContent.indexOf('男')>=0){ b.click(); return 1; } }
    return 0;
  });
  await sleep(700);
  const r5 = await ev(function(){
    const c=document.querySelectorAll('.look-card');
    c[0].click();
    const cur=G.getLook(G.State.state.account.look);
    const pair=G.pairLook(cur.id);
    return '当前='+cur.name+'('+cur.gender+') 配对='+pair.name+'('+pair.gender+') 卡数='+c.length;
  });
  console.log('5) 男女配对  ' + r5);
  await sleep(1600);
  console.log('\n控制台异常 = ' + errs.length + ' 条' + (errs.length? ' -> '+errs[0].slice(0,200):''));
  ws.close(); proc.kill(); await sleep(200); process.exit(errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});