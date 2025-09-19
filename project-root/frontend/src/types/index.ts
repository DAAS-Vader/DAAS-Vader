// 지갑 관련 타입
export interface WalletInfo {
  connected: boolean
  address: string
  balance: number
  provider: 'sui' | 'martian' | 'suiet'
  authSignature?: string // For API authentication
}

// 워커노드 관련 타입
export interface WorkerNode {
  id: string
  name: string
  region: 'asia-pacific' | 'north-america' | 'europe'
  country: string
  city: string
  specs: {
    cpu: number
    memory: number // GB
    storage: number // GB
  }
  performance: {
    uptime: number // percentage
    avgLatency: number // ms
    reputation: number // 0-100
  }
  pricing: {
    cpuPrice: number // SUI per hour per CPU
    memoryPrice: number // SUI per hour per GB
    basePrice: number // SUI per hour
  }
  status: 'available' | 'busy' | 'offline'
  location: {
    lat: number
    lng: number
  }
}

export interface NodeFilter {
  regions: string[]
  minCPU: number
  maxLatency: number
  maxPrice: number
  minReputation: number
}

// 프로젝트 관련 타입
export interface Project {
  id: string
  name: string
  description?: string
  walrusBlobId?: string
  githubRepo?: string
  status: 'creating' | 'uploading' | 'deployed' | 'error'
  createdAt: Date
  updatedAt: Date
  deployments: Deployment[]
}

export interface Deployment {
  id: string
  projectId: string
  version: string
  nodes: WorkerNode[]
  status: 'pending' | 'deploying' | 'running' | 'stopped' | 'error'
  environment: Record<string, string>
  runtime: 'nodejs' | 'python' | 'go' | 'docker'
  resources: {
    cpu: number
    memory: number
    budget: number // SUI per day
  }
  metrics?: DeploymentMetrics
  createdAt: Date
}

// 모니터링 관련 타입
export interface DeploymentMetrics {
  requests: number
  errors: number
  avgLatency: number
  uptime: number
  cost: number // SUI spent
  lastUpdated: Date
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: string
  deploymentId: string
}

export interface Alert {
  id: string
  type: 'error' | 'performance' | 'cost' | 'uptime'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAt: Date
  resolved: boolean
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 업로드 관련 타입
export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number // 0-100
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

export interface ProjectUploadData {
  files?: File[]
  githubRepo?: string
  walrusBlobId?: string
  name: string
  description?: string
}