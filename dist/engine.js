const g = {
  count: 60,
  // 每轮粒子数
  colors: ["#FF8201", "#2DA6E0", "#FF262B"],
  // 颜色池
  shape: "rect",
  // 'rect' | 'circle' | 'star' | 'heart' | 'text'
  gravity: 0.12,
  // 重力加速度(px/frame^2)
  friction: 0.985,
  // 空气阻力(速度衰减系数)
  spread: 5,
  // 爆炸初速度上限
  size: 4,
  // 粒子尺寸(px)
  trail: !1,
  // 拖尾残影
  glow: !1,
  // 发光
  duration: 90,
  // 粒子最大寿命(帧)
  origin: "center",
  // 'center' | 'top' | { x, y }，(x,y) 为 CSS 像素坐标
  followMouse: !1,
  // 跟随鼠标
  bursts: 1,
  // 一次触发连续绽放几朵（1 = 单朵，保持兼容）
  burstInterval: 280,
  // 相邻两朵的间隔(ms)
  loop: !1,
  // 循环连放，直到 stop()/show=false
  launch: !1,
  // 是否显示发射过程（弹丸升空后绽放）
  launchDuration: 1200,
  // 弹丸升空时长(ms)
  launchFrom: "below",
  // 'below' | 'center' | { x, y }
  fps: 60,
  // 帧率
  // ---- 本次新增 ----
  preset: null,
  // 'show' | 'salute' | 'waterfall' | null
  secondary: 0,
  // 二次爆炸分裂出的子粒子数，0 = 关闭
  secondaryAt: 0.5,
  // 二次爆炸触发时机（占粒子寿命比例 0~1）
  colorMode: "random",
  // 'random' 随机取色 | 'gradient' 生命周期内渐变
  sound: !1,
  // Web Audio 合成音效（发射咻声 + 绽放爆响）
  volume: 0.35,
  // 音效音量 0~1
  text: "★",
  // shape='text' 时的文字内容
  shockwave: 0,
  // 冲击波环最大半径(px)，0 = 关闭
  fall: !1
  // 瀑布下落模式（粒子从顶部向下洒落）
}, y = {
  show: {
    preset: "show",
    bursts: 6,
    burstInterval: 260,
    loop: !0,
    launch: !0,
    launchDuration: 800,
    glow: !0,
    trail: !1,
    count: 70,
    spread: 6,
    size: 4,
    shape: "rect",
    gravity: 0.12,
    secondary: 0,
    colorMode: "gradient",
    sound: !1,
    shockwave: 0,
    fall: !1,
    origin: "center"
  },
  salute: {
    preset: "salute",
    bursts: 8,
    burstInterval: 70,
    loop: !1,
    launch: !1,
    glow: !0,
    trail: !1,
    count: 110,
    spread: 7,
    size: 5,
    shape: "circle",
    gravity: 0.12,
    secondary: 14,
    colorMode: "random",
    sound: !1,
    shockwave: 120,
    fall: !1,
    origin: "center"
  },
  waterfall: {
    preset: "waterfall",
    bursts: 3,
    burstInterval: 400,
    loop: !0,
    launch: !1,
    glow: !0,
    trail: !0,
    count: 80,
    spread: 3,
    size: 3,
    shape: "circle",
    gravity: 0.05,
    friction: 0.996,
    duration: 150,
    secondary: 0,
    colorMode: "gradient",
    sound: !1,
    shockwave: 0,
    fall: !0,
    origin: "center"
  }
}, M = 50, p = 6e3;
function m(f) {
  const t = f && f.preset && y[f.preset];
  return t ? { ...t, ...f } : f || {};
}
class w {
  constructor(t, i = {}) {
    if (!t)
      throw new Error("[vue-fireworks] canvas element is required");
    if (this.canvas = t, this.ctx = t.getContext("2d"), !this.ctx)
      throw new Error("[vue-fireworks] 2d context not available");
    this.options = { ...g, ...m(i) }, this.particles = [], this.rockets = [], this.waves = [], this.rafId = null, this.running = !1, this.finished = !1, this.frame = 0, this.lastTime = 0, this.accumulator = 0, this.mousePoint = null, this.onEnd = null, this._audioCtx = null, this.burstTimers = [], this.pendingBursts = 0, this.cycleOptions = null, this.loopActive = !1, this._onMouseMove = this._onMouseMove.bind(this), this._loop = this._loop.bind(this), this._resize = this._resize.bind(this), this._bindMouse(), this._resize(), window.addEventListener("resize", this._resize);
  }
  /** 运行时更新配置。传 preset 会展开该预设，随后 options 中的显式键覆盖它。 */
  setOptions(t = {}) {
    const i = this.options.followMouse;
    this.options = { ...this.options, ...m(t) }, i !== this.options.followMouse && (this._unbindMouse(), this._bindMouse());
  }
  /** 触发一轮烟花。overrides 可临时覆盖配置（含 preset）。 */
  fire(t = {}) {
    const i = { ...this.options, ...m(t) };
    t.origin !== void 0 && (i.bursts = 1, i.loop = !1, i.fall = !1), this.cycleOptions = i, this.loopActive = !!i.loop, this._clearBurstTimers(), this.particles = [], this.rockets = [], this.waves = [], this.finished = !1, this.frame = 0, this.lastTime = 0, this.accumulator = 0, this._scheduleCycle(), this.running || (this.running = !0, this.rafId = requestAnimationFrame(this._loop));
  }
  /** 立即停止并清空（含所有待触发的连发定时器） */
  stop() {
    this.loopActive = !1, this._clearBurstTimers(), this._teardown(), this._clear();
  }
  /** 彻底销毁，解绑所有事件与音频上下文 */
  destroy() {
    if (this.stop(), window.removeEventListener("resize", this._resize), this._unbindMouse(), this._audioCtx) {
      try {
        this._audioCtx.close && this._audioCtx.close();
      } catch {
      }
      this._audioCtx = null;
    }
    this.onEnd = null;
  }
  // ---------- 连发调度 ----------
  /** 按 bursts/burstInterval 排期一轮发射/绽放 */
  _scheduleCycle() {
    const t = this.cycleOptions;
    if (!t)
      return;
    const i = Math.max(1, Math.min(M, t.bursts || 1)), s = Math.max(16, t.burstInterval || 280);
    for (let o = 0; o < i; o++)
      if (o === 0)
        this._launchOrBurst();
      else {
        this.pendingBursts++;
        const e = setTimeout(() => {
          this.burstTimers = this.burstTimers.filter((a) => a !== e), this.pendingBursts = Math.max(0, this.pendingBursts - 1), this._launchOrBurst();
        }, s * o);
        this.burstTimers.push(e);
      }
  }
  /**
   * 绽放一朵：若开启 launch，先发射弹丸升空、抵达后再绽放；否则立即绽放。
   * 落点在此刻确定（连发随机 / 单朵按 origin），供弹丸与绽放共用。
   */
  _launchOrBurst() {
    const t = this.cycleOptions || this.options, s = Math.max(1, Math.min(M, t.bursts || 1)) > 1 ? this._randomOrigin() : this._resolveOrigin(t);
    t.launch && !t.fall ? this._spawnRocket(s, t) : this._spawnBurstAt(s, t);
  }
  /** 发射一枚弹丸：真实抛体运动，初速度向上、重力匀减速，顶点恰好绽放 */
  _spawnRocket(t, i) {
    const s = this._resolveLaunchOrigin(t, i), o = i.fps || 60, e = Math.max(1, (i.launchDuration || 1200) / (1e3 / o)), a = t.y - s.y, r = (t.x - s.x) / e, n = 2 * a / e, l = -2 * a / (e * e), u = i.colors[Math.floor(Math.random() * i.colors.length)], h = Math.min(10, Math.abs(a) * 0.02) * (Math.random() * 0.5 + 0.5), c = Math.random() * Math.PI * 2;
    this.rockets.push({
      x: s.x,
      y: s.y,
      startX: s.x,
      startY: s.y,
      targetX: t.x,
      targetY: t.y,
      vx: r,
      vy: n,
      ay: l,
      swayAmp: h,
      swayPhase: c,
      progress: 0,
      frames: e,
      color: u,
      tail: [],
      // 拖尾历史点
      sparks: []
      // 尾迹火花
    }), this._playSound("launch");
  }
  /** 计算发射起点：默认目标正下方底边 */
  _resolveLaunchOrigin(t, i) {
    const s = i.launchFrom || "below";
    return s === "center" ? { x: this.cssWidth / 2, y: this.cssHeight } : s && typeof s == "object" ? { x: s.x, y: s.y } : { x: t.x, y: this.cssHeight };
  }
  /**
   * 在指定落点绽放 count 个粒子。
   * - fall 模式：从画布顶部横向散开向下洒落（瀑布）
   * - 否则：球形爆炸
   */
  _spawnBurstAt(t, i) {
    i.fall ? this._spawnFallAt(t, i) : (this._spawnExplosionAt(t, i), i.shockwave > 0 && this.waves.push({
      x: t.x,
      y: t.y,
      r: i.size,
      maxR: i.shockwave,
      life: 0,
      maxLife: Math.max(10, i.shockwave / 3),
      color: i.colors[Math.floor(Math.random() * i.colors.length)]
    })), this._playSound("burst");
  }
  /** 球形爆炸：粒子从落点向四面炸开 */
  _spawnExplosionAt(t, i) {
    const s = Math.max(0, p - this.particles.length), o = Math.min(i.count, s);
    for (let e = 0; e < o; e++) {
      const a = Math.random() * Math.PI * 2, r = i.spread * (0.35 + Math.random() * 0.65), n = this._pickColors(i, e);
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: Math.cos(a) * r,
        vy: Math.sin(a) * r - 1.5,
        color: n[0],
        color2: n[1],
        size: i.size * (0.6 + Math.random() * 0.8),
        life: 0,
        maxLife: i.duration * (0.75 + Math.random() * 0.5),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        secondaryDone: !1
      });
    }
  }
  /** 瀑布模式：沿画布顶部横向铺开，初速度向下，长寿命 + 长拖尾 */
  _spawnFallAt(t, i) {
    const s = Math.max(0, p - this.particles.length), o = Math.min(i.count, s);
    for (let e = 0; e < o; e++) {
      const a = i.spread * (0.3 + Math.random() * 0.7), r = this._pickColors(i, e);
      this.particles.push({
        x: Math.random() * this.cssWidth,
        y: -10 + Math.random() * 24,
        vx: (Math.random() - 0.5) * a * 0.5,
        vy: a * (0.6 + Math.random() * 0.9),
        // 向下
        color: r[0],
        color2: r[1],
        size: i.size * (0.6 + Math.random() * 0.8),
        life: 0,
        maxLife: i.duration * (0.8 + Math.random() * 0.4),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
        secondaryDone: !1
      });
    }
  }
  /**
   * 为一颗粒子挑起点色/终点色。
   * random 模式两色相同（保持原行为）；gradient 模式按粒子序号在颜色池里顺延。
   */
  _pickColors(t, i) {
    const s = t.colors && t.colors.length ? t.colors : g.colors;
    if (t.colorMode === "gradient" && s.length > 1) {
      const e = i % s.length;
      return [s[e], s[(e + 1) % s.length]];
    }
    const o = s[Math.floor(Math.random() * s.length)];
    return [o, o];
  }
  /** 二次爆炸：粒子在寿命中途裂变成若干短命子粒子（子粒子不再裂变） */
  _spawnSecondary(t, i) {
    const s = Math.min(i.secondary, p - this.particles.length), o = i.spread * 0.55;
    for (let e = 0; e < s; e++) {
      const a = Math.random() * Math.PI * 2, r = o * (0.3 + Math.random() * 0.6);
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: Math.cos(a) * r,
        vy: Math.sin(a) * r,
        color: t.color2 || t.color,
        color2: t.color2 || t.color,
        size: t.size * 0.6,
        life: 0,
        maxLife: i.duration * (0.3 + Math.random() * 0.3),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        secondaryDone: !0
        // 关键：杜绝三级/指数级联
      });
    }
  }
  /** 连发随机落点：距边缘留 12% 边距，保证整朵可见 */
  _randomOrigin() {
    const t = this.cssWidth * 0.12, i = this.cssHeight * 0.15;
    return {
      x: t + Math.random() * Math.max(1, this.cssWidth - t * 2),
      y: i + Math.random() * Math.max(1, this.cssHeight - i * 2)
    };
  }
  /** 清空所有待触发定时器 */
  _clearBurstTimers() {
    for (const t of this.burstTimers)
      clearTimeout(t);
    this.burstTimers = [], this.pendingBursts = 0;
  }
  // ---------- private ----------
  _resolveOrigin(t) {
    return t.followMouse && this.mousePoint ? { ...this.mousePoint } : t.origin === "top" ? { x: this.cssWidth / 2, y: 0 } : t.origin === "center" ? { x: this.cssWidth / 2, y: this.cssHeight / 2 } : t.origin && typeof t.origin == "object" ? { x: t.origin.x, y: t.origin.y } : { x: this.cssWidth / 2, y: this.cssHeight / 2 };
  }
  _onMouseMove(t) {
    const i = this.canvas.getBoundingClientRect();
    this.mousePoint = { x: t.clientX - i.left, y: t.clientY - i.top };
  }
  _bindMouse() {
    this.options.followMouse && window.addEventListener("mousemove", this._onMouseMove);
  }
  _unbindMouse() {
    window.removeEventListener("mousemove", this._onMouseMove), this.mousePoint = null;
  }
  _resize() {
    const t = Math.min(window.devicePixelRatio || 1, 2), i = this.canvas.getBoundingClientRect();
    this.cssWidth = i.width || this.canvas.clientWidth || window.innerWidth, this.cssHeight = i.height || this.canvas.clientHeight || window.innerHeight * 0.6, this.canvas.width = Math.round(this.cssWidth * t), this.canvas.height = Math.round(this.cssHeight * t), this.ctx.setTransform(t, 0, 0, t, 0, 0);
  }
  _clear() {
    this.ctx.save(), this.ctx.setTransform(1, 0, 0, 1, 0, 0), this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height), this.ctx.restore();
  }
  _loop(t) {
    if (!this.running)
      return;
    this.lastTime || (this.lastTime = t);
    const i = t - this.lastTime;
    this.lastTime = t;
    const s = 1e3 / this.options.fps;
    this.accumulator += Math.min(i, s * 3);
    let o = 0;
    for (; this.accumulator >= s && o < 3; )
      this._update(), this.accumulator -= s, o++;
    if (this._render(), this.frame++, this.particles.length === 0 && this.rockets.length === 0 && this.pendingBursts === 0 && this.waves.length === 0)
      if (this.loopActive)
        this._scheduleCycle();
      else {
        this._teardown(), this._clear(), typeof this.onEnd == "function" && this.onEnd();
        return;
      }
    this.rafId = requestAnimationFrame(this._loop);
  }
  _update() {
    const t = this.cycleOptions || this.options, { gravity: i, friction: s } = t;
    for (let o = this.rockets.length - 1; o >= 0; o--) {
      const e = this.rockets[o];
      e.progress = Math.min(1, e.progress + 1 / e.frames);
      const a = e.progress;
      e.x = e.startX + e.vx * (a * e.frames) + Math.sin(a * Math.PI * 3 + e.swayPhase) * e.swayAmp * (1 - a);
      const r = a * e.frames;
      e.y = e.startY + e.vy * r + 0.5 * e.ay * r * r, e.tail.push({ x: e.x, y: e.y }), e.tail.length > 18 && e.tail.shift(), a < 0.92 && Math.random() < 0.7 && e.sparks.push({
        x: e.x + (Math.random() - 0.5) * 3,
        y: e.y + 2,
        vx: (Math.random() - 0.5) * 0.6,
        vy: Math.random() * 0.5 + 0.2,
        life: 0,
        maxLife: 8 + Math.random() * 10,
        size: 1 + Math.random() * 1.5
      });
      for (let n = e.sparks.length - 1; n >= 0; n--) {
        const l = e.sparks[n];
        l.x += l.vx, l.y += l.vy, l.life++, l.life >= l.maxLife && e.sparks.splice(n, 1);
      }
      e.progress >= 1 && (this._spawnBurstAt({ x: e.targetX, y: e.targetY }, t), this.rockets.splice(o, 1));
    }
    for (let o = this.particles.length - 1; o >= 0; o--) {
      const e = this.particles[o];
      e.vx *= s, e.vy = e.vy * s + i, e.x += e.vx, e.y += e.vy, e.rotation += e.spin, e.life++, t.secondary > 0 && !e.secondaryDone && e.life >= e.maxLife * t.secondaryAt && (e.secondaryDone = !0, this._spawnSecondary(e, t)), (e.life >= e.maxLife || e.y - e.size > this.cssHeight) && this.particles.splice(o, 1);
    }
    for (let o = this.waves.length - 1; o >= 0; o--) {
      const e = this.waves[o];
      e.life++, e.r = e.maxR * (e.life / e.maxLife), e.life >= e.maxLife && this.waves.splice(o, 1);
    }
  }
  _render() {
    const t = this.ctx, i = this.options;
    if (i.trail ? (t.globalCompositeOperation = "destination-out", t.fillStyle = "rgba(0,0,0,0.22)", t.fillRect(0, 0, this.cssWidth, this.cssHeight)) : t.clearRect(0, 0, this.cssWidth, this.cssHeight), this.waves.length) {
      t.globalCompositeOperation = "lighter";
      for (const s of this.waves) {
        const o = Math.max(0, 1 - s.life / s.maxLife);
        t.globalAlpha = o * 0.8, t.strokeStyle = s.color, t.lineWidth = 1 + o * 2, t.beginPath(), t.arc(s.x, s.y, s.r, 0, Math.PI * 2), t.stroke();
      }
    }
    if (i.glow) {
      t.globalCompositeOperation = "lighter";
      for (const s of this.particles) {
        const o = Math.max(0, 1 - s.life / s.maxLife);
        t.globalAlpha = o * 0.9;
        const e = this._getGlowSprite(s.color), a = s.size * 2.4;
        t.drawImage(e, s.x - a, s.y - a, a * 2, a * 2);
      }
    }
    t.globalCompositeOperation = i.glow ? "lighter" : "source-over";
    for (const s of this.particles) {
      const o = Math.max(0, 1 - s.life / s.maxLife);
      t.globalAlpha = o;
      const e = Math.min(1, s.life / s.maxLife);
      t.fillStyle = i.colorMode === "gradient" && s.color2 !== s.color ? this._lerpColor(s.color, s.color2, e) : s.color, this._drawShape(t, s, i);
    }
    for (const s of this.rockets) {
      if (s.tail.length > 1) {
        t.lineCap = "round";
        for (let o = 1; o < s.tail.length; o++) {
          const e = s.tail[o - 1], a = s.tail[o], r = o / s.tail.length;
          t.globalAlpha = r * r * 0.8, t.strokeStyle = s.color, t.lineWidth = 0.5 + r * 2, t.beginPath(), t.moveTo(e.x, e.y), t.lineTo(a.x, a.y), t.stroke();
        }
      }
      t.fillStyle = s.color;
      for (const o of s.sparks)
        t.globalAlpha = (1 - o.life / o.maxLife) * 0.9, t.fillRect(o.x, o.y, o.size, o.size);
      if (t.globalAlpha = 1, i.glow) {
        const o = this._getGlowSprite(s.color), e = 10;
        t.drawImage(o, s.x - e, s.y - e, e * 2, e * 2);
      }
      t.fillStyle = "#fff", t.fillRect(s.x - 1.5, s.y - 2.5, 3, 5);
    }
    t.globalAlpha = 1, t.globalCompositeOperation = "source-over";
  }
  /** 按颜色缓存发光贴图（离屏 canvas），一次生成、多帧复用 */
  _getGlowSprite(t) {
    this._glowCache || (this._glowCache = /* @__PURE__ */ new Map());
    let i = this._glowCache.get(t);
    if (i)
      return i;
    const s = 64;
    i = document.createElement("canvas"), i.width = i.height = s;
    const o = i.getContext("2d"), e = o.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    return e.addColorStop(0, t), e.addColorStop(0.35, this._withAlpha(t, 0.5)), e.addColorStop(1, this._withAlpha(t, 0)), o.fillStyle = e, o.fillRect(0, 0, s, s), this._glowCache.set(t, i), i;
  }
  /** 解析 hex / rgb() 颜色为 [r,g,b] */
  _parseColor(t) {
    if (t[0] === "#") {
      let s = t.slice(1);
      s.length === 3 && (s = s.split("").map((e) => e + e).join(""));
      const o = parseInt(s, 16);
      return [o >> 16 & 255, o >> 8 & 255, o & 255];
    }
    const i = t.match(/rgba?\(([^)]+)\)/);
    if (i) {
      const s = i[1].split(",").map((o) => parseFloat(o));
      return [s[0], s[1], s[2]];
    }
    return [255, 255, 255];
  }
  /** 给 hex / rgb 颜色附加 alpha，供渐变使用 */
  _withAlpha(t, i) {
    const [s, o, e] = this._parseColor(t);
    return `rgba(${s},${o},${e},${i})`;
  }
  /** 两色线性插值，用于颜色渐变池 */
  _lerpColor(t, i, s) {
    const o = this._parseColor(t), e = this._parseColor(i), a = Math.round(o[0] + (e[0] - o[0]) * s), r = Math.round(o[1] + (e[1] - o[1]) * s), n = Math.round(o[2] + (e[2] - o[2]) * s);
    return `rgb(${a},${r},${n})`;
  }
  _drawShape(t, i, s) {
    const o = i.size;
    if (s.shape === "text") {
      t.font = `${o * 3}px sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.save(), t.translate(i.x, i.y), t.rotate(i.rotation), t.fillText(s.text || "★", 0, 0), t.restore();
      return;
    }
    if (s.shape === "heart") {
      this._heartPath(t, i.x, i.y, o * 1.3, i.rotation), t.fill();
      return;
    }
    if (s.shape === "circle") {
      t.beginPath(), t.arc(i.x, i.y, o / 2, 0, Math.PI * 2), t.fill();
      return;
    }
    if (s.shape === "star") {
      this._starPath(t, i.x, i.y, 5, o / 2, o / 4, i.rotation), t.fill();
      return;
    }
    t.save(), t.translate(i.x, i.y), t.rotate(i.rotation), t.fillRect(-o / 2, -o / 2, o, o * 1.6), t.restore();
  }
  _starPath(t, i, s, o, e, a, r) {
    t.save(), t.translate(i, s), t.rotate(r), t.beginPath();
    for (let n = 0; n < o * 2; n++) {
      const l = n % 2 === 0 ? e : a, u = n * Math.PI / o - Math.PI / 2, h = Math.cos(u) * l, c = Math.sin(u) * l;
      n === 0 ? t.moveTo(h, c) : t.lineTo(h, c);
    }
    t.closePath(), t.restore();
  }
  /** 心形路径：两段对称三次贝塞尔 */
  _heartPath(t, i, s, o, e) {
    t.save(), t.translate(i, s), t.rotate(e || 0);
    const a = o;
    t.beginPath(), t.moveTo(0, a * 0.35), t.bezierCurveTo(-a * 1.1, -a * 0.35, -a * 0.55, -a * 1.1, 0, -a * 0.5), t.bezierCurveTo(a * 0.55, -a * 1.1, a * 1.1, -a * 0.35, 0, a * 0.35), t.closePath(), t.restore();
  }
  /** Web Audio 合成音效：发射咻声（扫频）+ 绽放爆响（噪声低通）。无 AudioContext 时静默。 */
  _ensureAudio() {
    if (this._audioCtx)
      return this._audioCtx;
    const t = typeof window < "u" && (window.AudioContext || window.webkitAudioContext);
    if (!t)
      return null;
    try {
      this._audioCtx = new t();
    } catch {
      return null;
    }
    return this._audioCtx;
  }
  _playSound(t) {
    const i = this.cycleOptions || this.options;
    if (!i.sound)
      return;
    const s = this._ensureAudio();
    if (!s)
      return;
    if (s.state === "suspended" && s.resume)
      try {
        s.resume();
      } catch {
      }
    const o = s.currentTime || 0, e = Math.max(0, Math.min(1, i.volume == null ? 0.35 : i.volume));
    try {
      if (t === "launch") {
        const a = s.createOscillator(), r = s.createGain();
        a.type = "sine", a.frequency.setValueAtTime(180, o), a.frequency.exponentialRampToValueAtTime(720, o + 0.5), r.gain.setValueAtTime(1e-4, o), r.gain.exponentialRampToValueAtTime(Math.max(1e-4, e * 0.15), o + 0.05), r.gain.exponentialRampToValueAtTime(1e-4, o + 0.55), a.connect(r), r.connect(s.destination), a.start(o), a.stop(o + 0.6);
      } else {
        const r = s.sampleRate || 44100, n = s.createBuffer(1, Math.floor(r * 0.42), r), l = n.getChannelData(0);
        for (let d = 0; d < l.length; d++)
          l[d] = (Math.random() * 2 - 1) * (1 - d / l.length);
        const u = s.createBufferSource();
        u.buffer = n;
        const h = s.createBiquadFilter();
        h.type = "lowpass", h.frequency.setValueAtTime(1400, o), h.frequency.exponentialRampToValueAtTime(200, o + 0.42);
        const c = s.createGain();
        c.gain.setValueAtTime(Math.max(1e-4, e * 0.5), o), c.gain.exponentialRampToValueAtTime(1e-4, o + 0.42), u.connect(h), h.connect(c), c.connect(s.destination), u.start(o);
      }
    } catch {
    }
  }
  _teardown() {
    this.running = !1, this.loopActive = !1, this._clearBurstTimers(), this.rafId !== null && (cancelAnimationFrame(this.rafId), this.rafId = null), this.particles = [], this.rockets = [], this.waves = [], this.finished = !0;
  }
}
export {
  w as FireworksEngine,
  y as PRESETS,
  w as default
};
