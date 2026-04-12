import type { AssistantMessage, ToolMessage, NonSystemMessage } from '../foundation/messages/types';

// ===== Agent Step State =====

export type AgentStepState =
  | 'idle'
  | 'thinking'
  | 'tool_calling'
  | 'reflecting'
  | 'completed'
  | 'error';

// ===== Trajectory Types =====

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  result: string;
  durationMs: number;
  isError: boolean;
}

export interface TrajectoryStep {
  step: number;
  state: AgentStepState;
  startedAt: number;
  endedAt: number;
  assistantMessage: AssistantMessage;
  toolCalls: ToolCallRecord[];
}

export interface Trajectory {
  threadId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  steps: TrajectoryStep[];
  totalSteps: number;
  success: boolean;
  error?: string;
}

// ===== State Change Event =====

export interface AgentStateEvent {
  threadId: string;
  step: number;
  state: AgentStepState;
  toolName?: string; // present when state === 'tool_calling'
}

// ===== Trajectory Recorder =====

export class TrajectoryRecorder {
  private steps: TrajectoryStep[] = [];
  private currentStep: Partial<TrajectoryStep> | null = null;
  private startTime: number = 0;

  readonly threadId: string;

  constructor(threadId: string) {
    this.threadId = threadId;
    this.startTime = Date.now();
  }

  beginStep(step: number): void {
    this.currentStep = {
      step,
      state: 'thinking',
      startedAt: Date.now(),
      toolCalls: [],
    };
  }

  recordAssistantMessage(msg: AssistantMessage): void {
    if (this.currentStep) {
      this.currentStep.assistantMessage = msg;
    }
  }

  recordToolCall(record: ToolCallRecord): void {
    if (this.currentStep) {
      this.currentStep.toolCalls!.push(record);
      this.currentStep.state = 'tool_calling';
    }
  }

  endStep(state: AgentStepState = 'completed'): void {
    if (this.currentStep) {
      this.currentStep.endedAt = Date.now();
      this.currentStep.state = state;
      this.steps.push(this.currentStep as TrajectoryStep);
      this.currentStep = null;
    }
  }

  finalize(success: boolean, error?: string): Trajectory {
    // Close any open step
    if (this.currentStep) {
      this.endStep(success ? 'completed' : 'error');
    }

    const endedAt = Date.now();
    return {
      threadId: this.threadId,
      startedAt: this.startTime,
      endedAt,
      durationMs: endedAt - this.startTime,
      steps: this.steps,
      totalSteps: this.steps.length,
      success,
      error,
    };
  }

  getSteps(): TrajectoryStep[] {
    return [...this.steps];
  }
}
