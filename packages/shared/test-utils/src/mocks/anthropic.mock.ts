import { vi } from 'vitest';

/**
 * Anthropic Claude API mock for testing AI agent interactions
 */

export interface AnthropicMockOptions {
  defaultResponse?: string;
  errorRate?: number; // 0-1, probability of error
  latencyMs?: number;
  model?: string;
}

export interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: null | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicMock {
  messages: {
    create: any;
  };
  // Test helpers
  setResponse: (response: string | AnthropicMessage) => void;
  setError: (error: Error) => void;
  getCallHistory: () => any[];
  getLastCall: () => any;
  reset: () => void;
}

export function createAnthropicMock(options: AnthropicMockOptions = {}): AnthropicMock {
  const {
    defaultResponse = 'Mock AI response',
    errorRate = 0,
    latencyMs = 10,
    model = 'claude-3-haiku-20240307'
  } = options;

  let customResponse: string | AnthropicMessage | null = null;
  let customError: Error | null = null;
  const callHistory: any[] = [];

  const createMessage = (input: any): AnthropicMessage => {
    // Store call in history
    callHistory.push(input);

    // Check for custom error
    if (customError) {
      throw customError;
    }

    // Simulate random errors based on error rate
    if (Math.random() < errorRate) {
      throw new Error('Anthropic API error (simulated)');
    }

    // Use custom response if set
    if (customResponse) {
      if (typeof customResponse === 'string') {
        return {
          id: `msg-test-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: customResponse
          }],
          model: input.model || model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        };
      }
      return customResponse;
    }

    // Generate response based on input
    const systemPrompt = input.system || '';
    const userMessages = input.messages?.filter((m: any) => m.role === 'user') || [];
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

    // Simulate different responses based on input patterns
    let responseText = defaultResponse;

    if (lastUserMessage.includes('analyze requirements')) {
      responseText = JSON.stringify({
        analysis: 'Requirements analyzed successfully',
        complexity: 'medium',
        recommendations: ['Use TypeScript', 'Add unit tests', 'Implement CI/CD']
      });
    } else if (lastUserMessage.includes('generate code')) {
      responseText = '```typescript\n// Generated code\nexport function hello() {\n  return "Hello, World!";\n}\n```';
    } else if (lastUserMessage.includes('validate')) {
      responseText = JSON.stringify({
        valid: true,
        issues: [],
        suggestions: ['Consider adding more tests']
      });
    } else if (lastUserMessage.includes('resolve conflict')) {
      responseText = JSON.stringify({
        resolution: 'Merged both changes',
        confidence: 0.95,
        explanation: 'Both changes are compatible'
      });
    }

    return {
      id: `msg-test-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: responseText
      }],
      model: input.model || model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: JSON.stringify(input).length / 4, // Rough approximation
        output_tokens: responseText.length / 4
      }
    };
  };

  const mock: AnthropicMock = {
    messages: {
      create: vi.fn(async (input: any) => {
        // Simulate latency
        if (latencyMs > 0) {
          await new Promise(resolve => setTimeout(resolve, latencyMs));
        }

        return createMessage(input);
      })
    },

    // Test helper methods
    setResponse: (response: string | AnthropicMessage) => {
      customResponse = response;
    },

    setError: (error: Error) => {
      customError = error;
    },

    getCallHistory: () => [...callHistory],

    getLastCall: () => callHistory[callHistory.length - 1],

    reset: () => {
      customResponse = null;
      customError = null;
      callHistory.length = 0;
      mock.messages.create.mockClear();
    }
  };

  return mock;
}

// Helper to create a mock Anthropic constructor
export function createAnthropicConstructorMock(options?: AnthropicMockOptions) {
  return vi.fn(() => createAnthropicMock(options));
}

// Pre-configured mocks for common scenarios
export const AnthropicMocks = {
  // Mock that always succeeds with generic response
  success: () => createAnthropicMock({ defaultResponse: 'Task completed successfully' }),

  // Mock that always fails
  failure: () => {
    const mock = createAnthropicMock();
    mock.setError(new Error('API request failed'));
    return mock;
  },

  // Mock with high latency
  slow: () => createAnthropicMock({ latencyMs: 1000 }),

  // Mock with intermittent failures
  flaky: () => createAnthropicMock({ errorRate: 0.3 }),

  // Mock for scaffold agent
  scaffold: () => createAnthropicMock({
    defaultResponse: JSON.stringify({
      structure: {
        directories: ['src', 'tests', 'docs'],
        files: ['package.json', 'tsconfig.json', 'README.md']
      },
      analysis: {
        complexity: 'medium',
        estimatedHours: 8
      }
    })
  }),

  // Mock for validation agent
  validation: () => createAnthropicMock({
    defaultResponse: JSON.stringify({
      valid: true,
      typeErrors: 0,
      lintWarnings: 2,
      coverage: 85.5
    })
  }),

  // Mock for e2e agent
  e2e: () => createAnthropicMock({
    defaultResponse: JSON.stringify({
      tests: [
        {
          name: 'should load homepage',
          type: 'ui',
          steps: ['navigate', 'wait', 'assert']
        }
      ]
    })
  })
};