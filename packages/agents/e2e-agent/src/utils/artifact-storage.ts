import fs from 'fs-extra';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'artifact-storage' });

export interface ArtifactStorageOptions {
  storage_type: 'local' | 's3';
  local_path?: string;
  s3_bucket?: string;
  s3_region?: string;
  s3_prefix?: string;
}

export interface StoredArtifact {
  name: string;
  type: 'screenshot' | 'video' | 'trace' | 'report' | 'test';
  path: string;
  url?: string;
  size_bytes: number;
}

/**
 * Artifact storage manager
 */
export class ArtifactStorage {
  private options: ArtifactStorageOptions;

  constructor(options: ArtifactStorageOptions) {
    this.options = options;
  }

  /**
   * Store an artifact
   */
  async store(
    sourcePath: string,
    artifactName: string,
    artifactType: StoredArtifact['type']
  ): Promise<StoredArtifact> {
    if (this.options.storage_type === 'local') {
      return this.storeLocal(sourcePath, artifactName, artifactType);
    } else {
      return this.storeS3(sourcePath, artifactName, artifactType);
    }
  }

  /**
   * Store artifact locally
   */
  private async storeLocal(
    sourcePath: string,
    artifactName: string,
    artifactType: StoredArtifact['type']
  ): Promise<StoredArtifact> {
    const basePath = this.options.local_path || './artifacts';
    const destPath = path.join(basePath, artifactType, artifactName);

    logger.info('Storing artifact locally', {
      source: sourcePath,
      destination: destPath,
      type: artifactType
    });

    try {
      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destPath));

      // Copy file
      await fs.copy(sourcePath, destPath);

      // Get file stats
      const stats = await fs.stat(destPath);

      return {
        name: artifactName,
        type: artifactType,
        path: destPath,
        size_bytes: stats.size
      };
    } catch (error) {
      logger.error('Failed to store artifact locally', { error, source: sourcePath });
      throw error;
    }
  }

  /**
   * Store artifact in S3
   */
  private async storeS3(
    sourcePath: string,
    artifactName: string,
    artifactType: StoredArtifact['type']
  ): Promise<StoredArtifact> {
    // Note: S3 upload would require AWS SDK which we're not including in this implementation
    // This is a placeholder for future implementation
    logger.warn('S3 storage not yet implemented, falling back to local storage');
    return this.storeLocal(sourcePath, artifactName, artifactType);
  }

  /**
   * Store multiple artifacts
   */
  async storeMany(
    artifacts: Array<{ path: string; name: string; type: StoredArtifact['type'] }>
  ): Promise<StoredArtifact[]> {
    const results: StoredArtifact[] = [];

    for (const artifact of artifacts) {
      try {
        const stored = await this.store(artifact.path, artifact.name, artifact.type);
        results.push(stored);
      } catch (error) {
        logger.error('Failed to store artifact', { error, artifact });
      }
    }

    return results;
  }

  /**
   * Store test files
   */
  async storeTestFiles(testFiles: Map<string, string>, outputPath: string): Promise<StoredArtifact[]> {
    const artifacts: StoredArtifact[] = [];

    logger.info('Storing test files', { count: testFiles.size, output_path: outputPath });

    for (const [fileName, content] of testFiles.entries()) {
      const filePath = path.join(outputPath, fileName);

      try {
        // Ensure directory exists
        await fs.ensureDir(path.dirname(filePath));

        // Write file
        await fs.writeFile(filePath, content, 'utf-8');

        // Get file stats
        const stats = await fs.stat(filePath);

        artifacts.push({
          name: fileName,
          type: 'test',
          path: filePath,
          size_bytes: stats.size
        });

        logger.info('Stored test file', { file_name: fileName, size: stats.size });
      } catch (error) {
        logger.error('Failed to store test file', { error, file_name: fileName });
      }
    }

    return artifacts;
  }

  /**
   * Store page object files
   */
  async storePageObjectFiles(
    pageObjectFiles: Map<string, string>,
    outputPath: string
  ): Promise<StoredArtifact[]> {
    const pagesDir = path.join(outputPath, 'pages');
    const artifacts: StoredArtifact[] = [];

    logger.info('Storing page object files', { count: pageObjectFiles.size, output_path: pagesDir });

    for (const [fileName, content] of pageObjectFiles.entries()) {
      const filePath = path.join(pagesDir, fileName);

      try {
        // Ensure directory exists
        await fs.ensureDir(path.dirname(filePath));

        // Write file
        await fs.writeFile(filePath, content, 'utf-8');

        // Get file stats
        const stats = await fs.stat(filePath);

        artifacts.push({
          name: `pages/${fileName}`,
          type: 'test',
          path: filePath,
          size_bytes: stats.size
        });

        logger.info('Stored page object file', { file_name: fileName, size: stats.size });
      } catch (error) {
        logger.error('Failed to store page object file', { error, file_name: fileName });
      }
    }

    return artifacts;
  }

  /**
   * Collect test artifacts from Playwright run
   */
  async collectPlaywrightArtifacts(projectPath: string): Promise<{
    screenshots: StoredArtifact[];
    videos: StoredArtifact[];
    traces: StoredArtifact[];
    reports: StoredArtifact[];
  }> {
    const screenshots: StoredArtifact[] = [];
    const videos: StoredArtifact[] = [];
    const traces: StoredArtifact[] = [];
    const reports: StoredArtifact[] = [];

    // Collect screenshots
    const screenshotsDir = path.join(projectPath, 'test-results');
    if (await fs.pathExists(screenshotsDir)) {
      const files = await this.findFiles(screenshotsDir, /\.png$/);
      for (const file of files) {
        const artifact = await this.store(
          file,
          path.basename(file),
          'screenshot'
        );
        screenshots.push(artifact);
      }
    }

    // Collect videos
    const videosDir = path.join(projectPath, 'test-results');
    if (await fs.pathExists(videosDir)) {
      const files = await this.findFiles(videosDir, /\.webm$/);
      for (const file of files) {
        const artifact = await this.store(
          file,
          path.basename(file),
          'video'
        );
        videos.push(artifact);
      }
    }

    // Collect HTML report
    const reportPath = path.join(projectPath, 'playwright-report', 'index.html');
    if (await fs.pathExists(reportPath)) {
      const artifact = await this.store(reportPath, 'index.html', 'report');
      reports.push(artifact);
    }

    logger.info('Collected Playwright artifacts', {
      screenshots_count: screenshots.length,
      videos_count: videos.length,
      traces_count: traces.length,
      reports_count: reports.length
    });

    return { screenshots, videos, traces, reports };
  }

  /**
   * Find files matching a pattern recursively
   */
  private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const nested = await this.findFiles(fullPath, pattern);
          results.push(...nested);
        } else if (pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      logger.error('Error finding files', { error, dir });
    }

    return results;
  }
}
