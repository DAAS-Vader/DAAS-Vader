# DAAS-Vader (Decentralized Application as a Service)

Sui 블록체인과 Walrus 분산 스토리지를 활용한 탈중앙화 애플리케이션 배포 플랫폼

## 주요 기능

- 🔗 **Sui 지갑 연결**: Suiet, Slush Wallet 등 지원
- 📦 **프로젝트 업로드**: 폴더 구조 그대로 업로드 가능
- 🐳 **Docker 이미지 지원**: tar 형식의 Docker 이미지 업로드
- 🔒 **분산 스토리지**: Walrus를 통한 안전한 파일 저장
- 🌐 **완전한 탈중앙화**: 백엔드 서버 없이 작동

## 프로젝트 구조

```
project-root/
├── frontend/         # Next.js 프론트엔드 애플리케이션
├── docs/            # 프로젝트 문서
├── seal/            # 암호화 관련 모듈 (선택적)
└── walrus/          # Walrus 설정 파일
```

## 시작하기

### 필수 요구사항

- Node.js 18+
- npm 또는 yarn
- Sui 지갑 (Suiet 또는 Slush Wallet)

### 설치 및 실행

```bash
# 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 애플리케이션에 접속할 수 있습니다.

## 사용 방법

### 1. 지갑 연결
- Sui 지갑을 연결하여 시작합니다
- Testnet SUI 토큰이 필요합니다

### 2. 프로젝트 업로드
- **프로젝트 폴더**: 전체 프로젝트 폴더를 선택하여 업로드
- **압축 파일**: .zip, .tar.gz 형식 지원
- **Docker 이미지**: `docker save` 명령으로 생성한 .tar 파일 업로드

### 3. Docker 이미지 준비
```bash
# Docker 이미지 빌드
docker build -t myapp .

# tar 파일로 저장
docker save myapp > myapp.tar

# 생성된 tar 파일을 업로드
```

### 4. 업로드 확인
- 업로드 완료 후 콘솔에서 다운로드 URL 확인
- Blob ID를 통해 Walrus에서 직접 접근 가능

## 기술 스택

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Blockchain**: Sui Network
- **Storage**: Walrus Decentralized Storage
- **Wallet**: @mysten/dapp-kit

## 보안

- 모든 데이터는 Walrus 분산 스토리지에 저장
- 지갑 서명을 통한 사용자 인증
- 선택적 암호화 지원 (Seal 모듈)

## 라이선스

MIT