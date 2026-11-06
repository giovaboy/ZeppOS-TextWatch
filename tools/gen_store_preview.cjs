#!/usr/bin/env node
// Builds the Zepp store preview: an animated GIF cycling through the languages.
//
//   node tools/gen_store_preview.cjs
//
// The store takes a single picture: 360x360, at most 1 MB, PNG or GIF, not the AOD look.
// Frames come from docs/screenshots/<lang>.png (normal mode); the first one is what a
// viewer that doesn't animate GIFs shows. Output: docs/store-preview.gif.
//
// The sharp in the Zeus CLI install can't build an animation from separate images, so it
// encodes each frame as a one-frame GIF and this script joins their compressed data.
// It is .cjs because Zeus bundles every .js file of the project.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SHOTS = path.join(ROOT, 'docs', 'screenshots')
const OUT = path.join(ROOT, 'docs', 'store-preview.gif')
const LANGS = ['en', 'it', 'es', 'fr', 'ru'] // English first: the store is international
const SIZE = 360
const FRAME_MS = 2000
const MAX_BYTES = 1024 * 1024

// sharp ships inside the Zeus CLI install; no package.json in this project.
function loadSharp() {
  try { return require('sharp') } catch (_) {}
  const zeus = fs.realpathSync(execSync('command -v zeus', { shell: '/bin/bash' }).toString().trim())
  return require(path.resolve(path.dirname(zeus), '..', 'node_modules', 'sharp'))
}

// Offset just past a chain of GIF sub-blocks, terminator included.
function skipSubBlocks(buf, i) {
  while (buf[i] !== 0) i += buf[i] + 1
  return i + 1
}

// Pulls the one image out of a one-frame GIF: placement, palette, transparency, LZW data.
function parseFrame(buf) {
  if (buf.toString('latin1', 0, 3) !== 'GIF') throw new Error('not a GIF')
  const screenFlags = buf[10]
  let i = 13
  let palette = null
  if (screenFlags & 0x80) {
    const len = 3 << ((screenFlags & 7) + 1)
    palette = buf.subarray(i, i + len)
    i += len
  }
  let transparent = null
  while (i < buf.length) {
    const block = buf[i]
    if (block === 0x21) {
      if (buf[i + 1] === 0xf9 && (buf[i + 3] & 1)) transparent = buf[i + 6]
      i = skipSubBlocks(buf, i + 2)
    } else if (block === 0x2c) {
      const descriptor = buf.subarray(i + 1, i + 9)
      const flags = buf[i + 9]
      i += 10
      if (flags & 0x80) {
        const len = 3 << ((flags & 7) + 1)
        palette = buf.subarray(i, i + len)
        i += len
      }
      const dataStart = i
      i = skipSubBlocks(buf, i + 1)
      if (!palette) throw new Error('frame without a palette')
      return { descriptor, interlace: flags & 0x40, palette, transparent, data: buf.subarray(dataStart, i) }
    } else {
      break
    }
  }
  throw new Error('no image in GIF')
}

function joinFrames(frames, size, frameMs) {
  const screen = Buffer.alloc(7)
  screen.writeUInt16LE(size, 0)
  screen.writeUInt16LE(size, 2)
  screen[4] = 0x70 // no global palette: every frame carries its own
  const loopForever = Buffer.from([
    0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0', 'latin1'), 0x03, 0x01, 0x00, 0x00, 0x00,
  ])
  const parts = [Buffer.from('GIF89a', 'latin1'), screen, loopForever]
  for (const f of frames) {
    // Disposal 2 (clear to transparent) so the corners don't keep the previous frame.
    const control = Buffer.from([0x21, 0xf9, 0x04, (2 << 2) | (f.transparent === null ? 0 : 1), 0, 0, f.transparent || 0, 0])
    control.writeUInt16LE(Math.round(frameMs / 10), 4)
    const paletteBits = Math.log2(f.palette.length / 3) - 1
    parts.push(control, Buffer.from([0x2c]), f.descriptor, Buffer.from([0x80 | f.interlace | paletteBits]), f.palette, f.data)
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}

async function main() {
  const sharp = loadSharp()
  const frames = []
  for (const lang of LANGS) {
    const gif = await sharp(path.join(SHOTS, `${lang}.png`))
      .resize(SIZE, SIZE)
      .gif({ colours: 256, effort: 10, dither: 0 })
      .toBuffer()
    frames.push(parseFrame(gif))
  }
  fs.writeFileSync(OUT, joinFrames(frames, SIZE, FRAME_MS))

  const meta = await sharp(OUT, { animated: true }).metadata()
  const bytes = fs.statSync(OUT).size
  console.log(`${path.relative(ROOT, OUT)}: ${meta.width}x${meta.pageHeight}, ${meta.pages} frames, ` +
    `delays ${meta.delay}, loop ${meta.loop}, ${(bytes / 1024).toFixed(0)} KB`)
  if (meta.pages !== LANGS.length || meta.pageHeight !== SIZE || meta.width !== SIZE) throw new Error('unexpected frame layout')
  if (bytes > MAX_BYTES) throw new Error(`over the store's 1 MB limit: ${bytes} bytes`)
}

main().catch(e => { console.error(e); process.exit(1) })
