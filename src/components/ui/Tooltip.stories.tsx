import type { Meta, StoryObj } from '@storybook/react'
import { Tooltip } from './Tooltip'

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: { layout: 'centered' },
  argTypes: {
    side: { control: 'radio', options: ['top', 'right', 'bottom', 'left'] },
    delay: { control: { type: 'range', min: 0, max: 1000, step: 50 } },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    side: 'top',
    delay: 350,
    children: <button style={{ padding: '0.5rem 1rem', borderRadius: 6 }}>Hover me</button>,
  },
}

export const WithShortcut: Story = {
  args: {
    content: 'Save project',
    shortcut: 'Ctrl+S',
    side: 'bottom',
    children: <button style={{ padding: '0.5rem 1rem', borderRadius: 6 }}>Save</button>,
  },
}

export const NoDelay: Story = {
  args: {
    content: 'Appears instantly',
    delay: 0,
    children: <button style={{ padding: '0.5rem 1rem', borderRadius: 6 }}>Hover (no delay)</button>,
  },
}

export const Disabled: Story = {
  args: {
    content: 'This tooltip is disabled',
    disabled: true,
    children: (
      <button style={{ padding: '0.5rem 1rem', borderRadius: 6, opacity: 0.5 }}>
        Hover (tooltip disabled)
      </button>
    ),
  },
}

export const AllSides: Story = {
  name: 'All sides',
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Tooltip key={side} content={`Tooltip on ${side}`} side={side} delay={0}>
          <button style={{ padding: '0.5rem 1rem', borderRadius: 6 }}>{side}</button>
        </Tooltip>
      ))}
    </div>
  ),
}
