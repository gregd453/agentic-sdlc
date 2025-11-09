import { describe, it, expect } from 'vitest';
import { ContractValidator } from '../contract-validator';
import { scaffoldContract } from '../contracts/scaffold.contract';

describe('Scaffold Agent Contract', () => {
  const validator = new ContractValidator();

  describe('contract definition', () => {
    it('should have valid contract definition', () => {
      const result = validator.validateContractDefinition(scaffoldContract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have correct metadata', () => {
      expect(scaffoldContract.name).toBe('scaffold-agent');
      expect(scaffoldContract.version).toBe('1.0.0');
      expect(scaffoldContract.supported_versions).toContain('1.0.0');
    });

    it('should have input and output schemas defined', () => {
      expect(scaffoldContract.input_schema).toBeDefined();
      expect(scaffoldContract.output_schema).toBeDefined();
    });
  });

  describe('version compatibility', () => {
    it('should support current version', () => {
      expect(scaffoldContract.supported_versions).toContain(scaffoldContract.version);
    });

    it('should have N-2 compatible version list', () => {
      expect(Array.isArray(scaffoldContract.supported_versions)).toBe(true);
      expect(scaffoldContract.supported_versions.length).toBeGreaterThan(0);
    });
  });

  describe('contract completeness', () => {
    it('should have migration support configured', () => {
      expect(scaffoldContract.migrations).toBeDefined();
      expect(scaffoldContract.migrations instanceof Map).toBe(true);
    });

    it('should have breaking changes documentation configured', () => {
      expect(scaffoldContract.breaking_changes).toBeDefined();
      expect(scaffoldContract.breaking_changes instanceof Map).toBe(true);
    });
  });
});
