/**
 * customMaterials.ts — Custom user-defined material types and localStorage CRUD (D7-5).
 *
 * Custom materials are saved per-browser in localStorage. Each material has
 * a name and a set of numeric properties (density, Young's modulus, etc.).
 * Pro-only feature — Free users see a locked indicator.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Standard material property keys. */
export type MaterialProperty = 'rho' | 'E' | 'nu' | 'mu' | 'k' | 'cp'

/** Human-readable labels and units for each property. */
export const MATERIAL_PROPERTY_META: Record<
  MaterialProperty,
  { label: string; unit: string; placeholder: string }
> = {
  rho: { label: 'Density', unit: 'kg/m\u00B3', placeholder: '7850' },
  E: { label: "Young's Modulus", unit: 'Pa', placeholder: '200e9' },
  nu: { label: "Poisson's Ratio", unit: '\u2014', placeholder: '0.30' },
  mu: { label: 'Dynamic Viscosity', unit: 'Pa\u00B7s', placeholder: '1e-3' },
  k: { label: 'Thermal Conductivity', unit: 'W/m\u00B7K', placeholder: '50' },
  cp: { label: 'Specific Heat', unit: 'J/kg\u00B7K', placeholder: '500' },
}

/** Ordered list of property keys for consistent display. */
export const MATERIAL_PROPERTIES: MaterialProperty[] = ['rho', 'E', 'nu', 'mu', 'k', 'cp']

/** A user-defined custom material. */
export interface CustomMaterial {
  id: string
  name: string
  /** Property values — only defined properties are stored. */
  properties: Partial<Record<MaterialProperty, number>>
}

// ── Validation ───────────────────────────────────────────────────────────────

export const MAX_MATERIAL_NAME_LENGTH = 64

export function validateMaterialName(name: string): { ok: boolean; error?: string } {
  if (!name.trim()) return { ok: false, error: 'Name is required' }
  if (name.length > MAX_MATERIAL_NAME_LENGTH) {
    return { ok: false, error: `Name must not exceed ${MAX_MATERIAL_NAME_LENGTH} characters` }
  }
  return { ok: true }
}

export function validateMaterialProperties(props: Partial<Record<MaterialProperty, number>>): {
  ok: boolean
  error?: string
} {
  const defined = Object.entries(props).filter(([, v]) => v !== undefined)
  if (defined.length === 0) {
    return { ok: false, error: 'At least one property must be defined' }
  }
  for (const [key, value] of defined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, error: `${key}: value must be a finite number` }
    }
  }
  return { ok: true }
}

// ── localStorage CRUD ────────────────────────────────────────────────────────

const LS_KEY = 'cs:custom-materials'

export function loadCustomMaterials(): CustomMaterial[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is CustomMaterial =>
        typeof m === 'object' &&
        m !== null &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        typeof m.properties === 'object',
    )
  } catch {
    return []
  }
}

export function saveCustomMaterials(materials: CustomMaterial[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(materials))
  } catch {
    // Private browsing — silently fail
  }
}

export function generateMaterialId(): string {
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
