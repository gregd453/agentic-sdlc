import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from '../../services/git.service';
import simpleGit from 'simple-git';

// Mock simple-git
vi.mock('simple-git', () => ({
  default: vi.fn()
}));

describe('GitService', () => {
  let gitService: GitService;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      branch: vi.fn().mockResolvedValue(undefined),
      checkout: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({ current: 'main', isClean: () => true }),
      log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      merge: vi.fn().mockResolvedValue({ failed: false }),
      add: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
      diff: vi.fn().mockResolvedValue(''),
      fetch: vi.fn().mockResolvedValue(undefined),
      pull: vi.fn().mockResolvedValue(undefined),
      push: vi.fn().mockResolvedValue(undefined),
      rebase: vi.fn().mockResolvedValue(undefined)
    };

    (simpleGit as any).mockReturnValue(mockGit);
    gitService = new GitService('/tmp/test-repo');
  });

  describe('createBranch', () => {
    it('should create and checkout branch by default', async () => {
      await gitService.createBranch('feature/test');

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('feature/test');
    });

    it('should create branch without checkout', async () => {
      await gitService.createBranch('feature/test', false);

      expect(mockGit.branch).toHaveBeenCalledWith(['feature/test']);
    });

    it('should throw error on failure', async () => {
      mockGit.checkoutLocalBranch.mockRejectedValue(new Error('Branch exists'));

      await expect(gitService.createBranch('feature/test')).rejects.toThrow('Failed to create branch');
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch with -d flag', async () => {
      await gitService.deleteBranch('feature/test');

      expect(mockGit.branch).toHaveBeenCalledWith(['-d', 'feature/test']);
    });

    it('should force delete branch with -D flag', async () => {
      await gitService.deleteBranch('feature/test', true);

      expect(mockGit.branch).toHaveBeenCalledWith(['-D', 'feature/test']);
    });
  });

  describe('mergeBranch', () => {
    beforeEach(() => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        modified: ['file1.ts'],
        created: [],
        deleted: [],
        conflicted: []
      });
    });

    it('should merge branches successfully with standard merge', async () => {
      const result = await gitService.mergeBranch('feature/test', 'main', 'merge');

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(mockGit.checkout).toHaveBeenCalledWith('main');
      expect(mockGit.merge).toHaveBeenCalledWith(['feature/test']);
    });

    it('should handle merge conflicts', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        modified: [],
        created: [],
        deleted: [],
        conflicted: ['src/index.ts']
      });

      vi.spyOn(gitService as any, 'parseConflicts').mockResolvedValue([{
        file_path: 'src/index.ts',
        conflict_markers: { ours: 'code1', theirs: 'code2' },
        conflict_type: 'content'
      }]);

      const result = await gitService.mergeBranch('feature/test', 'main', 'merge');

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should handle squash merge', async () => {
      mockGit.commit.mockResolvedValue(undefined);

      await gitService.mergeBranch('feature/test', 'main', 'squash');

      expect(mockGit.merge).toHaveBeenCalledWith(['--squash', 'feature/test']);
    });

    it('should handle rebase', async () => {
      await gitService.mergeBranch('feature/test', 'main', 'rebase');

      expect(mockGit.rebase).toHaveBeenCalledWith(['feature/test']);
    });

    it('should handle fast-forward merge', async () => {
      await gitService.mergeBranch('feature/test', 'main', 'fast-forward');

      expect(mockGit.merge).toHaveBeenCalledWith(['--ff-only', 'feature/test']);
    });
  });

  describe('getCurrentCommitSha', () => {
    it('should return current commit SHA', async () => {
      const sha = await gitService.getCurrentCommitSha();

      expect(sha).toBe('abc123');
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 1 });
    });

    it('should throw error if no commits', async () => {
      mockGit.log.mockResolvedValue({ latest: null });

      await expect(gitService.getCurrentCommitSha()).rejects.toThrow('No commits found');
    });
  });

  describe('applyResolution', () => {
    it('should write resolved content and stage file', async () => {
      const fs = await import('fs/promises');
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await gitService.applyResolution('src/index.ts', 'resolved code');

      expect(mockGit.add).toHaveBeenCalledWith('src/index.ts');
    });
  });

  describe('createCommit', () => {
    it('should create commit and return SHA', async () => {
      const sha = await gitService.createCommit('Test commit');

      expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
      expect(sha).toBe('abc123');
    });
  });

  describe('resetToCommit', () => {
    it('should reset hard by default', async () => {
      await gitService.resetToCommit('abc123');

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'abc123']);
    });

    it('should reset soft if requested', async () => {
      await gitService.resetToCommit('abc123', false);

      expect(mockGit.reset).toHaveBeenCalledWith(['--soft', 'abc123']);
    });
  });

  describe('hasUncommittedChanges', () => {
    it('should return true if changes exist', async () => {
      mockGit.status.mockResolvedValue({ isClean: () => false });

      const result = await gitService.hasUncommittedChanges();

      expect(result).toBe(true);
    });

    it('should return false if clean', async () => {
      mockGit.status.mockResolvedValue({ isClean: () => true });

      const result = await gitService.hasUncommittedChanges();

      expect(result).toBe(false);
    });
  });
});
