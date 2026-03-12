import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmDialog } from './ConfirmDialog'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'App/ConfirmDialog',
  component: ConfirmDialog,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    title: 'Discard unsaved changes?',
    message: 'You have unsaved changes on this canvas. Switching projects will lose them.',
    actions: [
      { label: 'Cancel', variant: 'muted', onClick: () => {} },
      { label: 'Discard changes', variant: 'danger', onClick: () => {} },
    ],
    onClose: () => {},
  },
}

export const DestructiveOnly: Story = {
  args: {
    open: true,
    title: 'Delete project?',
    message:
      'This will permanently delete "My Project" and all its canvases. This action cannot be undone.',
    actions: [
      { label: 'Cancel', variant: 'muted', onClick: () => {} },
      { label: 'Delete permanently', variant: 'danger', onClick: () => {} },
    ],
    onClose: () => {},
  },
}

export const WithPrimary: Story = {
  args: {
    open: true,
    title: 'Save before closing?',
    message: 'Do you want to save your changes before closing?',
    actions: [
      { label: "Don't save", variant: 'muted', onClick: () => {} },
      { label: 'Cancel', variant: 'muted', onClick: () => {} },
      { label: 'Save', variant: 'primary', onClick: () => {} },
    ],
    onClose: () => {},
  },
}
