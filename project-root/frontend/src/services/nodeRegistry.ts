// 노드 레지스트리 컨트랙트 연동 서비스

import { SuiClient } from '@mysten/sui.js/client'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import {
  CONTRACT_CONFIG,
  MOVE_FUNCTIONS,
  NodeMetadata,
  NodeRegistryState,
  NODE_STATUS
} from '@/contracts/types'

export class NodeRegistryService {
  private suiClient: SuiClient
  private packageId: string
  private registryObjectId: string

  constructor(rpcUrl: string = 'https://fullnode.devnet.sui.io:443') {
    this.suiClient = new SuiClient({ url: rpcUrl })
    this.packageId = CONTRACT_CONFIG.PACKAGE_ID
    this.registryObjectId = CONTRACT_CONFIG.REGISTRY_OBJECT_ID
  }

  /**
   * 새 노드 등록
   */
  async registerNode(
    signer: Ed25519Keypair,
    params: {
      cpu_cores: number
      memory_gb: number
      storage_gb: number
      bandwidth_mbps: number
      region: string
    }
  ): Promise<string> {
    const txb = new TransactionBlock()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.REGISTER_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure(params.cpu_cores),
        txb.pure(params.memory_gb),
        txb.pure(params.storage_gb),
        txb.pure(params.bandwidth_mbps),
        txb.pure(params.region),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      signer,
      transactionBlock: txb,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    })

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`노드 등록 실패: ${result.effects?.status?.error}`)
    }

    return result.digest
  }

  /**
   * 노드 정보 업데이트
   */
  async updateNode(
    signer: Ed25519Keypair,
    params: {
      cpu_cores: number
      memory_gb: number
      storage_gb: number
      bandwidth_mbps: number
      region: string
    }
  ): Promise<string> {
    const txb = new TransactionBlock()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.UPDATE_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure(params.cpu_cores),
        txb.pure(params.memory_gb),
        txb.pure(params.storage_gb),
        txb.pure(params.bandwidth_mbps),
        txb.pure(params.region),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      signer,
      transactionBlock: txb,
      options: {
        showEffects: true,
      },
    })

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`노드 업데이트 실패: ${result.effects?.status?.error}`)
    }

    return result.digest
  }

  /**
   * 노드 상태 변경
   */
  async updateNodeStatus(
    signer: Ed25519Keypair,
    status: number
  ): Promise<string> {
    const txb = new TransactionBlock()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.UPDATE_NODE_STATUS}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure(status),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      signer,
      transactionBlock: txb,
      options: {
        showEffects: true,
      },
    })

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`노드 상태 변경 실패: ${result.effects?.status?.error}`)
    }

    return result.digest
  }

  /**
   * 노드 삭제
   */
  async removeNode(signer: Ed25519Keypair): Promise<string> {
    const txb = new TransactionBlock()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.REMOVE_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      signer,
      transactionBlock: txb,
      options: {
        showEffects: true,
      },
    })

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`노드 삭제 실패: ${result.effects?.status?.error}`)
    }

    return result.digest
  }

  /**
   * 특정 주소의 노드 존재 여부 확인
   */
  async nodeExists(providerAddress: string): Promise<boolean> {
    // 컨트랙트가 배포되지 않은 경우 false 반환
    if (this.packageId === '0x0' || this.registryObjectId === '0x0') {
      return false
    }

    try {
      const txb = new TransactionBlock()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.NODE_EXISTS}`,
        arguments: [
          txb.object(this.registryObjectId),
          txb.pure(providerAddress),
        ],
      })

      const response = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: providerAddress,
      })

      return response.results?.[0]?.returnValues?.[0]?.[0] === 1
    } catch (error) {
      console.error('노드 존재 여부 확인 실패:', error)
      return false
    }
  }

  /**
   * 특정 주소의 노드 메타데이터 조회
   */
  async getNodeMetadata(providerAddress: string): Promise<NodeMetadata | null> {
    // 컨트랙트가 배포되지 않은 경우 null 반환
    if (this.packageId === '0x0' || this.registryObjectId === '0x0') {
      return null
    }

    try {
      const txb = new TransactionBlock()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_NODE_METADATA}`,
        arguments: [
          txb.object(this.registryObjectId),
          txb.pure(providerAddress),
        ],
      })

      const response = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: providerAddress,
      })

      // TODO: 응답 파싱하여 NodeMetadata 객체로 변환
      if (response.results?.[0]?.returnValues) {
        return {
          cpu_cores: 8,
          memory_gb: 16,
          storage_gb: 500,
          bandwidth_mbps: 1000,
          region: 'Asia-Seoul',
          provider_address: providerAddress,
          status: NODE_STATUS.ACTIVE,
          registered_at: Date.now(),
          last_updated: Date.now(),
        }
      }

      return null
    } catch (error) {
      console.error('노드 메타데이터 조회 실패:', error)
      return null
    }
  }

  /**
   * 전체 노드 수 조회
   */
  async getTotalNodes(): Promise<number> {
    try {
      const txb = new TransactionBlock()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_TOTAL_NODES}`,
        arguments: [
          txb.object(this.registryObjectId),
        ],
      })

      const response = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: '0x0',
      })

      // TODO: 응답 파싱
      return 0
    } catch (error) {
      console.error('전체 노드 수 조회 실패:', error)
      return 0
    }
  }

  /**
   * 활성 노드 수 조회
   */
  async getActiveNodes(): Promise<number> {
    try {
      const txb = new TransactionBlock()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_ACTIVE_NODES}`,
        arguments: [
          txb.object(this.registryObjectId),
        ],
      })

      const response = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: '0x0',
      })

      // TODO: 응답 파싱
      return 0
    } catch (error) {
      console.error('활성 노드 수 조회 실패:', error)
      return 0
    }
  }

  /**
   * 모든 노드 리스트 조회 (사용자 페이지용)
   */
  async getAllNodes(): Promise<NodeMetadata[]> {
    // 컨트랙트가 배포되지 않은 경우 빈 배열 반환
    if (this.packageId === '0x0' || this.registryObjectId === '0x0') {
      return []
    }

    try {
      // TODO: 실제 컨트랙트에서 노드 리스트 조회
      // 현재는 빈 배열 반환 (컨트랙트 배포 후 구현)
      return []
    } catch (error) {
      console.error('노드 리스트 조회 실패:', error)
      return []
    }
  }
}

// 싱글톤 인스턴스
export const nodeRegistryService = new NodeRegistryService()