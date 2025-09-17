'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Server,
  Upload,
  Settings,
  Activity,
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import WalletConnector from '@/components/wallet/WalletConnector'
import NodeSelector from '@/components/nodes/NodeSelector'
import ProjectUpload from '@/components/ProjectUpload'
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard'
import { WalletInfo, WorkerNode, ProjectUploadData, Deployment } from '@/types'

type Step = 'wallet' | 'nodes' | 'upload' | 'deploy' | 'monitor'

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('wallet')
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<WorkerNode[]>([])
  const [projectData, setProjectData] = useState<ProjectUploadData | null>(null)
  const [deployment, setDeployment] = useState<Deployment | null>(null)

  const steps = [
    { id: 'wallet', title: '지갑 연결', icon: Wallet, description: 'Sui 지갑을 연결하여 시작하세요' },
    { id: 'nodes', title: '노드 선택', icon: Server, description: '배포할 워커노드를 선택하세요' },
    { id: 'upload', title: '코드 업로드', icon: Upload, description: '프로젝트를 업로드하세요' },
    { id: 'deploy', title: '배포 설정', icon: Settings, description: '배포 환경을 설정하세요' },
    { id: 'monitor', title: '모니터링', icon: Activity, description: '실시간으로 모니터링하세요' }
  ]

  const isStepCompleted = (stepId: string) => {
    switch (stepId) {
      case 'wallet': return walletInfo?.connected
      case 'nodes': return selectedNodes.length > 0
      case 'upload': return projectData !== null
      case 'deploy': return deployment !== null
      case 'monitor': return deployment !== null
      default: return false
    }
  }

  const isStepAccessible = (stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId)
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepCompleted(steps[i].id)) return false
    }
    return true
  }

  const handleWalletConnect = (wallet: WalletInfo) => {
    setWalletInfo(wallet)
    setCurrentStep('nodes')
  }

  const handleWalletDisconnect = () => {
    setWalletInfo(null)
    setCurrentStep('wallet')
    setSelectedNodes([])
    setProjectData(null)
    setDeployment(null)
  }

  const handleNodesSelect = (nodes: WorkerNode[]) => {
    setSelectedNodes(nodes)
    if (nodes.length > 0) {
      setCurrentStep('upload')
    }
  }

  const handleProjectUpload = async (files: File[]) => {
    // Mock project data
    const mockProjectData: ProjectUploadData = {
      files,
      name: 'my-project',
      description: 'My awesome project'
    }
    setProjectData(mockProjectData)
    setCurrentStep('deploy')
  }

  const handleDeploy = () => {
    // Mock deployment creation
    const mockDeployment: Deployment = {
      id: 'deploy-1',
      projectId: 'project-1',
      version: 'v1.0.0',
      nodes: selectedNodes,
      status: 'running',
      environment: {},
      runtime: 'nodejs',
      resources: {
        cpu: 2,
        memory: 4,
        budget: 5
      },
      createdAt: new Date()
    }
    setDeployment(mockDeployment)
    setCurrentStep('monitor')
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'wallet':
        return (
          <WalletConnector
            onConnect={handleWalletConnect}
            onDisconnect={handleWalletDisconnect}
            currentWallet={walletInfo}
          />
        )

      case 'nodes':
        return (
          <div className="space-y-4">
            <NodeSelector
              onSelect={handleNodesSelect}
              selectedNodes={selectedNodes}
              maxNodes={3}
            />
            {selectedNodes.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep('upload')}>
                  다음 단계
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )

      case 'upload':
        return (
          <ProjectUpload
            onFileUpload={handleProjectUpload}
            onGitHubConnect={async (repo) => {
              const mockProjectData: ProjectUploadData = {
                githubRepo: repo.full_name,
                name: repo.name,
                description: repo.description || ''
              }
              setProjectData(mockProjectData)
              setCurrentStep('deploy')
            }}
            maxFileSize={50 * 1024 * 1024}
            acceptedFileTypes={[
              '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs',
              '.json', '.md', '.txt', '.html', '.css', '.scss', '.less',
              '.php', '.rb', '.kt', '.swift', '.dart', '.vue', '.svelte'
            ]}
            backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}
          />
        )

      case 'deploy':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">배포 설정</h2>
              <p className="text-muted-foreground">
                선택한 노드에 프로젝트를 배포하기 전 마지막 설정을 확인하세요
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">프로젝트 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">이름:</span>
                    <span>{projectData?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">파일 수:</span>
                    <span>{projectData?.files?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">런타임:</span>
                    <span>Node.js</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">선택된 노드</h3>
                <div className="space-y-2">
                  {selectedNodes.map(node => (
                    <div key={node.id} className="flex items-center justify-between text-sm">
                      <span>{node.name}</span>
                      <Badge variant="outline">{node.city}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleDeploy}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                배포 시작
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 'monitor':
        return deployment ? (
          <MonitoringDashboard deployment={deployment} realTime={true} />
        ) : null

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">D</span>
              </div>
              <h1 className="text-xl font-bold">DaaS Platform</h1>
            </div>

            {walletInfo?.connected && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {walletInfo.balance.toFixed(2)} SUI
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleWalletDisconnect}
                >
                  연결 해제
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            const completed = isStepCompleted(step.id)
            const accessible = isStepAccessible(step.id)
            const current = currentStep === step.id

            return (
              <div key={step.id} className="flex items-center">
                <motion.div
                  className={`flex flex-col items-center cursor-pointer ${
                    accessible ? '' : 'opacity-50 pointer-events-none'
                  }`}
                  onClick={() => accessible && setCurrentStep(step.id as Step)}
                  whileHover={accessible ? { scale: 1.05 } : {}}
                  whileTap={accessible ? { scale: 0.95 } : {}}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2 transition-all ${
                      completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : current
                        ? 'bg-primary border-primary text-primary-foreground'
                        : accessible
                        ? 'border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary'
                        : 'border-muted-foreground/20 text-muted-foreground/50'
                    }`}
                  >
                    {completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className={`font-medium text-sm ${current ? 'text-primary' : ''}`}>
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-24">
                      {step.description}
                    </p>
                  </div>
                </motion.div>

                {index < steps.length - 1 && (
                  <div className="flex-1 h-px bg-border mx-4" />
                )}
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          {renderStepContent()}
        </motion.div>
      </div>
    </div>
  )
}
