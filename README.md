# @meijie/fireworks-core

Framework-agnostic canvas fireworks engine with **zero runtime dependencies**. Use it with vanilla JS, Vue, React, Svelte, Angular — or any framework (or none at all).

The engine is the single source of truth shared by [`@meijie/vue-fireworks`](https://www.npmjs.com/package/@meijie/vue-fireworks) and [`@meijie/react-fireworks`](https://www.npmjs.com/package/@meijie/react-fireworks).

## Why a separate core

- **No framework tax** — vanilla JS users no longer need to install a Vue-branded package.
- **Clean dependency graph** — React no longer depends on a Vue package.
- **One implementation** — all bindings drive the identical engine, so behaviour never drifts.
- **Zero dependencies** — nothing but the browser Canvas and Web Audio APIs.

## Installation

```bash
npm install @meijie/fireworks-core
```

## Quick start (vanilla JS)

```js
import { FireworksEngine, PRESETS } from '@meijie/fireworks-core'

const canvas = document.querySelector('#stage')
const engine = new FireworksEngine(canvas, {
  glow: true,
  trail: true,
  ...PRESETS.show
})

// Fire at a clicked position (explicit origin forces a single burst)
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect()
  engine.fire({ origin: { x: event.clientX - box.left, y: event.clientY - box.top } })
})

// Clean up when the view is torn down
// engine.destroy()
```

The canvas is automatically sized to its CSS box with DPR handling. Give it a width/height in CSS.

## Options

All options are optional. They can be passed to the constructor, to `setOptions()`, or as per-call overrides to `fire()`.

| Option | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `60` | Particles per burst (hard-capped at 6000 total) |
| `colors` | `string[]` | `['#FF8201','#2DA6E0','#FF262B']` | Color pool (hex or `rgb()`) |
| `shape` | `'rect' \| 'circle' \| 'star' \| 'heart' \| 'text'` | `'rect'` | Particle shape |
| `text` | `string` | `'★'` | Glyph used when `shape: 'text'` |
| `gravity` | `number` | `0.12` | Downward acceleration (px/frame²) |
| `friction` | `number` | `0.985` | Velocity decay factor |
| `spread` | `number` | `5` | Initial explosion speed |
| `size` | `number` | `4` | Particle size (px) |
| `duration` | `number` | `90` | Particle lifetime (frames) |
| `trail` | `boolean` | `false` | Fading trails |
| `glow` | `boolean` | `false` | Additive glow sprites |
| `origin` | `'center' \| 'top' \| {x,y}` | `'center'` | Burst origin in CSS pixels |
| `followMouse` | `boolean` | `false` | Burst at the last mouse position |
| `bursts` | `number` | `1` | Bursts per trigger (max 50) |
| `burstInterval` | `number` | `280` | Delay between bursts (ms) |
| `loop` | `boolean` | `false` | Repeat until `stop()` |
| `launch` | `boolean` | `false` | Animate a projectile rising before the burst |
| `launchDuration` | `number` | `1200` | Projectile flight time (ms) |
| `launchFrom` | `'below' \| 'center' \| {x,y}` | `'below'` | Projectile start point |
| `preset` | `'show' \| 'salute' \| 'waterfall' \| null` | `null` | Built-in effect; explicit keys win over the preset |
| `secondary` | `number` | `0` | Child particles spawned mid-life (0 = off) |
| `secondaryAt` | `number` | `0.5` | When children spawn, as a fraction of lifetime |
| `colorMode` | `'random' \| 'gradient'` | `'random'` | Per-particle color selection |
| `shockwave` | `number` | `0` | Expanding ring radius (px, 0 = off) |
| `fall` | `boolean` | `false` | Waterfall mode — particles rain from the top |
| `sound` | `boolean` | `false` | Web Audio launch/burst sound effects |
| `volume` | `number` | `0.35` | Sound volume (0–1) |
| `fps` | `number` | `60` | Simulation frame rate |

Two semantic constraints worth knowing:

- An explicit `origin` passed to `fire()` forces a **single** burst at that exact point (ignores `bursts` and `loop`).
- In waterfall mode (`fall: true`), `launch` and `shockwave` are ignored — a waterfall has no single explosion point.

## Presets

```js
import { PRESETS } from '@meijie/fireworks-core'

Object.keys(PRESETS) // ['show', 'salute', 'waterfall']

engine.setOptions(PRESETS.salute)
engine.fire()

// Or one-shot via fire() — does not change persistent options
engine.fire({ preset: 'waterfall' })
```

| Preset | Effect |
|---|---|
| `show` | Looping fireworks display with rising projectiles and gradient colors |
| `salute` | Rapid multi-burst salute with secondary explosions and shockwaves |
| `waterfall` | Continuous colored rain with long trails and gradient color transitions |

## API

| Member | Description |
|---|---|
| `new FireworksEngine(canvas, options?)` | Create an engine bound to a canvas element |
| `engine.setOptions(options?)` | Update persistent configuration at runtime |
| `engine.fire(overrides?)` | Trigger a round; overrides apply to this round only |
| `engine.stop()` | Stop immediately and clear all particles/projectiles/timers |
| `engine.destroy()` | Stop and unbind all listeners; also closes the audio context |
| `engine.onEnd` | Callback fired when playback finishes (not fired while looping) |

## Framework bindings

Prefer a declarative component? Use the thin bindings — both depend on this core:

- [`@meijie/vue-fireworks`](https://www.npmjs.com/package/@meijie/vue-fireworks) — Vue 2.6+ / Vue 3
- [`@meijie/react-fireworks`](https://www.npmjs.com/package/@meijie/react-fireworks) — React 16.8+

Already using `@meijie/vue-fireworks/engine`? It still works — that entry is now a backward-compatible re-export of this package. New code should import from `@meijie/fireworks-core` directly.

## Development

```bash
npm install
npm test        # Vitest
npm run dev     # Vanilla JS demo on 127.0.0.1:5194
npm run build   # ES + CJS bundles in dist/
```

## License

MIT © meijie
