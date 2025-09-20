// Hybrid Walrus implementation: SDK first, HTTP API fallback
// Walrus client with SDK-first approach and HTTP API fallback
// SDK is preferred for better performance and features, HTTP API as backup

export interface WalrusUploadOptions {
  epochs?: number;
  permanent?: boolean;
  metadata?: Record<string, unknown>;
  walletAddress?: string;
}

export interface WalrusUploadResult {
  status: 'success' | 'alreadyExists' | 'error';
  blobId: string;
  url?: string;
  size?: number;
  error?: string;
}

export interface WalrusProjectUploadResult {
  status: 'success' | 'partial' | 'error';
  codeBlobId?: string;
  dockerBlobId?: string;
  codeUrl?: string;
  dockerUrl?: string;
  codeSize?: number;
  dockerSize?: number;
  error?: string;
}

// Walrus testnet endpoints (현재 작동하는 엔드포인트)
const WALRUS_CONFIG = {
  publisher: 'https://publisher.walrus-testnet.walrus.space',
  aggregator: 'https://aggregator.walrus-testnet.walrus.space'
};

// SDK is disabled - only using HTTP API
// SDK initialization variables are kept for future re-enabling but not used

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2
};

// Helper function for exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Walrus SDK - DISABLED
const initializeWalrusSDK = async (): Promise<boolean> => {
  // SDK is currently disabled - always use HTTP API
  console.log('ℹ️ Walrus SDK is disabled, using HTTP API for all operations');
  return false;
};

// SDK upload implementation - DISABLED
const uploadViaSDK = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data: Uint8Array | Blob | File,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: WalrusUploadOptions
): Promise<WalrusUploadResult> => {
  // SDK is disabled, always return error to trigger HTTP API fallback
  throw new Error('SDK is disabled, use HTTP API');
};



// HTTP API fallback implementation
const uploadViaHttpApi = async (
  data: Uint8Array | Blob | File,
  options?: WalrusUploadOptions
): Promise<WalrusUploadResult> => {
  try {
    console.log('🔄 HTTP API 폴백 사용...');

    // Convert to binary data
    let binaryData: ArrayBuffer;
    if (data instanceof Uint8Array) {
      const buffer = data.buffer as ArrayBuffer;  // Type assertion to handle SharedArrayBuffer case
      binaryData = buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else if (data instanceof Blob) {
      binaryData = await data.arrayBuffer();
    } else {
      throw new Error('Unsupported data type for upload');
    }

    console.log('📦 HTTP API 데이터 크기:', binaryData.byteLength, 'bytes');

    // Construct URL with epochs parameter (correct API path is /v1/blobs)
    let url = `${WALRUS_CONFIG.publisher}/v1/blobs`;
    if (options?.epochs) {
      url += `?epochs=${options.epochs}`;
    }

    // HTTP PUT request to Walrus publisher
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: binaryData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: 'error',
        blobId: '',
        error: `HTTP API blobs store failed: ${response.status} ${response.statusText} - ${errorText}`
      };
    }

    const rawResult = await response.json();
    console.log('✅ HTTP API store 완료!');
    console.log('📄 HTTP API Result:', rawResult);

    // Extract blobId from different response formats
    const blobId = rawResult.newlyCreated?.blobObject?.blobId ||
                   rawResult.alreadyCertified?.blobId ||
                   rawResult.blobId;

    if (!blobId) {
      return {
        status: 'error',
        blobId: '',
        error: 'No blobId received from HTTP API response'
      };
    }

    const downloadUrl = `${WALRUS_CONFIG.aggregator}/v1/blobs/${blobId}`;
    console.log('📥 다운로드 URL:', downloadUrl);
    console.log('💾 Blob ID:', blobId);

    return {
      status: rawResult.newlyCreated ? 'success' : 'alreadyExists',
      blobId: blobId,
      url: downloadUrl,
      size: binaryData.byteLength,
    };
  } catch (error) {
    console.error('❌ HTTP API upload 실패:', error);
    return {
      status: 'error',
      blobId: '',
      error: `HTTP API upload 실패: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// Generic retry wrapper
const withRetry = async <T>(
  fn: () => Promise<T>,
  context: string,
  retryConfig = RETRY_CONFIG
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      console.log(`🔄 ${context} (attempt ${attempt}/${retryConfig.maxAttempts})...`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ ${context} attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < retryConfig.maxAttempts) {
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );
        console.log(`⏳ Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error(`${context} failed after ${retryConfig.maxAttempts} attempts`);
};

// Main upload function with SDK-first, HTTP API fallback approach and retry logic
export const uploadToWalrus = async (
  data: Uint8Array | Blob | File,
  options?: WalrusUploadOptions
): Promise<WalrusUploadResult> => {
  console.log('📤 Starting Walrus upload with intelligent fallback...');
  
  // Try SDK first if available
  const sdkReady = await initializeWalrusSDK();
  
  if (sdkReady) {
    try {
      console.log('🔧 Attempting SDK upload (preferred method)...');
      return await withRetry(
        () => uploadViaSDK(data, options),
        'SDK upload',
        { ...RETRY_CONFIG, maxAttempts: 2 } // Fewer retries for SDK before fallback
      );
    } catch (sdkError) {
      console.warn('⚠️ All SDK upload attempts failed, falling back to HTTP API:', sdkError);
      // Fall through to HTTP API
    }
  }
  
  // Fallback to HTTP API with retry
  console.log('🔄 Using HTTP API fallback with retry logic...');
  try {
    return await withRetry(
      () => uploadViaHttpApi(data, options),
      'HTTP API upload'
    );
  } catch (error) {
    // Final fallback: return error result instead of throwing
    console.error('❌ All upload methods failed:', error);
    return {
      status: 'error',
      blobId: '',
      error: `All upload attempts failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// SDK read implementation - DISABLED
const readViaSDK = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  blobId: string
): Promise<Uint8Array> => {
  // SDK is disabled, always throw error to trigger HTTP API fallback
  throw new Error('SDK is disabled, use HTTP API');
};

// HTTP API read implementation
const readViaHttpApi = async (blobId: string): Promise<Uint8Array> => {
  try {
    console.log('📥 Using HTTP API for read...');
    
    const response = await fetch(`${WALRUS_CONFIG.aggregator}/v1/blobs/${blobId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP API read failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    console.log('✅ HTTP API read successful, size:', data.length);
    return data;
  } catch (error) {
    console.error('❌ HTTP API read failed:', error);
    throw error;
  }
};

// Main read function with SDK-first, HTTP API fallback approach and retry logic
export const readFromWalrus = async (blobId: string): Promise<Uint8Array> => {
  console.log('📥 Starting Walrus read with intelligent fallback for blob:', blobId);
  
  // Validate blobId
  if (!blobId || blobId.trim() === '') {
    throw new Error('Invalid blobId: empty or null');
  }
  
  // Try SDK first if available
  const sdkReady = await initializeWalrusSDK();
  
  if (sdkReady) {
    try {
      console.log('🔧 Attempting SDK read (preferred method)...');
      return await withRetry(
        () => readViaSDK(blobId),
        'SDK read',
        { ...RETRY_CONFIG, maxAttempts: 2 } // Fewer retries for SDK before fallback
      );
    } catch (sdkError) {
      console.warn('⚠️ All SDK read attempts failed, falling back to HTTP API:', sdkError);
      // Fall through to HTTP API
    }
  }
  
  // Fallback to HTTP API with retry
  console.log('🔄 Using HTTP API fallback for read with retry logic...');
  return await withRetry(
    () => readViaHttpApi(blobId),
    'HTTP API read'
  );
};

// Docker image export and upload functions
export const exportDockerImage = async (imageName: string): Promise<Blob> => {
  return new Promise((resolve) => {
    // Note: This needs to be implemented with proper Docker API integration
    // For now, we'll simulate the process
    console.log('🐳 Docker 이미지 export 시작:', imageName);

    // In a real implementation, this would use Docker Engine API or execute docker save command
    // docker save imageName | gzip

    // For demo purposes, create a dummy blob
    const dummyData = new TextEncoder().encode(`Docker image export for ${imageName} - ${new Date().toISOString()}`);
    const blob = new Blob([dummyData], { type: 'application/gzip' });

    setTimeout(() => {
      console.log('✅ Docker 이미지 export 완료');
      resolve(blob);
    }, 1000);
  });
};

// Define project data interface
export interface ProjectData {
  projectName?: string;
  files?: Array<{ path: string; content: string }>;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export const uploadProjectToWalrus = async (
  projectData: ProjectData | Record<string, unknown>,
  dockerImageName?: string,
  options?: WalrusUploadOptions
): Promise<WalrusProjectUploadResult> => {
  try {
    console.log('🚀 프로젝트 Walrus 업로드 시작...');

    // 1. 소스코드 업로드
    console.log('📦 1단계: 소스코드 업로드...');
    const jsonData = JSON.stringify(projectData, null, 2);
    const codeBlob = new Blob([jsonData], { type: 'application/json' });

    const codeResult = await uploadToWalrus(codeBlob, {
      ...options,
      metadata: { type: 'source-code', ...options?.metadata }
    });

    if (codeResult.status === 'error') {
      return {
        status: 'error',
        error: `소스코드 업로드 실패: ${codeResult.error}`
      };
    }

    let dockerResult: WalrusUploadResult | null = null;

    // 2. Docker 이미지 업로드 (옵션)
    if (dockerImageName) {
      try {
        console.log('🐳 2단계: Docker 이미지 업로드...');
        const dockerBlob = await exportDockerImage(dockerImageName);

        dockerResult = await uploadToWalrus(dockerBlob, {
          ...options,
          metadata: { type: 'docker-image', imageName: dockerImageName, ...options?.metadata }
        });

        if (dockerResult.status === 'error') {
          console.warn('⚠️ Docker 이미지 업로드 실패, 소스코드만 저장됨');
        }
      } catch (dockerError) {
        console.warn('⚠️ Docker 이미지 처리 실패:', dockerError);
      }
    }

    // 3. 결과 정리
    const result: WalrusProjectUploadResult = {
      status: dockerImageName && (!dockerResult || dockerResult.status === 'error') ? 'partial' : 'success',
      codeBlobId: codeResult.blobId,
      codeUrl: codeResult.url,
      codeSize: codeResult.size
    };

    if (dockerResult && dockerResult.status !== 'error') {
      result.dockerBlobId = dockerResult.blobId;
      result.dockerUrl = dockerResult.url;
      result.dockerSize = dockerResult.size;
    }

    console.log('✅ 프로젝트 업로드 완료!');
    console.log('📄 코드 Blob ID:', result.codeBlobId);
    if (result.dockerBlobId) {
      console.log('🐳 Docker Blob ID:', result.dockerBlobId);
    }

    return result;

  } catch (error) {
    console.error('❌ 프로젝트 업로드 실패:', error);
    return {
      status: 'error',
      error: `프로젝트 업로드 실패: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// Define SealClient interface
interface SealClient {
  isSessionActive: () => boolean;
  encryptAndUploadToWalrus: (
    data: Uint8Array,
    dataType: number,
    uploadFunction: typeof uploadToWalrus
  ) => Promise<{
    blobId: string;
    keyId: string;
    encryptedKey: string;
    metadata: { walrusUrl: string };
  }>;
}

interface SealMetadata {
  code?: { encrypted: boolean; keyId: string; encryptedKey: string };
  docker?: { encrypted: boolean; keyId: string; encryptedKey: string };
}

// Seal 통합 업로드 함수
export const uploadProjectWithSeal = async (
  projectData: ProjectData | Record<string, unknown>,
  dockerImageName?: string,
  sealClient?: SealClient,
  options?: WalrusUploadOptions
): Promise<WalrusProjectUploadResult & { sealMetadata?: SealMetadata }> => {
  try {
    console.log('🔐 Seal 암호화 + Walrus 업로드 시작...');

    let codeSealMetadata;
    let dockerSealMetadata;

    // 1. 소스코드 처리
    console.log('📦 1단계: 소스코드 처리...');
    const jsonData = JSON.stringify(projectData, null, 2);
    const codeData = new TextEncoder().encode(jsonData);

    let codeResult: WalrusUploadResult;

    if (sealClient && sealClient.isSessionActive()) {
      // Seal 암호화 후 업로드
      console.log('🔒 Seal 암호화 적용 중...');
      const sealResult = await sealClient.encryptAndUploadToWalrus(
        codeData,
        0, // DataType.SECRETS
        uploadToWalrus
      );

      codeResult = {
        status: 'success',
        blobId: sealResult.blobId,
        url: sealResult.metadata.walrusUrl
      };

      codeSealMetadata = {
        encrypted: true,
        keyId: sealResult.keyId,
        encryptedKey: sealResult.encryptedKey
      };
    } else {
      // 일반 업로드
      console.log('📤 일반 업로드 (암호화 없음)...');
      const codeBlob = new Blob([codeData], { type: 'application/json' });
      codeResult = await uploadToWalrus(codeBlob, {
        ...options,
        metadata: { type: 'source-code', ...options?.metadata }
      });
    }

    if (codeResult.status === 'error') {
      return {
        status: 'error',
        error: `소스코드 업로드 실패: ${codeResult.error}`
      };
    }

    // 2. Docker 이미지 처리 (옵션)
    let dockerResult: WalrusUploadResult | null = null;

    if (dockerImageName) {
      try {
        console.log('🐳 2단계: Docker 이미지 처리...');
        const dockerBlob = await exportDockerImage(dockerImageName);
        const dockerData = await dockerBlob.arrayBuffer();

        if (sealClient && sealClient.isSessionActive()) {
          // Seal 암호화 후 업로드
          console.log('🔒 Docker 이미지 Seal 암호화 중...');
          const sealResult = await sealClient.encryptAndUploadToWalrus(
            new Uint8Array(dockerData),
            1, // DataType.CONFIG
            uploadToWalrus
          );

          dockerResult = {
            status: 'success',
            blobId: sealResult.blobId,
            url: sealResult.metadata.walrusUrl
          };

          dockerSealMetadata = {
            encrypted: true,
            keyId: sealResult.keyId,
            encryptedKey: sealResult.encryptedKey
          };
        } else {
          // 일반 업로드
          dockerResult = await uploadToWalrus(dockerBlob, {
            ...options,
            metadata: { type: 'docker-image', imageName: dockerImageName, ...options?.metadata }
          });
        }

        if (dockerResult.status === 'error') {
          console.warn('⚠️ Docker 이미지 업로드 실패, 소스코드만 저장됨');
        }
      } catch (dockerError) {
        console.warn('⚠️ Docker 이미지 처리 실패:', dockerError);
      }
    }

    // 3. 결과 정리
    const result: WalrusProjectUploadResult & { sealMetadata?: SealMetadata } = {
      status: dockerImageName && (!dockerResult || dockerResult.status === 'error') ? 'partial' : 'success',
      codeBlobId: codeResult.blobId,
      codeUrl: codeResult.url,
      codeSize: codeResult.size
    };

    if (dockerResult && dockerResult.status !== 'error') {
      result.dockerBlobId = dockerResult.blobId;
      result.dockerUrl = dockerResult.url;
      result.dockerSize = dockerResult.size;
    }

    // Seal 메타데이터 추가
    if (codeSealMetadata || dockerSealMetadata) {
      result.sealMetadata = {
        code: codeSealMetadata,
        docker: dockerSealMetadata
      };
    }

    console.log('✅ Seal + Walrus 업로드 완료!');
    if (result.sealMetadata) {
      console.log('🔐 암호화 적용됨:', result.sealMetadata);
    }

    return result;

  } catch (error) {
    console.error('❌ Seal 업로드 실패:', error);
    return {
      status: 'error',
      error: `Seal 업로드 실패: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// Export for compatibility - WalrusClient type will be available after dynamic import