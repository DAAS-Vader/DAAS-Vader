import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient, DataType, Operation } from '../services/sealClient.js';

/**
 * Seal v2 통합 예제
 * Move 컨트랙트와 TypeScript SDK의 완전한 워크플로우 데모
 */

async function demonstrateSealV2Workflow() {
  console.log('🚀 Starting Seal v2 Integration Demonstration');

  // 1. Sui 클라이언트 설정
  const suiClient = new SuiClient({
    url: 'https://fullnode.testnet.sui.io:443'
  });

  // 2. SealClient 초기화
  const sealClient = new SealClient({
    suiClient,
    packageId: process.env.SEAL_PACKAGE_ID || '0x0', // 실제 배포된 패키지 ID
    sealRegistryId: process.env.SEAL_REGISTRY_ID || '0x0', // 실제 레지스트리 ID
    enclaveRegistryId: process.env.ENCLAVE_REGISTRY_ID || '0x0', // 실제 Enclave 레지스트리 ID
    defaultIdentity: new Uint8Array(Buffer.from('test_enclave_001', 'utf8'))
  });

  console.log('✅ SealClient initialized');

  // 3. 세션 키 생성
  console.log('\n📝 Creating session key...');
  try {
    const sessionKey = await sealClient.createSessionKey(
      new Uint8Array(Buffer.from('test_enclave_001', 'utf8')),
      [DataType.CONFIG, DataType.LOGS],
      3600000 // 1시간
    );

    console.log(`✅ Session key created: ${sessionKey.keyId}`);
    console.log(`   Public key: ${sessionKey.publicKey}`);
    console.log(`   Expires at: ${new Date(sessionKey.expiresAt).toISOString()}`);
    console.log(`   Permissions: ${sessionKey.permissions.map(p => DataType[p]).join(', ')}`);

    // 4. 접근 권한 검증 테스트
    console.log('\n🔐 Testing access control...');

    // Enclave 접근 검증
    const enclaveAccess = await sealClient.verifyEnclaveAccess(
      new Uint8Array(Buffer.from('test_enclave_001', 'utf8'))
    );
    console.log(`   Enclave access: ${enclaveAccess.approved ? '✅ Approved' : '❌ Denied'}`);
    if (!enclaveAccess.approved) {
      console.log(`   Reason: ${enclaveAccess.reason}`);
    }

    // 데이터 타입별 접근 검증
    for (const dataType of [DataType.SECRETS, DataType.CONFIG, DataType.LOGS, DataType.PUBLIC]) {
      const dataAccess = await sealClient.verifyDataAccess(
        new Uint8Array(Buffer.from('test_enclave_001', 'utf8')),
        dataType
      );
      console.log(`   ${DataType[dataType]} access: ${dataAccess.approved ? '✅ Approved' : '❌ Denied'}`);
      if (!dataAccess.approved) {
        console.log(`     Reason: ${dataAccess.reason}`);
      }
    }

    // 5. 암호화 및 업로드 시뮬레이션
    console.log('\n🔒 Testing encryption workflow...');

    const testData = Buffer.from('{"secret": "test_secret_value", "config": "test_config"}', 'utf8');

    try {
      const encryptResult = await sealClient.encryptAndUpload(
        testData,
        new Uint8Array(Buffer.from('test_enclave_001', 'utf8')),
        DataType.CONFIG,
        sessionKey.keyId
      );

      console.log(`✅ Data encrypted and uploaded`);
      console.log(`   CID: ${encryptResult.cid}`);
      console.log(`   DEK Version: ${encryptResult.dekVersion}`);
      console.log(`   Session Key ID: ${encryptResult.sessionKeyId}`);

      // 6. 복호화 티켓 생성
      console.log('\n🎫 Creating decryption ticket...');

      const ticket = await sealClient.createDecryptionTicket(
        encryptResult.cid,
        'test_node_001',
        'test_lease_001',
        new Uint8Array(Buffer.from('test_enclave_001', 'utf8')),
        DataType.CONFIG,
        sessionKey.keyId
      );

      console.log(`✅ Decryption ticket created`);
      console.log(`   Ticket: ${ticket.ticket.substring(0, 50)}...`);
      console.log(`   Expires: ${new Date(ticket.exp * 1000).toISOString()}`);
      console.log(`   JTI: ${ticket.jti}`);

    } catch (error) {
      console.log(`❌ Encryption failed: ${(error as Error).message}`);
    }

    // 7. 세션 관리 테스트
    console.log('\n🔧 Testing session management...');

    // 세션 검증
    const validatedSession = await sealClient.validateSessionKey(sessionKey.keyId);
    console.log(`   Session validation: ${validatedSession ? '✅ Valid' : '❌ Invalid'}`);

    // 활성 세션 목록
    const activeSessions = sealClient.getActiveSessions();
    console.log(`   Active sessions: ${activeSessions.length}`);

    // 세션 폐기
    const revoked = await sealClient.revokeSessionKey(sessionKey.keyId);
    console.log(`   Session revocation: ${revoked ? '✅ Success' : '❌ Failed'}`);

  } catch (error) {
    console.error(`❌ Session creation failed: ${(error as Error).message}`);
  }

  // 8. 시스템 상태 확인
  console.log('\n🏥 System health check...');
  try {
    const health = await sealClient.healthCheck();
    console.log(`   Seal service: ${health.sealService ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   Registries: ${health.registries ? '✅ Healthy' : '❌ Unhealthy'}`);

    // 레지스트리 정보
    const registryInfo = await sealClient.getRegistryInfo();
    console.log(`   Seal registry: ${registryInfo.sealRegistry.data ? '✅ Found' : '❌ Not found'}`);
    console.log(`   Enclave registry: ${registryInfo.enclaveRegistry.data ? '✅ Found' : '❌ Not found'}`);

  } catch (error) {
    console.error(`❌ Health check failed: ${(error as Error).message}`);
  }

  // 9. 정리
  console.log('\n🧹 Cleanup...');
  const cleaned = await sealClient.cleanupExpiredSessions();
  console.log(`   Cleaned expired sessions: ${cleaned}`);

  console.log('\n✅ Seal v2 demonstration completed successfully!');
}

/**
 * API 엔드포인트 테스트 예제
 */
async function demonstrateAPIWorkflow() {
  console.log('\n🌐 API Workflow Demonstration');

  const baseUrl = 'http://localhost:3000/api/seal/v2';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer dev-allow' // 개발용 토큰
  };

  try {
    // 1. 세션 키 생성
    console.log('1. Creating session key via API...');
    const sessionResponse = await fetch(`${baseUrl}/session/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        identity: Buffer.from('test_enclave_001', 'utf8').toString('hex'),
        permissions: ['CONFIG', 'LOGS'],
        duration: 3600000
      })
    });

    if (!sessionResponse.ok) {
      throw new Error(`Session creation failed: ${sessionResponse.statusText}`);
    }

    const sessionData = await sessionResponse.json();
    console.log(`✅ Session created: ${sessionData.keyId}`);

    // 2. Enclave 접근 검증
    console.log('2. Verifying enclave access...');
    const enclaveResponse = await fetch(`${baseUrl}/verify/enclave`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        identity: Buffer.from('test_enclave_001', 'utf8').toString('hex')
      })
    });

    const enclaveData = await enclaveResponse.json();
    console.log(`✅ Enclave verification: ${enclaveData.approved ? 'Approved' : 'Denied'}`);

    // 3. 데이터 암호화
    console.log('3. Encrypting data...');
    const encryptResponse = await fetch(`${baseUrl}/encrypt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: Buffer.from('test secret data', 'utf8').toString('base64'),
        identity: Buffer.from('test_enclave_001', 'utf8').toString('hex'),
        dataType: 'CONFIG',
        sessionKeyId: sessionData.keyId
      })
    });

    if (encryptResponse.ok) {
      const encryptData = await encryptResponse.json();
      console.log(`✅ Data encrypted: ${encryptData.cid}`);

      // 4. 복호화 티켓 생성
      console.log('4. Creating decryption ticket...');
      const ticketResponse = await fetch(`${baseUrl}/decrypt-ticket`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cid: encryptData.cid,
          nodeId: 'test_node_001',
          leaseId: 'test_lease_001',
          identity: Buffer.from('test_enclave_001', 'utf8').toString('hex'),
          dataType: 'CONFIG',
          sessionKeyId: sessionData.keyId
        })
      });

      if (ticketResponse.ok) {
        const ticketData = await ticketResponse.json();
        console.log(`✅ Ticket created: ${ticketData.jti}`);
      } else {
        console.log(`❌ Ticket creation failed: ${ticketResponse.statusText}`);
      }
    } else {
      console.log(`❌ Encryption failed: ${encryptResponse.statusText}`);
    }

    // 5. 세션 폐기
    console.log('5. Revoking session...');
    const revokeResponse = await fetch(`${baseUrl}/session/${sessionData.keyId}`, {
      method: 'DELETE',
      headers
    });

    if (revokeResponse.ok) {
      console.log(`✅ Session revoked`);
    } else {
      console.log(`❌ Session revocation failed: ${revokeResponse.statusText}`);
    }

    // 6. 상태 확인
    console.log('6. Checking system health...');
    const healthResponse = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers
    });

    const healthData = await healthResponse.json();
    console.log(`✅ System status: ${healthData.status}`);

  } catch (error) {
    console.error(`❌ API workflow failed: ${(error as Error).message}`);
  }

  console.log('\n✅ API workflow demonstration completed!');
}

// 실행 함수
async function runDemonstration() {
  console.log('🎯 Walrus Seal v2 Integration Demonstration');
  console.log('============================================\n');

  // SDK 직접 사용 데모
  await demonstrateSealV2Workflow();

  // API 엔드포인트 데모 (서버가 실행 중일 때)
  if (process.env.NODE_ENV === 'development') {
    await demonstrateAPIWorkflow();
  }

  console.log('\n🎉 All demonstrations completed successfully!');
}

// 스크립트로 실행할 경우
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemonstration().catch(console.error);
}

export { demonstrateSealV2Workflow, demonstrateAPIWorkflow, runDemonstration };