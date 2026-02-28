/**
 * installedBlockPacksService.ts — P116 block_pack localStorage registry.
 *
 * Persists installed block_pack marketplace items in localStorage so the
 * block definitions are available across sessions without a network request.
 *
 * Schema:
 *   localStorage key: 'chainsolve.installed_block_packs'
 *   value: JSON array of InstalledBlockPack
 */

/** One pre-configured node template inside a block_pack. */
export interface BlockPackDefinition {
  /** Unique ID within this pack (author-assigned). */
  id: string
  /** Human-readable name shown in the block picker. */
  label: string
  /**
   * Engine op/block type string (e.g. 'add', 'eng.fluids.reynolds').
   * Must be a known catalog op on the current engine contract.
   */
  block_type: string
  /** Pre-filled input values keyed by port name. */
  data: Record<string, unknown>
}

/** The top-level payload stored for a marketplace block_pack item. */
export interface BlockPackPayload {
  /**
   * Minimum engine contract version required to use this pack.
   * Omit or set to 1 for universal compatibility.
   */
  minContractVersion?: number
  /** The block definitions included in this pack. */
  defs: BlockPackDefinition[]
}

/** A block_pack that the user has installed, stored in localStorage. */
export interface InstalledBlockPack {
  /** Marketplace item UUID. */
  itemId: string
  /** Display name of the pack. */
  name: string
  /** Extracted block definitions. */
  defs: BlockPackDefinition[]
}

const STORAGE_KEY = 'chainsolve.installed_block_packs'

/** Return all currently installed block packs. */
export function getInstalledBlockPacks(): InstalledBlockPack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as InstalledBlockPack[]
  } catch {
    return []
  }
}

/** Add (or replace) a block pack in the registry. */
export function addInstalledBlockPack(pack: InstalledBlockPack): void {
  // Remove any previous entry for the same item (idempotent update)
  const packs = getInstalledBlockPacks().filter((p) => p.itemId !== pack.itemId)
  packs.push(pack)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs))
  } catch {
    // Ignore storage-full / private-browsing errors.
  }
}

/** Remove a block pack from the registry. */
export function removeInstalledBlockPack(itemId: string): void {
  const packs = getInstalledBlockPacks().filter((p) => p.itemId !== itemId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs))
  } catch {
    // ignore
  }
}
