/**
 * FireworksEngine — 纯 Canvas 粒子引擎
 * 不依赖任何框架，供 Vue2 / Vue3 / React 薄壳共用。
 *
 * 能力：多形状粒子、颜色池/渐变、发光/拖尾、连发/循环、
 *       抛体升空、二次爆炸、冲击波环、Web Audio 音效、预设效果。
 */

const DEFAULTS = {
  count: 60,                                   // 每轮粒子数
  colors: ['#FF8201', '#2DA6E0', '#FF262B'],   // 颜色池
  shape: 'rect',            // 'rect' | 'circle' | 'star' | 'heart' | 'text'
  gravity: 0.12,            // 重力加速度(px/frame^2)
  friction: 0.985,          // 空气阻力(速度衰减系数)
  spread: 5,                // 爆炸初速度上限
  size: 4,                  // 粒子尺寸(px)
  trail: false,             // 拖尾残影
  glow: false,              // 发光
  duration: 90,             // 粒子最大寿命(帧)
  origin: 'center',         // 'center' | 'top' | { x, y }，(x,y) 为 CSS 像素坐标
  followMouse: false,       // 跟随鼠标
  bursts: 1,                // 一次触发连续绽放几朵（1 = 单朵，保持兼容）
  burstInterval: 280,       // 相邻两朵的间隔(ms)
  loop: false,              // 循环连放，直到 stop()/show=false
  launch: false,            // 是否显示发射过程（弹丸升空后绽放）
  launchDuration: 1200,     // 弹丸升空时长(ms)
  launchFrom: 'below',      // 'below' | 'center' | { x, y }
  fps: 60,                  // 帧率
  // ---- 本次新增 ----
  preset: null,             // 'show' | 'salute' | 'waterfall' | null
  secondary: 0,             // 二次爆炸分裂出的子粒子数，0 = 关闭
  secondaryAt: 0.5,         // 二次爆炸触发时机（占粒子寿命比例 0~1）
  colorMode: 'random',      // 'random' 随机取色 | 'gradient' 生命周期内渐变
  sound: false,             // Web Audio 合成音效（发射咻声 + 绽放爆响）
  volume: 0.35,             // 音效音量 0~1
  text: '★',                // shape='text' 时的文字内容
  shockwave: 0,             // 冲击波环最大半径(px)，0 = 关闭
  fall: false               // 瀑布下落模式（粒子从顶部向下洒落）
}

/**
 * 预设效果：一组"建议配置"。用户在同一 options 里显式写的键会覆盖预设。
 * 每个预设写全所有相关键，保证相互切换时不会残留上一预设的状态。
 */
export const PRESETS = {
  show: {
    preset: 'show', bursts: 6, burstInterval: 260, loop: true,
    launch: true, launchDuration: 800, glow: true, trail: false,
    count: 70, spread: 6, size: 4, shape: 'rect', gravity: 0.12,
    secondary: 0, colorMode: 'gradient', sound: false, shockwave: 0,
    fall: false, origin: 'center'
  },
  salute: {
    preset: 'salute', bursts: 8, burstInterval: 70, loop: false,
    launch: false, glow: true, trail: false, count: 110, spread: 7,
    size: 5, shape: 'circle', gravity: 0.12, secondary: 14,
    colorMode: 'random', sound: false, shockwave: 120,
    fall: false, origin: 'center'
  },
  waterfall: {
    preset: 'waterfall', bursts: 3, burstInterval: 400, loop: true,
    launch: false, glow: true, trail: true, count: 80, spread: 3,
    size: 3, shape: 'circle', gravity: 0.05, friction: 0.996,
    duration: 150, secondary: 0, colorMode: 'gradient', sound: false,
    shockwave: 0, fall: true, origin: 'center'
  }
}

const MAX_BURSTS = 50       // 连发数上限，防止配置过大卡死
const MAX_PARTICLES = 6000  // 粒子总数硬上限，防止二次爆炸级联失控

/** 应用预设：预设值作底，options 里显式写的键覆盖它 */
function withPreset (opts) {
  const p = opts && opts.preset && PRESETS[opts.preset]
  return p ? { ...p, ...opts } : (opts || {})
}

export class FireworksEngine {
  constructor (canvas, options = {}) {
    if (!canvas) throw new Error('[vue-fireworks] canvas element is required')

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    if (!this.ctx) throw new Error('[vue-fireworks] 2d context not available')

    this.options = { ...DEFAULTS, ...withPreset(options) }
    this.particles = []
    this.rockets = []           // 飞行中的弹丸
    this.waves = []             // 冲击波环
    this.rafId = null
    this.running = false
    this.finished = false
    this.frame = 0
    this.lastTime = 0
    this.accumulator = 0
    this.mousePoint = null
    this.onEnd = null
    this._audioCtx = null       // Web Audio 上下文（懒创建）

    // 连发调度状态
    this.burstTimers = []       // 待触发的 setTimeout 句柄
    this.pendingBursts = 0      // 已排期还未绽放的朵数
    this.cycleOptions = null    // 当前一轮的配置快照（loop 复用）
    this.loopActive = false

    this._onMouseMove = this._onMouseMove.bind(this)
    this._loop = this._loop.bind(this)
    this._resize = this._resize.bind(this)

    this._bindMouse()
    this._resize()
    window.addEventListener('resize', this._resize)
  }

  /** 运行时更新配置。传 preset 会展开该预设，随后 options 中的显式键覆盖它。 */
  setOptions (options = {}) {
    const prevFollow = this.options.followMouse
    this.options = { ...this.options, ...withPreset(options) }
    if (prevFollow !== this.options.followMouse) {
      this._unbindMouse()
      this._bindMouse()
    }
  }

  /** 触发一轮烟花。overrides 可临时覆盖配置（含 preset）。 */
  fire (overrides = {}) {
    const o = { ...this.options, ...withPreset(overrides) }
    // 显式指定落点 = 确定性单朵（点哪爆哪），连发/循环/瀑布自动让位
    if (overrides.origin !== undefined) {
      o.bursts = 1
      o.loop = false
      o.fall = false
    }
    this.cycleOptions = o
    this.loopActive = !!o.loop

    // 重新触发时清空旧粒子/弹丸/波环/定时器，避免叠加竞态
    this._clearBurstTimers()
    this.particles = []
    this.rockets = []
    this.waves = []
    this.finished = false
    this.frame = 0
    this.lastTime = 0
    this.accumulator = 0

    this._scheduleCycle()

    if (!this.running) {
      this.running = true
      this.rafId = requestAnimationFrame(this._loop)
    }
  }

  /** 立即停止并清空（含所有待触发的连发定时器） */
  stop () {
    this.loopActive = false
    this._clearBurstTimers()
    this._teardown()
    this._clear()
  }

  /** 彻底销毁，解绑所有事件与音频上下文 */
  destroy () {
    this.stop()
    window.removeEventListener('resize', this._resize)
    this._unbindMouse()
    if (this._audioCtx) {
      try { this._audioCtx.close && this._audioCtx.close() } catch (_) {}
      this._audioCtx = null
    }
    this.onEnd = null
  }

  // ---------- 连发调度 ----------

  /** 按 bursts/burstInterval 排期一轮发射/绽放 */
  _scheduleCycle () {
    const o = this.cycleOptions
    if (!o) return
    const bursts = Math.max(1, Math.min(MAX_BURSTS, o.bursts || 1))
    const interval = Math.max(16, o.burstInterval || 280)

    for (let i = 0; i < bursts; i++) {
      if (i === 0) {
        // 第一朵立即绽放
        this._launchOrBurst()
      } else {
        this.pendingBursts++
        const timer = setTimeout(() => {
          this.burstTimers = this.burstTimers.filter(t => t !== timer)
          this.pendingBursts = Math.max(0, this.pendingBursts - 1)
          this._launchOrBurst()
        }, interval * i)
        this.burstTimers.push(timer)
      }
    }
  }

  /**
   * 绽放一朵：若开启 launch，先发射弹丸升空、抵达后再绽放；否则立即绽放。
   * 落点在此刻确定（连发随机 / 单朵按 origin），供弹丸与绽放共用。
   */
  _launchOrBurst () {
    const o = this.cycleOptions || this.options
    const bursts = Math.max(1, Math.min(MAX_BURSTS, o.bursts || 1))
    const origin = bursts > 1
      ? this._randomOrigin()
      : this._resolveOrigin(o)

    // fall（瀑布）从顶部洒落，没有"从下升空的弹丸"，launch 语义冲突 → 忽略
    if (o.launch && !o.fall) {
      this._spawnRocket(origin, o)
    } else {
      this._spawnBurstAt(origin, o)
    }
  }

  /** 发射一枚弹丸：真实抛体运动，初速度向上、重力匀减速，顶点恰好绽放 */
  _spawnRocket (target, o) {
    const start = this._resolveLaunchOrigin(target, o)
    const fps = o.fps || 60
    const frames = Math.max(1, (o.launchDuration || 1200) / (1000 / fps))
    const dy = target.y - start.y          // 负值（向上）
    const vx = (target.x - start.x) / frames
    const vy0 = 2 * dy / frames            // 顶点速度归零所需的初速度
    const ay = -2 * dy / (frames * frames) // 重力加速度（向下，为正）
    const color = o.colors[Math.floor(Math.random() * o.colors.length)]
    // 横向轻微摇摆，幅度随上升衰减，模拟空气扰动
    const swayAmp = Math.min(10, Math.abs(dy) * 0.02) * (Math.random() * 0.5 + 0.5)
    const swayPhase = Math.random() * Math.PI * 2

    this.rockets.push({
      x: start.x,
      y: start.y,
      startX: start.x,
      startY: start.y,
      targetX: target.x,
      targetY: target.y,
      vx, vy: vy0, ay,
      swayAmp,
      swayPhase,
      progress: 0,
      frames,
      color,
      tail: [],      // 拖尾历史点
      sparks: []     // 尾迹火花
    })

    this._playSound('launch')
  }

  /** 计算发射起点：默认目标正下方底边 */
  _resolveLaunchOrigin (target, o) {
    const from = o.launchFrom || 'below'
    if (from === 'center') return { x: this.cssWidth / 2, y: this.cssHeight }
    if (from && typeof from === 'object') return { x: from.x, y: from.y }
    // 'below'：目标正下方的画布底边
    return { x: target.x, y: this.cssHeight }
  }

  /**
   * 在指定落点绽放 count 个粒子。
   * - fall 模式：从画布顶部横向散开向下洒落（瀑布）
   * - 否则：球形爆炸
   */
  _spawnBurstAt (origin, o) {
    if (o.fall) {
      this._spawnFallAt(origin, o)
      // 瀑布没有单一爆点（粒子沿整条顶边洒落），冲击波无处依附 → 忽略。
      // 否则会在 origin（画布中心/top）凭空出现一个与瀑布无关的光环。
    } else {
      this._spawnExplosionAt(origin, o)
      // 冲击波环：绽放瞬间从落点扩散一圈
      if (o.shockwave > 0) {
        this.waves.push({
          x: origin.x, y: origin.y,
          r: o.size, maxR: o.shockwave,
          life: 0, maxLife: Math.max(10, o.shockwave / 3),
          color: o.colors[Math.floor(Math.random() * o.colors.length)]
        })
      }
    }
    this._playSound('burst')
  }

  /** 球形爆炸：粒子从落点向四面炸开 */
  _spawnExplosionAt (origin, o) {
    const room = Math.max(0, MAX_PARTICLES - this.particles.length)
    const n = Math.min(o.count, room)
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = o.spread * (0.35 + Math.random() * 0.65)
      const shades = this._pickColors(o, i)
      this.particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: shades[0],
        color2: shades[1],
        size: o.size * (0.6 + Math.random() * 0.8),
        life: 0,
        maxLife: o.duration * (0.75 + Math.random() * 0.5),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        secondaryDone: false
      })
    }
  }

  /** 瀑布模式：沿画布顶部横向铺开，初速度向下，长寿命 + 长拖尾 */
  _spawnFallAt (_origin, o) {
    const room = Math.max(0, MAX_PARTICLES - this.particles.length)
    const n = Math.min(o.count, room)
    for (let i = 0; i < n; i++) {
      const speed = o.spread * (0.3 + Math.random() * 0.7)
      const shades = this._pickColors(o, i)
      this.particles.push({
        x: Math.random() * this.cssWidth,
        y: -10 + Math.random() * 24,
        vx: (Math.random() - 0.5) * speed * 0.5,
        vy: speed * (0.6 + Math.random() * 0.9),   // 向下
        color: shades[0],
        color2: shades[1],
        size: o.size * (0.6 + Math.random() * 0.8),
        life: 0,
        maxLife: o.duration * (0.8 + Math.random() * 0.4),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
        secondaryDone: false
      })
    }
  }

  /**
   * 为一颗粒子挑起点色/终点色。
   * random 模式两色相同（保持原行为）；gradient 模式按粒子序号在颜色池里顺延。
   */
  _pickColors (o, index) {
    const pool = o.colors && o.colors.length ? o.colors : DEFAULTS.colors
    if (o.colorMode === 'gradient' && pool.length > 1) {
      const i = index % pool.length
      return [pool[i], pool[(i + 1) % pool.length]]
    }
    const c = pool[Math.floor(Math.random() * pool.length)]
    return [c, c]
  }

  /** 二次爆炸：粒子在寿命中途裂变成若干短命子粒子（子粒子不再裂变） */
  _spawnSecondary (parent, o) {
    const n = Math.min(o.secondary, MAX_PARTICLES - this.particles.length)
    const speed = o.spread * 0.55
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.6)
      this.particles.push({
        x: parent.x,
        y: parent.y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        color: parent.color2 || parent.color,
        color2: parent.color2 || parent.color,
        size: parent.size * 0.6,
        life: 0,
        maxLife: o.duration * (0.3 + Math.random() * 0.3),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        secondaryDone: true     // 关键：杜绝三级/指数级联
      })
    }
  }

  /** 连发随机落点：距边缘留 12% 边距，保证整朵可见 */
  _randomOrigin () {
    const padX = this.cssWidth * 0.12
    const padY = this.cssHeight * 0.15
    return {
      x: padX + Math.random() * Math.max(1, this.cssWidth - padX * 2),
      y: padY + Math.random() * Math.max(1, this.cssHeight - padY * 2)
    }
  }

  /** 清空所有待触发定时器 */
  _clearBurstTimers () {
    for (const t of this.burstTimers) clearTimeout(t)
    this.burstTimers = []
    this.pendingBursts = 0
  }

  // ---------- private ----------

  _resolveOrigin (o) {
    if (o.followMouse && this.mousePoint) return { ...this.mousePoint }
    if (o.origin === 'top') {
      return { x: this.cssWidth / 2, y: 0 }
    }
    if (o.origin === 'center') {
      return { x: this.cssWidth / 2, y: this.cssHeight / 2 }
    }
    if (o.origin && typeof o.origin === 'object') {
      return { x: o.origin.x, y: o.origin.y }
    }
    return { x: this.cssWidth / 2, y: this.cssHeight / 2 }
  }

  _onMouseMove (e) {
    const rect = this.canvas.getBoundingClientRect()
    this.mousePoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  _bindMouse () {
    if (this.options.followMouse) window.addEventListener('mousemove', this._onMouseMove)
  }

  _unbindMouse () {
    window.removeEventListener('mousemove', this._onMouseMove)
    this.mousePoint = null
  }

  _resize () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.cssWidth = rect.width || this.canvas.clientWidth || window.innerWidth
    this.cssHeight = rect.height || this.canvas.clientHeight || window.innerHeight * 0.6
    this.canvas.width = Math.round(this.cssWidth * dpr)
    this.canvas.height = Math.round(this.cssHeight * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  _clear () {
    this.ctx.save()
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  _loop (timestamp) {
    if (!this.running) return
    if (!this.lastTime) this.lastTime = timestamp
    const delta = timestamp - this.lastTime
    this.lastTime = timestamp

    // 固定步长累加，最多补 3 帧，避免掉帧后爆炸式推进
    const step = 1000 / this.options.fps
    this.accumulator += Math.min(delta, step * 3)
    let steps = 0
    while (this.accumulator >= step && steps < 3) {
      this._update()
      this.accumulator -= step
      steps++
    }

    this._render()
    this.frame++

    const idle = this.particles.length === 0 && this.rockets.length === 0 &&
      this.pendingBursts === 0 && this.waves.length === 0
    if (idle) {
      if (this.loopActive) {
        // 循环模式：一轮结束，排期下一轮（不触发 onEnd）
        this._scheduleCycle()
      } else {
        this._teardown()
        this._clear()
        if (typeof this.onEnd === 'function') this.onEnd()
        return
      }
    }
    this.rafId = requestAnimationFrame(this._loop)
  }

  _update () {
    const o = this.cycleOptions || this.options
    const { gravity, friction } = o

    // 弹丸上升：抛体物理（匀减速到顶点），抵达后绽放
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]
      r.progress = Math.min(1, r.progress + 1 / r.frames)
      const p = r.progress
      // 横向：匀速推进 + 随高度衰减的正弦摆动
      r.x = r.startX + r.vx * (p * r.frames)
        + Math.sin(p * Math.PI * 3 + r.swayPhase) * r.swayAmp * (1 - p)
      // 纵向：y = y0 + v0*t + 0.5*a*t²（t 以帧计），匀减速，顶点速度归零
      const t = p * r.frames
      r.y = r.startY + r.vy * t + 0.5 * r.ay * t * t

      // 拖尾历史点
      r.tail.push({ x: r.x, y: r.y })
      if (r.tail.length > 18) r.tail.shift()

      // 尾迹火花：随机小火星，短命，向下飘散
      if (p < 0.92 && Math.random() < 0.7) {
        r.sparks.push({
          x: r.x + (Math.random() - 0.5) * 3,
          y: r.y + 2,
          vx: (Math.random() - 0.5) * 0.6,
          vy: Math.random() * 0.5 + 0.2,
          life: 0,
          maxLife: 8 + Math.random() * 10,
          size: 1 + Math.random() * 1.5
        })
      }
      for (let s = r.sparks.length - 1; s >= 0; s--) {
        const sp = r.sparks[s]
        sp.x += sp.vx
        sp.y += sp.vy
        sp.life++
        if (sp.life >= sp.maxLife) r.sparks.splice(s, 1)
      }

      if (r.progress >= 1) {
        // 精确落在目标点，避免浮点累积误差
        this._spawnBurstAt({ x: r.targetX, y: r.targetY }, o)
        this.rockets.splice(i, 1)
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.vx *= friction
      p.vy = p.vy * friction + gravity
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.spin
      p.life++

      // 二次爆炸：到达寿命节点时裂变一次（仅父粒子、仅配置开启时）
      if (o.secondary > 0 && !p.secondaryDone && p.life >= p.maxLife * o.secondaryAt) {
        p.secondaryDone = true
        this._spawnSecondary(p, o)
      }

      if (p.life >= p.maxLife || p.y - p.size > this.cssHeight) {
        this.particles.splice(i, 1)
      }
    }

    // 冲击波环：半径扩张 + 透明度衰减
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]
      w.life++
      w.r = w.maxR * (w.life / w.maxLife)
      if (w.life >= w.maxLife) this.waves.splice(i, 1)
    }
  }

  _render () {
    const ctx = this.ctx
    const o = this.options

    // 拖尾：用 destination-out 降低已有像素 alpha，透明擦除，不引入黑底
    if (o.trail) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)
    } else {
      ctx.clearRect(0, 0, this.cssWidth, this.cssHeight)
    }

    // 冲击波环：lighter 模式下画细圆环
    if (this.waves.length) {
      ctx.globalCompositeOperation = 'lighter'
      for (const w of this.waves) {
        const a = Math.max(0, 1 - w.life / w.maxLife)
        ctx.globalAlpha = a * 0.8
        ctx.strokeStyle = w.color
        ctx.lineWidth = 1 + a * 2
        ctx.beginPath()
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    if (o.glow) {
      // 发光：预渲染的径向渐变贴图 + lighter 叠加。
      // 不用 ctx.shadowBlur —— 阴影是逐像素高斯模糊，几十倍慢。
      ctx.globalCompositeOperation = 'lighter'
      for (const p of this.particles) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife)
        ctx.globalAlpha = alpha * 0.9
        // 渐变模式的光晕用起点色，避免每帧生成新颜色导致贴图缓存无限膨胀
        const sprite = this._getGlowSprite(p.color)
        const r = p.size * 2.4 // 光晕半径
        ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2)
      }
    }

    // 粒子本体：正常合成模式下画清晰实体
    ctx.globalCompositeOperation = o.glow ? 'lighter' : 'source-over'
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife)
      ctx.globalAlpha = alpha
      const t = Math.min(1, p.life / p.maxLife)
      ctx.fillStyle = (o.colorMode === 'gradient' && p.color2 !== p.color)
        ? this._lerpColor(p.color, p.color2, t)
        : p.color
      this._drawShape(ctx, p, o)
    }

    // 弹丸：平滑渐隐尾迹（历史点连成渐变线）+ 火花 + 亮头
    for (const r of this.rockets) {
      // 尾迹：逐段连线，越靠近弹丸越亮越粗
      if (r.tail.length > 1) {
        ctx.lineCap = 'round'
        for (let i = 1; i < r.tail.length; i++) {
          const a = r.tail[i - 1]
          const b = r.tail[i]
          const f = i / r.tail.length
          ctx.globalAlpha = f * f * 0.8
          ctx.strokeStyle = r.color
          ctx.lineWidth = 0.5 + f * 2
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      // 火花
      ctx.fillStyle = r.color
      for (const sp of r.sparks) {
        ctx.globalAlpha = (1 - sp.life / sp.maxLife) * 0.9
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size)
      }
      // 亮头
      ctx.globalAlpha = 1
      if (o.glow) {
        const sprite = this._getGlowSprite(r.color)
        const rad = 10
        ctx.drawImage(sprite, r.x - rad, r.y - rad, rad * 2, rad * 2)
      }
      ctx.fillStyle = '#fff'
      ctx.fillRect(r.x - 1.5, r.y - 2.5, 3, 5)
    }

    // 复原上下文状态，避免污染外部
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  /** 按颜色缓存发光贴图（离屏 canvas），一次生成、多帧复用 */
  _getGlowSprite (color) {
    if (!this._glowCache) this._glowCache = new Map()
    let sprite = this._glowCache.get(color)
    if (sprite) return sprite

    const size = 64
    sprite = document.createElement('canvas')
    sprite.width = sprite.height = size
    const c = sprite.getContext('2d')
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, color)
    g.addColorStop(0.35, this._withAlpha(color, 0.5))
    g.addColorStop(1, this._withAlpha(color, 0))
    c.fillStyle = g
    c.fillRect(0, 0, size, size)
    this._glowCache.set(color, sprite)
    return sprite
  }

  /** 解析 hex / rgb() 颜色为 [r,g,b] */
  _parseColor (color) {
    if (color[0] === '#') {
      let hex = color.slice(1)
      if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('')
      const n = parseInt(hex, 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = color.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const parts = m[1].split(',').map(s => parseFloat(s))
      return [parts[0], parts[1], parts[2]]
    }
    return [255, 255, 255]
  }

  /** 给 hex / rgb 颜色附加 alpha，供渐变使用 */
  _withAlpha (color, a) {
    const [r, g, b] = this._parseColor(color)
    return `rgba(${r},${g},${b},${a})`
  }

  /** 两色线性插值，用于颜色渐变池 */
  _lerpColor (c1, c2, t) {
    const a = this._parseColor(c1)
    const b = this._parseColor(c2)
    const r = Math.round(a[0] + (b[0] - a[0]) * t)
    const g = Math.round(a[1] + (b[1] - a[1]) * t)
    const bl = Math.round(a[2] + (b[2] - a[2]) * t)
    return `rgb(${r},${g},${bl})`
  }

  _drawShape (ctx, p, o) {
    const s = p.size
    if (o.shape === 'text') {
      ctx.font = `${s * 3}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillText(o.text || '★', 0, 0)
      ctx.restore()
      return
    }
    if (o.shape === 'heart') {
      this._heartPath(ctx, p.x, p.y, s * 1.3, p.rotation)
      ctx.fill()
      return
    }
    if (o.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    if (o.shape === 'star') {
      this._starPath(ctx, p.x, p.y, 5, s / 2, s / 4, p.rotation)
      ctx.fill()
      return
    }
    // rect 默认，带旋转
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.fillRect(-s / 2, -s / 2, s, s * 1.6)
    ctx.restore()
  }

  _starPath (ctx, cx, cy, points, outer, inner, rotation) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    ctx.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = (i * Math.PI) / points - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.restore()
  }

  /** 心形路径：两段对称三次贝塞尔 */
  _heartPath (ctx, cx, cy, size, rotation) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation || 0)
    const s = size
    ctx.beginPath()
    ctx.moveTo(0, s * 0.35)
    ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.55, -s * 1.1, 0, -s * 0.5)
    ctx.bezierCurveTo(s * 0.55, -s * 1.1, s * 1.1, -s * 0.35, 0, s * 0.35)
    ctx.closePath()
    ctx.restore()
  }

  /** Web Audio 合成音效：发射咻声（扫频）+ 绽放爆响（噪声低通）。无 AudioContext 时静默。 */
  _ensureAudio () {
    if (this._audioCtx) return this._audioCtx
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext)
    if (!AC) return null
    try {
      this._audioCtx = new AC()
    } catch (_) {
      return null
    }
    return this._audioCtx
  }

  _playSound (kind) {
    const o = this.cycleOptions || this.options
    if (!o.sound) return
    const ac = this._ensureAudio()
    if (!ac) return
    if (ac.state === 'suspended' && ac.resume) {
      try { ac.resume() } catch (_) {}
    }
    const t = ac.currentTime || 0
    const vol = Math.max(0, Math.min(1, o.volume == null ? 0.35 : o.volume))
    try {
      if (kind === 'launch') {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(180, t)
        osc.frequency.exponentialRampToValueAtTime(720, t + 0.5)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.15), t + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
        osc.connect(g); g.connect(ac.destination)
        osc.start(t); osc.stop(t + 0.6)
      } else {
        const dur = 0.42
        const rate = ac.sampleRate || 44100
        const buf = ac.createBuffer(1, Math.floor(rate * dur), rate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
        }
        const src = ac.createBufferSource()
        src.buffer = buf
        const filter = ac.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1400, t)
        filter.frequency.exponentialRampToValueAtTime(200, t + dur)
        const g = ac.createGain()
        g.gain.setValueAtTime(Math.max(0.0001, vol * 0.5), t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        src.connect(filter); filter.connect(g); g.connect(ac.destination)
        src.start(t)
      }
    } catch (_) {
      // 音频不可用（自动播放策略等）时静默降级，绝不影响动画
    }
  }

  _teardown () {
    this.running = false
    this.loopActive = false
    this._clearBurstTimers()
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.particles = []
    this.rockets = []
    this.waves = []
    this.finished = true
  }
}

export default FireworksEngine
