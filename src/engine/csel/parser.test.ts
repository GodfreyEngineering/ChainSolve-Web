import { describe, it, expect } from 'vitest'
import { parseCsel } from './parser'
import { generateGraph } from './graphGen'

describe('CSEL Parser', () => {
  it('parses a simple addition', () => {
    const ast = parseCsel('1 + 2')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('binary')
    if (ast[0].type === 'binary') {
      expect(ast[0].op).toBe('+')
      expect(ast[0].left).toEqual({ type: 'literal', value: 1 })
      expect(ast[0].right).toEqual({ type: 'literal', value: 2 })
    }
  })

  it('parses operator precedence: 1 + 2 * 3', () => {
    const ast = parseCsel('1 + 2 * 3')
    expect(ast).toHaveLength(1)
    if (ast[0].type === 'binary') {
      expect(ast[0].op).toBe('+')
      expect(ast[0].left).toEqual({ type: 'literal', value: 1 })
      if (ast[0].right.type === 'binary') {
        expect(ast[0].right.op).toBe('*')
      }
    }
  })

  it('parses function calls', () => {
    const ast = parseCsel('sin(3.14)')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('call')
    if (ast[0].type === 'call') {
      expect(ast[0].name).toBe('sin')
      expect(ast[0].args).toHaveLength(1)
    }
  })

  it('parses variadic function: max(1, 2, 3)', () => {
    const ast = parseCsel('max(1, 2, 3)')
    expect(ast).toHaveLength(1)
    if (ast[0].type === 'call') {
      expect(ast[0].name).toBe('max')
      expect(ast[0].args).toHaveLength(3)
    }
  })

  it('parses assignment: x = 5', () => {
    const ast = parseCsel('x = 5')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('assign')
    if (ast[0].type === 'assign') {
      expect(ast[0].name).toBe('x')
      expect(ast[0].value).toEqual({ type: 'literal', value: 5 })
    }
  })

  it('parses display: 1 + 2 =', () => {
    const ast = parseCsel('1 + 2 =')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('display')
  })

  it('parses multiple statements: x = 5; y = x * 2; y + 1 =', () => {
    const ast = parseCsel('x = 5; y = x * 2; y + 1 =')
    expect(ast).toHaveLength(3)
    expect(ast[0].type).toBe('assign')
    expect(ast[1].type).toBe('assign')
    expect(ast[2].type).toBe('display')
  })

  it('parses unary negation', () => {
    const ast = parseCsel('-5')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('unary')
  })

  it('parses power (right-associative)', () => {
    const ast = parseCsel('2 ^ 3 ^ 2')
    expect(ast).toHaveLength(1)
    if (ast[0].type === 'binary') {
      expect(ast[0].op).toBe('^')
      // Right-associative: 2^(3^2)
      expect(ast[0].right.type).toBe('binary')
    }
  })

  it('parses parentheses', () => {
    const ast = parseCsel('(1 + 2) * 3')
    expect(ast).toHaveLength(1)
    if (ast[0].type === 'binary') {
      expect(ast[0].op).toBe('*')
      expect(ast[0].left.type).toBe('binary')
    }
  })

  it('parses identifiers (pi, e)', () => {
    const ast = parseCsel('pi')
    expect(ast).toHaveLength(1)
    expect(ast[0].type).toBe('identifier')
    if (ast[0].type === 'identifier') {
      expect(ast[0].name).toBe('pi')
    }
  })
})

describe('CSEL Graph Generator', () => {
  it('generates 3 nodes for 1 + 2 =', () => {
    const ast = parseCsel('1 + 2 =')
    const graph = generateGraph(ast)
    // Number(1), Number(2), Add, Display = 4 nodes
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3)
    expect(graph.edges.length).toBeGreaterThanOrEqual(2)
    // Should have a display node
    expect(graph.nodes.some((n) => n.blockType === 'display')).toBe(true)
  })

  it('generates sin block for sin(pi/4) =', () => {
    const ast = parseCsel('sin(pi / 4) =')
    const graph = generateGraph(ast)
    expect(graph.nodes.some((n) => n.blockType === 'sin')).toBe(true)
    expect(graph.nodes.some((n) => n.blockType === 'display')).toBe(true)
  })

  it('generates named blocks for x = 5; y = 10; x * y =', () => {
    const ast = parseCsel('x = 5; y = 10; x * y =')
    const graph = generateGraph(ast)
    // Should have Number(5), Number(10), Multiply, Display
    expect(graph.nodes.some((n) => n.blockType === 'multiply')).toBe(true)
    expect(graph.nodes.some((n) => n.blockType === 'display')).toBe(true)
    // Named blocks should be reused (x appears in assignment and multiplication)
    const numberNodes = graph.nodes.filter((n) => n.blockType === 'number')
    expect(numberNodes.length).toBe(2) // x=5, y=10
  })

  it('generates variadic max block for max(1, 2, 3, 4)', () => {
    const ast = parseCsel('max(1, 2, 3, 4) =')
    const graph = generateGraph(ast)
    const maxNode = graph.nodes.find((n) => n.blockType === 'max')
    expect(maxNode).toBeDefined()
    expect(maxNode?.data.dynamicInputCount).toBe(4)
  })
})
