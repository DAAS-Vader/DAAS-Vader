# DAAS Vader Backend

DAAS Vader Backend는 프로젝트 파일 업로드와 시크릿 분리를 위한 TypeScript/Node.js 기반의 백엔드 서비스입니다.

## 주요 기능

- **통합 업로드**: 디렉터리 드래그&드롭 또는 ZIP 파일 업로드
- **GitHub 연동**: GitHub 저장소에서 직접 프로젝트 가져오기
- **자동 시크릿 분리**: `.env*` 파일을 자동으로 감지하여 분리 처리
- **Seal 암호화**: 시크릿 파일들을 Seal 서비스로 암호화하여 Walrus에 저장
- **Walrus 저장**: 코드 파일들을 Walrus 분산 저장소에 저장
- **5분 TTL 티켓**: 런타임에서 시크릿 복호화를 위한 제한된 티켓 발급

## 아키텍처

```
사용자 → 백엔드 API → Seal (시크릿 암호화) → Walrus (저장)
                    → Walrus (코드 저장)
                    → PostgreSQL (메타데이터)
                    → Redis (티켓 관리)
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 편집하여 필요한 설정값 입력
```

### 3. 데이터베이스 마이그레이션

```bash
npm run migrate
```

### 4. 개발 서버 실행

```bash
npm run dev
```

### 5. 프로덕션 빌드 및 실행

```bash
npm run build
npm start
```

## API 엔드포인트

### 인증

모든 보호된 엔드포인트는 `Authorization: Bearer <token>` 헤더가 필요합니다.
개발 단계에서는 `DEV_ADMIN_TOKEN` 환경 변수의 값을 사용합니다.

### 프로젝트 업로드

#### `POST /project/upload`

프로젝트 파일들을 업로드하고 자동으로 시크릿과 코드를 분리합니다.

**요청:**

- Content-Type: `multipart/form-data`
- 파일들: `dir[]` (다중 파일) 또는 `file` (ZIP)
- ignorePatterns: 추가 무시 패턴 (선택사항)

**응답:**

```json
{
  \"cid_code\": \"bafy...\",
  \"size_code\": 123456,
  \"cid_env\": \"bafy...\",
  \"dek_version\": 3,
  \"files_env\": [{\"path\": \".env\", \"size\": 123}],
  \"ignored\": [\"node_modules/**\", \".git/**\"]
}
```

#### `POST /project/from-github`

GitHub 저장소에서 프로젝트를 가져와서 처리합니다.

**요청:**

```json
{
  \"repo\": \"owner/repo-name\",
  \"ref\": \"main\",
  \"installation_id\": 123,
  \"ignorePatterns\": [\"dist/**\"]
}
```

**응답:** `/project/upload`와 동일한 형식

### 프로젝트 조회

#### `GET /project/bundles`

사용자의 프로젝트 번들 목록을 조회합니다.

**쿼리 파라미터:**

- `limit`: 결과 개수 제한 (기본: 50)
- `offset`: 오프셋 (기본: 0)

#### `GET /project/bundles/:id`

특정 프로젝트 번들의 상세 정보를 조회합니다.

### 시크릿 티켓

#### `POST /seal/ticket`

시크릿 복호화를 위한 5분 TTL 티켓을 발급합니다.

**요청:**

```json
{
  \"leaseId\": \"lease-1\",
  \"cidEnv\": \"bafy...\",
  \"nodeId\": \"node-abc\"
}
```

**응답:**

```json
{
  \"ticket\": \"<JWT>\",
  \"exp\": 1734567890,
  \"jti\": \"unique-id\"
}
```

### 헬스체크

#### `GET /health`

서비스 상태를 확인합니다.

#### `GET /health/detailed`

상세한 서비스 상태를 확인합니다.

## 환경 변수

| 변수명               | 설명                | 기본값        |
| -------------------- | ------------------- | ------------- |
| `PORT`               | 서버 포트           | `3000`        |
| `NODE_ENV`           | 실행 환경           | `development` |
| `DATABASE_URL`       | PostgreSQL 연결 URL | -             |
| `REDIS_URL`          | Redis 연결 URL      | -             |
| `DEV_ADMIN_TOKEN`    | 개발용 인증 토큰    | `dev-allow`   |
| `SEAL_URL`           | Seal 서비스 URL     | -             |
| `SEAL_SERVICE_TOKEN` | Seal 서비스 토큰    | -             |
| `SEAL_TICKET_SECRET` | 티켓 서명용 시크릿  | -             |
| `WALRUS_GATEWAY`     | Walrus 게이트웨이   | -             |

## 파일 처리 규칙

### 시크릿 파일 감지

- 패턴: `^\.env(\..+)?$` (예: `.env`, `.env.local`, `.env.production`)
- 제외: `*.example`, `*.sample`, `*.template`

### 기본 무시 패턴

- `node_modules/**`
- `.git/**`
- `dist/`, `build/`, `.next/`
- `*.log`
- `.DS_Store`, `Thumbs.db`

### 용량 제한

- 시크릿 파일: 개별 10MB, 전체 20MB
- 코드 번들: 200MB
- 요청 타임아웃: 180초

## 개발 가이드

### 프로젝트 구조

```
src/
├── config/          # 설정 관리
├── db/             # 데이터베이스 연결 및 모델
├── middleware/     # Express 미들웨어
├── routes/         # API 라우트
├── services/       # 외부 서비스 연동
├── types/          # TypeScript 타입 정의
├── utils/          # 유틸리티 함수
└── index.ts        # 메인 진입점
```

### 스크립트

- `npm run dev`: 개발 서버 실행
- `npm run build`: TypeScript 컴파일
- `npm run start`: 프로덕션 서버 실행
- `npm run migrate`: 데이터베이스 마이그레이션
- `npm run test`: 테스트 실행
- `npm run type-check`: 타입 체크

### 코드 스타일

- TypeScript Strict 모드 사용
- ESLint + Prettier 적용
- 함수형 프로그래밍 스타일 선호
- 명확한 타입 정의와 에러 핸들링

## 보안 고려사항

- 시크릿은 절대 로그에 남기지 않음
- 모든 외부 서비스 호출에 타임아웃 설정
- JWT 티켓은 한 번만 사용 가능 (JTI 관리)
- 파일 업로드 시 용량 및 타입 검증
- CORS, Helmet 등 보안 미들웨어 적용

## 모니터링

- 구조화된 로그 출력
- 헬스체크 엔드포인트 제공
- 외부 서비스 연결 상태 모니터링
- 에러 추적 및 알림 (TODO)

## 로드맵

- [ ] zkLogin 인증 구현
- [ ] GitHub App 웹훅 처리
- [ ] 메트릭 수집 및 모니터링
- [ ] API 문서 자동화
- [ ] 통합 테스트 추가

## 라이센스

MIT License
