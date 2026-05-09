import type { AgentMiddleware } from '../middleware';
import type { AssistantMessage, ToolUseContent, NonSystemMessage, ToolMessage, Message } from '../../foundation/messages/types';
import type { ModelProvider } from '../../foundation/models/provider';
import type { FunctionTool } from '../../foundation/tools/define-tool';
import type { MemoryStore } from '../memory';
import { createMemoryWriteTool } from '../../coding/tools/memory-write';
import { createSkillCreateTool } from '../../coding/tools/skill-create';
import { MEMORY_REVIEW_PROMPT, SKILL_REVIEW_PROMPT } from './review-prompts';

const DEFAULT_MEMORY_NUDGE_TURNS = 10;
const DEFAULT_SKILL_NUDGE_ITERS = 10;
const DEFAULT_REVIEW_MODEL = process.env.CODEX_REVIEW_MODEL || 'glm-4.5-flash';
const REVIEW_HISTORY_TAIL = 16;
const REVIEW_TIMEOUT_MS = 60_000;

export type ReviewMode = 'memory' | 'skill';

export interface ReviewCompleteEvent {
  mode: ReviewMode;
  ok: boolean;
  memoriesAdded: number;
  skillsProposed: number;
  toolCalls: number;
  durationMs: number;
  error?: string;
}

export interface BackgroundReviewOptions {
  memoryStore: MemoryStore;
  provider: ModelProvider;
  reviewModel?: string;
  memoryNudgeTurns?: number;
  skillNudgeIters?: number;
  onReviewComplete?: (event: ReviewCompleteEvent) => void;
  /**
   * Inject a stand-in for setImmediate; used by tests to await the review
   * synchronously without blocking the main flow in production.
   */
  scheduler?: (cb: () => void) => void;
}

interface ConversationSnapshot {
  messages: NonSystemMessage[];
}

/**
 * BackgroundReviewMiddleware — Hermes-style "agent learning loop".
 *
 * Watches turns and tool iterations. When thresholds trigger it spawns a
 * review pass on a separate, minimal agent (Haiku-tier model) that decides
 * whether to add memory entries or propose new skills. The review never
 * blocks the main agent: setImmediate pushes work off the main path and
 * any failure is swallowed with console.error.
 *
 * Crucial property: the review agent has middlewares=[] to avoid recursion
 * (no review-of-review-of-review).
 */
export class BackgroundReviewMiddleware implements AgentMiddleware {
  private turnsSinceMemory = 0;
  private itersSinceSkill = 0;
  private inFlight: Promise<void> = Promise.resolve();
  /**
   * Drop-not-queue concurrency gate (H3). When a review is already running
   * we skip new triggers entirely instead of chaining them. Without this, a
   * 50-tool-call run can fan out 5 simultaneous reviews against the same
   * provider (GLM), causing 429s under realistic load.
   */
  private busy = false;
  private trace: NonSystemMessage[] = [];

  constructor(private readonly options: BackgroundReviewOptions) {}

  /**
   * Capture every assistant + tool message produced during the run.
   */
  async afterModel(message: AssistantMessage): Promise<AssistantMessage | void> {
    this.trace.push(message);
  }

  async afterToolUse(_toolUse: ToolUseContent, result: string): Promise<void> {
    // Each tool use logs a synthetic tool message into the trace so the
    // reviewer sees both the request and the response.
    const synthetic: ToolMessage = {
      role: 'tool',
      content: [{ type: 'tool_result', toolUseId: _toolUse.id, content: result.slice(0, 1500) }],
    };
    this.trace.push(synthetic);

    this.itersSinceSkill++;
    if (this.itersSinceSkill >= (this.options.skillNudgeIters ?? DEFAULT_SKILL_NUDGE_ITERS)) {
      this.itersSinceSkill = 0;
      this.scheduleReview('skill');
    }
  }

  async afterAgentStep(_step: number): Promise<void> {
    this.turnsSinceMemory++;
    if (this.turnsSinceMemory >= (this.options.memoryNudgeTurns ?? DEFAULT_MEMORY_NUDGE_TURNS)) {
      this.turnsSinceMemory = 0;
      this.scheduleReview('memory');
    }
  }

  /**
   * Wait for any pending background review. Useful for tests; never required
   * in production code.
   */
  flush(): Promise<void> {
    return this.inFlight;
  }

  private scheduleReview(mode: ReviewMode): void {
    const snapshot: ConversationSnapshot = {
      messages: this.trace.slice(-REVIEW_HISTORY_TAIL),
    };
    if (snapshot.messages.length === 0) return;

    // H3: drop the trigger if another review is already in flight. Queueing
    // here would just shift load — we'd still hit the provider 5+ times
    // back-to-back when a long run rolls past multiple thresholds. The next
    // threshold crossing will produce a fresh snapshot anyway, so we lose
    // little by skipping.
    if (this.busy) return;

    this.busy = true;
    const scheduler = this.options.scheduler ?? ((cb) => setImmediate(cb));
    const work = new Promise<void>((resolve) => {
      scheduler(() => {
        this.runReview(mode, snapshot)
          .catch((err) => console.error('[background-review] failed:', err))
          .finally(() => {
            this.busy = false;
            resolve();
          });
      });
    });
    // Chain so flush() awaits the work that we DID let through.
    this.inFlight = this.inFlight.then(() => work);
  }

  private async runReview(mode: ReviewMode, snapshot: ConversationSnapshot): Promise<void> {
    const start = Date.now();
    const memoryTool = createMemoryWriteTool(this.options.memoryStore);
    const skillTool = createSkillCreateTool();
    const tools: FunctionTool<any, any>[] = mode === 'memory' ? [memoryTool] : [skillTool];

    const userExcerpt = renderConversationForReview(snapshot.messages);
    const reviewPrompt = mode === 'memory' ? MEMORY_REVIEW_PROMPT : SKILL_REVIEW_PROMPT;

    const messages: Message[] = [
      { role: 'system', content: [{ type: 'text', text: reviewPrompt }] },
      { role: 'user', content: [{ type: 'text', text: userExcerpt }] },
    ];

    let response: AssistantMessage;
    try {
      response = await withTimeout(
        this.options.provider.invoke({
          model: this.options.reviewModel ?? DEFAULT_REVIEW_MODEL,
          messages,
          tools,
        }),
        REVIEW_TIMEOUT_MS,
      );
    } catch (err: any) {
      this.options.onReviewComplete?.({
        mode,
        ok: false,
        memoriesAdded: 0,
        skillsProposed: 0,
        toolCalls: 0,
        durationMs: Date.now() - start,
        error: err?.message || String(err),
      });
      return;
    }

    let memoriesAdded = 0;
    let skillsProposed = 0;
    let toolCalls = 0;
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      toolCalls++;
      const tool = tools.find((t) => t.name === block.name);
      if (!tool) continue;
      try {
        const result = await tool.invoke(block.input);
        if (typeof result === 'string') {
          if (block.name === 'memory_write' && result.startsWith('OK')) memoriesAdded++;
          if (block.name === 'skill_create' && result.startsWith('skill_create OK')) skillsProposed++;
        }
      } catch (err) {
        console.error('[background-review] tool failed:', err);
      }
    }

    this.options.onReviewComplete?.({
      mode,
      ok: true,
      memoriesAdded,
      skillsProposed,
      toolCalls,
      durationMs: Date.now() - start,
    });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`review timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Compress the recent conversation into a single user-message string the
 * review agent can read. Tool outputs are truncated; thinking blocks are
 * dropped because they balloon token count without changing the verdict.
 *
 * Prompt-injection hardening (H2): every captured string runs through
 * `sanitizeForExcerpt` before being concatenated. We strip the closing
 * `</conversation_excerpt>` tag (so attackers can't end the excerpt early
 * and inject sibling instructions), the literal `<system>` tag (so they
 * can't impersonate the system), and a few common role-play prefixes.
 * The replacement marker `[/redacted]` is kept short and visible so the
 * curator agent can see *that* something was filtered without parsing the
 * payload.
 */
function renderConversationForReview(messages: NonSystemMessage[]): string {
  const lines: string[] = ['<conversation_excerpt>'];
  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = msg.content
        .map((c) => (c.type === 'text' ? c.text : `[${c.type}]`))
        .join(' ');
      lines.push(`USER: ${sanitizeForExcerpt(truncate(text, 600))}`);
    } else if (msg.role === 'assistant') {
      for (const c of msg.content) {
        if (c.type === 'text') lines.push(`ASSISTANT: ${sanitizeForExcerpt(truncate(c.text, 600))}`);
        else if (c.type === 'tool_use') {
          const args = JSON.stringify(c.input).slice(0, 200);
          lines.push(`TOOL_USE(${c.name}): ${sanitizeForExcerpt(args)}`);
        }
      }
    } else if (msg.role === 'tool') {
      for (const c of msg.content) {
        lines.push(`TOOL_RESULT: ${sanitizeForExcerpt(truncate(c.content, 400))}`);
      }
    }
  }
  lines.push('</conversation_excerpt>');
  return lines.join('\n');
}

/**
 * Pattern set tuned for closing-tag attacks against the excerpt wrapper plus
 * a handful of obvious role-impersonation tells. Case-insensitive on the
 * tag/role tokens so `<SYSTEM>` and `<System>` both get scrubbed.
 *
 * Exported for tests in tests/unit/agent/background-review-injection.test.ts.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /<\/conversation_excerpt>/gi,
  /<conversation_excerpt>/gi, // attacker can't pre-open another wrapper
  /<\/?system>/gi,
  /<\|system\|>/gi,
  /\bignore (?:all )?previous instructions\b/gi,
  /\byou are now\b/gi,
];

export function sanitizeForExcerpt(text: string): string {
  let out = text;
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, '[/redacted]');
  }
  return out;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
