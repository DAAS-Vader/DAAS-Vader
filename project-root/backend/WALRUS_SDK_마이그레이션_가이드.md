# Walrus SDK 마이그레이션 가이드

DAAS Vader 백엔드는 이제 Walrus 통합을 위해 HTTP API와 SDK 모드를 모두 지원합니다. 이 가이드는 향상된 기능을 위해 SDK 모드로 마이그레이션하는 방법을 안내합니다.

## 현재 구현 방식

시스템은 이제 **하이브리드 방식**을 사용하여 자동으로 최적의 방법을 선택합니다:

- **HTTP API 모드** (기본값): 간단하고 빠르며, 블록체인 의존성 없음
- **SDK 모드** (선택사항): 블록체인 통합을 통한 향상된 기능

## 기능 비교

| 기능 | HTTP API | SDK 모드 |
|------|----------|----------|
| 파일 업로드 | ✅ | ✅ |
| 파일 다운로드 | ✅ | ✅ |
| 파일 존재 확인 | ✅ | ✅ |
| 메타데이터 저장 | ❌ | ✅ |
| 병렬 업로드 | ❌ | ✅ |
| 트랜잭션 제어 | ❌ | ✅ |
| 재시도 로직 | 기본 | 고급 |
| 지갑 관리 | ❌ | ✅ |

## 마이그레이션 단계

### 1. 의존성 설치

필요한 패키지는 이미 `package.json`에 포함되어 있습니다:

```bash
npm install @mysten/walrus @mysten/sui
```

### 2. 환경 변수 설정

`.env` 파일에 다음 변수들을 추가하세요:

```bash
# SDK 모드 활성화
USE_WALRUS_SDK=true

# Walrus SDK 설정
WALRUS_NETWORK=testnet          # 또는 'mainnet'
WALRUS_KEYPAIR_SEED=여기에-니모닉-구문-입력
WALRUS_WAL_COIN_TYPE=0x...::wal::WAL  # 선택사항: WAL 토큰 타입
```

### 3. 지갑 설정

1. **지갑 생성 또는 가져오기**:
   ```bash
   # 새 니모닉 생성 (안전하게 보관하세요!)
   sui client new-address ed25519
   
   # 또는 기존 지갑 가져오기
   sui client import-keypair "여러분의 니모닉 구문"
   ```

2. **지갑에 자금 충전**:
   - 트랜잭션 수수료용 SUI 토큰 획득
   - 저장 비용용 WAL 토큰 획득
   - 테스트용으로 테스트넷 faucet 사용

3. **니모닉 구문 가져오기**:
   ```bash
   # 니모닉 구문 내보내기
   sui client export
   ```

### 4. 설정 확인

SDK 모드가 작동하는지 확인하세요:

```bash
# API 엔드포인트 테스트
curl http://localhost:3000/health

# 예상 응답:
{
  "walrus": {
    "http": true,
    "sdk": true,
    "wallet": {
      "address": "0x...",
      "suiBalance": "1000000000",
      "walBalance": "500000000"
    }
  }
}
```

## 서비스 아키텍처

### 하이브리드 서비스 로직

```typescript
// 시스템이 자동으로 최적의 방법을 선택합니다:

// 1. 메타데이터가 있는 파일은 SDK 사용
const result = await walrusHybridService.uploadCodeBundle(buffer, {
  fileName: 'project.tar',
  mimeType: 'application/tar',
  epochs: 5
});

// 2. 간단한 업로드는 HTTP API 사용 (폴백)
const result = await walrusHybridService.uploadCodeBundle(buffer);

// 3. 병렬 업로드는 SDK 사용
const results = await walrusHybridService.uploadMultipleFiles([
  { data: buffer1, name: 'file1.txt' },
  { data: buffer2, name: 'file2.txt' }
]);
```

### 자동 폴백

- SDK 초기화 실패 → HTTP API로 폴백
- SDK 업로드 실패 → HTTP API로 재시도
- 애플리케이션 코드 변경 불필요

## 설정 옵션

### 개발 환경 설정

```bash
# 개발용 .env
USE_WALRUS_SDK=false
WALRUS_NETWORK=testnet
```

### 프로덕션 환경 설정

```bash
# 프로덕션용 .env
USE_WALRUS_SDK=true
WALRUS_NETWORK=mainnet
WALRUS_KEYPAIR_SEED=프로덕션용-니모닉
```

### 하이브리드 모드

```bash
# 시스템이 자동으로 결정
# (유익할 때는 SDK, 그렇지 않으면 HTTP API 사용)
USE_WALRUS_SDK=true
```

## 모니터링 및 헬스 체크

### 서비스 상태

```bash
GET /health

응답:
{
  "walrus": {
    "mode": "sdk",           # "http", "sdk", 또는 "hybrid"
    "http": true,
    "sdk": true,
    "wallet": {
      "address": "0x...",
      "suiBalance": "1000000000",
      "walBalance": "500000000"
    }
  }
}
```

### 서비스 기능

```bash
GET /walrus/capabilities

응답:
{
  "mode": "sdk",
  "features": [
    "upload",
    "download", 
    "existence_check",
    "metadata_storage",
    "parallel_uploads",
    "transaction_control",
    "wallet_management",
    "retry_logic"
  ]
}
```

## 문제 해결

### 자주 발생하는 문제

1. **SDK 초기화 실패**
   ```
   오류: Walrus keypair seed not configured
   ```
   **해결책**: 환경변수에 `WALRUS_KEYPAIR_SEED` 설정

2. **잔액 부족**
   ```
   오류: Insufficient SUI/WAL balance for operation
   ```
   **해결책**: 지갑에 SUI와 WAL 토큰 충전

3. **네트워크 연결 문제**
   ```
   오류: Failed to connect to SUI network
   ```
   **해결책**: `WALRUS_NETWORK` 설정과 네트워크 연결 확인

4. **SDK가 HTTP로 폴백**
   ```
   경고: Failed to initialize Walrus SDK, falling back to HTTP API
   ```
   **해결책**: SDK 설정과 지갑 설정 확인

### 디버그 모드

상세한 로깅 활성화:

```bash
NODE_ENV=development
DEBUG=walrus:*
```

### 지갑 잔액 확인

```javascript
// 지갑 정보 가져오기
const info = await walrusHybridService.getWalletInfo();
console.log('지갑 주소:', info.address);
console.log('SUI 잔액:', info.suiBalance);
console.log('WAL 잔액:', info.walBalance);
```

## 성능 고려사항

### SDK 모드 사용 시기

**SDK 사용 권장**:
- 메타데이터 저장이 필요한 경우 (파일명, MIME 타입)
- 여러 파일을 동시에 업로드하는 경우
- 트랜잭션 제어와 향상된 에러 처리가 필요한 경우
- 안정성이 요구되는 프로덕션 애플리케이션

**HTTP API 사용 권장**:
- 메타데이터 없는 간단한 업로드
- 개발 및 테스트 환경
- 최소한의 설정이 필요한 경우
- 블록체인 접근이 제한된 네트워크 환경

### 비용 고려사항

- **SDK 모드**: 트랜잭션용 SUI + 저장용 WAL 필요
- **HTTP API**: 저장 비용만 필요 (Walrus 운영자가 처리)
- **트랜잭션 비용**: 트랜잭션당 약 0.001 SUI
- **저장 비용**: 데이터 크기와 에폭 기간에 따라 결정

## 마이그레이션 체크리스트

- [ ] 의존성 설치 (`@mysten/walrus`, `@mysten/sui`)
- [ ] 지갑 설정 및 니모닉 구문 획득
- [ ] 지갑에 SUI와 WAL 토큰 충전
- [ ] 환경 변수 설정
- [ ] 헬스 체크 엔드포인트 테스트
- [ ] 파일 업로드/다운로드 동작 확인
- [ ] 폴백 경고 로그 모니터링
- [ ] 필요시 배포 스크립트 업데이트

## 지원

다음과 관련된 문제가 있는 경우:

- **Walrus SDK**: [Mysten Labs 문서](https://docs.mystenlabs.com/walrus) 확인
- **SUI 네트워크**: [SUI 문서](https://docs.sui.io) 확인
- **DAAS 통합**: 애플리케이션 로그와 헬스 엔드포인트 확인

하이브리드 방식은 SDK 설정에 관계없이 애플리케이션이 계속 작동하도록 보장하며, 원활한 마이그레이션 경로를 제공합니다.

## 예제 사용법

### 기본 파일 업로드
```javascript
// 메타데이터 없는 간단한 업로드 (HTTP API 사용)
const result = await walrusHybridService.uploadCodeBundle(codeBuffer);

// 메타데이터가 있는 업로드 (SDK 사용)
const result = await walrusHybridService.uploadCodeBundle(codeBuffer, {
  fileName: '프로젝트.tar',
  mimeType: 'application/tar',
  epochs: 5  // 저장 기간
});
```

### 여러 파일 업로드
```javascript
const files = [
  { data: buffer1, name: '파일1.txt', mimeType: 'text/plain' },
  { data: buffer2, name: '파일2.js', mimeType: 'application/javascript' }
];

// SDK로 병렬 업로드
const results = await walrusHybridService.uploadMultipleFiles(files, {
  epochs: 3,
  deletable: false
});
```

### 헬스 체크 및 모니터링
```javascript
// 서비스 상태 확인
const health = await walrusHybridService.healthCheck();
console.log('HTTP API 상태:', health.http);
console.log('SDK 상태:', health.sdk);

// 현재 모드 확인
const mode = walrusHybridService.getServiceMode();
console.log('현재 모드:', mode);  // 'http', 'sdk', 또는 'hybrid'

// 사용 가능한 기능 확인
const capabilities = walrusHybridService.getCapabilities();
console.log('사용 가능한 기능:', capabilities.features);
```