/**
 * annotationRegistry — Standalone registry for annotation tools (V2-022).
 *
 * Annotations are visual-only canvas elements, completely separate from the
 * block system (BLOCK_REGISTRY). They are ReactFlow nodes of kind 'csAnnotation'
 * but are NOT engine-evaluating blocks. The `blockType` field retains the
 * `annotation_` prefix so the existing engine exclusion filter in bridge.ts
 * continues to work without changes.
 */

export type AnnotationType = 'text' | 'callout' | 'highlight' | 'arrow' | 'leader'

export interface AnnotationDefaults {
  blockType: string
  label: string
  annotationType: AnnotationType
  annotationText?: string
  annotationColor: string
  annotationFontSize: number
  annotationBold: boolean
  annotationItalic: boolean
}

export interface AnnotationDef {
  /** Registry key — matches the `blockType` value (e.g. 'annotation_text'). */
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
  def('annotation_text', 'Text Label', 'text', '#facc15', { annotationText: 'Label' }),
  def('annotation_callout', 'Callout Box', 'callout', '#60a5fa', { annotationText: 'Note' }),
  def('annotation_highlight', 'Highlight Region', 'highlight', '#facc15'),
  def('annotation_arrow', 'Arrow', 'arrow', '#f87171'),
  def('annotation_leader', 'Leader Label', 'leader', '#a78bfa', { annotationText: 'Label' }),
])
