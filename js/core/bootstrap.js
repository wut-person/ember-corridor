/* =========================================================
   余烬回廊 · 启动引导
   ========================================================= */
(function (G) {
  const U = G.U;

  const STEPS = [
    '读取本地存档……',
    '点燃余烬灯……',
    '校准武器库（16 种武器）……',
    '整理衣柜（17 件衣物）……',
    '装载任务板（20 项委托）……',
    '构建回廊层数（5 层）……',
    '准备就绪'
  ];

  function boot() {
    /* 基础设置 */
    G.State.load();
    if (!G.State.state.settings) G.State.state.settings = { sfx: true, autoTrack: true };
    if (G.State.state.settings.sfx === false) G.Audio.setEnabled(false);

    /* 启动日志动画 */
    const fill = document.getElementById('boot-fill');
    const log = document.getElementById('boot-log');
    let i = 0;
    (function step() {
      if (i < STEPS.length) {
        if (log) log.textContent = STEPS[i];
        if (fill) fill.style.width = Math.round(((i + 1) / STEPS.length) * 100) + '%';
        i++;
        setTimeout(step, 130);
      } else {
        finish();
      }
    })();
  }

  function finish() {
    const boot = document.getElementById('boot-screen');
    if (boot) boot.classList.add('done');
    document.body.classList.remove('no-scroll');

    /* 首次交互解锁音频 */
    const unlock = function () {
      G.Audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    /* 进入登录界面 */
    G.Screen.clearHistory();
    G.Screen.go('login');

    /* 存档提示 */
    const st = G.State.state;
    if (st.account && st.account.lvl > 1) {
      setTimeout(function () {
        G.Screen.toast('欢迎回来，' + st.account.name + '（Lv.' + st.account.lvl + '）', 'ok', 2600);
      }, 700);
    }
    window.addEventListener('beforeunload', function () { G.State.saveNow(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.G = window.G || {});
/* EOF */
