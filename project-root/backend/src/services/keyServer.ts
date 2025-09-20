import crypto from 'crypto';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient, DataType } from './sealClient.js';
import { ServiceError } from '../types/index.js';

// 키 서버 모드
export enum KeyServerMode {
  OPEN = 'open',           // 누구나 키 요청 가능
  PERMISSIONED = 'permissioned'  // 승인된 클라이언트만 키 요청 가능
}

// 키 타입
export enum KeyType {
  SESSION = 'session',     // 세션 키
  ENCRYPTION = 'encryption', // 암호화 키
  SIGNING = 'signing'      // 서명 키
}

// 키 상태
export enum KeyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  PENDING = 'pending'
}

// 키 메타데이터
export interface KeyMetadata {
  keyId: string;
  keyType: KeyType;
  status: KeyStatus;
  createdAt: number;
  expiresAt: number;
  lastUsed?: number;
  usageCount: number;
  maxUsage?: number;
  clientId?: string;
  identity: Uint8Array;
  permissions: DataType[];
  rotationPolicy?: RotationPolicy;
}

// 키 회전 정책
export interface RotationPolicy {
  enabled: boolean;
  intervalMs: number;      // 회전 주기 (밀리초)
  maxAge: number;         // 최대 키 수명
  preRotationPeriod: number; // 미리 회전 시작 시간
  retentionPeriod: number;   // 이전 키 보존 기간
}

// 클라이언트 권한
export interface ClientPermission {
  clientId: string;
  allowedKeyTypes: KeyType[];
  allowedDataTypes: DataType[];
  maxConcurrentKeys: number;
  maxKeyLifetime: number;
  rateLimit: RateLimitConfig;
  isActive: boolean;
  createdAt: number;
  lastAccess?: number;
}

// 속도 제한 설정
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
}

// 키 요청
export interface KeyRequest {
  clientId?: string;
  keyType: KeyType;
  dataTypes: DataType[];
  lifetime?: number;
  identity?: Uint8Array;
  metadata?: Record<string, any>;
}

// 키 응답
export interface KeyResponse {
  keyId: string;
  publicKey?: string;
  privateKey?: string;
  expiresAt: number;
  keyType: KeyType;
  permissions: DataType[];
  metadata: Record<string, any>;
}

// 키 서버 설정
export interface KeyServerConfig {
  mode: KeyServerMode;
  sealClient: SealClient;
  suiClient: SuiClient;
  adminKeypair?: Ed25519Keypair;

  // 기본 정책
  defaultRotationPolicy: RotationPolicy;
  defaultRateLimit: RateLimitConfig;
  maxConcurrentKeys: number;

  // 보안 설정
  keyEncryptionKey?: string;  // 키 암호화용 마스터 키
  backupEnabled: boolean;
  auditEnabled: boolean;
}

/**
 * Walrus Seal 키 서버
 * Open/Permissioned 모드 지원
 */
export class KeyServer {
  private mode: KeyServerMode;
  private sealClient: SealClient;
  private suiClient: SuiClient;
  private adminKeypair?: Ed25519Keypair;

  // 키 저장소 (프로덕션에서는 안전한 외부 저장소 사용)
  private keys: Map<string, KeyMetadata> = new Map();
  private keyData: Map<string, { publicKey: string; privateKey: string }> = new Map();

  // 클라이언트 관리
  private clients: Map<string, ClientPermission> = new Map();

  // 속도 제한 추적
  private rateLimitTracker: Map<string, { requests: number[]; lastReset: number }> = new Map();

  // 설정
  private config: KeyServerConfig;

  // 회전 타이머
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: KeyServerConfig) {
    this.mode = config.mode;
    this.sealClient = config.sealClient;
    this.suiClient = config.suiClient;
    this.adminKeypair = config.adminKeypair;
    this.config = config;

    // 기본 클라이언트 설정 (OPEN 모드에서도 기본 제한 적용)
    this.setupDefaultPolicies();

    console.log(`🔐 Key Server initialized in ${this.mode.toUpperCase()} mode`);
  }

  // ==================== 키 생성 및 관리 ====================

  /**
   * 새로운 키 생성
   */
  async generateKey(request: KeyRequest): Promise<KeyResponse> {
    // 1. 권한 검증
    await this.validateKeyRequest(request);

    // 2. 속도 제한 확인
    if (request.clientId) {
      await this.checkRateLimit(request.clientId);
    }

    // 3. 키 생성
    const keyId = crypto.randomUUID();
    const keypair = Ed25519Keypair.generate();

    const now = Date.now();
    const lifetime = request.lifetime || this.getDefaultLifetime(request.keyType);
    const expiresAt = now + lifetime;

    // 4. 메타데이터 생성
    const metadata: KeyMetadata = {
      keyId,
      keyType: request.keyType,
      status: KeyStatus.ACTIVE,
      createdAt: now,
      expiresAt,
      usageCount: 0,
      clientId: request.clientId,
      identity: request.identity || new Uint8Array(),
      permissions: request.dataTypes,
      rotationPolicy: this.config.defaultRotationPolicy
    };

    // 5. 키 저장
    this.keys.set(keyId, metadata);
    this.keyData.set(keyId, {
      publicKey: keypair.getPublicKey().toBase64(),
      privateKey: keypair.getSecretKey()
    });

    // 6. 회전 스케줄링
    if (metadata.rotationPolicy?.enabled) {
      this.scheduleKeyRotation(keyId);
    }

    // 7. Seal 클라이언트와 통합 (세션 키의 경우)
    if (request.keyType === KeyType.SESSION) {
      try {
        await this.sealClient.createSessionKey(
          request.identity,
          request.dataTypes,
          lifetime
        );
      } catch (error) {
        console.warn(`⚠️ Failed to register session with SealClient: ${(error as Error).message}`);
      }
    }

    // 8. 사용량 추적 업데이트
    this.updateUsageTracking(request.clientId);

    console.log(`🔑 Generated ${request.keyType} key ${keyId} for client ${request.clientId || 'anonymous'}`);

    return {
      keyId,
      publicKey: keypair.getPublicKey().toBase64(),
      privateKey: request.keyType === KeyType.SESSION ? keypair.getSecretKey() : undefined,
      expiresAt,
      keyType: request.keyType,
      permissions: request.dataTypes,
      metadata: request.metadata || {}
    };
  }

  /**
   * 키 조회
   */
  async getKey(keyId: string, clientId?: string): Promise<KeyResponse | null> {
    const metadata = this.keys.get(keyId);
    if (!metadata) {
      return null;
    }

    // 권한 확인
    if (this.mode === KeyServerMode.PERMISSIONED && clientId !== metadata.clientId) {
      throw new ServiceError('Unauthorized key access', 403);
    }

    // 상태 확인
    if (metadata.status !== KeyStatus.ACTIVE) {
      return null;
    }

    // 만료 확인
    if (Date.now() > metadata.expiresAt) {
      metadata.status = KeyStatus.EXPIRED;
      return null;
    }

    const keyData = this.keyData.get(keyId);
    if (!keyData) {
      throw new ServiceError('Key data not found', 404);
    }

    // 사용량 추적
    metadata.lastUsed = Date.now();
    metadata.usageCount++;

    return {
      keyId,
      publicKey: keyData.publicKey,
      privateKey: metadata.keyType === KeyType.SESSION ? keyData.privateKey : undefined,
      expiresAt: metadata.expiresAt,
      keyType: metadata.keyType,
      permissions: metadata.permissions,
      metadata: {}
    };
  }

  /**
   * 키 폐기
   */
  async revokeKey(keyId: string, clientId?: string): Promise<boolean> {
    const metadata = this.keys.get(keyId);
    if (!metadata) {
      return false;
    }

    // 권한 확인
    if (this.mode === KeyServerMode.PERMISSIONED && clientId !== metadata.clientId) {
      throw new ServiceError('Unauthorized key revocation', 403);
    }

    // 상태 업데이트
    metadata.status = KeyStatus.REVOKED;

    // 회전 타이머 정리
    const timer = this.rotationTimers.get(keyId);
    if (timer) {
      clearTimeout(timer);
      this.rotationTimers.delete(keyId);
    }

    // Seal 클라이언트에서도 폐기
    if (metadata.keyType === KeyType.SESSION) {
      try {
        await this.sealClient.revokeSessionKey(keyId);
      } catch (error) {
        console.warn(`⚠️ Failed to revoke session in SealClient: ${(error as Error).message}`);
      }
    }

    console.log(`🗑️ Revoked key ${keyId}`);
    return true;
  }

  // ==================== 클라이언트 관리 ====================

  /**
   * 클라이언트 등록 (Permissioned 모드)
   */
  async registerClient(
    clientId: string,
    permissions: Partial<ClientPermission>
  ): Promise<ClientPermission> {
    if (this.mode !== KeyServerMode.PERMISSIONED) {
      throw new ServiceError('Client registration only available in permissioned mode', 400);
    }

    const clientPermission: ClientPermission = {
      clientId,
      allowedKeyTypes: permissions.allowedKeyTypes || [KeyType.SESSION],
      allowedDataTypes: permissions.allowedDataTypes || [DataType.CONFIG, DataType.LOGS],
      maxConcurrentKeys: permissions.maxConcurrentKeys || 10,
      maxKeyLifetime: permissions.maxKeyLifetime || 3600000, // 1시간
      rateLimit: permissions.rateLimit || this.config.defaultRateLimit,
      isActive: true,
      createdAt: Date.now()
    };

    this.clients.set(clientId, clientPermission);

    console.log(`👤 Registered client ${clientId} in permissioned mode`);
    return clientPermission;
  }

  /**
   * 클라이언트 권한 업데이트
   */
  async updateClientPermissions(
    clientId: string,
    updates: Partial<ClientPermission>
  ): Promise<ClientPermission | null> {
    const existing = this.clients.get(clientId);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates };
    this.clients.set(clientId, updated);

    console.log(`🔄 Updated permissions for client ${clientId}`);
    return updated;
  }

  /**
   * 클라이언트 비활성화
   */
  async deactivateClient(clientId: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.isActive = false;

    // 해당 클라이언트의 모든 키 폐기
    for (const [keyId, metadata] of this.keys.entries()) {
      if (metadata.clientId === clientId && metadata.status === KeyStatus.ACTIVE) {
        await this.revokeKey(keyId);
      }
    }

    console.log(`❌ Deactivated client ${clientId} and revoked all keys`);
    return true;
  }

  // ==================== 키 회전 ====================

  /**
   * 키 회전 스케줄링
   */
  private scheduleKeyRotation(keyId: string): void {
    const metadata = this.keys.get(keyId);
    if (!metadata?.rotationPolicy?.enabled) {
      return;
    }

    const policy = metadata.rotationPolicy;
    const rotationTime = metadata.createdAt + policy.intervalMs - policy.preRotationPeriod;
    const delay = Math.max(0, rotationTime - Date.now());

    const timer = setTimeout(async () => {
      await this.rotateKey(keyId);
    }, delay);

    this.rotationTimers.set(keyId, timer);
  }

  /**
   * 키 회전 실행
   */
  async rotateKey(keyId: string): Promise<string | null> {
    const metadata = this.keys.get(keyId);
    if (!metadata || metadata.status !== KeyStatus.ACTIVE) {
      return null;
    }

    try {
      // 새 키 생성
      const newKeyRequest: KeyRequest = {
        clientId: metadata.clientId,
        keyType: metadata.keyType,
        dataTypes: metadata.permissions,
        lifetime: metadata.expiresAt - metadata.createdAt,
        identity: metadata.identity
      };

      const newKey = await this.generateKey(newKeyRequest);

      // 이전 키는 grace period 후에 폐기
      const graceTimer = setTimeout(async () => {
        await this.revokeKey(keyId);
      }, metadata.rotationPolicy?.retentionPeriod || 300000); // 기본 5분

      console.log(`🔄 Rotated key ${keyId} to new key ${newKey.keyId}`);
      return newKey.keyId;

    } catch (error) {
      console.error(`❌ Failed to rotate key ${keyId}: ${(error as Error).message}`);
      return null;
    }
  }

  // ==================== 헬퍼 함수들 ====================

  private setupDefaultPolicies(): void {
    // 기본 클라이언트 (Open 모드용)
    if (this.mode === KeyServerMode.OPEN) {
      this.clients.set('anonymous', {
        clientId: 'anonymous',
        allowedKeyTypes: [KeyType.SESSION, KeyType.ENCRYPTION],
        allowedDataTypes: [DataType.CONFIG, DataType.LOGS, DataType.PUBLIC],
        maxConcurrentKeys: 5,
        maxKeyLifetime: 3600000, // 1시간
        rateLimit: this.config.defaultRateLimit,
        isActive: true,
        createdAt: Date.now()
      });
    }
  }

  private async validateKeyRequest(request: KeyRequest): Promise<void> {
    const clientId = request.clientId || 'anonymous';

    if (this.mode === KeyServerMode.PERMISSIONED && !this.clients.has(clientId)) {
      throw new ServiceError('Client not registered', 403);
    }

    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      throw new ServiceError('Client not authorized', 403);
    }

    // 키 타입 검증
    if (!client.allowedKeyTypes.includes(request.keyType)) {
      throw new ServiceError(`Key type ${request.keyType} not allowed`, 403);
    }

    // 데이터 타입 검증
    for (const dataType of request.dataTypes) {
      if (!client.allowedDataTypes.includes(dataType)) {
        throw new ServiceError(`Data type ${dataType} not allowed`, 403);
      }
    }

    // 동시 키 수 확인
    const activeKeys = Array.from(this.keys.values()).filter(
      k => k.clientId === clientId && k.status === KeyStatus.ACTIVE
    );

    if (activeKeys.length >= client.maxConcurrentKeys) {
      throw new ServiceError('Maximum concurrent keys exceeded', 429);
    }

    // 키 수명 확인
    const requestedLifetime = request.lifetime || this.getDefaultLifetime(request.keyType);
    if (requestedLifetime > client.maxKeyLifetime) {
      throw new ServiceError('Requested key lifetime exceeds maximum', 400);
    }
  }

  private async checkRateLimit(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const now = Date.now();
    const windowMinute = Math.floor(now / 60000);
    const windowHour = Math.floor(now / 3600000);

    let tracker = this.rateLimitTracker.get(clientId);
    if (!tracker) {
      tracker = { requests: [], lastReset: now };
      this.rateLimitTracker.set(clientId, tracker);
    }

    // 시간 창 정리
    tracker.requests = tracker.requests.filter(
      time => now - time < 3600000 // 1시간 내의 요청만 유지
    );

    // 분당 제한 확인
    const recentRequests = tracker.requests.filter(
      time => now - time < 60000 // 1분 내
    );

    if (recentRequests.length >= client.rateLimit.requestsPerMinute) {
      throw new ServiceError('Rate limit exceeded (per minute)', 429);
    }

    // 시간당 제한 확인
    if (tracker.requests.length >= client.rateLimit.requestsPerHour) {
      throw new ServiceError('Rate limit exceeded (per hour)', 429);
    }

    // 요청 기록
    tracker.requests.push(now);
  }

  private updateUsageTracking(clientId?: string): void {
    if (!clientId) return;

    const client = this.clients.get(clientId);
    if (client) {
      client.lastAccess = Date.now();
    }
  }

  private getDefaultLifetime(keyType: KeyType): number {
    switch (keyType) {
      case KeyType.SESSION:
        return 3600000; // 1시간
      case KeyType.ENCRYPTION:
        return 86400000; // 24시간
      case KeyType.SIGNING:
        return 604800000; // 7일
      default:
        return 3600000;
    }
  }

  // ==================== 상태 및 통계 ====================

  /**
   * 서버 상태 조회
   */
  getServerStatus(): {
    mode: KeyServerMode;
    totalKeys: number;
    activeKeys: number;
    totalClients: number;
    activeClients: number;
    uptime: number;
  } {
    const totalKeys = this.keys.size;
    const activeKeys = Array.from(this.keys.values()).filter(
      k => k.status === KeyStatus.ACTIVE
    ).length;

    const totalClients = this.clients.size;
    const activeClients = Array.from(this.clients.values()).filter(
      c => c.isActive
    ).length;

    return {
      mode: this.mode,
      totalKeys,
      activeKeys,
      totalClients,
      activeClients,
      uptime: process.uptime() * 1000
    };
  }

  /**
   * 클라이언트별 통계
   */
  getClientStats(clientId: string): any {
    const client = this.clients.get(clientId);
    if (!client) return null;

    const clientKeys = Array.from(this.keys.values()).filter(
      k => k.clientId === clientId
    );

    const activeKeys = clientKeys.filter(k => k.status === KeyStatus.ACTIVE);
    const totalUsage = clientKeys.reduce((sum, k) => sum + k.usageCount, 0);

    return {
      client,
      keyStats: {
        total: clientKeys.length,
        active: activeKeys.length,
        expired: clientKeys.filter(k => k.status === KeyStatus.EXPIRED).length,
        revoked: clientKeys.filter(k => k.status === KeyStatus.REVOKED).length
      },
      totalUsage,
      lastAccess: client.lastAccess
    };
  }

  /**
   * 만료된 키 정리
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [keyId, metadata] of this.keys.entries()) {
      if (metadata.status === KeyStatus.ACTIVE && now > metadata.expiresAt) {
        metadata.status = KeyStatus.EXPIRED;

        // 회전 타이머 정리
        const timer = this.rotationTimers.get(keyId);
        if (timer) {
          clearTimeout(timer);
          this.rotationTimers.delete(keyId);
        }

        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired keys`);
    }

    return cleaned;
  }
}