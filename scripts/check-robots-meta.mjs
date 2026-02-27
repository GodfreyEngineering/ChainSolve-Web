#!/usr/bin/env node
/**
 * scripts/check-robots-meta.mjs — Guard: dist/index.html contains robots meta.
 *
 * Verifies the built HTML includes <meta name="robots" content="noindex, nofollow" />.
 * This prevents accidental removal of the tag that keeps the app out of search indexes.
 *
 * Run after `npm run build`:
 *   node scripts/check-robots-meta.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const targets = [
  resolve(ROOT, 'index.html'),
  resolve(ROOT, 'dist', 'index.html'),
]

let checked = 0

for (const file of targets) {
  if (!existsSync(file)) continue
  checked++
  const html = readFileSync(file, 'utf-8')
  if (!html.includes('noindex')) {
    console.error(`::error::Missing robots noindex meta tag in ${file}`)
    console.error('Expected: <meta name="robots" content="noindex, nofollow" />')
    process.exit(1)
  }
  const label = file.replace(ROOT + '/', '')
  console.log(`${label}: robots noindex meta tag present`)
}

if (checked === 0) {
  console.error('::error::Neither index.html nor dist/index.html found')
  process.exit(1)
}

console.log(`Robots meta guard passed (${checked} file(s) checked).`)
