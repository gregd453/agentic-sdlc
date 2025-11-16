import Anthropic from '@anthropic-ai/sdk';
import { GitConflict, ConflictStrategy } from '../types';

/**
 * Conflict resolution result with AI analysis
 */
export interface ConflictResolution {
  resolved_content: string;
  confidence: number; // 0-100
  reasoning: string;
  strategy_used: ConflictStrategy;
}

/**
 * ConflictResolverService - AI-powered conflict resolution using Claude
 * Analyzes merge conflicts and provides intelligent resolutions
 */
export class ConflictResolverService {
  private anthropic: Anthropic;
  private model: string = 'claude-haiku-4-5-20251001';

  constructor(anthropicClient: Anthropic) {
    this.anthropic = anthropicClient;
  }

  /**
   * Resolve a Git conflict using specified strategy
   */
  async resolveConflict(
    conflict: GitConflict,
    strategy: ConflictStrategy
  ): Promise<ConflictResolution> {
    switch (strategy) {
      case 'ours':
        return this.resolveWithOurs(conflict);

      case 'theirs':
        return this.resolveWithTheirs(conflict);

      case 'ai':
        return this.resolveWithAI(conflict);

      case 'manual':
        return this.markForManualResolution(conflict);

      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`);
    }
  }

  /**
   * Resolve by keeping "ours" (current branch) changes
   */
  private resolveWithOurs(conflict: GitConflict): ConflictResolution {
    return {
      resolved_content: conflict.conflict_markers.ours,
      confidence: 100,
      reasoning: 'Automatically resolved by keeping current branch changes',
      strategy_used: 'ours'
    };
  }

  /**
   * Resolve by keeping "theirs" (incoming branch) changes
   */
  private resolveWithTheirs(conflict: GitConflict): ConflictResolution {
    return {
      resolved_content: conflict.conflict_markers.theirs,
      confidence: 100,
      reasoning: 'Automatically resolved by keeping incoming branch changes',
      strategy_used: 'theirs'
    };
  }

  /**
   * Resolve conflict using AI analysis
   */
  private async resolveWithAI(conflict: GitConflict): Promise<ConflictResolution> {
    try {
      const prompt = this.buildConflictResolutionPrompt(conflict);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.2, // Lower temperature for more deterministic code resolution
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const result = this.parseAIResponse(content.text);

      return {
        resolved_content: result.resolved_content,
        confidence: result.confidence,
        reasoning: result.reasoning,
        strategy_used: 'ai'
      };

    } catch (error) {
      // Fallback to ours if AI resolution fails
      return {
        resolved_content: conflict.conflict_markers.ours,
        confidence: 50,
        reasoning: `AI resolution failed, falling back to 'ours' strategy. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        strategy_used: 'ours'
      };
    }
  }

  /**
   * Mark conflict for manual resolution (low confidence)
   */
  private markForManualResolution(conflict: GitConflict): ConflictResolution {
    return {
      resolved_content: this.formatConflictForManualReview(conflict),
      confidence: 0,
      reasoning: 'Marked for manual resolution - requires human review',
      strategy_used: 'manual'
    };
  }

  /**
   * Build prompt for Claude to resolve conflict
   */
  private buildConflictResolutionPrompt(conflict: GitConflict): string {
    const { file_path, conflict_markers, context } = conflict;

    return `You are a Git conflict resolution expert. Analyze the following merge conflict and provide the best resolution.

File: ${file_path}
Conflict Type: ${conflict.conflict_type}

CURRENT BRANCH (ours):
\`\`\`
${conflict_markers.ours}
\`\`\`

INCOMING BRANCH (theirs):
\`\`\`
${conflict_markers.theirs}
\`\`\`

${context?.surrounding_lines ? `
SURROUNDING CONTEXT:
\`\`\`
${context.surrounding_lines}
\`\`\`
` : ''}

${context?.function_name ? `Function/Method: ${context.function_name}` : ''}

Please analyze this conflict and provide:
1. The resolved code (the best merge of both versions)
2. Your confidence level (0-100) in this resolution
3. A brief explanation of your reasoning

Respond in the following JSON format:
{
  "resolved_content": "the resolved code here",
  "confidence": 85,
  "reasoning": "explanation of the resolution strategy"
}

Guidelines:
- Preserve functionality from both branches when possible
- Maintain code style consistency
- Avoid introducing syntax errors
- Consider the context and purpose of the changes
- If the conflict involves contradictory logic, choose the more recent/incoming change
- If you're uncertain, lower the confidence score accordingly
- DO NOT include conflict markers (<<<<<<, =======, >>>>>>>) in the resolved content`;
  }

  /**
   * Parse AI response from Claude
   */
  private parseAIResponse(responseText: string): {
    resolved_content: string;
    confidence: number;
    reasoning: string;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!parsed.resolved_content || typeof parsed.confidence !== 'number' || !parsed.reasoning) {
        throw new Error('Invalid response structure');
      }

      // Ensure confidence is in valid range
      const confidence = Math.max(0, Math.min(100, parsed.confidence));

      // Clean up resolved content (remove markdown code blocks if present)
      let resolvedContent = parsed.resolved_content.trim();
      resolvedContent = resolvedContent.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');

      return {
        resolved_content: resolvedContent,
        confidence,
        reasoning: parsed.reasoning
      };

    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format conflict with markers for manual review
   */
  private formatConflictForManualReview(conflict: GitConflict): string {
    return `<<<<<<< CURRENT (ours)
${conflict.conflict_markers.ours}
=======
${conflict.conflict_markers.theirs}
>>>>>>> INCOMING (theirs)
`;
  }

  /**
   * Batch resolve multiple conflicts
   */
  async resolveBatch(
    conflicts: GitConflict[],
    strategy: ConflictStrategy
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    // For AI strategy, we can optimize by processing sequentially
    // to avoid rate limits and maintain context
    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, strategy);
      resolutions.push(resolution);

      // Add small delay between AI requests to avoid rate limiting
      if (strategy === 'ai' && conflicts.length > 1) {
        await this.sleep(500);
      }
    }

    return resolutions;
  }

  /**
   * Validate resolved content doesn't contain conflict markers
   */
  validateResolution(resolvedContent: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for conflict markers
    if (resolvedContent.includes('<<<<<<<')) {
      errors.push('Resolved content still contains conflict markers (<<<<<<)');
    }
    if (resolvedContent.includes('>>>>>>>')) {
      errors.push('Resolved content still contains conflict markers (>>>>>>>)');
    }
    if (resolvedContent.includes('=======') && resolvedContent.includes('<<<<<<<')) {
      errors.push('Resolved content still contains conflict markers (=======)');
    }

    // Check for common resolution issues
    if (resolvedContent.trim().length === 0) {
      errors.push('Resolved content is empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get conflict complexity score (for determining if AI should be used)
   */
  analyzeComplexity(conflict: GitConflict): {
    score: number; // 0-100, higher = more complex
    factors: string[];
  } {
    let score = 0;
    const factors: string[] = [];

    const oursLines = conflict.conflict_markers.ours.split('\n').length;
    const theirsLines = conflict.conflict_markers.theirs.split('\n').length;

    // Factor 1: Number of lines in conflict
    const totalLines = oursLines + theirsLines;
    if (totalLines > 50) {
      score += 30;
      factors.push('Large conflict (>50 lines)');
    } else if (totalLines > 20) {
      score += 15;
      factors.push('Medium conflict (>20 lines)');
    }

    // Factor 2: Different line counts (structural changes)
    const lineDiff = Math.abs(oursLines - theirsLines);
    if (lineDiff > 10) {
      score += 20;
      factors.push('Significant structural differences');
    }

    // Factor 3: Conflict type
    if (conflict.conflict_type === 'rename') {
      score += 25;
      factors.push('File rename conflict');
    } else if (conflict.conflict_type === 'delete') {
      score += 30;
      factors.push('File deletion conflict');
    }

    // Factor 4: File type
    const extension = conflict.file_path.split('.').pop()?.toLowerCase();
    if (extension === 'json' || extension === 'yaml' || extension === 'yml') {
      score += 10;
      factors.push('Configuration file (requires careful merging)');
    }

    // Factor 5: Lack of context
    if (!conflict.context?.surrounding_lines) {
      score += 15;
      factors.push('Limited surrounding context');
    }

    return {
      score: Math.min(100, score),
      factors
    };
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
