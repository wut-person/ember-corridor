/* =========================================================
   ④ 开放世界 · 沙盒（俯视角）
   世界渲染与逻辑在 js/game/worldview.js，地形生成在 js/game/world.js，
   大地图在 js/ui/mapview.js。本文件负责界面装配与生命周期。
   ========================================================= */
(function (G) {
  const U = G.U;
  const K = G.Screen;

  K.register('world', {
    mount: function (node, params) {
      const self = this;
      const wrap = U.el('div', 'world-wrap');

      wrap.innerHTML =
        '<canvas class="world-canvas" id="world-canvas"></canvas>' +
        /* 左上：生命 / 体力 / 经验 */
        '<div class="world-hud tl">' +
        '  <div class="wcard">' +
        '    <div class="wrow"><span class="wlb">HP</span><div class="wbar"><i id="w-hp"></i></div><span class="wtx" id="w-hp-t">—</span></div>' +
        '    <div class="wrow"><span class="wlb">体力</span><div class="wbar st"><i id="w-st"></i></div><span class="wtx" id="w-st-t">—</span></div>' +
        '    <div class="wrow"><span class="wlb">EXP</span><div class="wbar xp"><i id="w-xp"></i></div><span class="wtx" id="w-lvl">Lv 1</span></div>' +
        '  </div>' +
        '</div>' +
        /* 右上：统计 */
        '  <div class="world-hud tr">' +
        '    <div class="wcard stat">' +
        '      <div class="wstat"><b id="w-kills">0</b><span>击杀</span></div>' +
        '      <div class="wstat"><b id="w-loot">0</b><span>拾取</span></div>' +
        '      <div class="wstat"><b id="w-ember">0</b><span>余烬</span></div>' +
        '      <div class="wstat"><b id="w-mobs">0</b><span>附近敌人</span></div>' +
        '    </div>' +
        '    <div class="wcard tip">Tab 背包　·　M 打开世界地图（可缩放 / 拖动）　·　ESC 暂停　·　顶栏可返回大厅</div>' +
        '  </div>' +
        /* 暂停面板 */
        '<div class="world-pause hide" id="w-pause">' +
        '  <div class="wp-box">' +
        '    <div class="wp-title">已暂停</div>' +
        '    <div class="wp-keys">' +
        '      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 自由移动（八方向）</div>' +
        '      <div><kbd>Shift</kbd> 疾跑（消耗体力）　<kbd>鼠标左键</kbd> 三段挥砍</div>' +
        '      <div><kbd>鼠标右键</kbd> 闪避（朝准星方向位移 + 无敌帧）</div>' +
        '      <div><kbd>E</kbd> 拾取掉落　<kbd>F</kbd> 使用药剂　<kbd>M</kbd> 世界地图</div>' +
        '      <div><kbd>Tab</kbd> 打开背包　<kbd>T</kbd> 旋转模式　<kbd>滚轮</kbd> 微调朝向</div>' +
        '      <div><kbd>ESC</kbd> 继续 / 暂停</div>' +
        '    </div>' +
        '    <div class="wp-btns">' +
        '      <button class="btn primary" id="wp-resume">继续探索</button>' +
        '      <button class="btn" id="wp-hub">返回营地</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      node.appendChild(wrap);
      document.body.classList.add('world-mode');

      const cv = U.qs('#world-canvas', wrap);
      this.world = new G.World(cv);
      this.world.start();
      this.world.syncHud();

      U.qs('#wp-resume', wrap).onclick = function () { self.world.paused = false; self.world.syncPause(); };
      U.qs('#wp-hub', wrap).onclick = function () { K.go('lobby', { type: 'hub' }); };
      this._wrap = wrap;

      /* 离开界面时停掉主循环并解绑输入 */
      K.onUnmount(function () {
        document.body.classList.remove('world-mode');
        if (self.world) { self.world.stop(); self.world = null; }
      });
    },
  });
})(window.G = window.G || {});
