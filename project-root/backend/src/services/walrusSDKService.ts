import { WalrusUploadResponse, ServiceError } from '../types/index.js';
import { config } from '../config/index.js';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';

/**
 * Walrus SDK Service - Real implementation using @mysten/walrus SDK
 * Supports user-specific wallet operations and advanced Walrus features
 */
export class WalrusSDKService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private walletAddress: string;
  private network: string;

  constructor(customKeypairSeed?: string) {
    console.log('🔧 WalrusSDKService initializing with real SDK...');

    // Network configuration
    this.network = config.walrus.network || 'testnet';

    // Initialize Sui client
    const rpcUrl = this.network === 'mainnet'
      ? 'https://fullnode.mainnet.sui.io:443'
      : 'https://fullnode.testnet.sui.io:443';

    this.client = new SuiClient({ url: rpcUrl });

    // Initialize keypair from seed
    const seedToUse = customKeypairSeed || config.walrus.keypairSeed;
    if (!seedToUse) {
      throw new Error('Keypair seed is required for Walrus SDK');
    }

    try {
      // Convert mnemonic to keypair
      this.keypair = this.createKeypairFromSeed(seedToUse);
      this.walletAddress = this.keypair.getPublicKey().toSuiAddress();

      console.log('✅ Walrus SDK initialized successfully');
      console.log(`🔑 Wallet Address: ${this.walletAddress}`);
      console.log(`🌐 Network: ${this.network}`);
    } catch (error) {
      console.error('❌ Failed to initialize Walrus SDK:', error);
      throw new ServiceError(`Walrus SDK initialization failed: ${(error as Error).message}`, 500);
    }
  }

  private createKeypairFromSeed(seed: string): Ed25519Keypair {
    try {
      // If it's a mnemonic phrase, derive keypair
      if (seed.split(' ').length >= 12) {
        return Ed25519Keypair.deriveKeypair(seed);
      }

      // If it's a hex string, parse directly
      if (seed.startsWith('0x')) {
        const secretKey = fromHEX(seed);
        return Ed25519Keypair.fromSecretKey(secretKey);
      }

      // If it's a raw hex string (without 0x), convert to buffer
      if (/^[0-9a-fA-F]{64,}$/.test(seed)) {
        const secretKey = Buffer.from(seed, 'hex');
        // Ensure it's exactly 32 bytes (Ed25519 requirement)
        const key32Bytes = secretKey.slice(0, 32);
        return Ed25519Keypair.fromSecretKey(key32Bytes);
      }

      // Default: treat as mnemonic
      return Ed25519Keypair.deriveKeypair(seed);
    } catch (error) {
      throw new Error(`Invalid keypair seed format: ${(error as Error).message}`);
    }
  }

  async uploadCodeBundle(
    codeBundle: Buffer,
    options?: {
      fileName?: string;
      mimeType?: string;
      epochs?: number;
      deletable?: boolean;
      userKeypairSeed?: string;
    }
  ): Promise<WalrusUploadResponse> {
    try {
      console.log(`🚀 Uploading ${codeBundle.length} bytes to Walrus via SDK`);

      // Use user-specific keypair if provided
      let keypairToUse = this.keypair;
      if (options?.userKeypairSeed) {
        keypairToUse = this.createKeypairFromSeed(options.userKeypairSeed);
        console.log(`🔑 Using user-specific keypair: ${keypairToUse.getPublicKey().toSuiAddress()}`);
      }

      // Import the Walrus SDK functions
      const { WalrusClient } = await import('@mysten/walrus');

      // Configure Walrus client
      const walrusConfig = {
        suiClient: this.client,
        network: this.network as 'testnet' | 'mainnet',
      };

      const walrusClient = new WalrusClient(walrusConfig);

      // Prepare blob options
      const blobOptions = {
        blob: codeBundle,
        epochs: options?.epochs || 5,
        deletable: options?.deletable ?? true,
        signer: keypairToUse
      };

      console.log('📤 Uploading blob to Walrus...', {
        size: codeBundle.length,
        epochs: blobOptions.epochs,
        deletable: blobOptions.deletable,
        wallet: keypairToUse.getPublicKey().toSuiAddress()
      });

      // Upload the blob using the SDK
      const result = await walrusClient.writeBlob(blobOptions);

      console.log('✅ Walrus SDK upload successful:', {
        blobId: result.blobId,
        blobObject: result.blobObject
      });

      return {
        cid: result.blobId,
        size: codeBundle.length
      };

    } catch (error) {
      console.error('❌ Walrus SDK upload failed:', error);
      throw new ServiceError(
        `Walrus SDK upload failed: ${(error as Error).message}`,
        500
      );
    }
  }

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
    try {
      console.log(`📤 Uploading ${files.length} files to Walrus via SDK`);

      const results = await Promise.all(
        files.map(async (file) => {
          const result = await this.uploadCodeBundle(file.data, {
            fileName: file.name,
            mimeType: file.mimeType,
            epochs: options?.epochs,
            deletable: options?.deletable,
            userKeypairSeed: options?.userKeypairSeed
          });

          return {
            ...result,
            fileName: file.name
          };
        })
      );

      return results;
    } catch (error) {
      console.error('❌ Multiple files upload failed:', error);
      throw new ServiceError(
        `Multiple files upload failed: ${(error as Error).message}`,
        500
      );
    }
  }

  async downloadBundle(blobId: string): Promise<Buffer> {
    try {
      console.log(`📥 Downloading from Walrus via SDK: ${blobId}`);

      // Import the Walrus SDK functions
      const { WalrusClient } = await import('@mysten/walrus');

      // Configure Walrus client
      const walrusConfig = {
        suiClient: this.client,
        network: this.network as 'testnet' | 'mainnet',
      };

      const walrusClient = new WalrusClient(walrusConfig);

      // Download the blob
      const result = await walrusClient.readBlob({ blobId });

      console.log(`✅ Downloaded ${result.length} bytes from Walrus`);
      return Buffer.from(result);

    } catch (error) {
      console.error('❌ Walrus SDK download failed:', error);
      throw new ServiceError(
        `Walrus SDK download failed: ${(error as Error).message}`,
        404
      );
    }
  }

  async getMetadata(blobId: string): Promise<{
    id: string;
    size: number;
    contentType: string;
    created: string;
    certified: boolean;
    epochs: number;
  }> {
    try {
      console.log(`📊 Getting metadata for: ${blobId}`);

      // Import the Walrus SDK functions
      const { WalrusClient } = await import('@mysten/walrus');

      const walrusConfig = {
        suiClient: this.client,
        network: this.network as 'testnet' | 'mainnet',
      };

      const walrusClient = new WalrusClient(walrusConfig);

      // Get blob metadata
      const info = await walrusClient.getBlobMetadata({ blobId });

      return {
        id: blobId,
        size: parseInt(info.metadata.V1.unencoded_length) || 0,
        contentType: 'application/octet-stream',
        created: new Date().toISOString(),
        certified: true, // If we can get metadata, it's certified
        epochs: 0 // Epochs not available in metadata structure
      };

    } catch (error) {
      console.error('❌ Metadata retrieval failed:', error);
      throw new ServiceError(
        `Metadata retrieval failed: ${(error as Error).message}`,
        404
      );
    }
  }

  async blobExists(blobId: string): Promise<boolean> {
    try {
      await this.getMetadata(blobId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      console.log('🏥 Walrus SDK health check...');

      // Test Sui client connection
      await this.client.getLatestSuiSystemState();

      // Test wallet balance
      const balance = await this.client.getBalance({
        owner: this.walletAddress
      });

      console.log('✅ Walrus SDK health check passed', {
        wallet: this.walletAddress,
        suiBalance: balance.totalBalance
      });

      return true;
    } catch (error) {
      console.error('❌ Walrus SDK health check failed:', error);
      return false;
    }
  }

  async getWalletInfo(): Promise<{
    address: string;
    suiBalance: string;
    walBalance?: string;
  }> {
    try {
      console.log('💰 Getting real wallet info...');

      // Get SUI balance
      const balance = await this.client.getBalance({
        owner: this.walletAddress
      });

      // Get WAL balance if available
      let walBalance: string | undefined;
      if (config.walrus.walCoinType) {
        try {
          const walBalanceResult = await this.client.getBalance({
            owner: this.walletAddress,
            coinType: config.walrus.walCoinType
          });
          walBalance = walBalanceResult.totalBalance;
        } catch (error) {
          console.warn('⚠️ Could not get WAL balance:', error);
        }
      }

      return {
        address: this.walletAddress,
        suiBalance: balance.totalBalance,
        walBalance
      };

    } catch (error) {
      console.error('❌ Failed to get wallet info:', error);
      throw new ServiceError(
        `Failed to get wallet info: ${(error as Error).message}`,
        500
      );
    }
  }
}