import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  listPendingSkills,
  confirmPendingSkill,
  rejectPendingSkill,
} from '../../agent/skills/skill-pending';

/**
 * IPC handlers for the agent-proposed skill pending queue.
 *
 * Q3 contract: skill_create writes to ~/.tiny-codex/skills/_pending/.
 * confirmPendingSkill renames the directory into the active skills dir
 * (loaded by createSkillsMiddleware). rejectPendingSkill rm -rf's it.
 *
 * Both confirm/reject are idempotent: invalid names return errors instead
 * of throwing so the renderer can show a stable error state.
 */
export function registerSkillPendingHandlers(): void {
  ipcMain.handle(IPC.SKILL_LIST_PENDING, async () => {
    return listPendingSkills();
  });

  ipcMain.handle(IPC.SKILL_CONFIRM, async (_event, name: string) => {
    return confirmPendingSkill(name);
  });

  ipcMain.handle(IPC.SKILL_REJECT, async (_event, name: string) => {
    return rejectPendingSkill(name);
  });
}
