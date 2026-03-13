import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { usePreferencesStore } from '../../stores/preferencesStore'

interface Props {
  cardStyle: React.CSSProperties
  checkRowStyle: React.CSSProperties
  checkboxStyle: React.CSSProperties
  checkLabelStyle: React.CSSProperties
  checkHintStyle: React.CSSProperties
}

export function EditorSettings({
  cardStyle,
  checkRowStyle,
  checkboxStyle,
  checkLabelStyle,
  checkHintStyle,
}: Props) {
  const { t } = useTranslation()
  const defaultSnapToGrid = usePreferencesStore((s) => s.defaultSnapToGrid)
  const defaultEdgeAnimation = usePreferencesStore((s) => s.defaultEdgeAnimation)
  const defaultLod = usePreferencesStore((s) => s.defaultLod)
  const showGrid = usePreferencesStore((s) => s.showGrid)
  const defaultZoom = usePreferencesStore((s) => s.defaultZoom)
  const canvasBgStyle = usePreferencesStore((s) => s.canvasBgStyle)
  const canvasGridSize = usePreferencesStore((s) => s.canvasGridSize)
  const canvasEdgeType = usePreferencesStore((s) => s.canvasEdgeType)
  const canvasEdgeWidth = usePreferencesStore((s) => s.canvasEdgeWidth)
  const canvasNodeBorderRadius = usePreferencesStore((s) => s.canvasNodeBorderRadius)
  const canvasNodeShadow = usePreferencesStore((s) => s.canvasNodeShadow)
  const canvasAnimationSpeed = usePreferencesStore((s) => s.canvasAnimationSpeed)
  const updatePrefs = usePreferencesStore((s) => s.update)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={defaultSnapToGrid}
            onChange={(e) => updatePrefs({ defaultSnapToGrid: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.snapToGrid')}</span>
            <span style={checkHintStyle}>{t('settings.snapToGridHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={defaultEdgeAnimation}
            onChange={(e) => updatePrefs({ defaultEdgeAnimation: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.animatedChains')}</span>
            <span style={checkHintStyle}>{t('settings.animatedChainsHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={defaultLod}
            onChange={(e) => updatePrefs({ defaultLod: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.lodRendering')}</span>
            <span style={checkHintStyle}>{t('settings.lodRenderingHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => updatePrefs({ showGrid: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.showGrid')}</span>
            <span style={checkHintStyle}>{t('settings.showGridHint')}</span>
          </div>
        </label>

        <Select
          label={t('settings.defaultZoom')}
          hint={t('settings.defaultZoomHint')}
          options={[
            { value: '50', label: '50%' },
            { value: '75', label: '75%' },
            { value: '100', label: '100%' },
            { value: '125', label: '125%' },
            { value: '150', label: '150%' },
          ]}
          value={String(defaultZoom)}
          onChange={(e) => updatePrefs({ defaultZoom: parseInt(e.target.value) })}
        />

        <Select
          label={t('settings.canvasBgStyle', 'Canvas background')}
          options={[
            { value: 'dot-grid', label: t('settings.bgDotGrid', 'Dot grid') },
            { value: 'line-grid', label: t('settings.bgLineGrid', 'Line grid') },
            { value: 'cross-grid', label: t('settings.bgCrossGrid', 'Cross grid') },
            { value: 'large-dots', label: t('settings.bgLargeDots', 'Large dots') },
            { value: 'solid', label: t('settings.bgSolid', 'Solid (no grid)') },
          ]}
          value={canvasBgStyle}
          onChange={(e) =>
            updatePrefs({
              canvasBgStyle: e.target.value as
                | 'solid'
                | 'dot-grid'
                | 'line-grid'
                | 'cross-grid'
                | 'large-dots',
            })
          }
        />

        <Select
          label={t('settings.canvasGridSize', 'Grid size')}
          options={[
            { value: '8', label: '8 px' },
            { value: '16', label: '16 px' },
            { value: '32', label: '32 px' },
            { value: '64', label: '64 px' },
          ]}
          value={String(canvasGridSize)}
          onChange={(e) =>
            updatePrefs({ canvasGridSize: parseInt(e.target.value) as 8 | 16 | 32 | 64 })
          }
        />

        <Select
          label={t('settings.canvasEdgeType', 'Edge style')}
          options={[
            { value: 'bezier', label: t('settings.edgeBezier', 'Bezier (curved)') },
            { value: 'smoothstep', label: t('settings.edgeSmoothstep', 'Smooth step') },
            { value: 'step', label: t('settings.edgeStep', 'Step (sharp corners)') },
            { value: 'straight', label: t('settings.edgeStraight', 'Straight') },
          ]}
          value={canvasEdgeType}
          onChange={(e) =>
            updatePrefs({
              canvasEdgeType: e.target.value as 'bezier' | 'step' | 'straight' | 'smoothstep',
            })
          }
        />

        <Select
          label={t('settings.canvasEdgeWidth', 'Edge width')}
          options={[
            { value: '1', label: '1 px (thin)' },
            { value: '1.5', label: '1.5 px (default)' },
            { value: '2', label: '2 px' },
            { value: '3', label: '3 px (thick)' },
          ]}
          value={String(canvasEdgeWidth)}
          onChange={(e) =>
            updatePrefs({ canvasEdgeWidth: parseFloat(e.target.value) as 1 | 1.5 | 2 | 3 })
          }
        />

        <Select
          label={t('settings.canvasNodeBorderRadius', 'Node corner radius')}
          options={[
            { value: '0', label: t('settings.borderRadiusSquare', 'Square (0 px)') },
            { value: '4', label: '4 px' },
            { value: '8', label: '8 px' },
            { value: '12', label: t('settings.borderRadiusRound', 'Rounded (12 px)') },
          ]}
          value={String(canvasNodeBorderRadius)}
          onChange={(e) =>
            updatePrefs({
              canvasNodeBorderRadius: parseInt(e.target.value) as 0 | 4 | 8 | 12,
            })
          }
        />

        <Select
          label={t('settings.canvasNodeShadow', 'Node shadow')}
          options={[
            { value: 'none', label: t('settings.shadowNone', 'None') },
            { value: 'subtle', label: t('settings.shadowSubtle', 'Subtle') },
            { value: 'strong', label: t('settings.shadowStrong', 'Strong') },
          ]}
          value={canvasNodeShadow}
          onChange={(e) =>
            updatePrefs({ canvasNodeShadow: e.target.value as 'none' | 'subtle' | 'strong' })
          }
        />

        <Select
          label={t('settings.canvasAnimationSpeed', 'Animation speed')}
          options={[
            { value: 'none', label: t('settings.animNone', 'None (disabled)') },
            { value: 'fast', label: t('settings.animFast', 'Fast (250 ms)') },
            { value: 'medium', label: t('settings.animMedium', 'Medium (600 ms)') },
            { value: 'slow', label: t('settings.animSlow', 'Slow (1200 ms)') },
          ]}
          value={canvasAnimationSpeed}
          onChange={(e) =>
            updatePrefs({
              canvasAnimationSpeed: e.target.value as 'none' | 'slow' | 'medium' | 'fast',
            })
          }
        />
      </div>
    </div>
  )
}
