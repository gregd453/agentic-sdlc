import Docker from 'dockerode';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Docker image build options
 */
export interface BuildImageOptions {
  dockerfilePath: string;
  contextPath: string;
  imageName: string;
  imageTag: string;
  buildArgs?: Record<string, string>;
  target?: string;
  cacheFrom?: string[];
  noCache?: boolean;
}

/**
 * Docker image information
 */
export interface ImageInfo {
  imageId: string;
  size: number;
  layers: number;
  warnings: string[];
}

/**
 * Docker push result
 */
export interface PushResult {
  digest: string;
  size?: number;
}

/**
 * DockerService - Manages Docker operations using dockerode
 * Handles image building, pushing, tagging, and registry authentication
 */
export class DockerService {
  private docker: Docker;

  constructor() {
    // Initialize dockerode with default socket
    this.docker = new Docker({
      socketPath: process.platform === 'win32'
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock'
    });
  }

  /**
   * Build Docker image from Dockerfile
   */
  async buildImage(options: BuildImageOptions): Promise<ImageInfo> {
    try {
      const {
        dockerfilePath,
        contextPath,
        imageName,
        imageTag,
        buildArgs,
        target,
        cacheFrom,
        noCache
      } = options;

      const imageFullName = `${imageName}:${imageTag}`;

      // Build options for dockerode
      const buildOptions: any = {
        dockerfile: dockerfilePath,
        t: imageFullName,
        buildargs: buildArgs,
        target,
        cachefrom: cacheFrom,
        nocache: noCache
      };

      // Create build stream
      const stream = await this.docker.buildImage(
        {
          context: contextPath,
          src: ['.']
        },
        buildOptions
      );

      // Follow build progress and capture output
      const warnings: string[] = [];

      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          stream as any,
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          (event: any) => {
            // Capture warnings
            if (event.stream && event.stream.includes('WARN')) {
              warnings.push(event.stream.trim());
            }
          }
        );
      });

      // Get image details
      const image = this.docker.getImage(imageFullName);
      const imageDetails = await image.inspect();

      return {
        imageId: imageDetails.Id,
        size: imageDetails.Size,
        layers: imageDetails.RootFS?.Layers?.length || 0,
        warnings
      };

    } catch (error) {
      throw new Error(`Docker build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Tag a Docker image
   */
  async tagImage(sourceImage: string, targetImage: string): Promise<void> {
    try {
      const image = this.docker.getImage(sourceImage);

      // Parse target image name
      const parts = targetImage.split(':');
      const repo = parts[0];
      const tag = parts[1] || 'latest';

      await image.tag({
        repo,
        tag
      });

    } catch (error) {
      throw new Error(`Failed to tag image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Push image to registry
   */
  async pushImage(imageName: string): Promise<PushResult> {
    try {
      const image = this.docker.getImage(imageName);

      // Create push stream
      const stream = await image.push({});

      // Follow push progress
      let digest = '';

      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          stream as any,
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          (event: any) => {
            // Capture digest
            if (event.aux?.Digest) {
              digest = event.aux.Digest;
            }

            // Check for errors
            if (event.error) {
              reject(new Error(event.error));
            }
          }
        );
      });

      return { digest };

    } catch (error) {
      throw new Error(`Failed to push image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Login to container registry
   */
  async loginToRegistry(
    registry: string,
    username: string,
    password: string
  ): Promise<void> {
    try {
      await this.docker.checkAuth({
        serveraddress: registry,
        username,
        password
      });

    } catch (error) {
      throw new Error(`Failed to login to registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pull image from registry
   */
  async pullImage(imageName: string): Promise<void> {
    try {
      const stream = await this.docker.pull(imageName);

      // Wait for pull to complete
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          stream as any,
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

    } catch (error) {
      throw new Error(`Failed to pull image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all images
   */
  async listImages(): Promise<Array<{
    id: string;
    tags: string[];
    size: number;
    created: number;
  }>> {
    try {
      const images = await this.docker.listImages();

      return images.map(img => ({
        id: img.Id,
        tags: img.RepoTags || [],
        size: img.Size,
        created: img.Created
      }));

    } catch (error) {
      throw new Error(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove image
   */
  async removeImage(imageName: string, force: boolean = false): Promise<void> {
    try {
      const image = this.docker.getImage(imageName);
      await image.remove({ force });

    } catch (error) {
      throw new Error(`Failed to remove image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get image details
   */
  async inspectImage(imageName: string): Promise<any> {
    try {
      const image = this.docker.getImage(imageName);
      return await image.inspect();

    } catch (error) {
      throw new Error(`Failed to inspect image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prune unused images
   */
  async pruneImages(filters?: { dangling?: boolean }): Promise<{
    imagesDeleted: number;
    spaceReclaimed: number;
  }> {
    try {
      const result = await this.docker.pruneImages({
        filters: filters || {}
      });

      return {
        imagesDeleted: result.ImagesDeleted?.length || 0,
        spaceReclaimed: result.SpaceReclaimed || 0
      };

    } catch (error) {
      throw new Error(`Failed to prune images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export image to tar file
   */
  async exportImage(imageName: string, outputPath: string): Promise<void> {
    try {
      const image = this.docker.getImage(imageName);
      const stream = await image.get();

      const writeStream = createWriteStream(outputPath);
      await pipeline(stream, writeStream);

    } catch (error) {
      throw new Error(`Failed to export image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if Docker daemon is accessible
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker version info
   */
  async getVersion(): Promise<{
    version: string;
    apiVersion: string;
    platform: string;
  }> {
    try {
      const info = await this.docker.version();

      return {
        version: info.Version,
        apiVersion: info.ApiVersion,
        platform: `${info.Os}/${info.Arch}`
      };

    } catch (error) {
      throw new Error(`Failed to get Docker version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // dockerode doesn't require explicit cleanup
    // but we can prune dangling images if needed
    try {
      await this.pruneImages({ dangling: true });
    } catch (error) {
      // Silent fail on cleanup
    }
  }
}
