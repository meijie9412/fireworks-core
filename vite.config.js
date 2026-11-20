import { defineConfig } from 'vite'
import { resolve } from 'path'

const format = process.env.FORMAT === 'cjs' ? 'cjs' : 'es'
const ext = format === 'cjs' ? 'cjs' : 'js'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: format === 'es',
    lib: {
      entry: resolve(__dirname, 'src/engine.js'),
      formats: [format],
      fileName: () => `engine.${ext}`
    },
    rollupOptions: {
      output: { exports: 'named' }
    }
  }
})
