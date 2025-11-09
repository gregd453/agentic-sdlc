import semver from 'semver';

/**
 * Version compatibility result
 */
export interface VersionCompatibilityResult {
  compatible: boolean;
  current_version: string;
  required_version: string;
  reason?: string;
  migration_required?: boolean;
  breaking_changes?: string[];
}

/**
 * Version policy configuration
 */
export interface VersionPolicy {
  /**
   * Number of major versions backward compatibility (N-2 policy means 2)
   */
  major_versions_back: number;

  /**
   * Allow minor version updates within same major
   */
  allow_minor_updates: boolean;

  /**
   * Allow patch version updates
   */
  allow_patch_updates: boolean;
}

/**
 * Default N-2 version policy
 * - Current version must support N-2 major versions
 * - Minor and patch updates are allowed
 */
export const DEFAULT_VERSION_POLICY: VersionPolicy = {
  major_versions_back: 2,
  allow_minor_updates: true,
  allow_patch_updates: true
};

/**
 * Version Validator
 * Enforces N-2 backward compatibility policy for schema versions
 */
export class VersionValidator {
  constructor(private policy: VersionPolicy = DEFAULT_VERSION_POLICY) {}

  /**
   * Check if current version is compatible with required version
   * based on the configured policy
   */
  isCompatible(
    currentVersion: string,
    requiredVersion: string
  ): VersionCompatibilityResult {
    // Parse versions
    const current = semver.parse(currentVersion);
    const required = semver.parse(requiredVersion);

    if (!current || !required) {
      return {
        compatible: false,
        current_version: currentVersion,
        required_version: requiredVersion,
        reason: 'Invalid version format. Must follow semver (x.y.z)'
      };
    }

    // Check if versions are equal
    if (semver.eq(current, required)) {
      return {
        compatible: true,
        current_version: currentVersion,
        required_version: requiredVersion
      };
    }

    // Current version is older than required - not compatible
    if (semver.lt(current, required)) {
      return {
        compatible: false,
        current_version: currentVersion,
        required_version: requiredVersion,
        reason: `Current version ${currentVersion} is older than required ${requiredVersion}`,
        migration_required: true
      };
    }

    // Current version is newer - check backward compatibility
    const majorDiff = current.major - required.major;

    // Same major version
    if (majorDiff === 0) {
      const minorDiff = current.minor - required.minor;

      // Minor version updates allowed by policy
      if (this.policy.allow_minor_updates || minorDiff === 0) {
        return {
          compatible: true,
          current_version: currentVersion,
          required_version: requiredVersion
        };
      }

      return {
        compatible: false,
        current_version: currentVersion,
        required_version: requiredVersion,
        reason: `Minor version updates not allowed by policy`
      };
    }

    // Different major versions - check N-2 policy
    if (majorDiff > 0 && majorDiff <= this.policy.major_versions_back) {
      return {
        compatible: true,
        current_version: currentVersion,
        required_version: requiredVersion,
        breaking_changes: this.estimateBreakingChanges(current, required)
      };
    }

    // Major version difference exceeds policy
    return {
      compatible: false,
      current_version: currentVersion,
      required_version: requiredVersion,
      reason: `Major version difference (${majorDiff}) exceeds N-${this.policy.major_versions_back} policy`,
      migration_required: true
    };
  }

  /**
   * Get minimum compatible version based on current version
   */
  getMinimumCompatibleVersion(currentVersion: string): string | null {
    const current = semver.parse(currentVersion);
    if (!current) {
      return null;
    }

    // N-2 policy: minimum major version is (current - N)
    const minMajor = Math.max(0, current.major - this.policy.major_versions_back);

    return `${minMajor}.0.0`;
  }

  /**
   * Get maximum compatible version based on current version
   */
  getMaximumCompatibleVersion(currentVersion: string): string | null {
    const current = semver.parse(currentVersion);
    if (!current) {
      return null;
    }

    // Maximum is the current version itself
    return currentVersion;
  }

  /**
   * Get version range for compatibility
   */
  getCompatibleVersionRange(currentVersion: string): string | null {
    const min = this.getMinimumCompatibleVersion(currentVersion);
    const max = this.getMaximumCompatibleVersion(currentVersion);

    if (!min || !max) {
      return null;
    }

    return `>=${min} <=${max}`;
  }

  /**
   * Validate a list of versions for compatibility
   */
  validateVersionList(
    currentVersion: string,
    versions: string[]
  ): Map<string, VersionCompatibilityResult> {
    const results = new Map<string, VersionCompatibilityResult>();

    for (const version of versions) {
      results.set(version, this.isCompatible(currentVersion, version));
    }

    return results;
  }

  /**
   * Check if migration is needed between versions
   */
  needsMigration(fromVersion: string, toVersion: string): boolean {
    const from = semver.parse(fromVersion);
    const to = semver.parse(toVersion);

    if (!from || !to) {
      return false;
    }

    // Migration needed if major version increased
    return to.major > from.major;
  }

  /**
   * Estimate breaking changes between versions
   * (This is a heuristic - actual breaking changes should be documented)
   */
  private estimateBreakingChanges(
    current: semver.SemVer,
    required: semver.SemVer
  ): string[] {
    const changes: string[] = [];

    const majorDiff = current.major - required.major;

    if (majorDiff > 0) {
      changes.push(`Major version increased by ${majorDiff} (potential breaking changes)`);
    }

    if (majorDiff > 1) {
      changes.push(`Multiple major versions ahead - review migration guide`);
    }

    return changes;
  }

  /**
   * Parse version from schema object
   */
  static parseSchemaVersion(schema: { version?: string }): string | null {
    if (!schema.version) {
      return null;
    }

    const parsed = semver.parse(schema.version);
    return parsed ? parsed.version : null;
  }

  /**
   * Compare two versions
   */
  static compare(version1: string, version2: string): number {
    return semver.compare(version1, version2);
  }

  /**
   * Sort versions in ascending order
   */
  static sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => semver.compare(a, b));
  }

  /**
   * Get latest version from a list
   */
  static getLatestVersion(versions: string[]): string | null {
    if (versions.length === 0) {
      return null;
    }

    const sorted = this.sortVersions(versions);
    return sorted[sorted.length - 1];
  }
}
