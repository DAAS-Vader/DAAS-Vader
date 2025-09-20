// 데이터베이스 모델들은 제거됨 - stateless 아키텍처 사용

// API Types
export interface FileInfo {
  path: string;
  size: number;
  sha256?: string;
}

export interface UploadResponse {
  cid_code: string;
  size_code: number;
  cid_env?: string;
  dek_version?: number;
  files_env: FileInfo[];
  ignored: string[];
}

export interface GitHubUploadRequest {
  repo: string;
  ref: string;
  installation_id: number;
  ignorePatterns?: string[];
}

export interface TicketRequest {
  leaseId: string;
  cidEnv: string;
  nodeId: string;
}

export interface TicketResponse {
  ticket: string;
  exp: number;
  jti: string;
}

// Service Types
export interface SealEncryptResponse {
  cid: string;
  dek_version: number;
}

export interface WalrusUploadResponse {
  cid: string;
  size: number;
}

// Walrus 트랜잭션 준비 응답
export interface WalrusTransactionRequest {
  txData: string; // 서명되지 않은 트랜잭션 데이터
  gasObjectId: string;
  gasBudget: string;
  metadata: {
    fileName: string;
    mimeType: string;
    epochs: number;
    size: number;
  };
}

// 사용자 지갑 업로드 요청
export interface UserWalletUploadRequest {
  signedTransaction: string; // 사용자가 서명한 트랜잭션
  walletAddress: string;
}

export interface ProcessedBundle {
  secretFiles: Map<string, Uint8Array>;
  codeFiles: Map<string, Uint8Array>;
  ignored: string[];
}

// File Tree Types
export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  path: string;
  children?: { [key: string]: FileTreeNode };
  lastModified?: Date;
  mimeType?: string;
}

export interface ProcessedBundleResult {
  secretFiles: Map<string, Uint8Array>;
  codeFiles: Map<string, Uint8Array>;
  ignored: string[];
  fileTree: FileTreeNode;
  projectType: string;
  totalFiles: number;
}

// Middleware Types
export interface AuthenticatedRequest extends Request {
  walletAddress: string; // 지갑 주소로 변경
}

// Authentication Types
export interface WalletAuthRequest {
  walletAddress: string;
  signature: string;
  message: string;
  timestamp: number;
}

// Configuration Types
export interface Config {
  port: number;
  nodeEnv: string;
  auth: {
    devAdminToken: string;
    sessionSecret: string;
  };
  seal: {
    url: string;
    serviceToken: string;
    ticketSecret: string;
  };
  sealV2?: {
    packageId?: string;
    sealRegistryId?: string;
    enclaveRegistryId?: string;
    adminPrivateKey?: string;
    defaultIdentity?: string;
  };
  sui?: {
    rpcUrl?: string;
    networkType?: string;
  };
  walrus: {
    // SDK configuration
    useSDK?: boolean;
    network?: string;
    keypairSeed?: string;
    walCoinType?: string;
  };
  github: {
    appId?: string;
    privateKeyPem?: string;
    webhookSecret: string;
    appSlug: string;
  };
  limits: {
    secretFileSize: number;
    secretBundleSize: number;
    codeBundleSize: number;
    requestTimeout: number;
  };
  defaultIgnorePatterns: string[];
}

// Error Types
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServiceError extends Error {
  public statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
  }
}