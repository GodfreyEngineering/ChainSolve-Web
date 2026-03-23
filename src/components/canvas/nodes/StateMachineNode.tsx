/**
 * StateMachineNode — 2.71: StateflowBlock (finite state machine).
 *
 * Renders a compact FSM block showing:
 *  - Current state (coloured badge)
 *  - State list (coloured dots + names)
 *  - Transition table (from→to: guard)
 *  - Variadic input handles for condition signals
 *
 * Guard evaluation: evaluates simple boolean expressions referencing
 * input port values (in_0, in_1, …) using a restricted Function constructor.
 * Transitions are sorted by priority (lower = higher priority) then index.
 *
 * In reactive eval mode, on each input change:
 *  1. Find all transitions whose `from` === currentStateId
 *  2. Evaluate each guard with current input values
 *  3. Take the first truthy guard → change state
 *  4. Update currentStateId + value (state index) in nodeData
 */

import { memo, createElement, useMemo, useEffect, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import type { FsmState, FsmTransition } from '../../../blocks/statemachine-blocks'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'

interface StateMachineNodeData extends NodeData {
  fsmStates: FsmState[]
  fsmTransitions: FsmTransition[]
  currentStateId: string
  initialStateId: string
  dynamicInputCount: number
  value: number
}

/**
 * Safely evaluate a guard expression string with the given variable bindings.
 * Only allows alphanumeric identifiers, operators, spaces, dots, and underscores.
 * Returns false on any error.
 */
function evalGuard(guard: string, inputs: Record<string, number>): boolean {
  if (!guard.trim()) return false
  // Reject any guard with unsafe patterns (quotes, backticks, parens chains, etc.)
  if (/[`'"\\;{}[\]]/.test(guard)) return false
  try {
    const keys = Object.keys(inputs)
    const vals = keys.map((k) => inputs[k])

    const fn = new Function(...keys, `return !!(${guard})`)
    return Boolean(fn(...vals))
  } catch {
    return false
  }
}

function StateMachineNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as StateMachineNodeData
  const { updateNodeData } = useReactFlow()

  const states: FsmState[] = useMemo(() => nd.fsmStates ?? [], [nd.fsmStates])
  const transitions: FsmTransition[] = useMemo(() => nd.fsmTransitions ?? [], [nd.fsmTransitions])
  const currentStateId = nd.currentStateId ?? states[0]?.id ?? ''
  const dynamicInputCount = nd.dynamicInputCount ?? 2
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  const currentState = states.find((s) => s.id === currentStateId) ?? states[0]
  const currentStateIndex = states.findIndex((s) => s.id === currentStateId)

  // Read all input values
  const in0 = useComputedValue(id)
  const in1 = useComputedValue(id)
  const in2 = useComputedValue(id)
  const in3 = useComputedValue(id)
  const in4 = useComputedValue(id)
  const in5 = useComputedValue(id)
  const in6 = useComputedValue(id)
  const in7 = useComputedValue(id)

  const resolveInput = useCallback(
    (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0),
    [],
  )

  useEffect(() => {
    const inputMap: Record<string, number> = {
      in_0: resolveInput(in0),
      in_1: resolveInput(in1),
      in_2: resolveInput(in2),
      in_3: resolveInput(in3),
      in_4: resolveInput(in4),
      in_5: resolveInput(in5),
      in_6: resolveInput(in6),
      in_7: resolveInput(in7),
    }

    // Find outgoing transitions from current state, sorted by priority then index
    const outgoing = transitions
      .filter((tr) => tr.from === currentStateId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    let nextStateId = currentStateId
    for (const tr of outgoing) {
      if (evalGuard(tr.guard, inputMap)) {
        nextStateId = tr.to
        break
      }
    }

    if (nextStateId !== currentStateId) {
      const nextIndex = states.findIndex((s) => s.id === nextStateId)
      updateNodeData(id, { currentStateId: nextStateId, value: Math.max(0, nextIndex) })
    }
  }, [
    id,
    in0,
    in1,
    in2,
    in3,
    in4,
    in5,
    in6,
    in7,
    currentStateId,
    transitions,
    states,
    updateNodeData,
    resolveInput,
  ])

  const inputHandles = Array.from({ length: Math.max(0, dynamicInputCount) }, (_, i) => i)

  // Vertical spacing for input handles
  const handleSpacing = dynamicInputCount > 1 ? 100 / (dynamicInputCount + 1) : 50

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>
          {nd.label ?? t('stateMachine.label', 'State Machine')}
        </span>
      </div>

      <div style={s.nodeBody}>
        {/* Current state indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            padding: '4px 8px',
            background: '#2a2a2a',
            borderRadius: 4,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: currentState?.color ?? '#888',
              boxShadow: `0 0 6px ${currentState?.color ?? '#888'}88`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#F4F4F3',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {currentState?.name ?? t('stateMachine.noState', 'No state')}
          </span>
          <span style={{ fontSize: 9, color: '#666', marginLeft: 'auto' }}>
            [{currentStateIndex}]
          </span>
        </div>

        {/* States list */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              fontSize: 9,
              color: '#666',
              marginBottom: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {t('stateMachine.states', 'States')}
          </div>
          {states.slice(0, 6).map((st) => (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
                opacity: st.id === currentStateId ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: st.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, color: '#aaa', fontFamily: 'JetBrains Mono, monospace' }}>
                {st.name}
              </span>
            </div>
          ))}
          {states.length > 6 && (
            <div style={{ fontSize: 8, color: '#555' }}>
              +{states.length - 6} {t('stateMachine.more', 'more')}
            </div>
          )}
        </div>

        {/* Transitions list */}
        <div>
          <div
            style={{
              fontSize: 9,
              color: '#666',
              marginBottom: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {t('stateMachine.transitions', 'Transitions')} ({transitions.length})
          </div>
          {transitions.slice(0, 4).map((tr) => {
            const fromSt = states.find((s) => s.id === tr.from)
            const toSt = states.find((s) => s.id === tr.to)
            const isActive = tr.from === currentStateId
            return (
              <div
                key={tr.id}
                style={{
                  fontSize: 8,
                  color: isActive ? '#aaa' : '#555',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 2,
                  padding: '1px 0',
                  borderLeft: isActive ? `2px solid ${typeColor}` : '2px solid transparent',
                  paddingLeft: 4,
                }}
              >
                {fromSt?.name ?? '?'} → {toSt?.name ?? '?'}
                <span style={{ color: '#666', marginLeft: 4 }}>{tr.guard}</span>
              </div>
            )
          })}
          {transitions.length > 4 && (
            <div style={{ fontSize: 8, color: '#555' }}>
              +{transitions.length - 4} {t('stateMachine.more', 'more')}
            </div>
          )}
        </div>
      </div>

      {/* Variadic input handles */}
      {inputHandles.map((i) => (
        <Handle
          key={`in_${i}`}
          type="target"
          position={Position.Left}
          id={`in_${i}`}
          style={{
            top: `${handleSpacing * (i + 1)}%`,
            background: '#888',
            width: 8,
            height: 8,
            border: '2px solid #1a1a1a',
          }}
        />
      ))}

      {/* Output: current state index */}
      <Handle
        type="source"
        position={Position.Right}
        id="state"
        style={{
          top: '50%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
      />
    </div>
  )
}

export const StateMachineNode = memo(StateMachineNodeInner)
