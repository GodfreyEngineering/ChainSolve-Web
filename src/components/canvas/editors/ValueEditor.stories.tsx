import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ValueEditor } from './ValueEditor'
import type { InputBinding } from '../../../blocks/types'

const meta: Meta<typeof ValueEditor> = {
  title: 'Canvas/ValueEditor',
  component: ValueEditor,
  parameters: { layout: 'centered' },
  argTypes: {
    compact: { control: 'boolean' },
    override: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

function ValueEditorWrapper({
  initialBinding,
  compact,
  override,
}: {
  initialBinding: InputBinding
  compact?: boolean
  override?: boolean
}) {
  const [binding, setBinding] = useState<InputBinding>(initialBinding)
  return (
    <div
      style={{
        width: compact ? 120 : 240,
        background: '#1a1a2e',
        padding: '0.5rem',
        borderRadius: 8,
      }}
    >
      <ValueEditor binding={binding} onChange={setBinding} compact={compact} override={override} />
    </div>
  )
}

export const LiteralDefault: Story = {
  name: 'Literal value (default)',
  render: () => <ValueEditorWrapper initialBinding={{ kind: 'literal', value: 42 }} />,
}

export const LiteralCompact: Story = {
  name: 'Literal value (compact)',
  render: () => <ValueEditorWrapper initialBinding={{ kind: 'literal', value: 3.14159 }} compact />,
}

export const LiteralZero: Story = {
  name: 'Literal zero',
  render: () => <ValueEditorWrapper initialBinding={{ kind: 'literal', value: 0 }} />,
}

export const LiteralNegative: Story = {
  name: 'Literal negative',
  render: () => <ValueEditorWrapper initialBinding={{ kind: 'literal', value: -9.81 }} />,
}

export const Unbound: Story = {
  name: 'Unbound (no binding)',
  render: () => (
    <div style={{ width: 240, background: '#1a1a2e', padding: '0.5rem', borderRadius: 8 }}>
      <ValueEditor binding={undefined} onChange={() => {}} />
    </div>
  ),
}
