import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

export interface DockerImageOnChain {
  walrusBlobId: string;
  downloadUrl: string;
  imageName: string;
  version: string;
  size: number;
  uploadType: 'docker' | 'project';
}

export interface DockerImageInfo {
  walrus_blob_id: string;
  download_url: string;
  image_name: string;
  version: string;
  size: string;
  timestamp: string;
  upload_type: string;
}

// 환경변수에서 가져올 설정값들
const DOCKER_REGISTRY_PACKAGE = process.env.NEXT_PUBLIC_DOCKER_REGISTRY_PACKAGE || '';
const DOCKER_REGISTRY_ID = process.env.NEXT_PUBLIC_DOCKER_REGISTRY_ID || '';
const CLOCK_ID = '0x6'; // Sui Clock object (고정값)

export class DockerContractClient {
  private suiClient: SuiClient;

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient;
  }

  /**
   * Docker 이미지 URL을 온체인에 저장
   */
  createRegisterTransaction(imageData: DockerImageOnChain): Transaction {
    const tx = new Transaction();

    // 디버그 로그
    console.log('📝 Creating register transaction with:', {
      package: DOCKER_REGISTRY_PACKAGE,
      registry: DOCKER_REGISTRY_ID,
      imageData
    });

    tx.moveCall({
      target: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::register_docker_image`,
      arguments: [
        tx.object(DOCKER_REGISTRY_ID),           // registry
        tx.pure.string(imageData.walrusBlobId),  // walrus_blob_id
        tx.pure.string(imageData.downloadUrl),   // download_url
        tx.pure.string(imageData.imageName),     // image_name
        tx.pure.string(imageData.version),       // version
        tx.pure.u64(imageData.size),            // size
        tx.pure.string(imageData.uploadType),   // upload_type
        tx.object(CLOCK_ID)                     // clock
      ],
    });

    return tx;
  }

  /**
   * 특정 이미지 삭제
   */
  createDeleteTransaction(blobId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::delete_docker_image`,
      arguments: [
        tx.object(DOCKER_REGISTRY_ID),
        tx.pure.string(blobId)
      ],
    });

    return tx;
  }

  /**
   * 사용자의 이미지 목록 조회
   */
  async getUserImages(userAddress: string): Promise<DockerImageInfo[]> {
    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::get_user_images`,
        arguments: [
          tx.object(DOCKER_REGISTRY_ID),
          tx.pure.address(userAddress)
        ],
      });

      const result = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: userAddress,
      });

      if (result.results && result.results.length > 0) {
        const returnValues = result.results[0].returnValues;
        if (returnValues && returnValues.length > 0) {
          // BCS 디코딩 (실제 구현에서는 정확한 타입 정의 필요)
          const decoded = this.decodeImages(returnValues[0]);
          return decoded;
        }
      }

      return [];
    } catch (error) {
      console.error('Failed to get user images:', error);
      return [];
    }
  }

  /**
   * 특정 이미지 조회
   */
  async getImageByBlobId(
    userAddress: string,
    blobId: string
  ): Promise<DockerImageInfo | null> {
    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::get_image_by_blob_id`,
        arguments: [
          tx.object(DOCKER_REGISTRY_ID),
          tx.pure.address(userAddress),
          tx.pure.string(blobId)
        ],
      });

      const result = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: userAddress,
      });

      if (result.results && result.results.length > 0) {
        const returnValues = result.results[0].returnValues;
        if (returnValues && returnValues.length > 1) {
          const found = returnValues[0];
          if (found) {
            const decoded = this.decodeImage(returnValues[1]);
            return decoded;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get image by blob ID:', error);
      return null;
    }
  }

  /**
   * 전체 이미지 수 조회
   */
  async getTotalImages(): Promise<number> {
    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::get_total_images`,
        arguments: [
          tx.object(DOCKER_REGISTRY_ID)
        ],
      });

      const result = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: '0x0', // sender not needed for this query
      });

      if (result.results && result.results.length > 0) {
        const returnValues = result.results[0].returnValues;
        if (returnValues && returnValues.length > 0) {
          // u64 디코딩
          const decoded = bcs.u64().parse(new Uint8Array(returnValues[0][0]));
          return Number(decoded);
        }
      }

      return 0;
    } catch (error) {
      console.error('Failed to get total images:', error);
      return 0;
    }
  }

  /**
   * 이벤트 구독
   */
  async subscribeToImageEvents(
    onImageRegistered?: (event: any) => void,
    onImageDeleted?: (event: any) => void
  ) {
    // ImageRegistered 이벤트 구독
    if (onImageRegistered) {
      const unsubscribe = await this.suiClient.subscribeEvent({
        filter: {
          MoveEventType: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::ImageRegistered`
        },
        onMessage(event) {
          console.log('🎉 Image registered event:', event);
          onImageRegistered(event);
        }
      });

      return unsubscribe;
    }

    // ImageDeleted 이벤트 구독
    if (onImageDeleted) {
      const unsubscribe = await this.suiClient.subscribeEvent({
        filter: {
          MoveEventType: `${DOCKER_REGISTRY_PACKAGE}::docker_registry::ImageDeleted`
        },
        onMessage(event) {
          console.log('🗑️ Image deleted event:', event);
          onImageDeleted(event);
        }
      });

      return unsubscribe;
    }
  }

  // Helper 함수들
  private decodeImages(data: any): DockerImageInfo[] {
    // 실제 구현에서는 BCS 디코딩 필요
    // 임시로 빈 배열 반환
    return [];
  }

  private decodeImage(data: any): DockerImageInfo {
    // 실제 구현에서는 BCS 디코딩 필요
    return {
      walrus_blob_id: '',
      download_url: '',
      image_name: '',
      version: '',
      size: '0',
      timestamp: '0',
      upload_type: ''
    };
  }
}

// React Hook for Docker Contract
export function useDockerContract(suiClient: SuiClient) {
  const client = new DockerContractClient(suiClient);

  return {
    registerImage: (imageData: DockerImageOnChain) =>
      client.createRegisterTransaction(imageData),
    deleteImage: (blobId: string) =>
      client.createDeleteTransaction(blobId),
    getUserImages: (address: string) =>
      client.getUserImages(address),
    getImageByBlobId: (address: string, blobId: string) =>
      client.getImageByBlobId(address, blobId),
    getTotalImages: () =>
      client.getTotalImages(),
    subscribeToEvents: client.subscribeToImageEvents.bind(client)
  };
}