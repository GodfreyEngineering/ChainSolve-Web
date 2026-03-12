/**
 * .storybook/preview.tsx — DEV-05: Global Storybook decorators and parameters.
 *
 * Wraps all stories in the i18n provider and injects a minimal dark-theme
 * CSS reset so components render as they would inside the app shell.
 */
import type { Preview } from '@storybook/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../src/i18n/config'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0e1016' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div
          style={{
            // Minimal CSS variable surface so components can use var(--*)
            '--primary': '#1CABB0',
            '--danger': '#ef4444',
            '--text-muted': '#9ca3af',
            '--border': 'rgba(255,255,255,0.1)',
            '--glass-bg': 'rgba(20,20,30,0.95)',
            '--glass-border': 'rgba(255,255,255,0.12)',
            '--glass-blur': '8px',
            '--tooltip-text': '#e5e7eb',
            '--radius-sm': '4px',
            '--color-on-primary': '#fff',
            color: '#e5e7eb',
            fontFamily: 'system-ui, sans-serif',
            padding: '1.5rem',
          } as React.CSSProperties}
        >
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
}

export default preview
