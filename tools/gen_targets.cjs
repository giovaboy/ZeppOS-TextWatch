#!/usr/bin/env node
// Generates the assets of every smaller-screen target from the 480 px ones.
//
//   node tools/gen_targets.cjs
//
// For each target in app.json named `target-<width>` (target-466, -454, -416, -360) it rebuilds
// assets/target-<width>/ from assets/default-target.r/: images scaled by <width> / designWidth,
// every other file (fonts) copied as is. The target's own preview.png is kept and never touched.
// Run it after changing any image in default-target.r, then commit the result.
//
// Why: Zeus takes a target's assets only from assets/<target name>/, with no fallback to
// default-target.r, and does not scale them; the layout code scales coordinates with px(), so
// images must come at the target's size. The scaling matches `zpm resize` (width rounded down,
// cubic kernel, very small images copied unscaled), with lossless maximum PNG compression.
// It is .cjs because Zeus bundles every .js file of the project.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'assets', 'default-target.r')
const KEEP = new Set(['preview.png']) // per-target files, not generated

// sharp ships inside the Zeus CLI install (zpm uses it); no package.json in this project.
function loadSharp() {
  try { return require('sharp') } catch (_) {}
  const zeus = fs.realpathSync(execSync('command -v zeus', { shell: '/bin/bash' }).toString().trim())
  return require(path.resolve(path.dirname(zeus), '..', 'node_modules', 'sharp'))
}

function walk(dir, rel = '') {
  const out = []
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const r = path.join(rel, e.name)
    if (e.isDirectory()) out.push(...walk(dir, r))
    else out.push(r)
  }
  return out
}

async function genTarget(sharp, name, width, designWidth) {
  const dest = path.join(ROOT, 'assets', name)
  fs.mkdirSync(dest, { recursive: true })
  for (const e of fs.readdirSync(dest)) {
    if (!KEEP.has(e)) fs.rmSync(path.join(dest, e), { recursive: true, force: true })
  }

  const ratio = width / designWidth
  const minWidth = Math.round(0.5 / (1 - ratio)) // as zpm: narrower images are copied unscaled
  const t0 = Date.now()
  let images = 0, copied = 0, bytes = 0

  for (const rel of walk(SRC)) {
    if (KEEP.has(rel)) continue
    const from = path.join(SRC, rel)
    const to = path.join(dest, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    if (/\.(png|jpe?g)$/i.test(rel)) {
      const { width: w } = await sharp(from).metadata()
      const nw = Math.floor(w * ratio)
      if (!w || nw === 0 || w < minWidth) { fs.copyFileSync(from, to); copied++ }
      else {
        await sharp(from).resize({ width: nw, kernel: 'cubic' })
          .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toFile(to)
        images++
      }
    } else {
      fs.copyFileSync(from, to); copied++
    }
    bytes += fs.statSync(to).size
  }

  if (!fs.existsSync(path.join(dest, 'preview.png'))) {
    console.warn(`  ${name}: no preview.png of its own (Zeus scales the store preview from it)`)
  }
  console.log(`${name}: ${images} images scaled to ${width}/${designWidth}, ${copied} files copied, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB, ${Date.now() - t0} ms`)
}

async function main() {
  const sharp = loadSharp()
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  const only = process.argv.slice(2)
  for (const [name, t] of Object.entries(app.targets)) {
    const m = /^target-(\d+)$/.exec(name)
    if (!m || (only.length && !only.includes(name))) continue
    await genTarget(sharp, name, Number(m[1]), t.designWidth || 480)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
