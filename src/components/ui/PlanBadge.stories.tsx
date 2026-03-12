import type { Meta, StoryObj } from '@storybook/react'
import { PlanBadge } from './PlanBadge'
import type { Plan } from '../../lib/entitlements'

const meta: Meta<typeof PlanBadge> = {
  title: 'UI/PlanBadge',
  component: PlanBadge,
  parameters: { layout: 'centered' },
  argTypes: {
    plan: {
      control: 'select',
      options: [
        'free',
        'trialing',
        'pro',
        'enterprise',
        'past_due',
        'canceled',
        'student',
        'developer',
      ] satisfies Plan[],
    },
    variant: { control: 'radio', options: ['badge', 'compact'] },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Free: Story = { args: { plan: 'free' } }
export const Trialing: Story = { args: { plan: 'trialing' } }
export const Pro: Story = { args: { plan: 'pro' } }
export const Enterprise: Story = { args: { plan: 'enterprise' } }
export const PastDue: Story = { args: { plan: 'past_due' } }
export const Canceled: Story = { args: { plan: 'canceled' } }
export const Student: Story = { args: { plan: 'student' } }
export const Developer: Story = { args: { plan: 'developer' } }

export const CompactPro: Story = { args: { plan: 'pro', variant: 'compact' } }
export const CompactEnterprise: Story = { args: { plan: 'enterprise', variant: 'compact' } }

export const AllBadges: Story = {
  name: 'All plans',
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      {(
        [
          'free',
          'trialing',
          'pro',
          'enterprise',
          'student',
          'developer',
          'past_due',
          'canceled',
        ] as Plan[]
      ).map((plan) => (
        <PlanBadge key={plan} plan={plan} />
      ))}
    </div>
  ),
}
