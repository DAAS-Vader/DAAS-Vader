import axios, { AxiosInstance } from 'axios';
import { DockerBuilderService } from './dockerBuilderService.js';

interface SecureBuildResponse {
  imageUrl: string;    // 컨테이너 이미지 URL
  buildHash: string;   // 빌드의 SHA256 해시
  attestation: string; // 암호화 증명
}

export class NautilusService {
  private client: AxiosInstance;
  private readonly endpoint: string;
  private dockerBuilder: DockerBuilderService;
  private dockerBuilderEndpoint: string;

  constructor() {
    this.endpoint = process.env.NAUTILUS_ENDPOINT || 'http://localhost:8080';
    this.dockerBuilderEndpoint = process.env.DOCKER_BUILDER_ENDPOINT || 'http://localhost:3001';

    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 300000, // 5분 (빌드 시간 고려)
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DAAS-Vader/1.0'
      }
    });

    // Initialize Docker builder service for local development
    this.dockerBuilder = new DockerBuilderService();
  }

  /**
   * 보안 컨테이너 빌드 요청 (Docker Builder 서버 사용)
   * @param bundleId - Walrus blob ID
   * @param walletAddress - 사용자 지갑 주소
   * @returns 빌드 결과와 암호화 증명
   */
  async secureBuild(bundleId: string, walletAddress: string): Promise<SecureBuildResponse> {
    try {
      console.log('🔒 Nautilus secure build 요청 중... (Docker Builder 사용)');

      // Docker Builder에서 빌드 시작
      const buildId = await this.dockerBuilder.startBuild({
        bundleId,
        buildOptions: {
          platform: 'linux/amd64',
          labels: {
            'wallet': walletAddress,
            'secure': 'true',
            'nautilus': 'true'
          }
        }
      });

      console.log('✅ Docker Builder 빌드 시작:', {
        buildId: buildId
      });

      // 빌드 상태 대기 (간단한 예시)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const buildResult = this.dockerBuilder.getBuildStatus(buildId);

      // Nautilus 형식으로 변환
      return {
        imageUrl: `${this.dockerBuilderEndpoint}/images/${buildId}`,
        buildHash: buildResult?.buildId || buildId,
        attestation: 'pending' // TODO: Nautilus 증명 생성
      };

    } catch (error) {
      console.error('❌ Nautilus 빌드 실패:', error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Docker Builder API 오류: ${error.response.status} - ${error.response.data?.message || error.message}`);
        } else if (error.request) {
          throw new Error('Docker Builder 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
        }
      }

      throw new Error('Nautilus 보안 빌드 중 예상치 못한 오류가 발생했습니다.');
    }
  }

  /**
   * Nautilus 서버 상태 확인
   * @returns 서버 가용 여부
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.warn('⚠️ Nautilus 서버 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 빌드 증명 검증
   * @param attestation - 검증할 증명
   * @param expectedHash - 예상되는 빌드 해시
   * @returns 검증 결과
   */
  async verifyAttestation(attestation: string, expectedHash: string): Promise<boolean> {
    try {
      const response = await this.client.post('/verify-attestation', {
        attestation,
        expectedHash
      });

      return response.data.valid === true;
    } catch (error) {
      console.error('❌ 증명 검증 실패:', error);
      return false;
    }
  }

  /**
   * 빌드 로그 조회
   * @param buildHash - 빌드 해시
   * @returns 빌드 로그
   */
  async getBuildLogs(buildHash: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/build-logs/${buildHash}`);
      return response.data.logs || [];
    } catch (error) {
      console.error('❌ 빌드 로그 조회 실패:', error);
      return [];
    }
  }

  /**
   * Build container using Docker Builder Service
   * @param bundleId - Walrus blob ID containing the code bundle
   * @param walletAddress - User wallet address
   * @param buildOptions - Optional build configuration
   * @returns Build ID for tracking
   */
  async buildWithDockerService(
    bundleId: string,
    walletAddress: string,
    buildOptions?: {
      platform?: string;
      dockerfile?: string;
      buildArgs?: Record<string, string>;
      labels?: Record<string, string>;
      target?: string;
    }
  ): Promise<string> {
    try {
      console.log(`🐳 Starting Docker build for bundle ${bundleId} via Docker Builder Service`);

      // Use local Docker builder service or remote endpoint
      if (process.env.NODE_ENV === 'development' || !process.env.DOCKER_BUILDER_ENDPOINT) {
        // Use local Docker builder service
        const buildId = await this.dockerBuilder.startBuild({
          bundleId,
          buildOptions: {
            ...buildOptions,
            labels: {
              ...buildOptions?.labels,
              'daas.wallet': walletAddress,
              'daas.timestamp': Date.now().toString(),
              'daas.service': 'nautilus-docker-builder'
            }
          }
        });

        console.log(`✅ Docker build started locally with ID: ${buildId}`);
        return buildId;

      } else {
        // Use remote Docker builder service
        const response = await axios.post(`${this.dockerBuilderEndpoint}/api/docker/build`, {
          bundleId,
          buildOptions: {
            ...buildOptions,
            labels: {
              ...buildOptions?.labels,
              'daas.wallet': walletAddress,
              'daas.timestamp': Date.now().toString(),
              'daas.service': 'nautilus-docker-builder'
            }
          }
        }, {
          timeout: 30000, // 30 seconds for build initiation
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DAAS-Vader-Nautilus/1.0'
          }
        });

        if (!response.data.success) {
          throw new Error(`Docker builder service error: ${response.data.message}`);
        }

        console.log(`✅ Docker build started remotely with ID: ${response.data.buildId}`);
        return response.data.buildId;
      }

    } catch (error) {
      console.error('❌ Docker build initiation failed:', error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Docker Builder API error: ${error.response.status} - ${error.response.data?.message || error.message}`);
        } else if (error.request) {
          throw new Error('Cannot connect to Docker Builder Service. Please check if the service is running.');
        }
      }

      throw new Error(`Docker build failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get Docker build status
   * @param buildId - Build ID from buildWithDockerService
   * @returns Build status and logs
   */
  async getDockerBuildStatus(buildId: string): Promise<{
    buildId: string;
    status: 'pending' | 'building' | 'success' | 'failed';
    progress?: number;
    currentStep?: string;
    logs: string[];
    error?: string;
  } | null> {
    try {
      // Use local Docker builder service or remote endpoint
      if (process.env.NODE_ENV === 'development' || !process.env.DOCKER_BUILDER_ENDPOINT) {
        // Use local Docker builder service
        const buildStatus = this.dockerBuilder.getBuildStatus(buildId);
        return buildStatus;

      } else {
        // Use remote Docker builder service
        const response = await axios.get(`${this.dockerBuilderEndpoint}/api/docker/build/${buildId}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'DAAS-Vader-Nautilus/1.0'
          }
        });

        if (!response.data.success) {
          return null;
        }

        return response.data.data;
      }

    } catch (error) {
      console.error('❌ Docker build status check failed:', error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }

      throw new Error(`Failed to get build status: ${(error as Error).message}`);
    }
  }

  /**
   * Push Docker image to registry
   * @param buildId - Build ID from buildWithDockerService
   * @param registry - Registry configuration
   * @returns Registry tag
   */
  async pushDockerImage(
    buildId: string,
    registry: {
      url: string;
      username: string;
      password: string;
      namespace?: string;
    }
  ): Promise<string> {
    try {
      console.log(`📤 Pushing Docker image for build ${buildId}`);

      // Use local Docker builder service or remote endpoint
      if (process.env.NODE_ENV === 'development' || !process.env.DOCKER_BUILDER_ENDPOINT) {
        // Use local Docker builder service
        const registryTag = await this.dockerBuilder.pushImage(buildId, registry);
        console.log(`✅ Image pushed locally: ${registryTag}`);
        return registryTag;

      } else {
        // Use remote Docker builder service
        const response = await axios.post(`${this.dockerBuilderEndpoint}/api/docker/push`, {
          buildId,
          registry
        }, {
          timeout: 300000, // 5 minutes for push
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DAAS-Vader-Nautilus/1.0'
          }
        });

        if (!response.data.success) {
          throw new Error(`Docker push failed: ${response.data.message}`);
        }

        console.log(`✅ Image pushed remotely: ${response.data.registryTag}`);
        return response.data.registryTag;
      }

    } catch (error) {
      console.error('❌ Docker image push failed:', error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Docker push error: ${error.response.status} - ${error.response.data?.message || error.message}`);
        } else if (error.request) {
          throw new Error('Cannot connect to Docker Builder Service for push operation.');
        }
      }

      throw new Error(`Docker push failed: ${(error as Error).message}`);
    }
  }

  /**
   * Cancel active Docker build
   * @param buildId - Build ID to cancel
   * @returns Success status
   */
  async cancelDockerBuild(buildId: string): Promise<boolean> {
    try {
      console.log(`🛑 Cancelling Docker build ${buildId}`);

      // Use local Docker builder service or remote endpoint
      if (process.env.NODE_ENV === 'development' || !process.env.DOCKER_BUILDER_ENDPOINT) {
        // Use local Docker builder service
        const cancelled = await this.dockerBuilder.cancelBuild(buildId);
        return cancelled;

      } else {
        // Use remote Docker builder service
        const response = await axios.delete(`${this.dockerBuilderEndpoint}/api/docker/build/${buildId}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'DAAS-Vader-Nautilus/1.0'
          }
        });

        return response.data.success;
      }

    } catch (error) {
      console.error('❌ Docker build cancellation failed:', error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }

      throw new Error(`Failed to cancel build: ${(error as Error).message}`);
    }
  }

  /**
   * Check Docker Builder Service health
   * @returns Service health status
   */
  async checkDockerBuilderHealth(): Promise<boolean> {
    try {
      // Use local Docker builder service or remote endpoint
      if (process.env.NODE_ENV === 'development' || !process.env.DOCKER_BUILDER_ENDPOINT) {
        // Use local Docker builder service
        return await this.dockerBuilder.healthCheck();

      } else {
        // Use remote Docker builder service
        const response = await axios.get(`${this.dockerBuilderEndpoint}/api/docker/health`, {
          timeout: 5000,
          headers: {
            'User-Agent': 'DAAS-Vader-Nautilus/1.0'
          }
        });

        return response.data.success && response.data.status === 'healthy';
      }

    } catch (error) {
      console.warn('⚠️ Docker Builder Service health check failed:', error);
      return false;
    }
  }
}