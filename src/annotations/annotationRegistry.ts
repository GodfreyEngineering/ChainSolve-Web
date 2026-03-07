/**
 * annotationRegistry -- V3-5.2 annotation tools registry.
 *
 * Annotations are visual-only canvas elements, completely separate from the
 * block system (BLOCK_REGISTRY). They are ReactFlow nodes of kind 'csAnnotation'
 * but are NOT engine-evaluating blocks. The `blockType` field retains the
 * `annotation_` prefix so the existing engine exclusion filter in bridge.ts
 * continues to work without changes.
 *
 * V3-5.2: Added shape primitives (rectangle, ellipse, diamond, rounded_rectangle)
 * and configurable arrow properties (markers, thickness, dash pattern).
 */

export type AnnotationType =
  | 'text'
  | 'callout'
  | 'highlight'
  | 'arrow'
  | 'leader'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'rounded_rectangle'

/** Arrow endpoint marker styles (V3-5.2). */
export type ArrowMarker = 'none' | 'arrowhead' | 'dot' | 'square'

/** Arrow dash pattern (V3-5.2). */
export type ArrowDash = 'solid' | 'dashed' | 'dotted'

export interface AnnotationDefaults {
  blockType: string
  label: string
  annotationType: AnnotationType
  annotationText?: string
  annotationColor: string
  annotationFontSize: number
  annotationBold: boolean
  annotationItalic: boolean
  /** V3-5.2: Shape border width in px. */
  annotationBorderWidth?: number
  /** V3-5.2: Shape fill color (shapes only). */
  annotationFillColor?: string
  /** V3-5.2: Arrow start marker. */
  annotationArrowStart?: ArrowMarker
  /** V3-5.2: Arrow end marker. */
  annotationArrowEnd?: ArrowMarker
  /** V3-5.2: Arrow line thickness. */
  annotationArrowThickness?: number
  /** V3-5.2: Arrow dash pattern. */
  annotationArrowDash?: ArrowDash
}

export interface AnnotationDef {
  /** Registry key -- matches the `blockType` value (e.g. 'annotation_text'). */
  key: string
  /** Human-readable label for toolbar/context-menu display. */
  label: string
  /** Default data for new nodes of this type. */
  defaultData: AnnotationDefaults
}

function def(
  key: string,
  label: string,
  type: AnnotationType,
  color: string,
  extra?: Partial<AnnotationDefaults>,
): [string, AnnotationDef] {
  return [
    key,
    {
      key,
      label,
      defaultData: {
        blockType: key,
        label,
        annotationType: type,
        annotationColor: color,
        annotationFontSize: 14,
        annotationBold: false,
        annotationItalic: false,
        ...extra,
      },
    },
  ]
}

export const ANNOTATION_REGISTRY: ReadonlyMap<string, AnnotationDef> = new Map([
  // Original types
  def('annotation_text', 'Text Label', 'text', '#facc15', { annotationText: 'Label' }),
  def('annotation_callout', 'Callout Box', 'callout', '#60a5fa', { annotationText: 'Note' }),
  def('annotation_highlight', 'Highlight Region', 'highlight', '#facc15'),
  def('annotation_arrow', 'Arrow', 'arrow', '#f87171', {
    annotationArrowStart: 'none',
    annotationArrowEnd: 'arrowhead',
    annotationArrowThickness: 3,
    annotationArrowDash: 'solid',
  }),
  def('annotation_leader', 'Leader Label', 'leader', '#a78bfa', { annotationText: 'Label' }),

  // V3-5.2: Shape primitives
  def('annotation_rectangle', 'Rectangle', 'rectangle', '#60a5fa', {
    annotationBorderWidth: 2,
    annotationFillColor: 'rgba(96,165,250,0.12)',
  }),
  def('annotation_ellipse', 'Ellipse', 'ellipse', '#34d399', {
    annotationBorderWidth: 2,
    annotationFillColor: 'rgba(52,211,153,0.12)',
  }),
  def('annotation_diamond', 'Diamond', 'diamond', '#fb923c', {
    annotationBorderWidth: 2,
    annotationFillColor: 'rgba(251,146,60,0.12)',
  }),
  def('annotation_rounded_rectangle', 'Rounded Rectangle', 'rounded_rectangle', '#a78bfa', {
    annotationBorderWidth: 2,
    annotationFillColor: 'rgba(167,139,250,0.12)',
  }),
])
