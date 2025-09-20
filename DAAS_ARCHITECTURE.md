# DAAS Vader 플랫폼 아키텍처

## 🚀 개요

DAAS (Decentralized Application as a Service) Vader는 사용자가 업로드한 코드를 Sui 블록체인의 Nautilus TEE (Trusted Execution Environment)에서 안전하게 컨테이너화하고 배포할 수 있는 탈중앙화 플랫폼입니다.

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   프론트엔드     │    │      백엔드 API      │    │   Walrus Storage    │
│                 │    │                      │    │                     │
│ ┌─────────────┐ │    │ ┌──────────────────┐ │    │ ┌─────────────────┐ │
│ │  React App  │◄┼────┼►│  Express.js      │◄┼────┼►│   Code Bundles  │ │
│ │             │ │    │ │  (Port 3001)     │ │    │ │                 │ │
│ │ - 코드 업로드│ │    │ │                  │ │    │ │ - .tar.gz 형태  │ │
│ │ - 빌드 요청 │ │    │ │ - 파일 처리      │ │    │ │ - Blob Storage  │ │
│ │ - 상태 확인 │ │    │ │ - API 라우팅     │ │    │ │ - 중복 제거     │ │
│ └─────────────┘ │    │ │ - 보안 검증      │ │    │ └─────────────────┘ │
│                 │    │ └──────────────────┘ │    └─────────────────────┘
└─────────────────┘    └──────────────────────┘
                                │
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Docker Builder   │    │ Nautilus Service │    │  Nautilus TEE    │
│   Service        │    │   Integration    │    │                  │
│                  │    │                  │    │ ┌──────────────┐ │
│ ┌──────────────┐ │    │ ┌──────────────┐ │    │ │  Rust Server │ │
│ │ Multi-Lang   │ │    │ │ Build        │ │    │ │  (Port 8080) │ │
│ │ Dockerfile   │ │    │ │ Coordination │ │    │ │              │ │
│ │ Generator    │ │    │ │              │ │    │ │ - TEE 보안   │ │
│ │              │ │    │ │ - Health     │ │    │ │ - 격리 실행  │ │
│ │ - Node.js    │ │    │ │   Check      │ │    │ │ - 증명 생성  │ │
│ │ - Python     │ │    │ │ - Status     │ │    │ │ - 암호화     │ │
│ │ - Go         │ │    │ │   Monitor    │ │    │ └──────────────┘ │
│ │ - Rust       │ │    │ │ - Log        │ │    │                  │
│ │ - Java       │ │    │ │   Retrieval  │ │    └──────────────────┘
│ └──────────────┘ │    │ └──────────────┘ │
│                  │    │                  │
└──────────────────┘    └──────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────────────┐
│                Docker Engine                         │
│                                                      │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│ │  Build       │  │   Registry   │  │   Runtime    │ │
│ │  Container   │  │   Push/Pull  │  │   Execution  │ │
│ │              │  │              │  │              │ │
│ │ - 격리 빌드  │  │ - 이미지 저장│  │ - 컨테이너   │ │
│ │ - 리소스     │  │ - 배포 준비  │  │   실행       │ │
│ │   제한       │  │ - 태깅       │  │ - 모니터링   │ │
│ └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────┘
```

## 📱 주요 구성 요소

### 1. 프론트엔드 (React Application)
- **위치**: `project-root/frontend/`
- **포트**: 3000
- **기능**:
  - 사용자 코드 업로드 인터페이스
  - 빌드 진행 상황 모니터링
  - 컨테이너 이미지 관리
  - 지갑 연동 (Sui Wallet)

### 2. 백엔드 API (Express.js)
- **위치**: `project-root/backend/`
- **포트**: 3001
- **주요 모듈**:
  - **파일 처리기**: 업로드된 코드에서 민감 정보 분리
  - **Walrus 클라이언트**: 분산 저장소 연동
  - **Nautilus 클라이언트**: TEE 빌드 시스템 연동
  - **Docker Builder**: 컨테이너 빌드 관리

### 3. Walrus Storage (분산 저장소)
- **목적**: 코드 번들의 탈중앙화 저장
- **특징**:
  - 내용 주소 지정 (Content Addressing)
  - 자동 중복 제거
  - 분산 가용성
  - Blob ID를 통한 접근

### 4. Nautilus TEE (신뢰 실행 환경)
- **위치**: `nautilus/`
- **포트**: 8080 (Rust 서버)
- **보안 기능**:
  - 격리된 실행 환경
  - 암호학적 증명 생성
  - 변조 방지
  - 기밀성 보장

### 5. Docker Builder Service
- **통합**: Nautilus Service 내 포함
- **지원 언어**:
  - Node.js (package.json 기반)
  - Python (requirements.txt/pyproject.toml 기반)
  - Go (go.mod 기반)
  - Rust (Cargo.toml 기반)
  - Java (pom.xml/build.gradle 기반)

## 🔄 데이터 플로우

### Phase 1: 코드 업로드 및 처리

```
사용자 코드 업로드
    ↓
┌─────────────────────────────────────┐
│ POST /api/project/upload            │
│                                     │
│ 1. Multer로 파일 수신               │
│ 2. FileProcessor로 민감정보 추출    │
│    - API Keys                       │
│    - Passwords                      │
│    - Private Keys                   │
│    - Database URLs                  │
│ 3. 정리된 코드 패키징               │
│ 4. Walrus에 업로드                  │
└─────────────────────────────────────┘
    ↓
Walrus Blob ID (bundleId) 반환
```

### Phase 2: 보안 빌드 프로세스

```
빌드 요청 (bundleId + walletAddress)
    ↓
┌─────────────────────────────────────┐
│ POST /api/project/build             │
│                                     │
│ 1. 요청 검증                        │
│ 2. Nautilus 서버 상태 확인          │
│ 3. Walrus에서 코드 번들 다운로드    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ NautilusService.secureBuild()       │
│                                     │
│ 1. Docker Builder Service 호출      │
│ 2. 프로젝트 타입 자동 감지          │
│ 3. Dockerfile 자동 생성             │
│ 4. Docker 이미지 빌드               │
│ 5. 빌드 로그 수집                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 빌드 결과 반환                      │
│                                     │
│ - imageUrl: 컨테이너 이미지 URL     │
│ - buildHash: 빌드 고유 해시         │
│ - attestation: 암호학적 증명        │
│ - logs: 빌드 과정 로그              │
└─────────────────────────────────────┘
```

### Phase 3: Docker 빌드 세부 과정

```
Docker Builder Service 내부 플로우:

코드 번들 수신
    ↓
┌─────────────────────────────────────┐
│ 1. 임시 디렉토리에 코드 추출        │
│ 2. 프로젝트 타입 감지:              │
│    - package.json → Node.js         │
│    - requirements.txt → Python      │
│    - go.mod → Go                    │
│    - Cargo.toml → Rust              │
│    - pom.xml → Java                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. 언어별 Dockerfile 자동 생성:     │
│                                     │
│ Node.js:                            │
│ FROM node:18-alpine                 │
│ COPY package*.json ./               │
│ RUN npm ci --only=production        │
│ COPY . .                            │
│ EXPOSE 3000                         │
│ CMD ["npm", "start"]                │
│                                     │
│ Python:                             │
│ FROM python:3.11-slim               │
│ COPY requirements.txt .             │
│ RUN pip install -r requirements.txt │
│ COPY . .                            │
│ EXPOSE 8000                         │
│ CMD ["python", "app.py"]            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. Docker 빌드 실행:                │
│    - 격리된 빌드 환경               │
│    - 리소스 제한 적용               │
│    - 보안 정책 적용                 │
│    - 실시간 로그 수집               │
└─────────────────────────────────────┘
    ↓
빌드 완료 및 이미지 생성
```

## 🛠️ API 엔드포인트

### 프로젝트 관리 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/project/upload` | 코드 업로드 및 Walrus 저장 |
| POST | `/api/project/build` | Nautilus TEE 빌드 실행 |
| POST | `/api/project/from-github` | GitHub 저장소 가져오기 |
| GET | `/api/project/bundles` | 저장된 코드 번들 목록 |
| GET | `/api/project/bundles/:id` | 특정 번들 정보 조회 |

### Docker Builder API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/docker/build` | Docker 이미지 빌드 시작 |
| GET | `/api/docker/build/:id` | 빌드 상태 및 로그 조회 |
| DELETE | `/api/docker/build/:id` | 빌드 취소 |
| POST | `/api/docker/push` | 이미지 레지스트리 푸시 |
| GET | `/api/docker/builds` | 모든 빌드 목록 |
| GET | `/api/docker/health` | Docker 서비스 상태 확인 |

### Seal (암호화) API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/seal/ticket` | 복호화 티켓 생성 |

## 🔐 보안 아키텍처

### 1. 코드 보안
```
사용자 코드
    ↓
민감 정보 추출 및 분리
    ├─ API Keys → Secure Vault
    ├─ Passwords → Encrypted Storage
    ├─ Private Keys → Hardware Security Module
    └─ Database URLs → Environment Variables
    ↓
정리된 코드 → Walrus Storage
```

### 2. TEE (Trusted Execution Environment) 보안
```
Nautilus TEE
    ├─ Hardware Attestation: CPU 레벨 보안 증명
    ├─ Memory Encryption: 실행 중 데이터 암호화
    ├─ Secure Boot: 검증된 코드만 실행
    └─ Remote Attestation: 외부 검증 가능
```

### 3. 빌드 격리
```
Docker Container Isolation
    ├─ Namespace Isolation: 프로세스 격리
    ├─ Cgroup Limits: 리소스 제한
    ├─ Seccomp Profiles: 시스템 콜 제한
    └─ AppArmor/SELinux: 추가 보안 정책
```

## 🚀 배포 아키텍처

### 개발 환경
```
로컬 개발
├─ Frontend: localhost:3000
├─ Backend: localhost:3001
├─ Nautilus: localhost:8080
└─ Docker: Docker Desktop
```

### 프로덕션 환경
```
클라우드 배포
├─ Frontend: Vercel/Netlify
├─ Backend: AWS ECS/Google Cloud Run
├─ Nautilus: Sui Nautilus Network
└─ Docker: Kubernetes/Container Service
```

## 📊 모니터링 및 로깅

### 시스템 메트릭
- 빌드 성공률
- 평균 빌드 시간
- 리소스 사용량
- 동시 빌드 수

### 보안 로깅
- 모든 API 호출 기록
- 빌드 과정 추적
- 오류 및 예외 로깅
- 보안 이벤트 모니터링

## 🔄 확장성 고려사항

### 수평 확장
- 백엔드 API 서버 로드 밸런싱
- Docker Builder 인스턴스 자동 스케일링
- Walrus 분산 저장소의 자동 확장

### 성능 최적화
- 빌드 캐싱 시스템
- 이미지 레이어 최적화
- 병렬 빌드 처리
- CDN을 통한 정적 자산 배포

## 🛡️ 장애 복구

### 고가용성
- 다중 리전 배포
- 자동 장애 조치
- 데이터 백업 및 복구
- 서비스 상태 모니터링

### 재해 복구
- 정기적인 백업
- 클러스터 간 복제
- 빠른 복구 절차
- 비즈니스 연속성 계획

---

*이 문서는 DAAS Vader 플랫폼의 현재 구현 상태를 반영하며, 지속적으로 업데이트됩니다.*