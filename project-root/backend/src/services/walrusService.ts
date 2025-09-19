import { WalrusSDKService } from './walrusSDKService.js';
import { config } from '../config/index.js';
import { WalrusUploadResponse, ServiceError } from '../types/index.js';

/**
 * Walrus Service - SDK 전용으로 간소화
 * 온체인 메타데이터와 고급 기능 지원
 */
export class WalrusService {
  private sdkService: WalrusSDKService;

  constructor() {
    // SDK 서비스 초기화
    if (!config.walrus.useSDK || !config.walrus.keypairSeed) {
      throw new Error('Walrus SDK configuration required: USE_WALRUS_SDK=true and WALRUS_KEYPAIR_SEED must be set');
    }

    try {
      this.sdkService = new WalrusSDKService();
      console.log('✅ Walrus SDK service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Walrus SDK:', error);
      throw new ServiceError(`Walrus SDK initialization failed: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Upload code bundle with metadata support
   */
  async uploadCodeBundle(
    codeBundle: Buffer,
    options?: {
      fileName?: string;
      mimeType?: string;
      epochs?: number;
      deletable?: boolean;
      userKeypairSeed?: string; // 사용자 지갑 시드
    }
  ): Promise<WalrusUploadResponse> {
    // 사용자별 키페어가 제공된 경우
    if (options?.userKeypairSeed) {
      console.log('🔄 Using user-specific wallet for upload');
      const userSDKService = new WalrusSDKService(options.userKeypairSeed);
      return userSDKService.uploadCodeBundle(codeBundle, options);
    }

    // 기본 서버 키페어 사용
    console.log('🔄 Using Walrus SDK for upload');
    return this.sdkService.uploadCodeBundle(codeBundle, options);
  }

  /**
   * Upload multiple files in parallel
   */
  async uploadMultipleFiles(
    files: Array<{
      data: Buffer;
      name: string;
      mimeType?: string;
    }>,
    options?: {
      epochs?: number;
      deletable?: boolean;
      userKeypairSeed?: string;
    }
  ): Promise<Array<WalrusUploadResponse & { fileName: string }>> {
    console.log(`🔄 Uploading ${files.length} files in parallel via SDK`);

    // 사용자별 키페어가 제공된 경우
    if (options?.userKeypairSeed) {
      const userSDKService = new WalrusSDKService(options.userKeypairSeed);
      return userSDKService.uploadMultipleFiles(files, options);
    }

    // 기본 서버 키페어 사용
    return this.sdkService.uploadMultipleFiles(files, options);
  }

  /**
   * Download code bundle
   */
  async downloadBundle(bundleId: string): Promise<Buffer> {
    console.log(`🔄 Downloading bundle via SDK: ${bundleId}`);
    return this.sdkService.downloadBundle(bundleId);
  }

  /**
   * Get blob metadata (온체인 정보)
   */
  async getMetadata(blobId: string): Promise<{
    id: string;
    size: number;
    contentType: string;
    created: string;
    certified: boolean;
    epochs: number;
  }> {
    return this.sdkService.getMetadata(blobId);
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    return this.sdkService.blobExists(blobId);
  }

  /**
   * Health check with wallet info
   */
  async healthCheck(): Promise<boolean> {
    return this.sdkService.healthCheck();
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<{
    address: string;
    suiBalance: string;
    walBalance?: string;
  }> {
    return this.sdkService.getWalletInfo();
  }

  /**
   * Get service capabilities
   */
  getCapabilities(): {
    mode: string;
    features: string[];
  } {
    return {
      mode: 'sdk',
      features: [
        'upload',
        'download',
        'metadata_storage',
        'parallel_uploads',
        'transaction_control',
        'wallet_management',
        'onchain_queries',
        'user_specific_wallets'
      ],
    };
  }
}

// Export singleton instance
export const walrusService = new WalrusService();