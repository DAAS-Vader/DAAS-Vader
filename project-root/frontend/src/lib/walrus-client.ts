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

// SDK initialization state
interface WalrusSDKInstance {
  store: (data: Uint8Array, options: { epochs: number; permanent: boolean }) => Promise<{
    blobId?: string;
    blob_id?: string;
    isNew?: boolean;
  }>;
  read: (blobId: string) => Promise<Uint8Array>;
  ping: () => Promise<void>;
}

let sdkInstance: WalrusSDKInstance | null = null;
let sdkInitialized = false;
let sdkInitError: Error | null = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2
};

// Helper function for exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Walrus SDK (dynamic import for WASM) with retry logic
const initializeWalrusSDK = async (): Promise<boolean> => {
  if (sdkInitialized && sdkInstance) {
    return true;
  }
  
  if (sdkInitError && initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.warn('SDK permanently failed after max attempts:', sdkInitError.message);
    return false;
  }

  try {
    console.log(`🚀 Initializing Walrus SDK (attempt ${initializationAttempts + 1}/${MAX_INIT_ATTEMPTS})...`);
    initializationAttempts++;
    
    // Dynamic import to handle WASM loading
    const { WalrusClient } = await import('@mysten/walrus');
    const { getFullnodeUrl, SuiClient } = await import('@mysten/sui/client');
    
    // Initialize Sui client for testnet
    const suiClient = new SuiClient({
      url: getFullnodeUrl('testnet'),
    });
    
    // Initialize SDK with testnet configuration and Sui client
    // According to docs: WalrusClient needs both network and suiClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (WalrusClient as any)({
      network: 'testnet',
      suiClient: suiClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    
    // Debug: WalrusClient 인스턴스 구조 확인
    console.log('WalrusClient instance:', client);
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
    
    // Wrap the client to match our interface
    // Based on actual API: only readBlob and getSecondarySliver are available
    // Store operations will fall back to HTTP API
    sdkInstance = {
      store: async (data: Uint8Array, options: { epochs: number; permanent: boolean }) => {
        try {
          // Use writeBlob method for uploading to Walrus
          if (typeof client.writeBlob === 'function') {
            console.log('📤 Using SDK writeBlob method for upload');
            const result = await client.writeBlob(data, {
              epochs: options.epochs || 5,
              deletionType: options.permanent ? 'permanent' : 'ephemeral'
            });
            return result;
          } else if (typeof client.storeBlob === 'function') {
            console.log('📤 Using SDK storeBlob method for upload');
            const result = await client.storeBlob(data, options);
            return result;
          } else {
            console.error('Available methods on client:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
            throw new Error('WalrusClient does not have writeBlob or storeBlob method');
          }
        } catch (error) {
          console.error('SDK upload error:', error);
          throw error;
        }
      },
      read: async (blobId: string) => {
        try {
          // Based on actual API analysis: use readBlob method
          if (typeof client.readBlob === 'function') {
            console.log('📥 Using SDK readBlob method for blob:', blobId);
            const result = await client.readBlob(blobId);
            return result;
          } else {
            console.error('readBlob method not found on client:', client);
            console.error('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
            throw new Error('WalrusClient does not have readBlob method');
          }
        } catch (error) {
          console.error('SDK readBlob error:', error);
          throw error;
        }
      },
      ping: async () => {
        try {
          // SDK ping test: check if readBlob method exists as basic health check
          if (typeof client.readBlob === 'function') {
            console.log('✅ SDK health check: readBlob method available');
            return Promise.resolve();
          } else {
            throw new Error('SDK not properly initialized: readBlob method missing');
          }
        } catch (error) {
          console.error('SDK ping error:', error);
          throw error;
        }
      },
    };
    
    // Test SDK functionality with timeout
    const pingTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SDK ping timeout')), 5000)
    );
    
    await Promise.race([
      sdkInstance.ping(),
      pingTimeout
    ]);
    
    sdkInitialized = true;
    sdkInitError = null;
    console.log('✅ Walrus SDK initialized successfully');
    return true;
  } catch (error) {
    sdkInitError = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ SDK initialization attempt ${initializationAttempts} failed:`, sdkInitError);
    
    if (initializationAttempts < MAX_INIT_ATTEMPTS) {
      const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, initializationAttempts - 1),
        RETRY_CONFIG.maxDelay
      );
      console.log(`⏳ Will retry SDK initialization in ${delay}ms...`);
      await sleep(delay);
      return initializeWalrusSDK(); // Recursive retry
    }
    
    console.log('⚠️ SDK initialization failed permanently, will use HTTP API fallback');
    return false;
  }
};

// SDK upload implementation
const uploadViaSDK = async (
  data: Uint8Array | Blob | File,
  options?: WalrusUploadOptions
): Promise<WalrusUploadResult> => {
  try {
    console.log('📤 Using Walrus SDK for upload...');
    
    if (!sdkInstance) {
      throw new Error('SDK not initialized');
    }

    // Convert data to Uint8Array if needed
    let uint8Data: Uint8Array;
    if (data instanceof Uint8Array) {
      uint8Data = data;
    } else if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      uint8Data = new Uint8Array(buffer);
    } else {
      throw new Error('Unsupported data type for SDK upload');
    }

    console.log('📦 SDK upload data size:', uint8Data.length, 'bytes');

    // SDK upload with options
    const result = await sdkInstance.store(uint8Data, {
      epochs: options?.epochs || 10,
      permanent: options?.permanent || false,
    });

    console.log('✅ SDK upload successful!');
    console.log('📄 SDK Result:', result);

    const blobId = result.blobId || result.blob_id;
    
    if (!blobId) {
      throw new Error('No blobId received from SDK response');
    }
    
    const downloadUrl = `${WALRUS_CONFIG.aggregator}/v1/blobs/${blobId}`;

    return {
      status: result.isNew ? 'success' : 'alreadyExists',
      blobId: blobId,
      url: downloadUrl,
      size: uint8Data.length,
    };
  } catch (error) {
    console.error('❌ SDK upload failed:', error);
    throw error;
  }
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

// SDK read implementation
const readViaSDK = async (blobId: string): Promise<Uint8Array> => {
  try {
    console.log('📥 Using Walrus SDK for read...');
    
    if (!sdkInstance) {
      throw new Error('SDK not initialized');
    }

    const data = await sdkInstance.read(blobId);
    
    console.log('✅ SDK read successful, size:', data.length);
    return data;
  } catch (error) {
    console.error('❌ SDK read failed:', error);
    throw error;
  }
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