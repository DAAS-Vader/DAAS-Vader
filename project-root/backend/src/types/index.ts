// Database Models
export interface ProjectBundle {
  id: string;
  user_id: string; // 이제 지갑 주소가 직접 저장됨
  source: 'dir-upload' | 'zip-upload' | 'github';
  repo?: string;
  ref?: string;
  cid_code: string;
  cid_env?: string;
  size_code: number;
  size_env?: number;
  files_env: FileInfo[];
  ignored: string[];
  file_tree?: FileTreeNode;
  project_type?: string;
  total_files?: number;
  created_at: Date;
}

// User 인터페이스는 더 이상 필요하지 않음 - 지갑 주소를 직접 사용

export interface GitHubInstallation {
  installation_id: number;
  user_id: string; // 이제 지갑 주소가 직접 저장됨
  account_login: string;
  created_at: Date;
}

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
  walrus: {
    publisher: string;
    aggregator: string;
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