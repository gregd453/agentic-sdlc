import fs from 'fs-extra';
import path from 'path';
import type { Logger } from 'pino';
import { GeneratedFile, FileGenerationError } from './types';

/**
 * File generator for safely creating files and directories
 */
export class FileGenerator {
  constructor(private readonly logger: Logger) {}

  /**
   * Create directories with proper error handling
   */
  async createDirectories(directories: string[]): Promise<void> {
    for (const dir of directories) {
      try {
        // Validate path is safe (no parent directory traversal)
        this.validatePath(dir);

        await fs.ensureDir(dir);
        this.logger.debug('Created directory', { path: dir });
      } catch (error) {
        throw new FileGenerationError(
          `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          dir
        );
      }
    }
  }

  /**
   * Create files with proper error handling
   */
  async createFiles(files: GeneratedFile[]): Promise<void> {
    for (const file of files) {
      try {
        // Validate path is safe
        this.validatePath(file.path);

        // Ensure parent directory exists
        const dir = path.dirname(file.path);
        await fs.ensureDir(dir);

        // Write file
        await fs.writeFile(file.path, file.content, 'utf-8');

        this.logger.debug('Created file', {
          path: file.path,
          type: file.type,
          size: file.content.length
        });
      } catch (error) {
        throw new FileGenerationError(
          `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file.path
        );
      }
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      this.validatePath(filePath);
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new FileGenerationError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath
      );
    }
  }

  /**
   * Validate path to prevent directory traversal attacks
   */
  private validatePath(filePath: string): void {
    // Check for parent directory traversal patterns
    if (filePath.includes('..')) {
      throw new FileGenerationError(
        'Invalid path: directory traversal not allowed',
        filePath
      );
    }

    const normalized = path.normalize(filePath);

    // Additional check after normalization
    if (normalized.includes('..')) {
      throw new FileGenerationError(
        'Invalid path: directory traversal not allowed',
        filePath
      );
    }

    // Check for absolute paths outside allowed directories (basic safety)
    // In production, you'd want more sophisticated path validation
    if (path.isAbsolute(normalized)) {
      // Allow absolute paths but log them
      this.logger.warn('Using absolute path', { path: normalized });
    }
  }

  /**
   * Remove directory and all contents (use with caution)
   */
  async removeDirectory(dirPath: string): Promise<void> {
    try {
      this.validatePath(dirPath);
      await fs.remove(dirPath);
      this.logger.debug('Removed directory', { path: dirPath });
    } catch (error) {
      throw new FileGenerationError(
        `Failed to remove directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath
      );
    }
  }

  /**
   * Copy file from source to destination
   */
  async copyFile(source: string, destination: string): Promise<void> {
    try {
      this.validatePath(source);
      this.validatePath(destination);

      await fs.copy(source, destination);
      this.logger.debug('Copied file', { from: source, to: destination });
    } catch (error) {
      throw new FileGenerationError(
        `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source
      );
    }
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath: string): Promise<string[]> {
    try {
      this.validatePath(dirPath);
      const files = await fs.readdir(dirPath);
      return files;
    } catch (error) {
      throw new FileGenerationError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath
      );
    }
  }
}
