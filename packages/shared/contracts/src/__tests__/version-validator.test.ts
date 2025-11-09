import { describe, it, expect } from 'vitest';
import { VersionValidator, DEFAULT_VERSION_POLICY } from '../version-validator';

describe('VersionValidator', () => {
  const validator = new VersionValidator();

  describe('isCompatible', () => {
    it('should accept identical versions', () => {
      const result = validator.isCompatible('1.0.0', '1.0.0');
      expect(result.compatible).toBe(true);
    });

    it('should accept same major, newer minor version', () => {
      const result = validator.isCompatible('1.2.0', '1.0.0');
      expect(result.compatible).toBe(true);
    });

    it('should accept N-2 major version difference', () => {
      const result = validator.isCompatible('3.0.0', '1.0.0');
      expect(result.compatible).toBe(true);
      expect(result.breaking_changes).toBeDefined();
    });

    it('should reject versions exceeding N-2 policy', () => {
      const result = validator.isCompatible('4.0.0', '1.0.0');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('exceeds N-2 policy');
    });

    it('should reject current version older than required', () => {
      const result = validator.isCompatible('1.0.0', '2.0.0');
      expect(result.compatible).toBe(false);
      expect(result.migration_required).toBe(true);
    });

    it('should reject invalid version formats', () => {
      const result = validator.isCompatible('invalid', '1.0.0');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Invalid version format');
    });

    it('should handle patch version differences', () => {
      const result = validator.isCompatible('1.0.5', '1.0.0');
      expect(result.compatible).toBe(true);
    });
  });

  describe('getMinimumCompatibleVersion', () => {
    it('should return correct minimum version for N-2 policy', () => {
      const min = validator.getMinimumCompatibleVersion('3.5.2');
      expect(min).toBe('1.0.0'); // 3 - 2 = 1
    });

    it('should not go below 0 for major version', () => {
      const min = validator.getMinimumCompatibleVersion('1.0.0');
      expect(min).toBe('0.0.0'); // max(0, 1-2) = 0
    });

    it('should return null for invalid version', () => {
      const min = validator.getMinimumCompatibleVersion('invalid');
      expect(min).toBeNull();
    });
  });

  describe('getCompatibleVersionRange', () => {
    it('should return correct version range', () => {
      const range = validator.getCompatibleVersionRange('3.0.0');
      expect(range).toBe('>=1.0.0 <=3.0.0');
    });

    it('should return null for invalid version', () => {
      const range = validator.getCompatibleVersionRange('invalid');
      expect(range).toBeNull();
    });
  });

  describe('validateVersionList', () => {
    it('should validate multiple versions', () => {
      const results = validator.validateVersionList('3.0.0', [
        '1.0.0', // Compatible (N-2)
        '2.0.0', // Compatible (N-1)
        '3.0.0', // Compatible (same)
        '0.9.0', // Incompatible (exceeds N-2)
        '4.0.0'  // Incompatible (current < required)
      ]);

      expect(results.get('1.0.0')?.compatible).toBe(true);
      expect(results.get('2.0.0')?.compatible).toBe(true);
      expect(results.get('3.0.0')?.compatible).toBe(true);
      expect(results.get('0.9.0')?.compatible).toBe(false);
      expect(results.get('4.0.0')?.compatible).toBe(false);
    });
  });

  describe('needsMigration', () => {
    it('should detect when migration is needed (major version change)', () => {
      expect(validator.needsMigration('1.0.0', '2.0.0')).toBe(true);
    });

    it('should not require migration for minor version changes', () => {
      expect(validator.needsMigration('1.0.0', '1.1.0')).toBe(false);
    });

    it('should not require migration for patch version changes', () => {
      expect(validator.needsMigration('1.0.0', '1.0.1')).toBe(false);
    });

    it('should not require migration for same version', () => {
      expect(validator.needsMigration('1.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should compare versions correctly', () => {
      expect(VersionValidator.compare('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(VersionValidator.compare('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(VersionValidator.compare('1.0.0', '1.0.0')).toBe(0);
    });

    it('should sort versions correctly', () => {
      const versions = ['2.0.0', '1.0.0', '1.5.0', '3.0.0'];
      const sorted = VersionValidator.sortVersions(versions);
      expect(sorted).toEqual(['1.0.0', '1.5.0', '2.0.0', '3.0.0']);
    });

    it('should get latest version', () => {
      const versions = ['1.0.0', '2.5.0', '1.8.0'];
      const latest = VersionValidator.getLatestVersion(versions);
      expect(latest).toBe('2.5.0');
    });

    it('should return null for empty version list', () => {
      const latest = VersionValidator.getLatestVersion([]);
      expect(latest).toBeNull();
    });

    it('should parse schema version', () => {
      const schema = { version: '1.2.3' };
      const version = VersionValidator.parseSchemaVersion(schema);
      expect(version).toBe('1.2.3');
    });

    it('should return null for missing schema version', () => {
      const schema = {};
      const version = VersionValidator.parseSchemaVersion(schema);
      expect(version).toBeNull();
    });
  });

  describe('custom version policy', () => {
    it('should respect custom N-1 policy', () => {
      const customValidator = new VersionValidator({
        major_versions_back: 1,
        allow_minor_updates: true,
        allow_patch_updates: true
      });

      expect(customValidator.isCompatible('2.0.0', '1.0.0').compatible).toBe(true);
      expect(customValidator.isCompatible('3.0.0', '1.0.0').compatible).toBe(false);
    });

    it('should enforce strict minor version policy', () => {
      const strictValidator = new VersionValidator({
        major_versions_back: 2,
        allow_minor_updates: false,
        allow_patch_updates: true
      });

      expect(strictValidator.isCompatible('1.1.0', '1.0.0').compatible).toBe(false);
      expect(strictValidator.isCompatible('1.0.5', '1.0.0').compatible).toBe(true);
    });
  });
});
