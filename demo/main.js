import { FireworksEngine, PRESETS } from '../src/engine.js'

const canvas = document.querySelector('#stage')
const engine = new FireworksEngine(canvas, {
  glow: true,
  trail: true,
  count: 90,
  ...PRESETS.show
})

// A single engine drives every effect — this is the entire vanilla JS integration.
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect()
  engine.fire({ origin: { x: event.clientX - box.left, y: event.clientY - box.top } })
})

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    engine.stop()
    engine.setOptions(PRESETS[button.dataset.preset])
    engine.fire()
  })
})

document.querySelector('#stop').addEventListener('click', () => engine.stop())
