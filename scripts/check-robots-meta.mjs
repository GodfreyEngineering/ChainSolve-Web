#!/usr/bin/env node
/**
 * scripts/check-robots-meta.mjs — Guard: dist/index.html contains robots meta.
 *
 * Verifies the built HTML includes a <meta name="robots"> tag allowing indexing.
 * The app should be publicly indexable (robots.txt handles route-level blocking).
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
  if (!html.includes('name="robots"')) {
    console.error(`::error::Missing robots meta tag in ${file}`)
    console.error('Expected: <meta name="robots" content="index, follow" />')
    process.exit(1)
  }
  const label = file.replace(ROOT + '/', '')
  console.log(`${label}: robots meta tag present`)
}

if (checked === 0) {
  console.error('::error::Neither index.html nor dist/index.html found')
  process.exit(1)
}

console.log(`Robots meta guard passed (${checked} file(s) checked).`)
