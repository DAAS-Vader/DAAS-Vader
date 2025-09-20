import { Router, Request, Response } from 'express';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient, DataType, Operation } from '../services/sealClient.js';
import { AuthenticatedRequest, ValidationError, ServiceError } from '../types/index.js';
import { config } from '../config/index.js';

const router = Router();

// Sui 클라이언트 초기화
const suiClient = new SuiClient({
  url: config.sui?.rpcUrl || 'https://fullnode.testnet.sui.io:443'
});

// SealClient 인스턴스 생성
let sealClient: SealClient;

// 초기화 함수
async function initializeSealClient() {
  if (!sealClient) {
    // 환경변수에서 설정 읽기
    const packageId = process.env.SEAL_PACKAGE_ID;
    const sealRegistryId = process.env.SEAL_REGISTRY_ID;
    const enclaveRegistryId = process.env.ENCLAVE_REGISTRY_ID;

    if (!packageId || !sealRegistryId || !enclaveRegistryId) {
      throw new ServiceError(
        'Missing required environment variables: SEAL_PACKAGE_ID, SEAL_REGISTRY_ID, ENCLAVE_REGISTRY_ID',
        500
      );
    }

    // 관리자 키페어 (선택사항)
    let adminKeypair: Ed25519Keypair | undefined;
    if (process.env.ADMIN_PRIVATE_KEY) {
      try {
        adminKeypair = Ed25519Keypair.fromSecretKey(
          Buffer.from(process.env.ADMIN_PRIVATE_KEY, 'hex')
        );
      } catch (error) {
        console.warn('⚠️ Invalid ADMIN_PRIVATE_KEY provided, continuing without admin privileges');
      }
    }

    // 기본 identity 설정
    let defaultIdentity: Uint8Array | undefined;
    if (process.env.DEFAULT_IDENTITY) {
      defaultIdentity = new Uint8Array(Buffer.from(process.env.DEFAULT_IDENTITY, 'hex'));
    }

    sealClient = new SealClient({
      suiClient,
      packageId,
      sealRegistryId,
      enclaveRegistryId,
      adminKeypair,
      defaultIdentity
    });

    console.log('✅ SealClient initialized successfully');
  }
  return sealClient;
}

// ==================== 세션 키 관리 ====================

/**
 * POST /seal/session/create
 * 새로운 세션 키 생성
 */
router.post('/session/create', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { identity, permissions, duration } = req.body;

    // identity 처리 (hex 문자열을 Uint8Array로 변환)
    let identityBytes: Uint8Array | undefined;
    if (identity) {
      if (typeof identity === 'string') {
        identityBytes = new Uint8Array(Buffer.from(identity, 'hex'));
      } else if (Array.isArray(identity)) {
        identityBytes = new Uint8Array(identity);
      } else {
        throw new ValidationError('Identity must be a hex string or byte array');
      }
    }

    // permissions 처리
    let permissionTypes: DataType[] = [DataType.CONFIG, DataType.LOGS];
    if (permissions && Array.isArray(permissions)) {
      permissionTypes = permissions.map((p: any) => {
        if (typeof p === 'string') {
          switch (p.toUpperCase()) {
            case 'SECRETS': return DataType.SECRETS;
            case 'CONFIG': return DataType.CONFIG;
            case 'LOGS': return DataType.LOGS;
            case 'PUBLIC': return DataType.PUBLIC;
            default: throw new ValidationError(`Invalid permission type: ${p}`);
          }
        }
        return p;
      });
    }

    const sessionKey = await client.createSessionKey(
      identityBytes,
      permissionTypes,
      duration || 3600000 // 기본 1시간
    );

    res.status(201).json({
      keyId: sessionKey.keyId,
      publicKey: sessionKey.publicKey,
      expiresAt: sessionKey.expiresAt,
      permissions: sessionKey.permissions,
      message: 'Session key created successfully'
    });

  } catch (error) {
    console.error('Session key creation error:', error);

    if (error instanceof ValidationError || error instanceof ServiceError) {
      res.status(error instanceof ValidationError ? 400 : (error as ServiceError).statusCode || 500).json({
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Session Creation Failed',
      message: 'Failed to create session key'
    });
  }
});

/**
 * GET /seal/session/:keyId
 * 세션 키 상태 확인
 */
router.get('/session/:keyId', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { keyId } = req.params;

    const sessionKey = await client.validateSessionKey(keyId);

    if (!sessionKey) {
      res.status(404).json({
        error: 'Session Not Found',
        message: 'Session key not found or expired'
      });
      return;
    }

    res.status(200).json({
      keyId: sessionKey.keyId,
      publicKey: sessionKey.publicKey,
      expiresAt: sessionKey.expiresAt,
      permissions: sessionKey.permissions,
      isActive: sessionKey.isActive,
      identityHash: Buffer.from(sessionKey.identity).toString('hex')
    });

  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      error: 'Session Validation Failed',
      message: 'Failed to validate session key'
    });
  }
});

/**
 * DELETE /seal/session/:keyId
 * 세션 키 폐기
 */
router.delete('/session/:keyId', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { keyId } = req.params;

    const revoked = await client.revokeSessionKey(keyId);

    if (revoked) {
      res.status(200).json({
        message: 'Session key revoked successfully'
      });
    } else {
      res.status(404).json({
        error: 'Session Not Found',
        message: 'Session key not found'
      });
    }

  } catch (error) {
    console.error('Session revocation error:', error);
    res.status(500).json({
      error: 'Session Revocation Failed',
      message: 'Failed to revoke session key'
    });
  }
});

/**
 * GET /seal/sessions
 * 활성 세션 목록 조회
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const activeSessions = client.getActiveSessions();

    const sessions = activeSessions.map(session => ({
      keyId: session.keyId,
      publicKey: session.publicKey,
      expiresAt: session.expiresAt,
      permissions: session.permissions,
      identityHash: Buffer.from(session.identity).toString('hex')
    }));

    res.status(200).json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Session list error:', error);
    res.status(500).json({
      error: 'Session List Failed',
      message: 'Failed to retrieve session list'
    });
  }
});

// ==================== 접근 권한 검증 ====================

/**
 * POST /seal/verify/enclave
 * Enclave 접근 권한 검증
 */
router.post('/verify/enclave', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { identity } = req.body;

    if (!identity) {
      throw new ValidationError('Identity is required');
    }

    const identityBytes = typeof identity === 'string'
      ? new Uint8Array(Buffer.from(identity, 'hex'))
      : new Uint8Array(identity);

    const result = await client.verifyEnclaveAccess(identityBytes);

    res.status(200).json(result);

  } catch (error) {
    console.error('Enclave verification error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Verification Failed',
      message: 'Failed to verify enclave access'
    });
  }
});

/**
 * POST /seal/verify/data
 * 데이터 접근 권한 검증
 */
router.post('/verify/data', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { identity, dataType } = req.body;

    if (!identity) {
      throw new ValidationError('Identity is required');
    }

    if (dataType === undefined || dataType === null) {
      throw new ValidationError('Data type is required');
    }

    const identityBytes = typeof identity === 'string'
      ? new Uint8Array(Buffer.from(identity, 'hex'))
      : new Uint8Array(identity);

    let dataTypeEnum: DataType;
    if (typeof dataType === 'string') {
      switch (dataType.toUpperCase()) {
        case 'SECRETS': dataTypeEnum = DataType.SECRETS; break;
        case 'CONFIG': dataTypeEnum = DataType.CONFIG; break;
        case 'LOGS': dataTypeEnum = DataType.LOGS; break;
        case 'PUBLIC': dataTypeEnum = DataType.PUBLIC; break;
        default: throw new ValidationError(`Invalid data type: ${dataType}`);
      }
    } else {
      dataTypeEnum = dataType;
    }

    const result = await client.verifyDataAccess(identityBytes, dataTypeEnum);

    res.status(200).json(result);

  } catch (error) {
    console.error('Data verification error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Verification Failed',
      message: 'Failed to verify data access'
    });
  }
});

// ==================== 암호화/복호화 워크플로우 ====================

/**
 * POST /seal/encrypt
 * 데이터 암호화 및 업로드
 */
router.post('/encrypt', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { data, identity, dataType, sessionKeyId } = req.body;

    if (!data) {
      throw new ValidationError('Data is required');
    }

    // 데이터 처리 (base64 또는 Buffer)
    const dataBuffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data, 'base64');

    // identity 처리
    let identityBytes: Uint8Array | undefined;
    if (identity) {
      identityBytes = typeof identity === 'string'
        ? new Uint8Array(Buffer.from(identity, 'hex'))
        : new Uint8Array(identity);
    }

    // dataType 처리
    let dataTypeEnum: DataType = DataType.SECRETS;
    if (dataType !== undefined) {
      if (typeof dataType === 'string') {
        switch (dataType.toUpperCase()) {
          case 'SECRETS': dataTypeEnum = DataType.SECRETS; break;
          case 'CONFIG': dataTypeEnum = DataType.CONFIG; break;
          case 'LOGS': dataTypeEnum = DataType.LOGS; break;
          case 'PUBLIC': dataTypeEnum = DataType.PUBLIC; break;
          default: throw new ValidationError(`Invalid data type: ${dataType}`);
        }
      } else {
        dataTypeEnum = dataType;
      }
    }

    const result = await client.encryptAndUpload(
      dataBuffer,
      identityBytes,
      dataTypeEnum,
      sessionKeyId
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('Encryption error:', error);

    if (error instanceof ValidationError || error instanceof ServiceError) {
      const statusCode = error instanceof ValidationError ? 400 : (error as ServiceError).statusCode || 500;
      res.status(statusCode).json({
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Encryption Failed',
      message: 'Failed to encrypt and upload data'
    });
  }
});

/**
 * POST /seal/decrypt-ticket
 * 복호화 티켓 생성
 */
router.post('/decrypt-ticket', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const { cid, nodeId, leaseId, identity, dataType, sessionKeyId } = req.body;

    // 필수 파라미터 검증
    if (!cid) throw new ValidationError('CID is required');
    if (!nodeId) throw new ValidationError('Node ID is required');
    if (!leaseId) throw new ValidationError('Lease ID is required');

    // identity 처리
    let identityBytes: Uint8Array | undefined;
    if (identity) {
      identityBytes = typeof identity === 'string'
        ? new Uint8Array(Buffer.from(identity, 'hex'))
        : new Uint8Array(identity);
    }

    // dataType 처리
    let dataTypeEnum: DataType = DataType.SECRETS;
    if (dataType !== undefined) {
      if (typeof dataType === 'string') {
        switch (dataType.toUpperCase()) {
          case 'SECRETS': dataTypeEnum = DataType.SECRETS; break;
          case 'CONFIG': dataTypeEnum = DataType.CONFIG; break;
          case 'LOGS': dataTypeEnum = DataType.LOGS; break;
          case 'PUBLIC': dataTypeEnum = DataType.PUBLIC; break;
          default: throw new ValidationError(`Invalid data type: ${dataType}`);
        }
      } else {
        dataTypeEnum = dataType;
      }
    }

    const ticket = await client.createDecryptionTicket(
      cid,
      nodeId,
      leaseId,
      identityBytes,
      dataTypeEnum,
      sessionKeyId
    );

    res.status(200).json(ticket);

  } catch (error) {
    console.error('Ticket creation error:', error);

    if (error instanceof ValidationError || error instanceof ServiceError) {
      const statusCode = error instanceof ValidationError ? 400 : (error as ServiceError).statusCode || 500;
      res.status(statusCode).json({
        error: error.constructor.name,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Ticket Creation Failed',
      message: 'Failed to create decryption ticket'
    });
  }
});

// ==================== 상태 및 정보 ====================

/**
 * GET /seal/health
 * 전체 시스템 상태 확인
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const health = await client.healthCheck();

    const status = health.sealService && health.registries ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status,
      components: health,
      timestamp: new Date().toISOString(),
      version: '1.0'
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      version: '1.0'
    });
  }
});

/**
 * GET /seal/info
 * 레지스트리 정보 조회
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const registryInfo = await client.getRegistryInfo();

    res.status(200).json({
      registries: registryInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registry info error:', error);
    res.status(500).json({
      error: 'Registry Info Failed',
      message: 'Failed to retrieve registry information'
    });
  }
});

/**
 * POST /seal/cleanup
 * 만료된 세션 정리
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const client = await initializeSealClient();
    const cleaned = await client.cleanupExpiredSessions();

    res.status(200).json({
      cleaned,
      message: `Cleaned up ${cleaned} expired sessions`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Cleanup Failed',
      message: 'Failed to cleanup expired sessions'
    });
  }
});

export default router;