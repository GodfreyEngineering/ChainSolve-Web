/**
 * statemachine-blocks.ts — 2.71: StateflowBlock (finite state machine).
 *
 * A visual FSM block for mode-switching logic: gear shifts, flight modes,
 * battery management, control mode selection, etc.
 *
 * Block type: 'stateMachine' — nodeKind: 'csStateMachine' — category: 'controlSystems'
 *
 * FSM model:
 *  - States: [{id, name, color}]
 *  - Transitions: [{id, from, to, guard}] where guard is a boolean expression
 *    referencing input port values by name (in_0, in_1, …)
 *  - Inputs: variadic — each input is a condition signal (e.g., velocity, mode, flag)
 *  - Outputs: 'state' (number = current state index, 0-based)
 *
 * In reactive eval mode the block checks all outgoing transitions of the
 * current state and takes the first one whose guard evaluates to true.
 * Full simulation semantics (entry/during/exit actions, priority queuing)
 * require the simulation worker (Category 8).
 *
 * Bridge: stateMachine → 'number' (current state index).
 */

import type { BlockDef } from './registry'

export interface FsmState {
  id: string
  name: string
  color: string
}

export interface FsmTransition {
  id: string
  from: string
  to: string
  /** Boolean expression referencing in_0, in_1, … e.g. "in_0 > 5" */
  guard: string
  priority: number
}

export function registerStateMachineBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'stateMachine',
    label: 'State Machine',
    category: 'controlSystems',
    nodeKind: 'csStateMachine',
    variadic: true,
    minInputs: 0,
    maxInputs: 16,
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'stateMachine',
      label: 'State Machine',
      value: 0,
      /** Ordered list of FSM states. */
      fsmStates: [
        { id: 's0', name: 'Idle', color: '#4a9eff' },
        { id: 's1', name: 'Active', color: '#2ecc71' },
        { id: 's2', name: 'Error', color: '#e74c3c' },
      ] as FsmState[],
      /** Transition table. */
      fsmTransitions: [
        { id: 't0', from: 's0', to: 's1', guard: 'in_0 > 0', priority: 0 },
        { id: 't1', from: 's1', to: 's0', guard: 'in_0 <= 0', priority: 0 },
        { id: 't2', from: 's1', to: 's2', guard: 'in_1 > 0', priority: 1 },
        { id: 't3', from: 's2', to: 's0', guard: 'in_0 <= 0 && in_1 <= 0', priority: 0 },
      ] as FsmTransition[],
      /** Currently active state id. */
      currentStateId: 's0',
      /** Initial state id (reset target). */
      initialStateId: 's0',
      /** Number of variadic input ports. */
      dynamicInputCount: 2,
    },
    synonyms: [
      'state machine',
      'FSM',
      'statechart',
      'Stateflow',
      'mode switch',
      'finite state machine',
      'mode logic',
      'gear shift',
      'flight mode',
    ],
    tags: ['control', 'discrete', 'logic', 'mode', 'state'],
    description:
      'Finite state machine (FSM) block: define states and guarded transitions. ' +
      'Transitions fire when the guard expression evaluates true (references input port values). ' +
      'Outputs the current state index — ideal for gear shift, flight mode, battery management logic.',
  })
}
