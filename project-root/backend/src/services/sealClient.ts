import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { SealService } from './sealService.js';
import { config } from '../config/index.js';
import { ServiceError } from '../types/index.js';
import crypto from 'crypto';

// Move 컨트랙트 타입 정의
export interface SealRegistry {
  objectId: string;
  version: string;
  digest: string;
}

export interface EnclaveRegistry {
  objectId: string;
  version: string;
  digest: string;
}

export interface SessionKey {
  keyId: string;
  publicKey: string;
  privateKey: string;
  identity: Uint8Array;
  expiresAt: number;
  permissions: DataType[];
  isActive: boolean;
}

export enum DataType {
  SECRETS = 0,
  CONFIG = 1,
  LOGS = 2,
  PUBLIC = 3
}

export enum Operation {
  READ = 0,
  WRITE = 1,
  DELETE = 2
}

export interface AccessValidationResult {
  approved: boolean;
  reason?: string;
  sessionDuration?: number;
}

export interface SealClientConfig {
  suiClient: SuiClient;
  packageId: string;
  sealRegistryId: string;
  enclaveRegistryId: string;
  adminKeypair?: Ed25519Keypair;
  defaultIdentity?: Uint8Array;
}

/**
 * 완전한 Walrus Seal 클라이언트
 * Move 컨트랙트와 TypeScript SDK 통합
 */
export class SealClient {
  private suiClient: SuiClient;
  private packageId: string;
  private sealRegistryId: string;
  private enclaveRegistryId: string;
  private adminKeypair?: Ed25519Keypair;
  private sealService: SealService;
  private defaultIdentity?: Uint8Array;
  private sessionKeys: Map<string, SessionKey> = new Map();

  constructor(config: SealClientConfig) {
    this.suiClient = config.suiClient;
    this.packageId = normalizeSuiAddress(config.packageId);
    this.sealRegistryId = normalizeSuiAddress(config.sealRegistryId);
    this.enclaveRegistryId = normalizeSuiAddress(config.enclaveRegistryId);
    this.adminKeypair = config.adminKeypair;
    this.defaultIdentity = config.defaultIdentity;
    this.sealService = new SealService();
  }

  // ==================== 접근 제어 함수들 ====================

  /**
   * Enclave 접근 권한 검증
   */
  async verifyEnclaveAccess(
    identity: Uint8Array,
    keypair?: Ed25519Keypair
  ): Promise<AccessValidationResult> {
    try {
      const txb = new Transaction();

      const clock = txb.object('0x6');

      txb.moveCall({
        target: `${this.packageId}::seal_access_control::verify_enclave_access`,
        arguments: [
          txb.pure.vector('u8', Array.from(identity)),
          txb.object(this.sealRegistryId),
          clock
        ]
      });

      const result = await this.suiClient.dryRunTransactionBlock({
        transactionBlock: await txb.build({ client: this.suiClient })
      });

      if (result.effects?.status?.status === 'success') {
        return {
          approved: true,
          sessionDuration: 3600000 // 1시간
        };
      } else {
        const error = result.effects?.status?.error || 'Unknown error';
        return {
          approved: false,
          reason: `Enclave access denied: ${error}`
        };
      }

    } catch (error) {
      return {
        approved: false,
        reason: `Enclave verification failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 데이터 타입별 접근 권한 검증
   */
  async verifyDataAccess(
    identity: Uint8Array,
    dataType: DataType,
    keypair?: Ed25519Keypair
  ): Promise<AccessValidationResult> {
    try {
      const txb = new Transaction();

      const clock = txb.object('0x6');

      txb.moveCall({
        target: `${this.packageId}::seal_access_control::verify_data_access`,
        arguments: [
          txb.pure.vector('u8', Array.from(identity)),
          txb.pure.u8(dataType),
          txb.object(this.sealRegistryId),
          clock
        ]
      });

      const result = await this.suiClient.dryRunTransactionBlock({
        transactionBlock: await txb.build({ client: this.suiClient })
      });

      if (result.effects?.status?.status === 'success') {
        return {
          approved: true,
          sessionDuration: this.getSessionDurationByDataType(dataType)
        };
      } else {
        const error = result.effects?.status?.error || 'Unknown error';
        return {
          approved: false,
          reason: `Data access denied: ${error}`
        };
      }

    } catch (error) {
      return {
        approved: false,
        reason: `Data access verification failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 패키지별 접근 권한 검증
   */
  async verifyPackageAccess(
    identity: Uint8Array,
    packageAddr: string,
    keypair?: Ed25519Keypair
  ): Promise<AccessValidationResult> {
    try {
      const txb = new Transaction();

      const clock = txb.object('0x6');

      txb.moveCall({
        target: `${this.packageId}::seal_access_control::verify_package_access`,
        arguments: [
          txb.pure.vector('u8', Array.from(identity)),
          txb.pure.address(normalizeSuiAddress(packageAddr)),
          txb.object(this.sealRegistryId),
          clock
        ]
      });

      const result = await this.suiClient.dryRunTransactionBlock({
        transactionBlock: await txb.build({ client: this.suiClient })
      });

      if (result.effects?.status?.status === 'success') {
        return {
          approved: true,
          sessionDuration: 3600000 // 1시간
        };
      } else {
        const error = result.effects?.status?.error || 'Unknown error';
        return {
          approved: false,
          reason: `Package access denied: ${error}`
        };
      }

    } catch (error) {
      return {
        approved: false,
        reason: `Package access verification failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 작업별 접근 권한 검증
   */
  async verifyOperation(
    identity: Uint8Array,
    operation: Operation,
    resourceType: number,
    keypair?: Ed25519Keypair
  ): Promise<AccessValidationResult> {
    try {
      const txb = new Transaction();

      const clock = txb.object('0x6');

      txb.moveCall({
        target: `${this.packageId}::seal_access_control::verify_operation`,
        arguments: [
          txb.pure.vector('u8', Array.from(identity)),
          txb.pure.u8(operation),
          txb.pure.u8(resourceType),
          txb.object(this.sealRegistryId),
          clock
        ]
      });

      const result = await this.suiClient.dryRunTransactionBlock({
        transactionBlock: await txb.build({ client: this.suiClient })
      });

      if (result.effects?.status?.status === 'success') {
        return {
          approved: true,
          sessionDuration: this.getSessionDurationByOperation(operation)
        };
      } else {
        const error = result.effects?.status?.error || 'Unknown error';
        return {
          approved: false,
          reason: `Operation access denied: ${error}`
        };
      }

    } catch (error) {
      return {
        approved: false,
        reason: `Operation verification failed: ${(error as Error).message}`
      };
    }
  }

  // ==================== 세션 키 관리 ====================

  /**
   * 새로운 세션 키 생성
   */
  async createSessionKey(
    identity?: Uint8Array,
    permissions: DataType[] = [DataType.CONFIG, DataType.LOGS],
    durationMs: number = 3600000 // 1시간
  ): Promise<SessionKey> {
    const keyId = crypto.randomUUID();
    const keypair = Ed25519Keypair.generate();
    const effectiveIdentity = identity || this.defaultIdentity;

    if (!effectiveIdentity) {
      throw new ServiceError('Identity is required for session key creation', 400);
    }

    // 세션 키에 대한 권한 검증
    const accessResult = await this.verifyEnclaveAccess(effectiveIdentity);
    if (!accessResult.approved) {
      throw new ServiceError(`Session key creation denied: ${accessResult.reason}`, 403);
    }

    const sessionKey: SessionKey = {
      keyId,
      publicKey: keypair.getPublicKey().toBase64(),
      privateKey: keypair.getSecretKey(),
      identity: effectiveIdentity,
      expiresAt: Date.now() + durationMs,
      permissions,
      isActive: true
    };

    this.sessionKeys.set(keyId, sessionKey);

    console.log(`🔑 Created session key ${keyId} for identity ${Buffer.from(effectiveIdentity).toString('hex')}`);

    return sessionKey;
  }

  /**
   * 세션 키 검증
   */
  async validateSessionKey(keyId: string): Promise<SessionKey | null> {
    const sessionKey = this.sessionKeys.get(keyId);

    if (!sessionKey) {
      return null;
    }

    if (!sessionKey.isActive || Date.now() > sessionKey.expiresAt) {
      this.sessionKeys.delete(keyId);
      return null;
    }

    return sessionKey;
  }

  /**
   * 세션 키 폐기
   */
  async revokeSessionKey(keyId: string): Promise<boolean> {
    const sessionKey = this.sessionKeys.get(keyId);

    if (sessionKey) {
      sessionKey.isActive = false;
      this.sessionKeys.delete(keyId);
      console.log(`🔑 Revoked session key ${keyId}`);
      return true;
    }

    return false;
  }

  /**
   * 만료된 세션 키 정리
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [keyId, sessionKey] of this.sessionKeys.entries()) {
      if (!sessionKey.isActive || now > sessionKey.expiresAt) {
        this.sessionKeys.delete(keyId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired session keys`);
    }

    return cleaned;
  }

  // ==================== 암호화/복호화 워크플로우 ====================

  /**
   * 보안 데이터 암호화 및 업로드
   */
  async encryptAndUpload(
    data: Buffer,
    identity?: Uint8Array,
    dataType: DataType = DataType.SECRETS,
    sessionKeyId?: string
  ): Promise<{ cid: string; dekVersion: string; sessionKeyId: string }> {
    const effectiveIdentity = identity || this.defaultIdentity;

    if (!effectiveIdentity) {
      throw new ServiceError('Identity is required for encryption', 400);
    }

    // 데이터 타입별 접근 권한 검증
    const accessResult = await this.verifyDataAccess(effectiveIdentity, dataType);
    if (!accessResult.approved) {
      throw new ServiceError(`Encryption denied: ${accessResult.reason}`, 403);
    }

    // 세션 키 처리
    let sessionKey: SessionKey;
    if (sessionKeyId) {
      const existingKey = await this.validateSessionKey(sessionKeyId);
      if (!existingKey) {
        throw new ServiceError('Invalid or expired session key', 401);
      }
      sessionKey = existingKey;
    } else {
      sessionKey = await this.createSessionKey(
        effectiveIdentity,
        [dataType],
        accessResult.sessionDuration || 3600000
      );
    }

    // 데이터 권한 재검증 (세션 키 권한 확인)
    if (!sessionKey.permissions.includes(dataType)) {
      throw new ServiceError(`Session key does not have permission for data type ${dataType}`, 403);
    }

    // Seal 서비스를 통한 암호화 및 업로드
    const sealResult = await this.sealService.encryptAndUpload(data);

    console.log(`🔒 Encrypted and uploaded data with CID: ${sealResult.cid}, DEK version: ${sealResult.dek_version}`);

    return {
      cid: sealResult.cid,
      dekVersion: sealResult.dek_version.toString(),
      sessionKeyId: sessionKey.keyId
    };
  }

  /**
   * 복호화 티켓 생성
   */
  async createDecryptionTicket(
    cid: string,
    nodeId: string,
    leaseId: string,
    identity?: Uint8Array,
    dataType: DataType = DataType.SECRETS,
    sessionKeyId?: string
  ): Promise<{ ticket: string; exp: number; jti: string }> {
    const effectiveIdentity = identity || this.defaultIdentity;

    if (!effectiveIdentity) {
      throw new ServiceError('Identity is required for decryption ticket', 400);
    }

    // 세션 키 검증
    if (sessionKeyId) {
      const sessionKey = await this.validateSessionKey(sessionKeyId);
      if (!sessionKey) {
        throw new ServiceError('Invalid or expired session key', 401);
      }

      if (!sessionKey.permissions.includes(dataType)) {
        throw new ServiceError(`Session key does not have permission for data type ${dataType}`, 403);
      }
    }

    // 데이터 접근 권한 재검증
    const accessResult = await this.verifyDataAccess(effectiveIdentity, dataType);
    if (!accessResult.approved) {
      throw new ServiceError(`Decryption ticket denied: ${accessResult.reason}`, 403);
    }

    // 티켓 생성
    const ticket = await this.sealService.generateTicket(leaseId, cid, nodeId);

    console.log(`🎫 Created decryption ticket for CID: ${cid}, Node: ${nodeId}`);

    return ticket;
  }

  // ==================== 유틸리티 함수들 ====================

  /**
   * 데이터 타입별 세션 지속 시간 계산
   */
  private getSessionDurationByDataType(dataType: DataType): number {
    switch (dataType) {
      case DataType.SECRETS:
        return 1800000; // 30분
      case DataType.CONFIG:
        return 3600000; // 1시간
      case DataType.LOGS:
        return 7200000; // 2시간
      case DataType.PUBLIC:
        return 86400000; // 24시간
      default:
        return 3600000; // 1시간 (기본값)
    }
  }

  /**
   * 작업별 세션 지속 시간 계산
   */
  private getSessionDurationByOperation(operation: Operation): number {
    switch (operation) {
      case Operation.READ:
        return 3600000; // 1시간
      case Operation.WRITE:
        return 1800000; // 30분
      case Operation.DELETE:
        return 900000; // 15분
      default:
        return 3600000; // 1시간 (기본값)
    }
  }

  /**
   * 기본 identity 설정
   */
  setDefaultIdentity(identity: Uint8Array): void {
    this.defaultIdentity = identity;
  }

  /**
   * 활성 세션 키 목록 반환
   */
  getActiveSessions(): SessionKey[] {
    const now = Date.now();
    return Array.from(this.sessionKeys.values()).filter(
      key => key.isActive && now <= key.expiresAt
    );
  }

  /**
   * 레지스트리 상태 확인
   */
  async getRegistryInfo(): Promise<{ sealRegistry: any; enclaveRegistry: any }> {
    try {
      const [sealRegistry, enclaveRegistry] = await Promise.all([
        this.suiClient.getObject({
          id: this.sealRegistryId,
          options: { showContent: true }
        }),
        this.suiClient.getObject({
          id: this.enclaveRegistryId,
          options: { showContent: true }
        })
      ]);

      return { sealRegistry, enclaveRegistry };
    } catch (error) {
      throw new ServiceError(`Failed to get registry info: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Seal 서비스 상태 확인
   */
  async healthCheck(): Promise<{ sealService: boolean; registries: boolean }> {
    try {
      const [sealHealthy, registryInfo] = await Promise.all([
        this.sealService.healthCheck(),
        this.getRegistryInfo().then(() => true).catch(() => false)
      ]);

      return {
        sealService: sealHealthy,
        registries: registryInfo
      };
    } catch (error) {
      return {
        sealService: false,
        registries: false
      };
    }
  }
}