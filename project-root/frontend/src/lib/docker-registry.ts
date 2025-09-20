import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

// 배포된 패키지 ID와 레지스트리 객체 ID
export const PACKAGE_ID = '0xf59bd1a3d4a0d26fa84d9d1c6cceb69063347f7ff2ee3a381115af6057cb30d2';
export const REGISTRY_ID = '0xa49447a573835ee7a3036565735ab4d1404460b35aa95af6296f64bdf994eb21'; // DockerRegistry shared object

export interface DockerImage {
  downloadUrls: string[];
  imageName: string;
  size: number;
  uploadType: 'docker' | 'project';
}

// Sui SDK Signer 타입 정의
interface Signer {
  signAndExecuteTransaction(input: {
    transaction: Transaction;
  }): Promise<{ digest: string }>;
}

export class DockerRegistryClient {
  private client: SuiClient;

  constructor(client: SuiClient) {
    this.client = client;
  }

  /**
   * Docker 이미지 URL을 온체인에 등록
   */
  async registerDockerImage(
    urls: string[],
    imageName: string,
    size: number,
    signer: Signer
  ): Promise<string> {
    const tx = new Transaction();

    // Clock 객체 참조
    const clockId = '0x6';

    // register_docker_image 함수 호출
    tx.moveCall({
      target: `${PACKAGE_ID}::docker_registry::register_docker_image`,
      arguments: [
        tx.object(REGISTRY_ID),
        tx.pure.vector('string', urls),
        tx.pure.string(imageName),
        tx.pure.u64(size),
        tx.pure.string('docker'),
        tx.object(clockId),
      ],
    });

    // 트랜잭션 실행
    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer,
    });

    return result.digest;
  }

  /**
   * 프로젝트 tar 파일 URL을 온체인에 등록
   */
  async registerProjectTar(
    urls: string[],
    projectName: string,
    size: number,
    signer: Signer
  ): Promise<string> {
    const tx = new Transaction();

    // Clock 객체 참조
    const clockId = '0x6';

    // register_docker_image 함수 호출 (upload_type을 'project'로)
    tx.moveCall({
      target: `${PACKAGE_ID}::docker_registry::register_docker_image`,
      arguments: [
        tx.object(REGISTRY_ID),
        tx.pure.vector('string', urls),
        tx.pure.string(projectName),
        tx.pure.u64(size),
        tx.pure.string('project'),
        tx.object(clockId),
      ],
    });

    // 트랜잭션 실행
    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer,
    });

    return result.digest;
  }

  /**
   * 사용자의 모든 이미지 조회
   */
  async getUserImages(userAddress: string): Promise<DockerImage[]> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::docker_registry::get_user_images`,
      arguments: [
        tx.object(REGISTRY_ID),
        tx.pure.address(userAddress),
      ],
    });

    const result = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: userAddress,
    });

    // 결과 파싱
    if (result.results && result.results[0]) {
      const returnValues = result.results[0].returnValues;
      if (returnValues && returnValues[0]) {
        // vector<DockerImage> 파싱
        return this.parseDockerImages(returnValues[0]);
      }
    }

    return [];
  }

  /**
   * 전체 이미지 수 조회
   */
  async getTotalImages(): Promise<number> {
    const object = await this.client.getObject({
      id: REGISTRY_ID,
      options: {
        showContent: true,
      },
    });

    if (object.data?.content?.dataType === 'moveObject') {
      const fields = (object.data.content as { fields: Record<string, unknown> }).fields;
      return parseInt((fields.total_images as string) || '0');
    }

    return 0;
  }

  private parseDockerImages(data: unknown): DockerImage[] {
    // Move 벡터 데이터를 파싱
    try {
      if (Array.isArray(data)) {
        return data.map((item: Record<string, unknown>) => ({
          downloadUrls: (item.download_urls as string[]) || [],
          imageName: (item.image_name as string) || '',
          size: parseInt((item.size as string) || '0'),
          uploadType: (item.upload_type as 'docker' | 'project') || 'docker',
        }));
      }
    } catch (error) {
      console.error('Failed to parse docker images:', error);
    }
    return [];
  }
}

// 레지스트리 객체 ID 조회 함수
export async function findRegistryObject(client: SuiClient): Promise<string | null> {
  try {
    // DockerRegistry 타입의 shared 객체 찾기
    const objects = await client.getOwnedObjects({
      owner: '0x0000000000000000000000000000000000000000000000000000000000000000',
      filter: {
        StructType: `${PACKAGE_ID}::docker_registry::DockerRegistry`,
      },
    });

    if (objects.data && objects.data.length > 0) {
      return objects.data[0].data?.objectId || null;
    }

    // Shared 객체로 조회
    const dynamicFields = await client.getDynamicFields({
      parentId: '0x5',
    });

    for (const field of dynamicFields.data) {
      const obj = await client.getObject({
        id: field.objectId,
        options: { showType: true },
      });

      if (obj.data?.type?.includes('DockerRegistry')) {
        return field.objectId;
      }
    }
  } catch (error) {
    console.error('Failed to find registry object:', error);
  }

  return null;
}