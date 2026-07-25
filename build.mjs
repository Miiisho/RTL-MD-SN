import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'

const outdir = 'dist'

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })

// نسخ الملفات الثابتة (html/css) إلى مجلد dist
cpSync('public/index.html', `${outdir}/index.html`)
cpSync('public/editor.css', `${outdir}/editor.css`)
cpSync('ext.json', `${outdir}/ext.json`)

// حزم جافاسكربت مع كل الاعتماديات في ملف واحد قائم بذاته
await build({
  entryPoints: ['src/editor.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2018'],
  outfile: `${outdir}/editor.js`,
  logLevel: 'info',
})

console.log('✓ تم بناء الإضافة في مجلد dist/')
