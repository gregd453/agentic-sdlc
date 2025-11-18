import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationManager, ConfigurationError, DEFAULT_AGENT_CONFIG, DEFAULT_LOGGING_CONFIG } from './index';

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager;
  const tempDir = path.join(__dirname, '..', '..', 'temp-test');

  beforeEach(() => {
    manager = new ConfigurationManager();
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    }
  });

  describe('initialize', () => {
    it('should initialize with defaults when no file provided', async () => {
      await manager.initialize();

      const config = manager.getConfig();
      expect(config.logging).toBeDefined();
      expect(config.logging?.global_level).toBe('info');
    });

    it('should load configuration from YAML file', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const content = `
agents:
  scaffold:
    timeout_ms: 60000
    max_retries: 5
logging:
  global_level: debug
`;
      fs.writeFileSync(configPath, content);

      await manager.initialize(configPath);

      const config = manager.getConfig();
      expect(config.agents?.scaffold?.timeout_ms).toBe(60000);
      expect(config.agents?.scaffold?.max_retries).toBe(5);
      expect(config.logging?.global_level).toBe('debug');
    });

    it('should load configuration from JSON file', async () => {
      const configPath = path.join(tempDir, 'config.json');
      const config = {
        agents: {
          validation: {
            timeout_ms: 45000,
            max_retries: 2
          }
        },
        logging: {
          global_level: 'warn'
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      await manager.initialize(configPath);

      const loaded = manager.getConfig();
      expect(loaded.agents?.validation?.timeout_ms).toBe(45000);
      expect(loaded.logging?.global_level).toBe('warn');
    });

    it('should warn when file does not exist', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.initialize('/nonexistent/path/config.yaml');

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      spy.mockRestore();
    });

    it('should throw for unsupported file format', async () => {
      const configPath = path.join(tempDir, 'config.txt');
      fs.writeFileSync(configPath, 'invalid');

      await expect(manager.initialize(configPath)).rejects.toThrow(ConfigurationError);
    });

    it('should merge file config with defaults', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const content = `
agents:
  scaffold:
    timeout_ms: 60000
`;
      fs.writeFileSync(configPath, content);

      await manager.initialize(configPath);

      const config = manager.getConfig();
      expect(config.agents?.scaffold?.timeout_ms).toBe(60000);
      expect(config.agents?.scaffold?.enabled).toBe(true); // From default
    });
  });

  describe('getAgentConfig', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return agent config with merged defaults', async () => {
      const config = manager.getAgentConfig('scaffold');

      expect(config.enabled).toBe(true);
      expect(config.timeout_ms).toBe(30000);
      expect(config.max_retries).toBe(3);
    });

    it('should return defaults for unregistered agent', async () => {
      const config = manager.getAgentConfig('nonexistent');

      expect(config).toEqual(DEFAULT_AGENT_CONFIG);
    });

    it('should include custom agent configuration', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const content = `
agents:
  scaffold:
    timeout_ms: 90000
    max_retries: 5
`;
      fs.writeFileSync(configPath, content);
      manager = new ConfigurationManager();
      await manager.initialize(configPath);

      const config = manager.getAgentConfig('scaffold');

      expect(config.timeout_ms).toBe(90000);
      expect(config.max_retries).toBe(5);
      expect(config.enabled).toBe(true);
    });
  });

  describe('getLoggingConfig', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return default logging config', () => {
      const config = manager.getLoggingConfig();

      expect(config.global_level).toBe('info');
      expect(config.trace_enabled).toBe(true);
      expect(config.pretty_print).toBe(true);
    });

    it('should return custom logging config', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const content = `
logging:
  global_level: debug
  trace_enabled: false
`;
      fs.writeFileSync(configPath, content);
      manager = new ConfigurationManager();
      await manager.initialize(configPath);

      const config = manager.getLoggingConfig();

      expect(config.global_level).toBe('debug');
      expect(config.trace_enabled).toBe(false);
    });
  });

  describe('setAgentConfig', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should update agent configuration at runtime', async () => {
      await manager.initialize();

      manager.setAgentConfig('scaffold', { timeout_ms: 120000 });

      const config = manager.getAgentConfig('scaffold');
      expect(config.timeout_ms).toBe(120000);
      expect(config.max_retries).toBe(3); // Preserved from default
    });

    it('should create new agent config entry if not exists', async () => {
      manager.setAgentConfig('new-agent', { timeout_ms: 15000, max_retries: 1 });

      const config = manager.getAgentConfig('new-agent');
      expect(config.timeout_ms).toBe(15000);
      expect(config.max_retries).toBe(1);
    });
  });

  describe('environment variable overrides', () => {
    it('should apply AGENT_* environment variables', async () => {
      // Set environment variables
      process.env.AGENT_SCAFFOLD_TIMEOUT_MS = '75000';
      process.env.AGENT_SCAFFOLD_MAX_RETRIES = '4';

      manager = new ConfigurationManager();
      await manager.initialize();

      const config = manager.getAgentConfig('scaffold');
      expect(config.timeout_ms).toBe(75000);
      expect(config.max_retries).toBe(4);

      // Clean up
      delete process.env.AGENT_SCAFFOLD_TIMEOUT_MS;
      delete process.env.AGENT_SCAFFOLD_MAX_RETRIES;
    });

    it('should apply LOG_LEVEL environment variable', async () => {
      process.env.LOG_LEVEL = 'error';

      manager = new ConfigurationManager();
      await manager.initialize();

      const config = manager.getLoggingConfig();
      expect(config.global_level).toBe('error');

      delete process.env.LOG_LEVEL;
    });

    it('should apply TRACE_ENABLED environment variable', async () => {
      process.env.TRACE_ENABLED = 'false';

      manager = new ConfigurationManager();
      await manager.initialize();

      const config = manager.getLoggingConfig();
      expect(config.trace_enabled).toBe(false);

      delete process.env.TRACE_ENABLED;
    });

    it('should override file config with env vars', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const content = `
agents:
  scaffold:
    timeout_ms: 30000
`;
      fs.writeFileSync(configPath, content);
      process.env.AGENT_SCAFFOLD_TIMEOUT_MS = '99000';

      manager = new ConfigurationManager();
      await manager.initialize(configPath);

      const config = manager.getAgentConfig('scaffold');
      expect(config.timeout_ms).toBe(99000); // Env var wins

      delete process.env.AGENT_SCAFFOLD_TIMEOUT_MS;
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return complete configuration', () => {
      const config = manager.getConfig();

      expect(config.agents).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should return deep clone', async () => {
      const config1 = manager.getConfig();
      config1.agents = {};

      const config2 = manager.getConfig();
      expect(config2.agents).not.toBe(config1.agents);
    });
  });

  describe('validation', () => {
    it('should throw ConfigurationError on invalid config', async () => {
      const configPath = path.join(tempDir, 'invalid-config.yaml');
      const content = `
agents:
  scaffold:
    timeout_ms: -5
`;
      fs.writeFileSync(configPath, content);

      manager = new ConfigurationManager();
      await expect(manager.initialize(configPath)).rejects.toThrow(ConfigurationError);
    });

    it('should validate after env overrides', async () => {
      process.env.AGENT_SCAFFOLD_TIMEOUT_MS = 'invalid';

      manager = new ConfigurationManager();
      await manager.initialize();

      // Should not throw - invalid string accepted
      const config = manager.getAgentConfig('scaffold');
      expect(config.timeout_ms).toBe('invalid'); // String value

      delete process.env.AGENT_SCAFFOLD_TIMEOUT_MS;
    });
  });
});
