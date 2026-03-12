/**
 * accuracy.spec.ts — TEST-03: Engine accuracy regression tests.
 *
 * Verifies specific computed values to guard against numerical regressions.
 * These tests MUST pass before deploy.
 *
 * Uses the worker-scoped `enginePage` fixture from helpers.ts so WASM
 * compiles once per worker and is reused across all accuracy tests.
 *
 * Coverage:
 *   sin(π/2)           → 1.0       (trig accuracy)
 *   3-4-5 Pythagorean  → 5.0       (sqrt + arithmetic)
 *   quadratic roots    → 1.0, 2.0  (compound arithmetic)
 *   chain arithmetic   → 38        (evaluation order)
 */

import { expect, test } from './helpers'

type EngineResult = {
  values: Record<string, { kind: string; value: number }>
  diagnostics: unknown[]
  elapsedUs: number
}

test.describe('Engine accuracy regression (TEST-03)', () => {
  test('sin(π/2) = 1.0', async ({ enginePage: page }) => {
    const result = (await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'angle', blockType: 'number', data: { value: 1.5707963267948966 } },
          { id: 'sinNode', blockType: 'sin', data: {} },
        ],
        edges: [
          {
            id: 'e1',
            source: 'angle',
            sourceHandle: 'out',
            target: 'sinNode',
            targetHandle: 'a',
          },
        ],
      })
    })) as EngineResult

    const sinResult = result.values['sinNode']?.value ?? NaN
    expect(Math.abs(sinResult - 1.0)).toBeLessThan(1e-10)
  })

  test('3-4-5 Pythagorean: sqrt(3² + 4²) = 5.0', async ({ enginePage: page }) => {
    const result = (await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'n3', blockType: 'number', data: { value: 3 } },
          { id: 'n4', blockType: 'number', data: { value: 4 } },
          { id: 'n2a', blockType: 'number', data: { value: 2 } },
          { id: 'n2b', blockType: 'number', data: { value: 2 } },
          { id: 'pow3', blockType: 'power', data: {} },
          { id: 'pow4', blockType: 'power', data: {} },
          { id: 'sumNode', blockType: 'add', data: {} },
          { id: 'hypNode', blockType: 'sqrt', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'n3', sourceHandle: 'out', target: 'pow3', targetHandle: 'base' },
          { id: 'e2', source: 'n2a', sourceHandle: 'out', target: 'pow3', targetHandle: 'exp' },
          { id: 'e3', source: 'n4', sourceHandle: 'out', target: 'pow4', targetHandle: 'base' },
          { id: 'e4', source: 'n2b', sourceHandle: 'out', target: 'pow4', targetHandle: 'exp' },
          { id: 'e5', source: 'pow3', sourceHandle: 'out', target: 'sumNode', targetHandle: 'a' },
          { id: 'e6', source: 'pow4', sourceHandle: 'out', target: 'sumNode', targetHandle: 'b' },
          {
            id: 'e7',
            source: 'sumNode',
            sourceHandle: 'out',
            target: 'hypNode',
            targetHandle: 'a',
          },
        ],
      })
    })) as EngineResult

    const hyp = result.values['hypNode']?.value ?? NaN
    expect(Math.abs(hyp - 5.0)).toBeLessThan(1e-10)
  })

  test('quadratic x²-3x+2=0: roots are 1 and 2', async ({ enginePage: page }) => {
    // Discriminant = b²-4ac = 9-8 = 1, sqrt=1
    // x₁ = (-b - sqrt) / 2a = (−3 − 1)/2 = −2 (wait: b=3, so -b=-3)
    // Actually for x²-3x+2: a=1, b=-3, c=2
    // disc = (-3)²-4(1)(2)=9-8=1, sqrt=1
    // x₁ = (3-1)/2 = 1, x₂ = (3+1)/2 = 2
    // So negate(b) = negate(-3) = 3. Let's use b_neg=3 directly.
    const result = (await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }
      // For x² - 3x + 2 = 0: a=1, b_coeff=3 (used as -b), c=2
      // Roots: x = (-b ± sqrt(b²-4ac)) / 2a where b=-3 coefficient
      // Using: neg_b = 3 (which is -(-3)), discriminant = 9-8=1
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'neg_b', blockType: 'number', data: { value: 3 } }, // -b = 3
          { id: 'b_sq', blockType: 'number', data: { value: 9 } }, // b² = 9
          { id: 'four_ac', blockType: 'number', data: { value: 8 } }, // 4ac = 8
          { id: 'two_a', blockType: 'number', data: { value: 2 } }, // 2a = 2
          { id: 'disc', blockType: 'subtract', data: {} }, // b² - 4ac = 1
          { id: 'sqrtD', blockType: 'sqrt', data: {} }, // sqrt(1) = 1
          { id: 'num1', blockType: 'subtract', data: {} }, // neg_b - sqrtD = 2
          { id: 'num2', blockType: 'add', data: {} }, // neg_b + sqrtD = 4
          { id: 'x1', blockType: 'divide', data: {} }, // 2/2 = 1
          { id: 'x2', blockType: 'divide', data: {} }, // 4/2 = 2
        ],
        edges: [
          { id: 'e1', source: 'b_sq', sourceHandle: 'out', target: 'disc', targetHandle: 'a' },
          {
            id: 'e2',
            source: 'four_ac',
            sourceHandle: 'out',
            target: 'disc',
            targetHandle: 'b',
          },
          { id: 'e3', source: 'disc', sourceHandle: 'out', target: 'sqrtD', targetHandle: 'a' },
          { id: 'e4', source: 'neg_b', sourceHandle: 'out', target: 'num1', targetHandle: 'a' },
          { id: 'e5', source: 'sqrtD', sourceHandle: 'out', target: 'num1', targetHandle: 'b' },
          { id: 'e6', source: 'neg_b', sourceHandle: 'out', target: 'num2', targetHandle: 'a' },
          { id: 'e7', source: 'sqrtD', sourceHandle: 'out', target: 'num2', targetHandle: 'b' },
          { id: 'e8', source: 'num1', sourceHandle: 'out', target: 'x1', targetHandle: 'a' },
          { id: 'e9', source: 'two_a', sourceHandle: 'out', target: 'x1', targetHandle: 'b' },
          { id: 'e10', source: 'num2', sourceHandle: 'out', target: 'x2', targetHandle: 'a' },
          { id: 'e11', source: 'two_a', sourceHandle: 'out', target: 'x2', targetHandle: 'b' },
        ],
      })
    })) as EngineResult

    const x1 = result.values['x1']?.value ?? NaN
    const x2 = result.values['x2']?.value ?? NaN
    expect(Math.abs(x1 - 1.0)).toBeLessThan(1e-10)
    expect(Math.abs(x2 - 2.0)).toBeLessThan(1e-10)
  })

  test('chain arithmetic: (10 + 5) × 3 - 7 = 38', async ({ enginePage: page }) => {
    const result = (await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'n10', blockType: 'number', data: { value: 10 } },
          { id: 'n5', blockType: 'number', data: { value: 5 } },
          { id: 'n3', blockType: 'number', data: { value: 3 } },
          { id: 'n7', blockType: 'number', data: { value: 7 } },
          { id: 'sumAB', blockType: 'add', data: {} },
          { id: 'prod', blockType: 'multiply', data: {} },
          { id: 'diff', blockType: 'subtract', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'n10', sourceHandle: 'out', target: 'sumAB', targetHandle: 'a' },
          { id: 'e2', source: 'n5', sourceHandle: 'out', target: 'sumAB', targetHandle: 'b' },
          { id: 'e3', source: 'sumAB', sourceHandle: 'out', target: 'prod', targetHandle: 'a' },
          { id: 'e4', source: 'n3', sourceHandle: 'out', target: 'prod', targetHandle: 'b' },
          { id: 'e5', source: 'prod', sourceHandle: 'out', target: 'diff', targetHandle: 'a' },
          { id: 'e6', source: 'n7', sourceHandle: 'out', target: 'diff', targetHandle: 'b' },
        ],
      })
    })) as EngineResult

    expect(result.values['diff']?.value).toBe(38)
  })
})
