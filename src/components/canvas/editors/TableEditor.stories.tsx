import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { TableEditor } from './TableEditor'

const meta: Meta<typeof TableEditor> = {
  title: 'Canvas/TableEditor',
  component: TableEditor,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof meta>

// Controlled wrapper for interactive stories
function TableEditorWrapper({ columns, rows }: { columns: string[]; rows: number[][] }) {
  const [state, setState] = useState({ columns, rows })
  return (
    <div style={{ width: 500, background: 'var(--node-bg, #1a1a2e)', borderRadius: 8, padding: 8 }}>
      <TableEditor
        columns={state.columns}
        rows={state.rows}
        onChange={(c, r) => setState({ columns: c, rows: r })}
      />
    </div>
  )
}

export const Small: Story = {
  render: () => (
    <TableEditorWrapper
      columns={['X', 'Y']}
      rows={[
        [0, 0],
        [1, 1],
        [2, 4],
        [3, 9],
      ]}
    />
  ),
}

export const Wide: Story = {
  render: () => (
    <TableEditorWrapper
      columns={['Time (s)', 'Force (N)', 'Velocity (m/s)', 'Accel (m/s²)']}
      rows={Array.from({ length: 10 }, (_, i) => [i * 0.1, i * 2.5, i * 1.2, 9.81])}
    />
  ),
}

export const LargeVirtualized: Story = {
  name: 'Large (500 rows, virtualized)',
  render: () => (
    <TableEditorWrapper
      columns={['Index', 'Value A', 'Value B']}
      rows={Array.from({ length: 500 }, (_, i) => [i, Math.sin(i * 0.1), Math.cos(i * 0.1)])}
    />
  ),
}

export const SingleColumn: Story = {
  render: () => <TableEditorWrapper columns={['Values']} rows={[[1.0], [2.5], [3.7], [4.2]]} />,
}

export const Empty: Story = {
  render: () => <TableEditorWrapper columns={['Column A']} rows={[]} />,
}
