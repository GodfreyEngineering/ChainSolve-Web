/**
 * complex-blocks.ts — Complex number block pack (SCI-08).
 *
 * 12 blocks: complex_from, complex_re, complex_im, complex_mag, complex_arg,
 * complex_conj, complex_add, complex_mul, complex_div, complex_exp, complex_ln,
 * complex_pow.
 * Evaluation handled by Rust/WASM engine ops (complex.* namespace).
 */

import type { BlockDef } from './types'

export function registerComplexBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'complex_from',
    label: 'Complex From Re/Im',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [
      { id: 're', label: 'Re' },
      { id: 'im', label: 'Im' },
    ],
    defaultData: { blockType: 'complex_from', label: 'Complex From Re/Im' },
    description: 'Create a complex number from real and imaginary parts: re + im·i',
    synonyms: ['complex number', 'imaginary', 'real imaginary'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_re',
    label: 'Real Part',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_re', label: 'Real Part' },
    description: 'Extract the real part of a complex number',
    synonyms: ['real part', 'Re(z)'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_im',
    label: 'Imaginary Part',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_im', label: 'Imaginary Part' },
    description: 'Extract the imaginary part of a complex number',
    synonyms: ['imaginary part', 'Im(z)'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_mag',
    label: 'Magnitude',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_mag', label: 'Magnitude' },
    description: 'Magnitude (modulus) of a complex number: |z| = sqrt(re²+im²)',
    synonyms: ['modulus', 'absolute value', '|z|'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_arg',
    label: 'Argument',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_arg', label: 'Argument' },
    description: 'Argument (phase angle) of a complex number: atan2(im, re) in radians',
    synonyms: ['phase', 'angle', 'arg(z)'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_conj',
    label: 'Conjugate',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_conj', label: 'Conjugate' },
    description: 'Complex conjugate: conj(re + im·i) = re − im·i',
    synonyms: ['complex conjugate', 'conj'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_add',
    label: 'Complex Add',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'z1', label: 'z₁' },
      { id: 'z2', label: 'z₂' },
    ],
    defaultData: { blockType: 'complex_add', label: 'Complex Add' },
    description: 'Add two complex numbers: z₁ + z₂',
    synonyms: ['complex addition', 'add complex'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_mul',
    label: 'Complex Multiply',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'z1', label: 'z₁' },
      { id: 'z2', label: 'z₂' },
    ],
    defaultData: { blockType: 'complex_mul', label: 'Complex Multiply' },
    description: 'Multiply two complex numbers: z₁ × z₂',
    synonyms: ['complex multiplication', 'multiply complex'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_div',
    label: 'Complex Divide',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'z1', label: 'z₁' },
      { id: 'z2', label: 'z₂' },
    ],
    defaultData: { blockType: 'complex_div', label: 'Complex Divide' },
    description: 'Divide two complex numbers: z₁ / z₂',
    synonyms: ['complex division', 'divide complex'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_exp',
    label: 'Complex Exp',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_exp', label: 'Complex Exp' },
    description: 'Complex exponential: e^z = e^re · (cos(im) + i·sin(im))',
    synonyms: ['complex exponential', "euler's formula"],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_ln',
    label: 'Complex Ln',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [{ id: 'z', label: 'z' }],
    defaultData: { blockType: 'complex_ln', label: 'Complex Ln' },
    description: 'Complex natural logarithm: ln(z) = ln|z| + i·arg(z)',
    synonyms: ['complex logarithm', 'complex log'],
    tags: ['complex', 'math'],
  })

  register({
    type: 'complex_pow',
    label: 'Complex Power',
    category: 'complex',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'z', label: 'z' },
      { id: 'n', label: 'n' },
    ],
    defaultData: { blockType: 'complex_pow', label: 'Complex Power' },
    description: 'Complex power: z^n where n is a real scalar',
    synonyms: ['complex exponent', 'z to the power n'],
    tags: ['complex', 'math'],
  })
}
