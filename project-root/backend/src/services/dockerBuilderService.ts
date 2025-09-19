import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import * as tar from 'tar';
import { walrusService } from './walrusService.js';
import { ServiceError } from '../types/index.js';

interface BuildRequest {
  bundleId: string;     // Walrus blob ID
  buildOptions?: {
    platform?: string;   // 예: 'linux/amd64'
    dockerfile?: string; // 사용자 정의 Dockerfile 경로
    buildArgs?: Record<string, string>; // 빌드 인수
    labels?: Record<string, string>;    // 이미지 라벨
    target?: string;     // 멀티 스테이지 빌드 타겟
  };
  registry?: {
    url: string;        // 레지스트리 URL
    username: string;   // 사용자명
    password: string;   // 비밀번호
    namespace?: string; // 네임스페이스
  };
}

interface BuildResult {
  buildId: string;    // 빌드 ID
  imageId: string;    // Docker 이미지 ID
  imageTag: string;   // 이미지 태그
  size: number;       // 이미지 크기 (바이트)
  status: 'pending' | 'building' | 'success' | 'failed'; // 빌드 상태
  logs: string[];     // 빌드 로그
  startTime: Date;    // 시작 시간
  endTime?: Date;     // 종료 시간
  error?: string;     // 오류 메시지
}

interface BuildStatus {
  buildId: string;    // 빌드 ID
  status: 'pending' | 'building' | 'success' | 'failed'; // 빌드 상태
  progress?: number;  // 진행률 (0-100)
  currentStep?: string; // 현재 단계
  logs: string[];     // 빌드 로그
  error?: string;     // 오류 메시지
}

export class DockerBuilderService {
  // Use Walrus SDK service for consistency
  private buildDirectory: string;            // 빌드 작업 디렉토리
  private builds: Map<string, BuildResult> = new Map(); // 빌드 결과 저장소
  private activeBuilds: Map<string, ChildProcess> = new Map(); // 활성 빌드 프로세스
  private maxConcurrentBuilds: number;       // 최대 동시 빌드 수
  private buildTimeout: number;              // 빌드 타임아웃 (ms)

  constructor() {
    // Use walrusService singleton
    this.buildDirectory = process.env.DOCKER_BUILD_DIR || '/tmp/docker-builds';
    this.maxConcurrentBuilds = parseInt(process.env.MAX_CONCURRENT_BUILDS || '3', 10);
    this.buildTimeout = parseInt(process.env.BUILD_TIMEOUT || '600', 10) * 1000; // 기본 10분

    this.initializeBuildDirectory();
    this.setupCleanupJob();
  }

  /**
   * 빌드 디렉토리 초기화
   */
  private async initializeBuildDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.buildDirectory, { recursive: true });
      console.log(`🏗️ Docker 빌드 디렉토리 초기화 완료: ${this.buildDirectory}`);
    } catch (error) {
      console.error('빌드 디렉토리 초기화 실패:', error);
      throw new ServiceError('Docker 빌더 초기화 실패', 500);
    }
  }

  /**
   * 오래된 빌드 아티팩트 정리 작업 설정
   */
  private setupCleanupJob(): void {
    // 매시간 오래된 빌드 정리
    setInterval(() => {
      this.cleanupOldBuilds();
    }, 60 * 60 * 1000);
  }

  /**
   * Walrus 번들로부터 Docker 빌드 시작
   */
  async startBuild(request: BuildRequest): Promise<string> {
    // 동시 빌드 수 제한 확인
    if (this.activeBuilds.size >= this.maxConcurrentBuilds) {
      throw new ServiceError('동시 빌드 수가 너무 많습니다. 나중에 다시 시도해주세요.', 429);
    }

    const buildId = this.generateBuildId();
    const buildPath = path.join(this.buildDirectory, buildId);

    console.log(`🔨 번들 ${request.bundleId}에 대한 Docker 빌드 ${buildId} 시작`);

    try {
      // 빌드 레코드 초기화
      const buildResult: BuildResult = {
        buildId,
        imageId: '',
        imageTag: `daas-app:${buildId}`,
        size: 0,
        status: 'pending',
        logs: [],
        startTime: new Date()
      };
      this.builds.set(buildId, buildResult);

      // 번들 다운로드 및 압축 해제
      await this.prepareBuildContext(buildPath, request.bundleId);

      // Dockerfile 생성 또는 검증
      await this.ensureDockerfile(buildPath, request.buildOptions);

      // 실제 빌드 실행
      await this.executeBuild(buildId, buildPath, request);

      return buildId;

    } catch (error) {
      console.error(`❌ 빌드 ${buildId} 준비 실패:`, error);

      const buildResult = this.builds.get(buildId);
      if (buildResult) {
        buildResult.status = 'failed';
        buildResult.error = (error as Error).message;
        buildResult.endTime = new Date();
      }

      // 실패 시 정리
      await this.cleanupBuildDirectory(buildPath);

      throw error;
    }
  }

  /**
   * 빌드 상태 및 로그 조회
   */
  getBuildStatus(buildId: string): BuildStatus | null {
    const build = this.builds.get(buildId);
    if (!build) {
      return null;
    }

    const isActive = this.activeBuilds.has(buildId);
    const progress = this.calculateBuildProgress(build);

    return {
      buildId: build.buildId,
      status: build.status,
      progress,
      currentStep: this.getCurrentBuildStep(build),
      logs: build.logs,
      error: build.error
    };
  }

  /**
   * 빌드된 이미지를 레지스트리에 푸시
   */
  async pushImage(buildId: string, registry: BuildRequest['registry']): Promise<string> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new ServiceError('Build not found', 404);
    }

    if (build.status !== 'success') {
      throw new ServiceError('Build has not completed successfully', 400);
    }

    if (!registry) {
      throw new ServiceError('Registry configuration required', 400);
    }

    console.log(`📤 Pushing image ${build.imageTag} to registry ${registry.url}`);

    try {
      // 레지스트리 로그인
      await this.dockerLogin(registry);

      // 레지스트리용 이미지 태그
      const registryTag = this.generateRegistryTag(build.imageTag, registry);
      await this.dockerTag(build.imageId, registryTag);

      // 레지스트리에 푸시
      await this.dockerPush(registryTag);

      console.log(`✅ Image pushed successfully: ${registryTag}`);
      return registryTag;

    } catch (error) {
      console.error(`❌ Failed to push image ${build.imageTag}:`, error);
      throw new ServiceError(`Failed to push image: ${(error as Error).message}`, 500);
    }
  }

  /**
   * 활성 빌드 취소
   */
  async cancelBuild(buildId: string): Promise<boolean> {
    const activeProcess = this.activeBuilds.get(buildId);
    const build = this.builds.get(buildId);

    if (!build) {
      return false;
    }

    if (activeProcess) {
      console.log(`🛑 Canceling build ${buildId}`);
      activeProcess.kill('SIGTERM');
      this.activeBuilds.delete(buildId);
    }

    if (build.status === 'building' || build.status === 'pending') {
      build.status = 'failed';
      build.error = 'Build cancelled by user';
      build.endTime = new Date();
    }

    // Cleanup build directory
    const buildPath = path.join(this.buildDirectory, buildId);
    await this.cleanupBuildDirectory(buildPath);

    return true;
  }

  /**
   * Walrus에서 번들 다운로드 및 압축 해제
   */
  private async prepareBuildContext(buildPath: string, bundleId: string): Promise<void> {
    console.log(`📥 Downloading bundle ${bundleId} from Walrus`);
    
    // 빌드 디렉토리 생성
    await fs.mkdir(buildPath, { recursive: true });

    // Walrus에서 번들 다운로드
    const bundleData = await walrusService.downloadBundle(bundleId);
    
    // tar.gz 번들 압축 해제
    const extractPath = path.join(buildPath, 'src');
    await fs.mkdir(extractPath, { recursive: true });
    
    return new Promise((resolve, reject) => {
      const stream = tar.extract({
        cwd: extractPath,
        strict: true,
        newer: true
      });

      stream.on('error', reject);
      stream.on('end', () => {
        console.log(`✅ Bundle extracted to ${extractPath}`);
        resolve();
      });

      stream.write(bundleData);
      stream.end();
    });
  }

  /**
   * Dockerfile 존재 확인 또는 생성
   */
  private async ensureDockerfile(buildPath: string, buildOptions?: BuildRequest['buildOptions']): Promise<void> {
    const srcPath = path.join(buildPath, 'src');
    const dockerfilePath = buildOptions?.dockerfile 
      ? path.join(srcPath, buildOptions.dockerfile)
      : path.join(srcPath, 'Dockerfile');

    try {
      // Dockerfile이 이미 존재하는지 확인
      await fs.access(dockerfilePath);
      console.log(`📄 Using existing Dockerfile: ${dockerfilePath}`);
    } catch {
      // 프로젝트 타입을 기반으로 Dockerfile 생성
      console.log(`🔧 Generating Dockerfile for project`);
      const dockerfile = await this.generateDockerfile(srcPath);
      await fs.writeFile(dockerfilePath, dockerfile, 'utf8');
      console.log(`✅ Generated Dockerfile: ${dockerfilePath}`);
    }
  }

  /**
   * 프로젝트 타입 감지를 기반으로 Dockerfile 생성
   */
  private async generateDockerfile(projectPath: string): Promise<string> {
    const files = await fs.readdir(projectPath);
    
    // 프로젝트 타입 감지
    if (files.includes('package.json')) {
      return this.generateNodeDockerfile(projectPath);
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      return this.generatePythonDockerfile(projectPath);
    } else if (files.includes('go.mod')) {
      return this.generateGoDockerfile();
    } else if (files.includes('Cargo.toml')) {
      return this.generateRustDockerfile();
    } else if (files.includes('pom.xml') || files.includes('build.gradle')) {
      return this.generateJavaDockerfile();
    } else {
      // 일반적인 Dockerfile
      return this.generateGenericDockerfile();
    }
  }

  /**
   * Node.js Dockerfile 생성
   */
  private async generateNodeDockerfile(projectPath: string): Promise<string> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf8')
      );
      
      const nodeVersion = packageJson.engines?.node || '18';
      const startScript = packageJson.scripts?.start || 'node index.js';
      
      return `# Auto-generated Dockerfile for Node.js application
FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build if build script exists
${packageJson.scripts?.build ? 'RUN npm run build' : ''}

# Expose port (default to 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
`;
    } catch {
      return this.generateGenericNodeDockerfile();
    }
  }

  /**
   * Python Dockerfile 생성
   */
  private generatePythonDockerfile(projectPath: string): Promise<string> {
    return Promise.resolve(`# Auto-generated Dockerfile for Python application
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt* pyproject.toml* ./

# Install Python dependencies
RUN if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
RUN if [ -f pyproject.toml ]; then pip install .; fi

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "app.py"]
`);
  }

  /**
   * Go Dockerfile 생성
   */
  private generateGoDockerfile(): Promise<string> {
    return Promise.resolve(`# Auto-generated Dockerfile for Go application
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production image
FROM alpine:latest
RUN apk --no-cache add ca-certificates curl
WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["./main"]
`);
  }

  /**
   * Rust Dockerfile 생성
   */
  private generateRustDockerfile(): Promise<string> {
    return Promise.resolve(`# Auto-generated Dockerfile for Rust application
FROM rust:1.70 AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

COPY src ./src
RUN touch src/main.rs
RUN cargo build --release

# Production image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/app /usr/local/bin/app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["app"]
`);
  }

  /**
   * Java Dockerfile 생성
   */
  private generateJavaDockerfile(): Promise<string> {
    return Promise.resolve(`# Auto-generated Dockerfile for Java application
FROM openjdk:17-jdk-slim AS builder

WORKDIR /app
COPY . .

# Build with Maven or Gradle
RUN if [ -f pom.xml ]; then apt-get update && apt-get install -y maven && mvn clean package -DskipTests; fi
RUN if [ -f build.gradle ]; then apt-get update && apt-get install -y gradle && gradle build; fi

# Production image
FROM openjdk:17-jre-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar 2>/dev/null || \\
     COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["java", "-jar", "app.jar"]
`);
  }

  /**
   * 일반적인 Dockerfile 생성
   */
  private generateGenericDockerfile(): Promise<string> {
    return Promise.resolve(`# Auto-generated generic Dockerfile
FROM alpine:latest

RUN apk --no-cache add curl

WORKDIR /app
COPY . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["sh", "-c", "echo 'Please configure your application startup command'"]
`);
  }

  /**
   * 폴백용 일반적인 Node.js Dockerfile 생성
   */
  private generateGenericNodeDockerfile(): Promise<string> {
    return Promise.resolve(`# Auto-generated Dockerfile for Node.js application
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
`);
  }

  /**
   * Docker 빌드 실행
   */
  private async executeBuild(buildId: string, buildPath: string, request: BuildRequest): Promise<void> {
    const build = this.builds.get(buildId)!;
    build.status = 'building';

    const srcPath = path.join(buildPath, 'src');
    const dockerfilePath = request.buildOptions?.dockerfile 
      ? path.join(srcPath, request.buildOptions.dockerfile)
      : path.join(srcPath, 'Dockerfile');

    // Docker 빌드 명령 구성
    const buildArgs = ['build', '-t', build.imageTag, '-f', dockerfilePath];
    
    // 빌드 인수 추가
    if (request.buildOptions?.buildArgs) {
      for (const [key, value] of Object.entries(request.buildOptions.buildArgs)) {
        buildArgs.push('--build-arg', `${key}=${value}`);
      }
    }

    // 라벨 추가
    if (request.buildOptions?.labels) {
      for (const [key, value] of Object.entries(request.buildOptions.labels)) {
        buildArgs.push('--label', `${key}=${value}`);
      }
    }

    // 플랫폼 추가
    if (request.buildOptions?.platform) {
      buildArgs.push('--platform', request.buildOptions.platform);
    }

    // 멀티 스테이지 빌드용 타겟 추가
    if (request.buildOptions?.target) {
      buildArgs.push('--target', request.buildOptions.target);
    }

    // 컨텍스트 경로 추가
    buildArgs.push(srcPath);

    console.log(`🔨 Executing: docker ${buildArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const dockerProcess = spawn('docker', buildArgs, {
        cwd: srcPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeBuilds.set(buildId, dockerProcess);

      // 타임아웃 처리
      const timeout = setTimeout(() => {
        console.log(`⏰ Build ${buildId} timed out after ${this.buildTimeout}ms`);
        dockerProcess.kill('SIGTERM');
        build.status = 'failed';
        build.error = 'Build timed out';
        build.endTime = new Date();
        this.activeBuilds.delete(buildId);
        reject(new ServiceError('Build timed out', 408));
      }, this.buildTimeout);

      // 표준 출력 캐처
      dockerProcess.stdout?.on('data', (data) => {
        const log = data.toString();
        build.logs.push(log);
        console.log(`[${buildId}] ${log.trim()}`);
      });

      // 표준 오류 캐처
      dockerProcess.stderr?.on('data', (data) => {
        const log = data.toString();
        build.logs.push(log);
        console.error(`[${buildId}] ${log.trim()}`);
      });

      // 완료 처리
      dockerProcess.on('close', async (code) => {
        clearTimeout(timeout);
        this.activeBuilds.delete(buildId);

        if (code === 0) {
          try {
            // 이미지 ID 및 크기 조회
            const { imageId, size } = await this.getImageInfo(build.imageTag);
            build.imageId = imageId;
            build.size = size;
            build.status = 'success';
            build.endTime = new Date();
            
            console.log(`✅ Build ${buildId} completed successfully`);
            resolve();
          } catch (error) {
            build.status = 'failed';
            build.error = `Failed to get image info: ${(error as Error).message}`;
            build.endTime = new Date();
            reject(error);
          }
        } else {
          build.status = 'failed';
          build.error = `Docker build failed with exit code ${code}`;
          build.endTime = new Date();
          
          console.error(`❌ Build ${buildId} failed with exit code ${code}`);
          reject(new ServiceError(`Docker build failed with exit code ${code}`, 500));
        }

        // 빌드 디렉토리 정리
        await this.cleanupBuildDirectory(buildPath);
      });

      dockerProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.activeBuilds.delete(buildId);
        build.status = 'failed';
        build.error = error.message;
        build.endTime = new Date();
        
        console.error(`❌ Build ${buildId} process error:`, error);
        reject(new ServiceError(`Docker process error: ${error.message}`, 500));
      });
    });
  }

  /**
   * Docker 이미지 정보 조회
   */
  private async getImageInfo(imageTag: string): Promise<{ imageId: string; size: number }> {
    return new Promise((resolve, reject) => {
      const inspectProcess = spawn('docker', ['inspect', imageTag], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      inspectProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      inspectProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const inspection = JSON.parse(output);
            if (inspection.length > 0) {
              const image = inspection[0];
              resolve({
                imageId: image.Id,
                size: image.Size || 0
              });
            } else {
              reject(new Error('No image found'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse docker inspect output: ${(error as Error).message}`));
          }
        } else {
          reject(new Error(`Docker inspect failed with exit code ${code}`));
        }
      });

      inspectProcess.on('error', reject);
    });
  }

  /**
   * Docker 레지스트리 로그인
   */
  private async dockerLogin(registry: NonNullable<BuildRequest['registry']>): Promise<void> {
    return new Promise((resolve, reject) => {
      const loginProcess = spawn('docker', ['login', '-u', registry.username, '-p', registry.password, registry.url], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      loginProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker login failed with exit code ${code}`));
        }
      });

      loginProcess.on('error', reject);
    });
  }

  /**
   * 레지스트리용 Docker 이미지 태그
   */
  private async dockerTag(imageId: string, registryTag: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tagProcess = spawn('docker', ['tag', imageId, registryTag], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      tagProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker tag failed with exit code ${code}`));
        }
      });

      tagProcess.on('error', reject);
    });
  }

  /**
   * Docker 이미지를 레지스트리에 푸시
   */
  private async dockerPush(registryTag: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pushProcess = spawn('docker', ['push', registryTag], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      pushProcess.stdout?.on('data', (data) => {
        output += data.toString();
        console.log(`[push] ${data.toString().trim()}`);
      });

      pushProcess.stderr?.on('data', (data) => {
        console.error(`[push] ${data.toString().trim()}`);
      });

      pushProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker push failed with exit code ${code}`));
        }
      });

      pushProcess.on('error', reject);
    });
  }

  /**
   * 레지스트리 태그 생성
   */
  private generateRegistryTag(imageTag: string, registry: NonNullable<BuildRequest['registry']>): string {
    const imageName = imageTag.split(':')[0];
    const tag = imageTag.split(':')[1] || 'latest';
    const namespace = registry.namespace || 'daas';
    
    return `${registry.url}/${namespace}/${imageName}:${tag}`;
  }

  /**
   * 고유한 빌드 ID 생성
   */
  private generateBuildId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * 빌드 진행률 계산
   */
  private calculateBuildProgress(build: BuildResult): number {
    if (build.status === 'success') return 100;
    if (build.status === 'failed') return 0;
    if (build.status === 'pending') return 0;
    
    // 로그 내용을 기반으로 진행률 추정
    const logs = build.logs.join(' ');
    let progress = 0;
    
    if (logs.includes('Sending build context')) progress = Math.max(progress, 10);
    if (logs.includes('Step 1/') || logs.includes('Step 2/')) progress = Math.max(progress, 20);
    if (logs.includes('Successfully built')) progress = Math.max(progress, 90);
    
    return Math.min(progress, 95); // 성공으로 표시될 때까지 95%로 제한
  }

  /**
   * 현재 빌드 단계 조회
   */
  private getCurrentBuildStep(build: BuildResult): string | undefined {
    if (build.status === 'pending') return 'Queued';
    if (build.status === 'failed') return 'Failed';
    if (build.status === 'success') return 'Completed';
    
    // 로그에서 현재 단계 추출
    const logs = build.logs.join('\n');
    const stepMatch = logs.match(/Step (\d+\/\d+)\s*:\s*(.+)/g);
    
    if (stepMatch && stepMatch.length > 0) {
      const lastStep = stepMatch[stepMatch.length - 1];
      return lastStep.replace(/^Step /, '');
    }
    
    return 'Building';
  }

  /**
   * 오래된 빌드 정리
   */
  private async cleanupOldBuilds(): Promise<void> {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    console.log('🧹 Cleaning up old builds...');
    
    for (const [buildId, build] of this.builds.entries()) {
      const buildAge = now - build.startTime.getTime();
      
      if (buildAge > maxAge && (build.status === 'success' || build.status === 'failed')) {
        this.builds.delete(buildId);
        
        // 이미지가 존재하면 제거
        if (build.imageId) {
          try {
            await this.removeDockerImage(build.imageId);
          } catch (error) {
            console.warn(`Failed to remove old image ${build.imageId}:`, error);
          }
        }
        
        console.log(`🗑️ Cleaned up old build ${buildId}`);
      }
    }
  }

  /**
   * Docker 이미지 제거
   */
  private async removeDockerImage(imageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const rmProcess = spawn('docker', ['rmi', imageId], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      rmProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker rmi failed with exit code ${code}`));
        }
      });

      rmProcess.on('error', reject);
    });
  }

  /**
   * 빌드 디렉토리 정리
   */
  private async cleanupBuildDirectory(buildPath: string): Promise<void> {
    try {
      await fs.rm(buildPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up build directory: ${buildPath}`);
    } catch (error) {
      console.warn(`Failed to cleanup build directory ${buildPath}:`, error);
    }
  }

  /**
   * 모든 빌드 조회
   */
  getAllBuilds(): BuildResult[] {
    return Array.from(this.builds.values());
  }

  /**
   * Docker 빌더 서비스 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Docker가 사용 가능한지 확인
      await new Promise<void>((resolve, reject) => {
        const dockerProcess = spawn('docker', ['version'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        dockerProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Docker not available, exit code: ${code}`));
          }
        });

        dockerProcess.on('error', reject);
      });

      // 빌드 디렉토리 확인
      await fs.access(this.buildDirectory);

      return true;
    } catch (error) {
      console.error('Docker builder health check failed:', error);
      return false;
    }
  }
}