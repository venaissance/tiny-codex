import { spawn } from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export class WorktreeManager {
  constructor(private repoPath: string) {}

  async create(path: string, branch: string): Promise<void> {
    await this.git(['worktree', 'add', '-b', branch, path]);
  }

  async remove(path: string): Promise<void> {
    await this.git(['worktree', 'remove', path, '--force']);
  }

  async list(): Promise<WorktreeInfo[]> {
    const output = await this.git(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.slice('worktree '.length) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice('branch refs/heads/'.length);
      }
    }
    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  }

  async merge(branch: string): Promise<string> {
    return this.git(['merge', branch]);
  }

  private git(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd: this.repoPath, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `git exited with code ${code}`));
      });
    });
  }
}
