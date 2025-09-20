// 컨트랙트 배포 전 테스트용 목 서비스

import { NodeMetadata, NODE_STATUS } from '@/contracts/types'

/**
 * 로컬 스토리지를 사용한 목 노드 레지스트리 서비스
 * 실제 컨트랙트 배포 전까지 사용
 */
export class MockNodeRegistryService {
  private storageKey = 'mock_node_registry'

  private getStorageData(): Record<string, NodeMetadata> {
    try {
      const data = localStorage.getItem(this.storageKey)
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  private setStorageData(data: Record<string, NodeMetadata>): void {
    localStorage.setItem(this.storageKey, JSON.stringify(data))
  }

  /**
   * 노드 등록
   */
  async registerNode(
    providerAddress: string,
    params: {
      cpu_cores: number
      memory_gb: number
      storage_gb: number
      bandwidth_mbps: number
      region: string
    }
  ): Promise<string> {
    const nodes = this.getStorageData()

    if (nodes[providerAddress]) {
      throw new Error('이미 등록된 노드가 있습니다.')
    }

    const nodeMetadata: NodeMetadata = {
      ...params,
      provider_address: providerAddress,
      status: NODE_STATUS.ACTIVE,
      registered_at: Date.now(),
      last_updated: Date.now(),
    }

    nodes[providerAddress] = nodeMetadata
    this.setStorageData(nodes)

    // 트랜잭션 해시 시뮬레이션
    return `0x${Math.random().toString(16).slice(2)}`
  }

  /**
   * 노드 정보 업데이트
   */
  async updateNode(
    providerAddress: string,
    params: {
      cpu_cores: number
      memory_gb: number
      storage_gb: number
      bandwidth_mbps: number
      region: string
    }
  ): Promise<string> {
    const nodes = this.getStorageData()

    if (!nodes[providerAddress]) {
      throw new Error('등록된 노드가 없습니다.')
    }

    nodes[providerAddress] = {
      ...nodes[providerAddress],
      ...params,
      last_updated: Date.now(),
    }

    this.setStorageData(nodes)
    return `0x${Math.random().toString(16).slice(2)}`
  }

  /**
   * 노드 상태 변경
   */
  async updateNodeStatus(
    providerAddress: string,
    status: number
  ): Promise<string> {
    const nodes = this.getStorageData()

    if (!nodes[providerAddress]) {
      throw new Error('등록된 노드가 없습니다.')
    }

    nodes[providerAddress].status = status
    nodes[providerAddress].last_updated = Date.now()

    this.setStorageData(nodes)
    return `0x${Math.random().toString(16).slice(2)}`
  }

  /**
   * 노드 삭제
   */
  async removeNode(providerAddress: string): Promise<string> {
    const nodes = this.getStorageData()

    if (!nodes[providerAddress]) {
      throw new Error('등록된 노드가 없습니다.')
    }

    delete nodes[providerAddress]
    this.setStorageData(nodes)
    return `0x${Math.random().toString(16).slice(2)}`
  }

  /**
   * 노드 존재 여부 확인
   */
  async nodeExists(providerAddress: string): Promise<boolean> {
    const nodes = this.getStorageData()
    return !!nodes[providerAddress]
  }

  /**
   * 노드 메타데이터 조회
   */
  async getNodeMetadata(providerAddress: string): Promise<NodeMetadata | null> {
    const nodes = this.getStorageData()
    return nodes[providerAddress] || null
  }

  /**
   * 모든 노드 리스트 조회
   */
  async getAllNodes(): Promise<NodeMetadata[]> {
    const nodes = this.getStorageData()
    return Object.values(nodes)
  }

  /**
   * 전체 노드 수 조회
   */
  async getTotalNodes(): Promise<number> {
    const nodes = this.getStorageData()
    return Object.keys(nodes).length
  }

  /**
   * 활성 노드 수 조회
   */
  async getActiveNodes(): Promise<number> {
    const nodes = this.getStorageData()
    return Object.values(nodes).filter(node => node.status === NODE_STATUS.ACTIVE).length
  }
}

// 싱글톤 인스턴스
export const mockNodeRegistryService = new MockNodeRegistryService()