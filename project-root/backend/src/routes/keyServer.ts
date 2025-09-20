import { Router, Request, Response } from 'express';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  KeyServer,
  KeyServerMode,
  KeyType,
  KeyRequest,
  RotationPolicy,
  ClientPermission,
  RateLimitConfig
} from '../services/keyServer.js';
import { SealClient, DataType } from '../services/sealClient.js';
import { AuthenticatedRequest, ValidationError, ServiceError } from '../types/index.js';
import { config } from '../config/index.js';

const router = Router();

// 키 서버 인스턴스
let keyServer: KeyServer;

// 초기화 함수
async function initializeKeyServer() {
  if (!keyServer) {
    // Sui 클라이언트 설정
    const suiClient = new SuiClient({
      url: config.sui?.rpcUrl || 'https://fullnode.testnet.sui.io:443'
    });

    // SealClient 설정
    const sealClient = new SealClient({
      suiClient,
      packageId: process.env.SEAL_PACKAGE_ID || '0x0',
      sealRegistryId: process.env.SEAL_REGISTRY_ID || '0x0',
      enclaveRegistryId: process.env.ENCLAVE_REGISTRY_ID || '0x0'
    });

    // 키 서버 모드 설정
    const mode = (process.env.KEY_SERVER_MODE as KeyServerMode) || KeyServerMode.OPEN;

    // 관리자 키페어 (선택사항)
    let adminKeypair: Ed25519Keypair | undefined;
    if (process.env.KEY_SERVER_ADMIN_KEY) {
      adminKeypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(process.env.KEY_SERVER_ADMIN_KEY, 'hex')
      );
    }

    // 기본 회전 정책
    const defaultRotationPolicy: RotationPolicy = {
      enabled: process.env.KEY_ROTATION_ENABLED === 'true',
      intervalMs: parseInt(process.env.KEY_ROTATION_INTERVAL || '86400000'), // 24시간
      maxAge: parseInt(process.env.KEY_MAX_AGE || '604800000'), // 7일
      preRotationPeriod: parseInt(process.env.KEY_PRE_ROTATION_PERIOD || '3600000'), // 1시간
      retentionPeriod: parseInt(process.env.KEY_RETENTION_PERIOD || '300000') // 5분
    };

    // 기본 속도 제한
    const defaultRateLimit: RateLimitConfig = {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60'),
      requestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '1000'),
      burstSize: parseInt(process.env.RATE_LIMIT_BURST || '10')
    };

    keyServer = new KeyServer({
      mode,
      sealClient,
      suiClient,
      adminKeypair,
      defaultRotationPolicy,
      defaultRateLimit,
      maxConcurrentKeys: parseInt(process.env.MAX_CONCURRENT_KEYS || '100'),
      keyEncryptionKey: process.env.KEY_ENCRYPTION_KEY,
      backupEnabled: process.env.KEY_BACKUP_ENABLED === 'true',
      auditEnabled: process.env.KEY_AUDIT_ENABLED === 'true'
    });

    console.log(`✅ Key Server initialized in ${mode.toUpperCase()} mode`);
  }
  return keyServer;
}

// ==================== 키 생성 및 관리 ====================

/**
 * POST /key-server/keys/generate
 * 새로운 키 생성
 */
router.post('/keys/generate', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const {
      keyType,
      dataTypes,
      lifetime,
      identity,
      clientId,
      metadata
    } = req.body;

    // 입력 검증
    if (!keyType || !Object.values(KeyType).includes(keyType)) {
      throw new ValidationError('Valid keyType is required');
    }

    if (!dataTypes || !Array.isArray(dataTypes)) {
      throw new ValidationError('dataTypes array is required');
    }

    // 데이터 타입 변환
    const dataTypeEnums = dataTypes.map((dt: any) => {
      if (typeof dt === 'string') {
        const enumValue = DataType[dt.toUpperCase() as keyof typeof DataType];
        if (enumValue === undefined) {
          throw new ValidationError(`Invalid data type: ${dt}`);
        }
        return enumValue;
      }
      return dt;
    });

    // identity 처리
    let identityBytes: Uint8Array | undefined;
    if (identity) {
      if (typeof identity === 'string') {
        identityBytes = new Uint8Array(Buffer.from(identity, 'hex'));
      } else if (Array.isArray(identity)) {
        identityBytes = new Uint8Array(identity);
      }
    }

    const keyRequest: KeyRequest = {
      keyType,
      dataTypes: dataTypeEnums,
      lifetime,
      identity: identityBytes,
      clientId,
      metadata
    };

    const keyResponse = await server.generateKey(keyRequest);

    res.status(201).json({
      success: true,
      key: {
        keyId: keyResponse.keyId,
        publicKey: keyResponse.publicKey,
        // privateKey는 세션 키에서만 반환
        ...(keyResponse.privateKey && { privateKey: keyResponse.privateKey }),
        expiresAt: keyResponse.expiresAt,
        keyType: keyResponse.keyType,
        permissions: keyResponse.permissions
      },
      metadata: keyResponse.metadata
    });

  } catch (error) {
    console.error('Key generation error:', error);

    if (error instanceof ValidationError || error instanceof ServiceError) {
      const statusCode = error instanceof ValidationError ? 400 : (error as ServiceError).statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Key Generation Failed',
      message: 'Failed to generate key'
    });
  }
});

/**
 * GET /key-server/keys/:keyId
 * 키 정보 조회
 */
router.get('/keys/:keyId', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { keyId } = req.params;
    const { clientId } = req.query;

    const keyResponse = await server.getKey(keyId, clientId as string);

    if (!keyResponse) {
      res.status(404).json({
        success: false,
        error: 'Key Not Found',
        message: 'Key not found or expired'
      });
      return;
    }

    res.status(200).json({
      success: true,
      key: {
        keyId: keyResponse.keyId,
        publicKey: keyResponse.publicKey,
        expiresAt: keyResponse.expiresAt,
        keyType: keyResponse.keyType,
        permissions: keyResponse.permissions
      },
      metadata: keyResponse.metadata
    });

  } catch (error) {
    console.error('Key retrieval error:', error);

    if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Key Retrieval Failed',
      message: 'Failed to retrieve key'
    });
  }
});

/**
 * DELETE /key-server/keys/:keyId
 * 키 폐기
 */
router.delete('/keys/:keyId', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { keyId } = req.params;
    const { clientId } = req.query;

    const revoked = await server.revokeKey(keyId, clientId as string);

    if (revoked) {
      res.status(200).json({
        success: true,
        message: 'Key revoked successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Key Not Found',
        message: 'Key not found'
      });
    }

  } catch (error) {
    console.error('Key revocation error:', error);

    if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Key Revocation Failed',
      message: 'Failed to revoke key'
    });
  }
});

// ==================== 클라이언트 관리 (Permissioned 모드) ====================

/**
 * POST /key-server/clients/register
 * 클라이언트 등록 (Permissioned 모드만)
 */
router.post('/clients/register', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const {
      clientId,
      allowedKeyTypes,
      allowedDataTypes,
      maxConcurrentKeys,
      maxKeyLifetime,
      rateLimit
    } = req.body;

    if (!clientId) {
      throw new ValidationError('clientId is required');
    }

    // 키 타입 변환
    const keyTypes = allowedKeyTypes?.map((kt: string) => {
      const enumValue = KeyType[kt.toUpperCase() as keyof typeof KeyType];
      if (enumValue === undefined) {
        throw new ValidationError(`Invalid key type: ${kt}`);
      }
      return enumValue;
    }) || [KeyType.SESSION];

    // 데이터 타입 변환
    const dataTypes = allowedDataTypes?.map((dt: string) => {
      const enumValue = DataType[dt.toUpperCase() as keyof typeof DataType];
      if (enumValue === undefined) {
        throw new ValidationError(`Invalid data type: ${dt}`);
      }
      return enumValue;
    }) || [DataType.CONFIG, DataType.LOGS];

    const permissions: Partial<ClientPermission> = {
      allowedKeyTypes: keyTypes,
      allowedDataTypes: dataTypes,
      maxConcurrentKeys,
      maxKeyLifetime,
      rateLimit
    };

    const clientPermission = await server.registerClient(clientId, permissions);

    res.status(201).json({
      success: true,
      client: clientPermission
    });

  } catch (error) {
    console.error('Client registration error:', error);

    if (error instanceof ValidationError || error instanceof ServiceError) {
      const statusCode = error instanceof ValidationError ? 400 : (error as ServiceError).statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Client Registration Failed',
      message: 'Failed to register client'
    });
  }
});

/**
 * PUT /key-server/clients/:clientId
 * 클라이언트 권한 업데이트
 */
router.put('/clients/:clientId', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { clientId } = req.params;
    const updates = req.body;

    const updatedClient = await server.updateClientPermissions(clientId, updates);

    if (updatedClient) {
      res.status(200).json({
        success: true,
        client: updatedClient
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Client Not Found',
        message: 'Client not found'
      });
    }

  } catch (error) {
    console.error('Client update error:', error);
    res.status(500).json({
      success: false,
      error: 'Client Update Failed',
      message: 'Failed to update client'
    });
  }
});

/**
 * DELETE /key-server/clients/:clientId
 * 클라이언트 비활성화
 */
router.delete('/clients/:clientId', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { clientId } = req.params;

    const deactivated = await server.deactivateClient(clientId);

    if (deactivated) {
      res.status(200).json({
        success: true,
        message: 'Client deactivated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Client Not Found',
        message: 'Client not found'
      });
    }

  } catch (error) {
    console.error('Client deactivation error:', error);
    res.status(500).json({
      success: false,
      error: 'Client Deactivation Failed',
      message: 'Failed to deactivate client'
    });
  }
});

/**
 * GET /key-server/clients/:clientId/stats
 * 클라이언트 통계 조회
 */
router.get('/clients/:clientId/stats', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { clientId } = req.params;

    const stats = server.getClientStats(clientId);

    if (stats) {
      res.status(200).json({
        success: true,
        stats
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Client Not Found',
        message: 'Client not found'
      });
    }

  } catch (error) {
    console.error('Client stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Stats Retrieval Failed',
      message: 'Failed to retrieve client stats'
    });
  }
});

// ==================== 서버 상태 및 관리 ====================

/**
 * GET /key-server/status
 * 키 서버 상태 조회
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const status = server.getServerStatus();

    res.status(200).json({
      success: true,
      status: {
        ...status,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Status Check Failed',
      message: 'Failed to retrieve server status'
    });
  }
});

/**
 * POST /key-server/cleanup
 * 만료된 키 정리
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const cleaned = await server.cleanupExpiredKeys();

    res.status(200).json({
      success: true,
      cleaned,
      message: `Cleaned up ${cleaned} expired keys`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup Failed',
      message: 'Failed to cleanup expired keys'
    });
  }
});

/**
 * GET /key-server/health
 * 전체 시스템 상태 확인
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const status = server.getServerStatus();

    const isHealthy = status.activeKeys >= 0; // 기본 헬스 체크

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      keyServer: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 키 회전 관리 ====================

/**
 * POST /key-server/keys/:keyId/rotate
 * 수동 키 회전
 */
router.post('/keys/:keyId/rotate', async (req: Request, res: Response) => {
  try {
    const server = await initializeKeyServer();
    const { keyId } = req.params;

    const newKeyId = await server.rotateKey(keyId);

    if (newKeyId) {
      res.status(200).json({
        success: true,
        oldKeyId: keyId,
        newKeyId,
        message: 'Key rotated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Key Not Found',
        message: 'Key not found or rotation failed'
      });
    }

  } catch (error) {
    console.error('Key rotation error:', error);
    res.status(500).json({
      success: false,
      error: 'Key Rotation Failed',
      message: 'Failed to rotate key'
    });
  }
});

export default router;