/**
 * UpgradeModal — D11-3 / Phase 3: Shows plan comparison with checkout.
 * Uses the shared PlanComparisonCard for the tier grid.
 */

import { Modal } from './ui/Modal'
import { useTranslation } from 'react-i18next'
import { PlanComparisonCard } from './app/PlanComparisonCard'
import type { Plan } from '../lib/entitlements'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Why the modal was triggered — drives the message shown. */
  reason:
    | 'project_limit'
    | 'canvas_limit'
    | 'feature_locked'
    | 'export_locked'
    | 'ai_locked'
    | 'custom_materials_locked'
    | 'custom_functions_locked'
  /** The user's current effective plan. */
  currentPlan?: Plan
}

export function UpgradeModal({ open, onClose, reason, currentPlan }: UpgradeModalProps) {
  const { t } = useTranslation()

  const title =
    reason === 'project_limit'
      ? t('entitlements.projectLimitTitle')
      : reason === 'canvas_limit'
        ? t('upgrade.canvasLimitTitle', 'Canvas limit reached')
        : reason === 'export_locked'
          ? t('upgrade.exportLockedTitle', 'Export requires Pro')
          : reason === 'ai_locked'
            ? t('ai.upgradeTitle')
            : reason === 'custom_materials_locked'
              ? t('upgrade.customMaterialsLockedTitle', 'Custom materials require Pro')
              : reason === 'custom_functions_locked'
                ? t('upgrade.customFunctionsLockedTitle', 'Custom functions require Pro')
                : t('entitlements.featureLockedTitle')

  const message =
    reason === 'project_limit'
      ? t('entitlements.projectLimitMsg')
      : reason === 'canvas_limit'
        ? t(
            'upgrade.canvasLimitMsg',
            'Free accounts can have 2 canvases per project. Upgrade to Pro for unlimited canvases.',
          )
        : reason === 'export_locked'
          ? t('upgrade.exportLockedMsg', 'Export and import require a Pro plan.')
          : reason === 'ai_locked'
            ? t('ai.upgradeBody')
            : reason === 'custom_materials_locked'
              ? t(
                  'upgrade.customMaterialsLockedMsg',
                  'Custom materials are a Pro feature. Upgrade to create and manage your own materials.',
                )
              : reason === 'custom_functions_locked'
                ? t(
                    'upgrade.customFunctionsLockedMsg',
                    'Custom function blocks are a Pro feature. Upgrade to create reusable formula blocks.',
                  )
                : t('entitlements.featureLockedMsg')

  return (
    <Modal open={open} onClose={onClose} title={title} width={880}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', opacity: 0.7 }}>{message}</p>
      <PlanComparisonCard currentPlan={currentPlan ?? 'free'} showCheckout compact />
    </Modal>
  )
}
