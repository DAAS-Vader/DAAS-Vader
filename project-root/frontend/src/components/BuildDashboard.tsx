'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Container,
  ExternalLink,
  FileText,
  Download,
  Copy,
  Loader2,
  AlertCircle,
  Settings,
  Cpu,
  MemoryStick,
  HardDrive
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface BuildMetadata {
  sourceId: string
  imageId: string
  projectType: string
  buildTime: number
  imageSize: number
  checksum: string
  kubernetesSpec: {
    image: string
    port: number
    resources: {
      requests: { cpu: string; memory: string }
      limits: { cpu: string; memory: string }
    }
    env: Array<{ name: string; value: string }>
    command?: string[]
  }
  environment: {
    runtime: string
    version: string
    dependencies: string[]
    buildCommands: string[]
    startCommand: string
  }
}

interface BuildResult {
  sourceId: string
  imageId: string
  metadata: BuildMetadata
  kubernetes: {
    deployment: any
    service: any
  }
}

interface Bundle {
  id: string
  source: string
  repo?: string
  walrus_blob_id: string
  size_code: number
  project_type?: string
  total_files?: number
  created_at: string
}

interface BuildDashboardProps {
  backendUrl: string
  authToken: string
}

export default function BuildDashboard({ backendUrl, authToken }: BuildDashboardProps) {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(0)
  const [buildLog, setBuildLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // 번들 목록 가져오기
  useEffect(() => {
    fetchBundles()
  }, [])

  const fetchBundles = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/project/bundles`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setBundles(data.bundles || [])
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
    }
  }

  const startBuild = async (bundleId: string) => {
    if (isBuilding) return

    setIsBuilding(true)
    setBuildProgress(0)
    setBuildLog([])
    setError(null)
    setBuildResult(null)

    // 빌드 진행률 시뮬레이션
    const progressInterval = setInterval(() => {
      setBuildProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 1000)

    try {
      // 빌드 로그 시뮬레이션
      addBuildLog('🚀 Starting build process...')
      addBuildLog(`📦 Building bundle: ${bundleId}`)
      addBuildLog('🔍 Detecting project type...')

      const response = await fetch(`${backendUrl}/api/project/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          bundleId,
          walletAddress: '0x742d35Cc6634C0532925a3b8D2Aa2e5a' // 해커톤용 임시 지갑 주소
        })
      })

      clearInterval(progressInterval)
      setBuildProgress(100)

      if (response.ok) {
        const result = await response.json()
        setBuildResult(result)
        addBuildLog('✅ Build completed successfully!')
        addBuildLog(`📦 Image ID: ${result.imageId}`)
        addBuildLog(`🔗 Source ID: ${result.sourceId}`)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Build failed')
      }
    } catch (error) {
      clearInterval(progressInterval)
      setError(error.message)
      addBuildLog(`❌ Build failed: ${error.message}`)
    } finally {
      setIsBuilding(false)
    }
  }

  const addBuildLog = (message: string) => {
    setBuildLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatBuildTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const getWalrusUrl = (blobId: string) => {
    return `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Build Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Build and deploy your projects to the decentralized network
          </p>
        </div>
        <Button onClick={fetchBundles} variant="outline">
          Refresh Bundles
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 번들 목록 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="w-5 h-5" />
                Project Bundles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bundles.map((bundle) => (
                <motion.div
                  key={bundle.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedBundle?.id === bundle.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedBundle(bundle)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium truncate">
                        {bundle.repo || `Bundle ${bundle.id.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {bundle.project_type || 'Unknown'} • {bundle.total_files || 0} files
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(bundle.size_code)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {bundle.source}
                    </Badge>
                  </div>
                </motion.div>
              ))}

              {bundles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Container className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No bundles found</p>
                  <p className="text-sm">Upload a project first</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 빌드 상세 */}
        <div className="lg:col-span-2">
          {selectedBundle ? (
            <div className="space-y-6">
              {/* 번들 정보 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Bundle Details
                    </CardTitle>
                    <Button
                      onClick={() => startBuild(selectedBundle.id)}
                      disabled={isBuilding}
                      className="flex items-center gap-2"
                    >
                      {isBuilding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {isBuilding ? 'Building...' : 'Start Build'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Bundle ID</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {selectedBundle.id}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedBundle.id)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Project Type</label>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {selectedBundle.project_type || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Walrus Blob ID</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                          {selectedBundle.walrus_blob_id}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedBundle.walrus_blob_id)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(getWalrusUrl(selectedBundle.walrus_blob_id), '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Size</label>
                      <div className="mt-1 text-sm">
                        {formatFileSize(selectedBundle.size_code)} • {selectedBundle.total_files || 0} files
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 빌드 진행률 */}
              {isBuilding && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Build Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={buildProgress} className="w-full mb-4" />
                    <div className="text-sm text-muted-foreground">
                      {buildProgress.toFixed(1)}% complete
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 빌드 로그 */}
              {buildLog.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Build Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                      {buildLog.map((log, index) => (
                        <div key={index}>{log}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 에러 */}
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-5 h-5" />
                      Build Failed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700">{error}</p>
                  </CardContent>
                </Card>
              )}

              {/* 빌드 결과 */}
              {buildResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      Build Successful
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="walrus">Walrus URLs</TabsTrigger>
                        <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
                        <TabsTrigger value="environment">Environment</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Build Time</label>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {formatBuildTime(buildResult.metadata.buildTime)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Image Size</label>
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-4 h-4" />
                              {formatFileSize(buildResult.metadata.imageSize)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Project Type</label>
                            <Badge variant="secondary">
                              {buildResult.metadata.projectType}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Runtime</label>
                            <div>{buildResult.metadata.environment.runtime} {buildResult.metadata.environment.version}</div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="walrus" className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Source Code (Walrus)</label>
                            <div className="flex items-center gap-2 mt-1 p-3 bg-muted rounded-lg">
                              <code className="text-sm flex-1 truncate">
                                {buildResult.sourceId}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(buildResult.sourceId)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(getWalrusUrl(buildResult.sourceId), '_blank')}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-muted-foreground">OCI Image (Walrus)</label>
                            <div className="flex items-center gap-2 mt-1 p-3 bg-muted rounded-lg">
                              <code className="text-sm flex-1 truncate">
                                {buildResult.imageId}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(buildResult.imageId)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(getWalrusUrl(buildResult.imageId), '_blank')}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Image Reference for Kubernetes</label>
                            <div className="flex items-center gap-2 mt-1 p-3 bg-muted rounded-lg">
                              <code className="text-sm flex-1">
                                {buildResult.metadata.kubernetesSpec.image}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(buildResult.metadata.kubernetesSpec.image)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-muted-foreground">SHA256 Checksum</label>
                            <div className="flex items-center gap-2 mt-1 p-3 bg-muted rounded-lg">
                              <code className="text-xs flex-1 break-all">
                                {buildResult.metadata.checksum}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(buildResult.metadata.checksum)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="kubernetes" className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Container Specs</label>
                            <div className="mt-2 p-3 bg-muted rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Port:</span>
                                <Badge variant="outline">{buildResult.metadata.kubernetesSpec.port}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">CPU Request:</span>
                                <div className="flex items-center gap-1">
                                  <Cpu className="w-3 h-3" />
                                  <span className="text-sm">{buildResult.metadata.kubernetesSpec.resources.requests.cpu}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Memory Request:</span>
                                <div className="flex items-center gap-1">
                                  <MemoryStick className="w-3 h-3" />
                                  <span className="text-sm">{buildResult.metadata.kubernetesSpec.resources.requests.memory}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Environment Variables</label>
                            <div className="mt-2 space-y-1">
                              {buildResult.metadata.kubernetesSpec.env.map((env, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                  <code>{env.name}</code>
                                  <code className="text-muted-foreground">{env.value}</code>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Deployment YAML</label>
                            <div className="mt-2 p-3 bg-black text-green-400 rounded-lg overflow-x-auto">
                              <pre className="text-xs whitespace-pre-wrap">
                                {JSON.stringify(buildResult.kubernetes.deployment, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="environment" className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Runtime Environment</label>
                            <div className="mt-2 p-3 bg-muted rounded-lg">
                              <div className="text-sm">
                                {buildResult.metadata.environment.runtime} {buildResult.metadata.environment.version}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Build Commands</label>
                            <div className="mt-2 space-y-1">
                              {buildResult.metadata.environment.buildCommands.map((cmd, index) => (
                                <div key={index} className="p-2 bg-muted rounded text-sm font-mono">
                                  {cmd}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Start Command</label>
                            <div className="mt-2 p-2 bg-muted rounded text-sm font-mono">
                              {buildResult.metadata.environment.startCommand}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Dependencies</label>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {buildResult.metadata.environment.dependencies.slice(0, 10).map((dep, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {dep}
                                </Badge>
                              ))}
                              {buildResult.metadata.environment.dependencies.length > 10 && (
                                <Badge variant="outline" className="text-xs">
                                  +{buildResult.metadata.environment.dependencies.length - 10} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Container className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a Bundle</h3>
                  <p>Choose a project bundle from the left to start building</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}