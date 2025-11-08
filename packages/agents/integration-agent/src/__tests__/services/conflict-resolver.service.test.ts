import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictResolverService } from '../../services/conflict-resolver.service';
import Anthropic from '@anthropic-ai/sdk';

describe('ConflictResolverService', () => {
  let service: ConflictResolverService;
  let mockAnthropic: any;

  beforeEach(() => {
    mockAnthropic = {
      messages: {
        create: vi.fn()
      }
    };

    service = new ConflictResolverService(mockAnthropic as any);
  });

  describe('resolveConflict', () => {
    const mockConflict = {
      file_path: 'src/index.ts',
      conflict_markers: {
        ours: 'const x = 1;',
        theirs: 'const x = 2;'
      },
      conflict_type: 'content' as const
    };

    it('should resolve with ours strategy', async () => {
      const result = await service.resolveConflict(mockConflict, 'ours');

      expect(result.resolved_content).toBe('const x = 1;');
      expect(result.confidence).toBe(100);
      expect(result.strategy_used).toBe('ours');
    });

    it('should resolve with theirs strategy', async () => {
      const result = await service.resolveConflict(mockConflict, 'theirs');

      expect(result.resolved_content).toBe('const x = 2;');
      expect(result.confidence).toBe(100);
      expect(result.strategy_used).toBe('theirs');
    });

    it('should resolve with AI strategy', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            resolved_content: 'const x = 2; // Updated value',
            confidence: 95,
            reasoning: 'Chose theirs with comment'
          })
        }]
      });

      const result = await service.resolveConflict(mockConflict, 'ai');

      expect(result.resolved_content).toBe('const x = 2; // Updated value');
      expect(result.confidence).toBe(95);
      expect(result.strategy_used).toBe('ai');
    });

    it('should fallback to ours if AI fails', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('API error'));

      const result = await service.resolveConflict(mockConflict, 'ai');

      expect(result.resolved_content).toBe('const x = 1;');
      expect(result.confidence).toBe(50);
      expect(result.strategy_used).toBe('ours');
    });

    it('should mark for manual resolution', async () => {
      const result = await service.resolveConflict(mockConflict, 'manual');

      expect(result.confidence).toBe(0);
      expect(result.strategy_used).toBe('manual');
      expect(result.resolved_content).toContain('<<<<<<< CURRENT');
    });
  });

  describe('validateResolution', () => {
    it('should validate clean resolution', () => {
      const result = service.validateResolution('const x = 2;');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect conflict markers', () => {
      const result = service.validateResolution('<<<<<<< HEAD\nconst x = 1;\n=======\nconst x = 2;\n>>>>>>> main');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty content', () => {
      const result = service.validateResolution('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Resolved content is empty');
    });
  });

  describe('analyzeComplexity', () => {
    it('should score simple conflicts low', () => {
      const conflict = {
        file_path: 'src/index.ts',
        conflict_markers: {
          ours: 'const x = 1;',
          theirs: 'const x = 2;'
        },
        conflict_type: 'content' as const
      };

      const result = service.analyzeComplexity(conflict);

      expect(result.score).toBeLessThan(50);
    });

    it('should score large conflicts high', () => {
      const conflict = {
        file_path: 'src/index.ts',
        conflict_markers: {
          ours: 'line\n'.repeat(60),
          theirs: 'different\n'.repeat(60)
        },
        conflict_type: 'content' as const
      };

      const result = service.analyzeComplexity(conflict);

      expect(result.score).toBeGreaterThan(30);
      expect(result.factors).toContain('Large conflict (>50 lines)');
    });

    it('should score delete conflicts high', () => {
      const conflict = {
        file_path: 'src/index.ts',
        conflict_markers: { ours: '', theirs: '' },
        conflict_type: 'delete' as const
      };

      const result = service.analyzeComplexity(conflict);

      expect(result.score).toBeGreaterThan(20);
      expect(result.factors).toContain('File deletion conflict');
    });
  });
});
