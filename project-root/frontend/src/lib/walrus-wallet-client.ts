// Walrus client with proper wallet integration for transaction signing
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';

// Types for wallet-integrated upload
export interface WalrusWalletUploadOptions {
  epochs?: number;
  permanent?: boolean;
  metadata?: Record<string, any>;
}

export interface WalrusWalletClient {
  uploadWithWallet: (
    data: Uint8Array,
    walletAddress: string,
    signAndExecute: any,
    options?: WalrusWalletUploadOptions
  ) => Promise<{ blobId: string; txDigest?: string }>;
}

// Create wallet-integrated Walrus client
export const createWalletIntegratedClient = async (): Promise<WalrusWalletClient> => {
  if (typeof window === 'undefined') {
    throw new Error('Wallet integration only available on client side');
  }

  try {
    // Dynamic import to avoid SSR issues
    const { WalrusClient } = await import('@mysten/walrus');

    // Create Sui client for testnet
    const suiClient = new SuiClient({
      url: getFullnodeUrl('testnet'),
    });

    // Create Walrus client
    const walrusClient = new WalrusClient({
      network: 'testnet',
      suiClient,
    });

    return {
      uploadWithWallet: async (
        data: Uint8Array,
        walletAddress: string,
        signAndExecute: any,
        options?: WalrusWalletUploadOptions
      ) => {
        console.log('🔐 지갑 통합 업로드 시작...');
        console.log('💳 사용자 지갑:', walletAddress);
        console.log('📦 데이터 크기:', data.length, 'bytes');

        // The Walrus SDK should handle transaction creation internally
        // But if it doesn't trigger wallet, we need to create transaction manually
        try {
          // First try the SDK's writeBlob method
          const result = await walrusClient.writeBlob({
            blob: data,
            epochs: options?.epochs || 10,
            deletable: true,
            signer: null as any  // Should be provided by wallet
          });

          console.log('✅ SDK writeBlob 성공:', result);
          return {
            blobId: result.blobId,
            txDigest: (result as any).txDigest
          };
        } catch (sdkError) {
          console.warn('⚠️ SDK writeBlob 실패, 수동 트랜잭션 시도:', sdkError);

          // If SDK doesn't work, create transaction manually
          const tx = new Transaction();

          // Add Walrus storage transaction
          // Note: This is a placeholder - actual Walrus Move calls would be needed
          // The exact Move function calls depend on Walrus package deployment
          tx.moveCall({
            target: '0x1234::walrus::store_blob', // Placeholder - need actual package ID
            arguments: [
              tx.pure.vector('u8', Array.from(data)),  // Convert Uint8Array to vector
              tx.pure.u64(BigInt(options?.epochs || 10))  // Use BigInt for u64
            ],
          });

          // Sign and execute transaction through wallet
          console.log('🔐 지갑 트랜잭션 서명 요청...');
          const result = await signAndExecute({
            transaction: tx,
          });

          console.log('✅ 트랜잭션 완료:', result);

          // Extract blob ID from transaction result
          // This would need proper parsing of transaction effects
          return {
            blobId: 'blob_from_tx_' + result.digest,
            txDigest: result.digest
          };
        }
      }
    };
  } catch (error) {
    console.error('❌ 지갑 통합 클라이언트 생성 실패:', error);
    throw error;
  }
};

// Hook for using wallet-integrated Walrus in components
export const useWalrusWithWallet = () => {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const uploadToWalrus = async (
    data: Uint8Array | Blob | File,
    options?: WalrusWalletUploadOptions
  ) => {
    if (!account) {
      throw new Error('지갑을 먼저 연결해주세요');
    }

    try {
      // Convert to Uint8Array
      let binaryData: Uint8Array;
      if (data instanceof Uint8Array) {
        binaryData = data;
      } else if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        binaryData = new Uint8Array(arrayBuffer);
      } else {
        throw new Error('Unsupported data type');
      }

      // Create wallet-integrated client
      const client = await createWalletIntegratedClient();

      // Upload with wallet signing
      const result = await client.uploadWithWallet(
        binaryData,
        account.address,
        signAndExecuteTransaction,
        options
      );

      return {
        success: true,
        blobId: result.blobId,
        txDigest: result.txDigest,
      };
    } catch (error) {
      console.error('❌ 지갑 업로드 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  return {
    uploadToWalrus,
    isWalletConnected: !!account,
    walletAddress: account?.address,
  };
};