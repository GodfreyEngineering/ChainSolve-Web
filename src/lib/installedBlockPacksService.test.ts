/**
 * installedBlockPacksService.test.ts — P116 block_pack registry tests.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getInstalledBlockPacks,
  addInstalledBlockPack,
  removeInstalledBlockPack,
  type InstalledBlockPack,
} from './installedBlockPacksService'

const PACK_1: InstalledBlockPack = {
  itemId: 'item-1',
  name: 'Physics Basics',
  defs: [{ id: 'd1', label: 'Power', block_type: 'eng.mechanics.power_work_time', data: {} }],
}

const PACK_2: InstalledBlockPack = {
  itemId: 'item-2',
  name: 'Finance Toolkit',
  defs: [{ id: 'd2', label: 'Compound FV', block_type: 'fin.tvm.compound_fv', data: { r: 0.05 } }],
}

beforeEach(() => {
  localStorage.clear()
})

describe('getInstalledBlockPacks', () => {
  it('returns [] when nothing stored', () => {
    expect(getInstalledBlockPacks()).toEqual([])
  })

  it('returns [] on malformed JSON', () => {
    localStorage.setItem('chainsolve.installed_block_packs', 'NOT_JSON')
    expect(getInstalledBlockPacks()).toEqual([])
  })

  it('returns stored packs', () => {
    localStorage.setItem('chainsolve.installed_block_packs', JSON.stringify([PACK_1]))
    expect(getInstalledBlockPacks()).toEqual([PACK_1])
  })
})

describe('addInstalledBlockPack', () => {
  it('adds a pack to an empty registry', () => {
    addInstalledBlockPack(PACK_1)
    expect(getInstalledBlockPacks()).toEqual([PACK_1])
  })

  it('adds multiple packs', () => {
    addInstalledBlockPack(PACK_1)
    addInstalledBlockPack(PACK_2)
    const packs = getInstalledBlockPacks()
    expect(packs).toHaveLength(2)
    expect(packs.map((p) => p.itemId)).toContain('item-1')
    expect(packs.map((p) => p.itemId)).toContain('item-2')
  })

  it('replaces an existing pack with the same itemId (idempotent)', () => {
    addInstalledBlockPack(PACK_1)
    const updated: InstalledBlockPack = { ...PACK_1, name: 'Physics Basics v2' }
    addInstalledBlockPack(updated)
    const packs = getInstalledBlockPacks()
    expect(packs).toHaveLength(1)
    expect(packs[0].name).toBe('Physics Basics v2')
  })
})

describe('removeInstalledBlockPack', () => {
  it('removes a pack by itemId', () => {
    addInstalledBlockPack(PACK_1)
    addInstalledBlockPack(PACK_2)
    removeInstalledBlockPack('item-1')
    const packs = getInstalledBlockPacks()
    expect(packs).toHaveLength(1)
    expect(packs[0].itemId).toBe('item-2')
  })

  it('is a no-op when itemId not found', () => {
    addInstalledBlockPack(PACK_1)
    removeInstalledBlockPack('non-existent')
    expect(getInstalledBlockPacks()).toHaveLength(1)
  })
})
