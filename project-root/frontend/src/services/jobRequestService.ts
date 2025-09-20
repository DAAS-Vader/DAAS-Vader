// 작업 요청 컨트랙트 연동 서비스

import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import {
  JOB_CONTRACT_CONFIG,
  JOB_MOVE_FUNCTIONS,
  JobRequest,
  JobRequirements,
  JOB_STATUS
} from '@/contracts/types'

export class JobRequestService {
  private suiClient: SuiClient
  private packageId: string
  private registryObjectId: string

  constructor(rpcUrl: string = 'https://fullnode.devnet.sui.io:443') {
    this.suiClient = new SuiClient({ url: rpcUrl })
    this.packageId = JOB_CONTRACT_CONFIG.PACKAGE_ID
    this.registryObjectId = JOB_CONTRACT_CONFIG.REGISTRY_OBJECT_ID
  }

  /**
   * 새 작업 요청 생성 (즉시 실행)
   */
  async createJobRequest(
    signer: Ed25519Keypair | null,
    params: {
      providerAddress: string
      projectName: string
      requirements: JobRequirements
      estimatedDuration: number
      offeredPrice: number
    }
  ): Promise<string> {
    console.log('🚀 작업 요청 생성:', {
      provider: params.providerAddress,
      project: params.projectName,
      price: params.offeredPrice
    })

    try {
      const txb = new Transaction()

      txb.moveCall({
        target: `${this.packageId}::${JOB_CONTRACT_CONFIG.MODULE_NAME}::${JOB_MOVE_FUNCTIONS.CREATE_JOB_REQUEST}`,
        arguments: [
          txb.object(this.registryObjectId),
          txb.pure(params.providerAddress),
          txb.pure(params.projectName),
          txb.pure(params.requirements.cpu_cores),
          txb.pure(params.requirements.memory_gb),
          txb.pure(params.requirements.storage_gb),
          txb.pure(params.requirements.bandwidth_mbps),
          txb.pure(params.estimatedDuration),
          txb.pure(params.offeredPrice),
        ],
      })

      // 실제 환경에서는 signer를 사용하여 트랜잭션을 실행
      if (signer) {
        const result = await this.suiClient.signAndExecuteTransaction({
          signer,
          transaction: txb,
          options: {
            showEffects: true,
            showEvents: true,
          },
        })

        if (result.effects?.status?.status !== 'success') {
          throw new Error(`작업 요청 생성 실패: ${result.effects?.status?.error}`)
        }

        console.log('✅ 작업 요청 생성 완료, 제공자에게 이벤트 전송됨')
        return result.digest
      } else {
        // 시뮬레이션 모드
        const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`
        console.log('✅ 작업 요청 생성 시뮬레이션 완료, 제공자에게 이벤트 전송 시뮬레이션')

        // 제공자에게 즉시 알림 시뮬레이션
        this.notifyProvider(params.providerAddress, {
          type: 'NEW_JOB_REQUEST',
          projectName: params.projectName,
          requirements: params.requirements,
          offeredPrice: params.offeredPrice,
          transactionHash: mockTxHash
        })

        return mockTxHash
      }
    } catch (error) {
      console.error('작업 요청 생성 실패:', error)
      throw error
    }
  }

  /**
   * 제공자에게 즉시 알림 (시뮬레이션)
   */
  private notifyProvider(providerAddress: string, eventData: any) {
    // 실제 환경에서는 웹소켓이나 이벤트 구독을 통해 제공자에게 알림
    console.log(`📢 제공자 ${providerAddress}에게 알림:`, eventData)

    // 브라우저 이벤트 발생으로 실시간 알림 시뮬레이션
    window.dispatchEvent(new CustomEvent('nodeJobRequest', {
      detail: {
        providerAddress,
        ...eventData
      }
    }))
  }

  /**
   * 제공자의 요청 목록 조회 (시뮬레이션)
   */
  async getProviderRequests(providerAddress: string): Promise<JobRequest[]> {
    try {
      // 실제 컨트랙트가 배포되지 않았으므로 시뮬레이션 모드로 동작
      console.log(`✅ 제공자 ${providerAddress}의 요청 목록 조회 (시뮬레이션)`)

      // 시뮬레이션용 더미 데이터 반환
      const mockRequests: JobRequest[] = []

      return mockRequests
    } catch (error) {
      console.error('제공자 요청 목록 조회 실패:', error)
      return []
    }
  }

  /**
   * 실시간 이벤트 구독 (브라우저 이벤트 기반)
   */
  subscribeToJobEvents(
    providerAddress: string,
    callback: (event: any) => void
  ): () => void {
    const handleJobRequest = (event: CustomEvent) => {
      if (event.detail.providerAddress === providerAddress) {
        callback(event.detail)
      }
    }

    window.addEventListener('nodeJobRequest', handleJobRequest as EventListener)

    console.log(`📡 제공자 ${providerAddress}의 작업 요청 이벤트 구독 시작`)

    // 정리 함수 반환
    return () => {
      window.removeEventListener('nodeJobRequest', handleJobRequest as EventListener)
      console.log(`📡 제공자 ${providerAddress}의 작업 요청 이벤트 구독 해제`)
    }
  }

  /**
   * 사용자의 현재 활성 작업 확인 (시뮬레이션)
   */
  async getUserActiveJobs(userAddress: string): Promise<JobRequest[]> {
    try {
      // 실제 컨트랙트가 배포되지 않았으므로 시뮬레이션 모드로 동작
      console.log(`✅ 사용자 ${userAddress}의 활성 작업 조회 (시뮬레이션)`)

      // 시뮬레이션용 더미 데이터 반환
      const mockActiveJobs: JobRequest[] = []

      return mockActiveJobs
    } catch (error) {
      console.error('사용자 활성 작업 조회 실패:', error)
      return []
    }
  }
}

// 싱글톤 인스턴스
export const jobRequestService = new JobRequestService()