// 노드 레지스트리 컨트랙트 연동 서비스

import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
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

    // 컨트랙트가 배포되지 않았으면 경고
    if (!this.packageId || !this.registryObjectId) {
      console.warn('⚠️ NodeRegistry 컨트랙트가 배포되지 않았습니다. 더미 데이터를 사용합니다.')
    }
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
    const txb = new Transaction()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.REGISTER_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure.u32(params.cpu_cores),
        txb.pure.u32(params.memory_gb),
        txb.pure.u32(params.storage_gb),
        txb.pure.u32(params.bandwidth_mbps),
        txb.pure.string(params.region),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransaction({
      signer,
      transaction: txb,
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
    const txb = new Transaction()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.UPDATE_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure.u32(params.cpu_cores),
        txb.pure.u32(params.memory_gb),
        txb.pure.u32(params.storage_gb),
        txb.pure.u32(params.bandwidth_mbps),
        txb.pure.string(params.region),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransaction({
      signer,
      transaction: txb,
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
    const txb = new Transaction()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.UPDATE_NODE_STATUS}`,
      arguments: [
        txb.object(this.registryObjectId),
        txb.pure.u8(status),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransaction({
      signer,
      transaction: txb,
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
    const txb = new Transaction()

    txb.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.REMOVE_NODE}`,
      arguments: [
        txb.object(this.registryObjectId),
      ],
    })

    const result = await this.suiClient.signAndExecuteTransaction({
      signer,
      transaction: txb,
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
    try {
      const txb = new Transaction()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.NODE_EXISTS}`,
        arguments: [
          txb.object(this.registryObjectId),
          txb.pure.address(providerAddress),
        ],
      })

      const response = await this.suiClient.devInspectTransaction({
        transaction: txb,
        sender: providerAddress,
      })

      // 응답 파싱 - 실제 컨트랙트에서는 boolean 값을 받음
      const returnValue = response.results?.[0]?.returnValues?.[0]
      const exists = Array.isArray(returnValue) && returnValue.length > 0 && (returnValue[0] as unknown as number) === 1
      console.log(`✅ 노드 존재 여부 확인: ${providerAddress} -> ${exists}`)
      return exists
    } catch (error) {
      console.error('노드 존재 여부 확인 실패:', error)
      return false
    }
  }

  /**
   * 특정 주소의 노드 메타데이터 조회
   */
  async getNodeMetadata(providerAddress: string): Promise<NodeMetadata | null> {
    try {
      const txb = new Transaction()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_NODE_METADATA}`,
        arguments: [
          txb.object(this.registryObjectId),
          txb.pure.address(providerAddress),
        ],
      })

      const response = await this.suiClient.devInspectTransaction({
        transaction: txb,
        sender: providerAddress,
      })

      // 응답 파싱하여 NodeMetadata 객체로 변환
      if (response.results?.[0]?.returnValues) {
        const returnValues = response.results[0].returnValues

        const metadata: NodeMetadata = {
          cpu_cores: parseInt(String(Array.isArray(returnValues[0]) ? returnValues[0][0] : returnValues[0] || 8)),
          memory_gb: parseInt(String(Array.isArray(returnValues[1]) ? returnValues[1][0] : returnValues[1] || 16)),
          storage_gb: parseInt(String(Array.isArray(returnValues[2]) ? returnValues[2][0] : returnValues[2] || 500)),
          bandwidth_mbps: parseInt(String(Array.isArray(returnValues[3]) ? returnValues[3][0] : returnValues[3] || 1000)),
          region: String(Array.isArray(returnValues[4]) ? returnValues[4][0] : returnValues[4] || 'Asia-Seoul'),
          provider_address: providerAddress,
          status: parseInt(String(Array.isArray(returnValues[5]) ? returnValues[5][0] : returnValues[5] || NODE_STATUS.ACTIVE)),
          registered_at: parseInt(String(Array.isArray(returnValues[6]) ? returnValues[6][0] : returnValues[6] || Date.now())),
          last_updated: parseInt(String(Array.isArray(returnValues[7]) ? returnValues[7][0] : returnValues[7] || Date.now())),
        }

        console.log(`✅ 노드 메타데이터 조회 성공:`, metadata)
        return metadata
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
      const txb = new Transaction()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_TOTAL_NODES}`,
        arguments: [
          txb.object(this.registryObjectId),
        ],
      })

      const response = await this.suiClient.devInspectTransaction({
        transaction: txb,
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
      const txb = new Transaction()

      txb.moveCall({
        target: `${this.packageId}::${CONTRACT_CONFIG.MODULE_NAME}::${MOVE_FUNCTIONS.GET_ACTIVE_NODES}`,
        arguments: [
          txb.object(this.registryObjectId),
        ],
      })

      const response = await this.suiClient.devInspectTransaction({
        transaction: txb,
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
    try {
      // 실제 구현에서는 컨트랙트에서 전체 노드 목록을 조회하는 함수가 필요
      // 여기서는 활성 노드 수를 먼저 조회하고, 각 노드의 메타데이터를 개별적으로 조회
      const totalNodes = await this.getTotalNodes()
      const activeNodes = await this.getActiveNodes()

      console.log(`✅ 전체 노드: ${totalNodes}, 활성 노드: ${activeNodes}`)

      // 실제 구현에서는 컨트랙트에서 노드 주소 목록을 가져와야 함
      // 현재는 시뮬레이션을 위해 더미 주소들을 사용
      const mockProviderAddresses = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        '0x9876543210fedcba9876543210fedcba98765432',
        '0xfedcba0987654321fedcba0987654321fedcba09',
        '0x13579bdf02468ace13579bdf02468ace13579bdf'
      ]

      const nodeMetadataList: NodeMetadata[] = []

      for (const address of mockProviderAddresses) {
        try {
          const exists = await this.nodeExists(address)
          if (exists) {
            const metadata = await this.getNodeMetadata(address)
            if (metadata && metadata.status === NODE_STATUS.ACTIVE) {
              nodeMetadataList.push(metadata)
            }
          }
        } catch (error) {
          console.error(`노드 ${address} 조회 실패:`, error)
        }
      }

      console.log(`✅ ${nodeMetadataList.length}개의 활성 노드 조회 완료`)
      return nodeMetadataList
    } catch (error) {
      console.error('노드 리스트 조회 실패:', error)
      return []
    }
  }
}

// 싱글톤 인스턴스
export const nodeRegistryService = new NodeRegistryService()