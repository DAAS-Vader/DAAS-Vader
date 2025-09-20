# PRD — 프로젝트 한방 업로드 & 시크릿 분리(MVP)

**담당자(Owner):** 백엔드 (you)

**버전:** v0.2 (MVP, 통합 업로드 방식)
**최종 수정:** <!-- 필요 시 갱신 -->

---

## 1) 요약

- **목표:** 사용자가 **프로젝트 루트 전체**를 한 번 업로드(드래그&드랍 디렉터리 또는 zip/tar.gz)하면, 서버가 **자동으로 시크릿(.env\*)과 코드**를 분리 처리한다.

  - 시크릿(.env\*): **Seal 서버측 암호화 → Walrus 저장 → `cid_env` 반환**
  - 코드(나머지): **Walrus 저장 → `cid_code` 반환**

- **결과:** `{ cid_code, cid_env, files_env, ignored }`를 반환하고, 런타임에선 `cid_env` + **5분 티켓**으로 시크릿을 안전히 주입한다.

---

## 2) 페르소나 & 사용 시나리오

- **개발자(사용자):** 프로젝트 루트를 드롭하거나 zip/tar로 업로드 → 한 번에 코드/시크릿 CID 생성. GitHub repo/ref를 선택해도 **동일한 분리 규칙** 적용.
- **플랫폼(백엔드):** 업로드 스트림을 수신 → ignore 규칙 적용 → `.env*`만 별번들로 tar.gz → Seal 암호화+Walrus 저장 → 코드 번들은 Walrus 저장 → DB 기록.
- **프로바이더/에이전트(런타임):** `cid_env`와 **5분 TTL 티켓**으로 복호화(1회) 후 tmpfs에 `.env*`를 내려 앱 기동.

---

## 3) 범위 내/외

**범위 내:**

- **통합 업로드 엔드포인트:** `/project/upload` (디렉터리 업로드 또는 zip/tar.gz)
- **GitHub 경로:** `/project/from-github` (tarball 스트리밍 수신 후 동일 분리 로직 적용)
- Seal `POST /v1/encrypt-and-upload` 연동(서버측 암호화)
- Walrus 게이트웨이 연동(CID 저장/조회)
- 런타임 티켓 API(`/seal/ticket`) — **TTL 5분**, 1회용(jti)
- Postgres 스키마: **project_bundles** 중심(필요 시 보조 테이블)

**범위 외(MVP):**

- K8s 바인더/스케줄러/에이전트 구현(별 앱)
- 온체인(Sui) 컨트랙트/오브젝트
- 이미지 빌드/서명(cosign)
- 전체 UI/대시보드(zkLogin 최소 페이지만)

---

## 4) 가정 & 제약

- **시크릿 식별:** 파일명 정규식 `^\.env(\..+)?$` 만 시크릿. `*.example|*.sample|*.template` 제외.
- **ignore 기본값(코드 번들에서 제외):** `node_modules/`, `.git/`, `dist/`, `.next/`, `build/`, `.cache/`, `coverage/`, `*.log`, `.DS_Store` 등.
  필요 시 업로드 요청에 `ignorePatterns` 옵션(추가/덮어쓰기) 허용.
- **용량 제한:**

  - 시크릿: **파일당 10MB**, 시크릿 번들 **≤ 20MB**(초과 시 413)
  - 코드 번들: **≤ 200MB**, 요청 타임아웃 기본 **180초**

- **스트리밍:** 평문 시크릿을 디스크에 저장하지 않음(스트리밍으로 tar.gz → Seal 전송).
- **TTL:** 티켓 **5분(300s)**, 고유 `jti` 단일 사용 보장.
- **Git LFS:** MVP에서는 미지원(무시).
- **인증:** 초기에는 **DEV 토큰**, 이후 **zkLogin(세션 쿠키)** 로 전환.

---

## 5) 기능 요구사항

### 5.1 통합 업로드(디렉터리/zip → 자동 분리)

- **`POST /project/upload`**

  - 입력: (A) 브라우저 디렉터리 업로드(폼 필드 복수 파일) 또는 (B) 단일 `zip`/`tar.gz` 파일.
  - 서버 처리:

    1. 파일 목록에 **ignore 규칙** 적용(기본 + 사용자 지정)
    2. **시크릿 세트**(`.env*` 매칭, 예제 제외)와 **코드 세트**(나머지)로 분리
    3. 시크릿 세트 → `tar.gz` → **Seal.encrypt-and-upload(target=walrus\://...)**
    4. 코드 세트 → `tar.gz`(또는 원본) → **Walrus put**

  - 응답:

    ```json
    {
      "cid_code": "bafy...",
      "size_code": 123456,
      "cid_env": "bafy...", // 시크릿이 없으면 null 생략 가능
      "dek_version": 3,
      "files_env": [{ "path": ".env", "size": 123 }],
      "ignored": ["node_modules/**", ".git/**", "*.log"]
    }
    ```

### 5.2 GitHub 경로(동일 분리 로직)

- **`POST /project/from-github`** `{ repo, ref, installation_id, ignorePatterns? }`

  - GitHub tarball 스트림 수신 → 위 **분리 로직** 동일 적용 → `cid_code`, `cid_env` 반환.

### 5.3 런타임 티켓 API

- **`POST /seal/ticket`** `{ leaseId, cidEnv, nodeId }` → `{ ticket, exp, jti }`

  - JWS(HS256)로 서명, `jti`는 Redis에 **NX+TTL=300s** 저장.

### 5.4 (선택) 레거시 개별 업로드 라우트

- `/secrets/env/upload-text|upload-file|from-github`, `/code/upload-file|from-github`는
  내부 모듈로 유지하되 **외부 문서에서는 `/project/*`만 표기**.

---

## 6) API 스펙 (MVP)

### 인증(개발 단계 임시)

- 보호 라우트는 `Authorization: Bearer <DEV_ADMIN_TOKEN>` 헤더 사용. 이후 zkLogin 세션 쿠키로 교체.

### 통합 업로드

- **`POST /project/upload`**
  **Form-Data:**

  - `dir[]` (여러 파일, 디렉터리 업로드 시) _또는_ `file=@project.zip|.tar.gz`
  - (옵션) `ignorePatterns` (JSON 문자열 또는 콤마분리)

  **200:** `{ cid_code, size_code, cid_env, dek_version, files_env:[...], ignored:[...] }`
  **4xx:** 검증 실패/용량 초과, **502:** Seal/Walrus 오류

### GitHub 경로

- **`POST /project/from-github`**
  **Body:** `{ "repo":"owner/name", "ref":"main|tag|sha", "installation_id":123, "ignorePatterns":["dist/**"] }`
  **200:** 통합 업로드와 동일 구조

### 티켓

- **`POST /seal/ticket`**
  **Body:** `{ "leaseId":"lease-1", "cidEnv":"bafy...", "nodeId":"node-abc" }`
  **200:** `{ "ticket":"<JWS>", "exp": 173..., "jti":"..." }`

---

## 7) 데이터 모델(Postgres)

```sql
CREATE TABLE project_bundles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,           -- "dir-upload" | "zip-upload" | "github"
  repo TEXT,
  ref TEXT,
  cid_code TEXT NOT NULL,
  cid_env  TEXT,                  -- 시크릿이 없으면 NULL
  size_code BIGINT,
  size_env  BIGINT,
  files_env JSONB NOT NULL DEFAULT '[]',  -- [{path,size,sha256}]
  ignored   JSONB NOT NULL DEFAULT '[]',  -- 적용한 ignore 패턴
  created_at TIMESTAMPTZ DEFAULT now()
);

-- (선택) 보조 테이블: GitHub 설치 매핑
CREATE TABLE github_installations (
  installation_id BIGINT PRIMARY KEY,
  user_id UUID,
  account_login TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- (선택) 사용자 테이블(zkLogin 전환 대비)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  sui_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8) 보안 & 프라이버시

- **시크릿은 절대 로그에 남기지 않기**(본문/헤더/쿼리 모두). 스트리밍 우선.
- **웹훅 HMAC** 타이밍-세이프 검증(GitHub 경로 사용 시).
- **레이트리밋:** 예) 사용자당 1 r/s, 일 100회. 초과 시 429.
- **쿠키(나중):** HttpOnly, Secure, SameSite=Lax. CSRF 토큰 또는 Origin 체크.
- **CORS:** zkLogin 적용 시, 허용 오리진 + `credentials: true` 조합.
- **토큰:** GitHub 설치 토큰은 **단기**. 저장 시 암호화 필수.
- **티켓 JWS:** 백엔드↔Seal 공유 시크릿(HS256). `jti`는 Redis NX로 단일 사용 보장.

---

## 9) 비기능 요구사항

- **성능:** 업로드 스트리밍; 기본 타임아웃 180s; 백프레셔 안전.
- **가용성:** 가능한 무상태; 세션 스토어는 Postgres(이후 필요 시 Redis).
- **가시성:** 접근 로그(시크릿 제거), 구조화 로그, Seal/Walrus 응답코드, 웹훅 처리 결과.
- **에러 표면:**

  - `400` 잘못된 파일명/파라미터
  - `401` 인증 실패
  - `413` 용량 초과
  - `415` 미지원 포맷
  - `429` 레이트리밋
  - `502` 상류(Seal/Walrus/GitHub) 오류

---

## 10) 마일스톤(PR 매핑)

1. **PR1** 백엔드 부트스트랩 + DB + `/healthz`
2. **PR2** `/project/upload` 구현(분리/ignore/Seal/Walrus/DB 기록)
3. **PR3** `/project/from-github` + GitHub App(설치/콜백/웹훅)
4. **PR4** `/seal/ticket` (TTL 5분, jti=Redis) + initContainer 주입 문서화
5. **PR5** zkLogin 최소 프런트(Nonce→Proof→Verify) & devAuth→세션 전환

---

## 11) 테스트 계획

- **유닛:** ignore 패턴 적용, `.env*` 필터, 용량 가드, tar.gz 번들러, HMAC 검증, JWS 서명.
- **통합:** Seal/Walrus 모킹으로 200/4xx/5xx 시나리오, 스트리밍 동작 확인.
- **E2E(스모크):** `/project/upload` → `{cid_code,cid_env}`, `/project/from-github` → 동일, 웹훅 push → 자동 처리, 티켓 발급 → JWS 디코드 & Redis jti 저장.

---

## 12) 리스크 & 대응

- **Seal/Walrus 불안정:** 지수 백오프 재시도, 사용자 메시지 명확화.
- **대용량/트리 수 심화:** ignore 기본값 강화, 합리적 한도(200MB/180s) 보호.
- **로그로 인한 시크릿 누출:** 레댁션 미들웨어, 시크릿 라우트 원문 로그 금지.
- **티켓 재사용:** `jti`를 TTL로 저장, Seal에서 재사용 거부.

---

## 13) 성공 지표(MVP)

- 통합 업로드 후 첫 응답(p50) **< 6초**(소규모 프로젝트 기준)
- 시크릿 분리 정확도 **≈100%**(예제/샘플 제외)
- 업로드→CID 성공률 **> 99%**
- 로그 내 시크릿 누출 **0건**(감사)

---

## 14) 차기 과제(포스트 MVP)

- zkLogin 프로덕션화(세션/CSRF 정식 적용)
- 컨테이너 빌드 + 런타임 cosign 검증
- K8s 바인더/에이전트, Sui 온체인 ReleaseRef/Lease
- 엣지 게이트웨이/커스텀 도메인
- 시크릿 회전 UX, 감사 이벤트 노출
- 프로젝트별 `.gitignore` 파싱 병합(옵션)

---

## 15) 플로우(머메이드)

```mermaid
sequenceDiagram
  autonumber
  participant User as 사용자(드래그&드랍/zip)
  participant API  as 우리 백엔드
  participant Seal
  participant Wal  as Walrus
  participant DB   as Postgres

  User->>API: POST /project/upload (dir or zip)
  API->>API: ignore 적용 + 시크릿(.env*)/코드 분리
  par Secrets
    API->>Seal: encrypt-and-upload(env-bundle.tar.gz)
    Seal->>Wal: store
    Wal-->>API: cid_env, dek_v
  and Code
    API->>Wal: put(code-bundle.tar.gz)
    Wal-->>API: cid_code
  end
  API->>DB: insert project_bundles {cid_code, cid_env, ...}
  API-->>User: {cid_code, cid_env, files_env, ignored}
```

---

## 16) 오픈 이슈

- 디렉터리 업로드 비지원 브라우저 대응(항상 zip 대안 제공?)
- 시크릿 탐지 보조(토큰 패턴 스캔) 경고 기능 도입 여부
- 퍼블릭 리포의 코드 번들은 실제 저장 vs 메타(repo/ref+유도 cid)만 저장?
- 사용자 플랜별 일일 쿼터 차등(무료/유료)?
- 번들 삭제/GC 정책 및 관리자 UI 필요 여부?

---

## 17) 환경변수(.env.example)

```dotenv
APP_BASE_URL=https://app.example.com
PORT=3000
NODE_ENV=development

# Postgres & Redis
DATABASE_URL=postgres://user:pass@localhost:5432/daas
REDIS_URL=redis://localhost:6379

# Session (zkLogin 적용 후 사용)
SESSION_SECRET=change-me-32bytes

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET=change-me
GITHUB_APP_SLUG=my-daas-app

# Seal / Walrus
SEAL_URL=https://seal.example.com
WALRUS_GATEWAY=walrus.example.com
SEAL_SERVICE_TOKEN=server-token-or-oidc
SEAL_TICKET_SECRET=shared-hs256-secret

# Dev-only admin token (zkLogin 도입 전)
DEV_ADMIN_TOKEN=dev-allow
```

---

**PRD 끝**
