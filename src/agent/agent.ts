import type { Model } from '../foundation/models/model';
import type { ModelContext } from '../foundation/models/context';
import type {
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolUseContent,
  NonSystemMessage,
} from '../foundation/messages/types';
import type { FunctionTool } from '../foundation/tools/define-tool';
import type { AgentMiddleware } from './middleware';
import { extractToolUses, createToolMessage } from '../foundation/messages';
import { TrajectoryRecorder, type AgentStepState, type AgentStateEvent, type Trajectory, type ToolCallRecord } from './trajectory';

export type AgentEvent =
  | AssistantMessage
  | ToolMessage
  | { type: 'state_change'; event: AgentStateEvent };

export interface AgentOptions {
  model: Model;
  prompt: string;
  messages?: NonSystemMessage[];
  tools?: FunctionTool<any, any>[];
  middlewares?: AgentMiddleware[];
  maxSteps?: number;
  threadId?: string;
  onStateChange?: (event: AgentStateEvent) => void;
}

export class Agent {
  private model: Model;
  private prompt: string;
  private messages: NonSystemMessage[];
  private tools: FunctionTool<any, any>[];
  private middlewares: AgentMiddleware[];
  private maxSteps: number;
  private abortController: AbortController;
  private threadId: string;
  private onStateChange?: (event: AgentStateEvent) => void;
  private lastTrajectory: Trajectory | null = null;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.prompt = options.prompt;
    this.messages = options.messages ? [...options.messages] : [];
    this.tools = options.tools ?? [];
    this.middlewares = options.middlewares ?? [];
    this.maxSteps = options.maxSteps ?? 100;
    this.abortController = new AbortController();
    this.threadId = options.threadId ?? 'unknown';
    this.onStateChange = options.onStateChange;
  }

  async *stream(message: UserMessage): AsyncGenerator<AssistantMessage | ToolMessage> {
    this.abortController = new AbortController();
    this.messages.push(message);
    const recorder = new TrajectoryRecorder(this.threadId);

    for (const mw of this.middlewares) {
      if (mw.beforeAgentRun) {
        const result = await mw.beforeAgentRun();
        if (result) Object.assign(this, result);
      }
    }

    try {
      for (let step = 1; step <= this.maxSteps; step++) {
        this.checkAborted();
        recorder.beginStep(step);
        this.emitState(step, 'thinking');

        for (const mw of this.middlewares) {
          if (mw.beforeAgentStep) await mw.beforeAgentStep(step);
        }

        const assistantMessage = await this.think();

        let finalMessage = assistantMessage;
        for (const mw of this.middlewares) {
          if (mw.afterModel) {
            const modified = await mw.afterModel(finalMessage);
            if (modified) finalMessage = modified;
          }
        }

        recorder.recordAssistantMessage(finalMessage);
        this.messages.push(finalMessage);
        yield finalMessage;

        const toolUses = extractToolUses(finalMessage);
        if (toolUses.length === 0) {
          recorder.endStep('completed');
          this.emitState(step, 'completed');
          for (const mw of this.middlewares) {
            if (mw.afterAgentRun) await mw.afterAgentRun();
          }
          this.lastTrajectory = recorder.finalize(true);
          return;
        }

        yield* this.act(toolUses, step, recorder);

        recorder.endStep('reflecting');
        for (const mw of this.middlewares) {
          if (mw.afterAgentStep) await mw.afterAgentStep(step);
        }
      }

      const err = new Error(`Agent exceeded max steps (${this.maxSteps})`);
      this.lastTrajectory = recorder.finalize(false, err.message);
      throw err;
    } catch (e: any) {
      if (!this.lastTrajectory) {
        this.lastTrajectory = recorder.finalize(false, e.message);
      }
      this.emitState(0, 'error');
      throw e;
    }
  }

  abort(): void {
    this.abortController.abort();
  }

  getMessages(): NonSystemMessage[] {
    return [...this.messages];
  }

  getLastTrajectory(): Trajectory | null {
    return this.lastTrajectory;
  }

  private async think(): Promise<AssistantMessage> {
    let context: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools.length > 0 ? this.tools : undefined,
    };

    for (const mw of this.middlewares) {
      if (mw.beforeModel) {
        const patch = await mw.beforeModel(context);
        if (patch) context = { ...context, ...patch };
      }
    }

    return this.model.invoke(context);
  }

  private async *act(toolUses: ToolUseContent[], step: number, recorder: TrajectoryRecorder): AsyncGenerator<ToolMessage> {
    const pending = toolUses.map(async (toolUse, index) => {
      const tool = this.tools.find((t) => t.name === toolUse.name);

      for (const mw of this.middlewares) {
        if (mw.beforeToolUse) await mw.beforeToolUse(toolUse);
      }

      this.emitState(step, 'tool_calling', toolUse.name);
      const toolStart = Date.now();
      let resultText: string;
      let isError = false;

      if (!tool) {
        resultText = `Error: Unknown tool "${toolUse.name}"`;
        isError = true;
      } else {
        try {
          this.checkAborted();
          const result = await tool.invoke(toolUse.input);
          resultText = typeof result === 'string' ? result : JSON.stringify(result);
        } catch (err: any) {
          if (err.name === 'AbortError' || this.abortController.signal.aborted) {
            throw new Error('Agent aborted');
          }
          resultText = `Error: ${err.message}`;
          isError = true;
        }
      }

      recorder.recordToolCall({
        name: toolUse.name,
        input: toolUse.input,
        result: resultText.slice(0, 2000), // truncate for storage
        durationMs: Date.now() - toolStart,
        isError,
      });

      for (const mw of this.middlewares) {
        if (mw.afterToolUse) await mw.afterToolUse(toolUse, resultText);
      }

      return { index, toolUseId: toolUse.id, result: resultText };
    });

    const remaining = new Set(pending.map((_, i) => i));
    while (remaining.size > 0) {
      const resolved = await Promise.race(
        [...remaining].map((i) => pending[i].then((r) => ({ ...r, pendingIndex: i }))),
      );
      remaining.delete(resolved.pendingIndex);

      const toolMessage = createToolMessage(resolved.toolUseId, resolved.result);
      this.messages.push(toolMessage);
      yield toolMessage;
    }
  }

  private emitState(step: number, state: AgentStepState, toolName?: string): void {
    this.onStateChange?.({
      threadId: this.threadId,
      step,
      state,
      toolName,
    });
  }

  private checkAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new Error('Agent aborted');
    }
  }
}
