import simpleGit, { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { join } from 'path';
import { MergeStrategy, GitConflict } from '../types';

/**
 * Git merge result with conflict information
 */
export interface MergeResult {
  success: boolean;
  merge_commit?: string;
  conflicts: GitConflict[];
  files_changed: number;
}

/**
 * GitService - Wrapper around simple-git for version control operations
 * Provides high-level Git operations for branch management, merging, and conflict resolution
 */
export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, checkout: boolean = true): Promise<void> {
    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a branch (local)
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const flag = force ? '-D' : '-d';
      await this.git.branch([flag, branchName]);
    } catch (error) {
      throw new Error(`Failed to delete branch ${branchName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName);
    } catch (error) {
      throw new Error(`Failed to checkout branch ${branchName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || 'HEAD';
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current commit SHA
   */
  async getCurrentCommitSha(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (!log.latest) {
        throw new Error('No commits found in repository');
      }
      return log.latest.hash;
    } catch (error) {
      throw new Error(`Failed to get current commit SHA: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Merge a branch with specified strategy
   */
  async mergeBranch(
    sourceBranch: string,
    targetBranch: string,
    strategy: MergeStrategy = 'merge'
  ): Promise<MergeResult> {
    try {
      // Save current branch
      const currentBranch = await this.getCurrentBranch();

      // Checkout target branch
      await this.checkoutBranch(targetBranch);

      let mergeCommit: string | undefined;

      // Execute merge based on strategy
      switch (strategy) {
        case 'merge':
          // Standard merge (creates merge commit)
          await this.git.merge([sourceBranch]);
          break;

        case 'squash':
          // Squash merge (all commits into one)
          await this.git.merge(['--squash', sourceBranch]);
          // Squash doesn't auto-commit, so we need to commit
          await this.createCommit(`Squash merge ${sourceBranch} into ${targetBranch}`);
          break;

        case 'rebase':
          // Rebase strategy
          await this.git.rebase([sourceBranch]);
          break;

        case 'fast-forward':
          // Fast-forward only
          await this.git.merge(['--ff-only', sourceBranch]);
          break;

        default:
          throw new Error(`Unknown merge strategy: ${strategy}`);
      }

      // Get merge commit SHA if available
      mergeCommit = await this.getCurrentCommitSha();

      // Check for conflicts
      const status = await this.git.status();
      const conflicts = await this.parseConflicts(status.conflicted);

      // Count changed files
      const filesChanged = status.modified.length + status.created.length + status.deleted.length;

      // Restore original branch if merge succeeded and no conflicts
      if (conflicts.length === 0 && currentBranch !== targetBranch) {
        await this.checkoutBranch(currentBranch);
      }

      return {
        success: conflicts.length === 0,
        merge_commit: mergeCommit,
        conflicts,
        files_changed: filesChanged
      };

    } catch (error) {
      // Check if error is due to conflicts
      const status = await this.git.status();
      if (status.conflicted.length > 0) {
        const conflicts = await this.parseConflicts(status.conflicted);
        return {
          success: false,
          conflicts,
          files_changed: status.modified.length + status.created.length + status.deleted.length
        };
      }

      throw new Error(`Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse conflict markers from files
   */
  private async parseConflicts(conflictedFiles: string[]): Promise<GitConflict[]> {
    const conflicts: GitConflict[] = [];

    for (const filePath of conflictedFiles) {
      try {
        const fullPath = join(this.repoPath, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Parse conflict markers
        const conflictRegex = /<<<<<<< (.+?)\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> (.+?)(\n|$)/g;
        let match;

        while ((match = conflictRegex.exec(content)) !== null) {
          const [, , oursContent, theirsContent] = match;

          conflicts.push({
            file_path: filePath,
            conflict_markers: {
              ours: oursContent.trim(),
              theirs: theirsContent.trim()
            },
            conflict_type: 'content',
            context: {
              surrounding_lines: this.extractContext(content, match.index)
            }
          });
        }

        // If no conflict markers found but file is conflicted, it might be a delete/rename conflict
        if (conflicts.length === 0) {
          conflicts.push({
            file_path: filePath,
            conflict_markers: {
              ours: '',
              theirs: ''
            },
            conflict_type: 'delete'
          });
        }

      } catch (error) {
        // File might have been deleted, add as delete conflict
        conflicts.push({
          file_path: filePath,
          conflict_markers: {
            ours: '',
            theirs: ''
          },
          conflict_type: 'delete'
        });
      }
    }

    return conflicts;
  }

  /**
   * Extract surrounding context for better conflict resolution
   */
  private extractContext(content: string, conflictIndex: number): string {
    const lines = content.split('\n');
    let currentPos = 0;
    let lineNum = 0;

    // Find line number of conflict
    for (let i = 0; i < lines.length; i++) {
      if (currentPos >= conflictIndex) {
        lineNum = i;
        break;
      }
      currentPos += lines[i].length + 1; // +1 for newline
    }

    // Get 3 lines before and after
    const startLine = Math.max(0, lineNum - 3);
    const endLine = Math.min(lines.length, lineNum + 10);

    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Apply conflict resolution to a file
   */
  async applyResolution(filePath: string, resolvedContent: string): Promise<void> {
    try {
      const fullPath = join(this.repoPath, filePath);
      await fs.writeFile(fullPath, resolvedContent, 'utf-8');

      // Stage the resolved file
      await this.git.add(filePath);
    } catch (error) {
      throw new Error(`Failed to apply resolution to ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a commit
   */
  async createCommit(message: string): Promise<string> {
    try {
      await this.git.commit(message);
      return await this.getCurrentCommitSha();
    } catch (error) {
      throw new Error(`Failed to create commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset to a specific commit or branch
   */
  async resetToCommit(commitShaOrBranch: string, hard: boolean = true): Promise<void> {
    try {
      const mode = hard ? '--hard' : '--soft';
      await this.git.reset([mode, commitShaOrBranch]);
    } catch (error) {
      throw new Error(`Failed to reset to ${commitShaOrBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of changed files between two commits/branches
   */
  async getChangedFiles(from: string, to: string = 'HEAD'): Promise<string[]> {
    try {
      const diff = await this.git.diff([from, to, '--name-only']);
      return diff.split('\n').filter(f => f.trim().length > 0);
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stage files for commit
   */
  async stageFiles(files: string[]): Promise<void> {
    try {
      await this.git.add(files);
    } catch (error) {
      throw new Error(`Failed to stage files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<{
    modified: string[];
    created: string[];
    deleted: string[];
    conflicted: string[];
    staged: string[];
  }> {
    try {
      const status = await this.git.status();
      return {
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        conflicted: status.conflicted,
        staged: status.staged
      };
    } catch (error) {
      throw new Error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Abort merge in progress
   */
  async abortMerge(): Promise<void> {
    try {
      await this.git.merge(['--abort']);
    } catch (error) {
      throw new Error(`Failed to abort merge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if repository has uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return !status.isClean();
    } catch (error) {
      throw new Error(`Failed to check for uncommitted changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string = 'origin'): Promise<void> {
    try {
      await this.git.fetch(remote);
    } catch (error) {
      throw new Error(`Failed to fetch from ${remote}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pull from remote
   */
  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    try {
      if (branch) {
        await this.git.pull(remote, branch);
      } else {
        await this.git.pull();
      }
    } catch (error) {
      throw new Error(`Failed to pull from ${remote}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Push to remote
   */
  async push(remote: string = 'origin', branch?: string): Promise<void> {
    try {
      if (branch) {
        await this.git.push(remote, branch);
      } else {
        await this.git.push();
      }
    } catch (error) {
      throw new Error(`Failed to push to ${remote}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
