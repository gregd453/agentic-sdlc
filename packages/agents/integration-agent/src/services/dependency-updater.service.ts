import { promises as fs } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';

const execAsync = promisify(execFile);

/**
 * Package update information
 */
export interface PackageUpdate {
  package_name: string;
  from_version: string;
  to_version: string;
  update_type: 'patch' | 'minor' | 'major';
}

/**
 * DependencyUpdaterService - Manages dependency updates
 * Supports npm, pnpm, and yarn package managers
 */
export class DependencyUpdaterService {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * Update dependencies based on package manager and update type
   */
  async updateDependencies(
    packageManager: 'npm' | 'pnpm' | 'yarn',
    updateType: 'patch' | 'minor' | 'major' | 'all',
    packages?: string[]
  ): Promise<PackageUpdate[]> {
    try {
      // Read current package.json
      const packageJsonPath = join(this.repoPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const beforeVersions = this.extractVersions(packageJson);

      // Perform updates based on package manager
      if (packages && packages.length > 0) {
        // Update specific packages
        await this.updateSpecificPackages(packageManager, packages);
      } else {
        // Update all packages based on type
        await this.updateAllPackages(packageManager, updateType);
      }

      // Read updated package.json
      const updatedContent = await fs.readFile(packageJsonPath, 'utf-8');
      const updatedPackageJson = JSON.parse(updatedContent);
      const afterVersions = this.extractVersions(updatedPackageJson);

      // Calculate what changed
      const updates = this.calculateUpdates(beforeVersions, afterVersions);

      return updates;

    } catch (error) {
      throw new Error(`Failed to update dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update specific packages
   */
  private async updateSpecificPackages(
    packageManager: 'npm' | 'pnpm' | 'yarn',
    packages: string[]
  ): Promise<void> {
    for (const pkg of packages) {
      await this.runPackageManagerCommand(packageManager, ['update', pkg]);
    }
  }

  /**
   * Update all packages based on update type
   */
  private async updateAllPackages(
    packageManager: 'npm' | 'pnpm' | 'yarn',
    updateType: 'patch' | 'minor' | 'major' | 'all'
  ): Promise<void> {
    switch (packageManager) {
      case 'npm':
        await this.updateWithNpm(updateType);
        break;
      case 'pnpm':
        await this.updateWithPnpm(updateType);
        break;
      case 'yarn':
        await this.updateWithYarn(updateType);
        break;
    }
  }

  /**
   * Update using npm
   */
  private async updateWithNpm(_updateType: string): Promise<void> {
    const args = ['update'];

    // npm doesn't have built-in support for update levels, so we use npm-check-updates if available
    // For now, just run npm update
    await this.runPackageManagerCommand('npm', args);
  }

  /**
   * Update using pnpm
   */
  private async updateWithPnpm(updateType: string): Promise<void> {
    const args = ['update'];

    if (updateType !== 'all') {
      // pnpm supports --latest flag for latest versions
      args.push('--latest');
    }

    await this.runPackageManagerCommand('pnpm', args);
  }

  /**
   * Update using yarn
   */
  private async updateWithYarn(updateType: string): Promise<void> {
    const args = ['upgrade'];

    if (updateType === 'all') {
      args.push('--latest');
    }

    await this.runPackageManagerCommand('yarn', args);
  }

  /**
   * Run package manager command
   */
  private async runPackageManagerCommand(
    packageManager: string,
    args: string[]
  ): Promise<void> {
    try {
      await execAsync(packageManager, args, { cwd: this.repoPath });
    } catch (error: any) {
      throw new Error(`Package manager command failed: ${error.message}`);
    }
  }

  /**
   * Extract versions from package.json
   */
  private extractVersions(packageJson: any): Map<string, string> {
    const versions = new Map<string, string>();

    // Extract from dependencies
    if (packageJson.dependencies) {
      for (const [pkg, version] of Object.entries(packageJson.dependencies)) {
        versions.set(pkg, version as string);
      }
    }

    // Extract from devDependencies
    if (packageJson.devDependencies) {
      for (const [pkg, version] of Object.entries(packageJson.devDependencies)) {
        versions.set(pkg, version as string);
      }
    }

    return versions;
  }

  /**
   * Calculate what changed between two version maps
   */
  private calculateUpdates(
    before: Map<string, string>,
    after: Map<string, string>
  ): PackageUpdate[] {
    const updates: PackageUpdate[] = [];

    for (const [pkg, afterVersion] of after.entries()) {
      const beforeVersion = before.get(pkg);

      if (beforeVersion && beforeVersion !== afterVersion) {
        const updateType = this.determineUpdateType(beforeVersion, afterVersion);

        updates.push({
          package_name: pkg,
          from_version: this.cleanVersion(beforeVersion),
          to_version: this.cleanVersion(afterVersion),
          update_type: updateType
        });
      }
    }

    return updates;
  }

  /**
   * Determine update type (patch/minor/major)
   */
  private determineUpdateType(
    fromVersion: string,
    toVersion: string
  ): 'patch' | 'minor' | 'major' {
    const cleanFrom = this.cleanVersion(fromVersion);
    const cleanTo = this.cleanVersion(toVersion);

    const diff = semver.diff(cleanFrom, cleanTo);

    if (diff === 'major' || diff === 'premajor') {
      return 'major';
    } else if (diff === 'minor' || diff === 'preminor') {
      return 'minor';
    } else {
      return 'patch';
    }
  }

  /**
   * Clean version string (remove ^, ~, etc.)
   */
  private cleanVersion(version: string): string {
    return version.replace(/^[\^~>=<]/, '').trim();
  }

  /**
   * Create pull request for dependency updates
   */
  async createPullRequest(
    _updates: PackageUpdate[],
    _updateType: string
  ): Promise<string> {
    // This would typically use GitHub API or gh CLI
    // For now, we'll return a placeholder URL
    // In a real implementation, this would:
    // 1. Create a new branch
    // 2. Commit the changes
    // 3. Push to remote
    // 4. Create PR via GitHub API

    // Placeholder - would actually call GitHub API here
    return `https://github.com/owner/repo/pull/123`;
  }

  /**
   * Generate PR title (unused - for future GitHub integration)
   */
  // @ts-ignore - Will be used when GitHub integration is added
  private generatePRTitle(updates: PackageUpdate[], updateType: string): string {
    if (updates.length === 1) {
      const update = updates[0];
      return `chore(deps): update ${update.package_name} to ${update.to_version}`;
    } else {
      return `chore(deps): ${updateType} dependency updates (${updates.length} packages)`;
    }
  }

  /**
   * Generate PR body with update details (unused - for future GitHub integration)
   */
  // @ts-ignore - Will be used when GitHub integration is added
  private generatePRBody(updates: PackageUpdate[]): string {
    let body = '## Dependency Updates\n\n';
    body += 'This PR contains automated dependency updates.\n\n';
    body += '### Updated Packages\n\n';

    for (const update of updates) {
      body += `- **${update.package_name}**: ${update.from_version} → ${update.to_version} (${update.update_type})\n`;
    }

    body += '\n### Checklist\n\n';
    body += '- [ ] Tests pass\n';
    body += '- [ ] No breaking changes\n';
    body += '- [ ] Changelog updated (if needed)\n';

    return body;
  }
}
