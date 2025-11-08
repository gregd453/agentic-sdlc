import {
  ECRClient,
  GetAuthorizationTokenCommand,
  CreateRepositoryCommand,
  DescribeRepositoriesCommand,
  PutLifecyclePolicyCommand,
  ListImagesCommand,
  BatchDeleteImageCommand,
  DescribeImagesCommand,
  ImageIdentifier
} from '@aws-sdk/client-ecr';

/**
 * ECR authorization token
 */
export interface ECRAuthToken {
  username: string;
  password: string;
  endpoint: string;
  expiresAt: Date;
}

/**
 * ECR repository lifecycle policy
 */
export interface LifecyclePolicy {
  rules: Array<{
    rulePriority: number;
    description: string;
    selection: {
      tagStatus: 'tagged' | 'untagged' | 'any';
      countType: 'imageCountMoreThan' | 'sinceImagePushed';
      countNumber: number;
    };
    action: {
      type: 'expire';
    };
  }>;
}

/**
 * ECRService - AWS Elastic Container Registry operations
 * Handles repository management, authentication, and image lifecycle
 */
export class ECRService {
  private client: ECRClient;

  constructor(region: string = 'us-east-1') {
    this.client = new ECRClient({ region });
  }

  /**
   * Get ECR authorization token for Docker login
   */
  async getAuthorizationToken(): Promise<ECRAuthToken> {
    try {
      const command = new GetAuthorizationTokenCommand({});
      const response = await this.client.send(command);

      const authData = response.authorizationData?.[0];
      if (!authData) {
        throw new Error('No authorization data returned from ECR');
      }

      // Decode base64 token
      const token = Buffer.from(authData.authorizationToken!, 'base64').toString('utf-8');
      const [username, password] = token.split(':');

      return {
        username,
        password,
        endpoint: authData.proxyEndpoint!,
        expiresAt: authData.expiresAt!
      };

    } catch (error) {
      throw new Error(`Failed to get ECR authorization token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create repository if it doesn't exist
   */
  async createRepositoryIfNotExists(
    repositoryName: string,
    lifecyclePolicy?: LifecyclePolicy
  ): Promise<string> {
    try {
      // Check if repository exists
      const exists = await this.repositoryExists(repositoryName);

      if (exists) {
        return await this.getRepositoryUri(repositoryName);
      }

      // Create repository
      const command = new CreateRepositoryCommand({
        repositoryName,
        imageScanningConfiguration: {
          scanOnPush: true
        },
        imageTagMutability: 'MUTABLE'
      });

      const response = await this.client.send(command);
      const repositoryUri = response.repository?.repositoryUri;

      if (!repositoryUri) {
        throw new Error('Failed to create repository - no URI returned');
      }

      // Apply lifecycle policy if provided
      if (lifecyclePolicy) {
        await this.putLifecyclePolicy(repositoryName, lifecyclePolicy);
      }

      return repositoryUri;

    } catch (error) {
      throw new Error(`Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(repositoryName: string): Promise<boolean> {
    try {
      const command = new DescribeRepositoriesCommand({
        repositoryNames: [repositoryName]
      });

      await this.client.send(command);
      return true;

    } catch (error: any) {
      if (error.name === 'RepositoryNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get repository URI
   */
  async getRepositoryUri(repositoryName: string): Promise<string> {
    try {
      const command = new DescribeRepositoriesCommand({
        repositoryNames: [repositoryName]
      });

      const response = await this.client.send(command);
      const repository = response.repositories?.[0];

      if (!repository?.repositoryUri) {
        throw new Error(`Repository ${repositoryName} not found`);
      }

      return repository.repositoryUri;

    } catch (error) {
      throw new Error(`Failed to get repository URI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Put lifecycle policy on repository
   */
  async putLifecyclePolicy(
    repositoryName: string,
    policy: LifecyclePolicy
  ): Promise<void> {
    try {
      const command = new PutLifecyclePolicyCommand({
        repositoryName,
        lifecyclePolicyText: JSON.stringify(policy)
      });

      await this.client.send(command);

    } catch (error) {
      throw new Error(`Failed to put lifecycle policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List images in repository
   */
  async listImages(repositoryName: string): Promise<Array<{
    imageDigest: string;
    imageTags: string[];
    pushedAt?: Date;
  }>> {
    try {
      const command = new ListImagesCommand({
        repositoryName
      });

      const response = await this.client.send(command);

      return (response.imageIds || []).map(img => ({
        imageDigest: img.imageDigest || '',
        imageTags: img.imageTag ? [img.imageTag] : [],
        pushedAt: undefined
      }));

    } catch (error) {
      throw new Error(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Describe images with detailed information
   */
  async describeImages(
    repositoryName: string,
    imageIds?: ImageIdentifier[]
  ): Promise<Array<{
    imageDigest: string;
    imageTags: string[];
    imageSizeInBytes: number;
    pushedAt: Date;
  }>> {
    try {
      const command = new DescribeImagesCommand({
        repositoryName,
        imageIds
      });

      const response = await this.client.send(command);

      return (response.imageDetails || []).map(img => ({
        imageDigest: img.imageDigest || '',
        imageTags: img.imageTags || [],
        imageSizeInBytes: img.imageSizeInBytes || 0,
        pushedAt: img.imagePushedAt!
      }));

    } catch (error) {
      throw new Error(`Failed to describe images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete images from repository
   */
  async deleteImages(
    repositoryName: string,
    imageIds: ImageIdentifier[]
  ): Promise<number> {
    try {
      const command = new BatchDeleteImageCommand({
        repositoryName,
        imageIds
      });

      const response = await this.client.send(command);

      return response.imageIds?.length || 0;

    } catch (error) {
      throw new Error(`Failed to delete images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete old images based on age or count
   */
  async deleteOldImages(
    repositoryName: string,
    keepCount: number = 10
  ): Promise<number> {
    try {
      // Get all images sorted by push date
      const images = await this.describeImages(repositoryName);

      // Sort by push date (newest first)
      images.sort((a, b) => b.pushedAt.getTime() - a.pushedAt.getTime());

      // Keep only the latest N images
      const imagesToDelete = images.slice(keepCount);

      if (imagesToDelete.length === 0) {
        return 0;
      }

      // Delete old images
      const imageIds: ImageIdentifier[] = imagesToDelete.map(img => ({
        imageDigest: img.imageDigest
      }));

      return await this.deleteImages(repositoryName, imageIds);

    } catch (error) {
      throw new Error(`Failed to delete old images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account ID from authorization token
   */
  async getAccountId(): Promise<string> {
    try {
      const authToken = await this.getAuthorizationToken();
      // Extract account ID from endpoint
      // Format: https://{account-id}.dkr.ecr.{region}.amazonaws.com
      const match = authToken.endpoint.match(/https:\/\/(\d+)\.dkr\.ecr/);

      if (!match) {
        throw new Error('Failed to extract account ID from endpoint');
      }

      return match[1];

    } catch (error) {
      throw new Error(`Failed to get account ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
