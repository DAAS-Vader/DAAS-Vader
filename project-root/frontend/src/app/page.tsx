'use client'

import React, { useState, useEffect } from 'react'
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
import RoleSelector from '@/components/RoleSelector'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import NodeSelector from '@/components/nodes/NodeSelector'
import ProjectUpload from '@/components/ProjectUpload'
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard'
import ProviderDashboard from '@/components/provider/ProviderDashboard'
import { WorkerNode, ProjectUploadData, Deployment } from '@/types'

type UserRole = 'user' | 'provider' | null
type Step = 'wallet' | 'nodes' | 'upload' | 'deploy' | 'monitor'

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<UserRole>(null)
  const [currentStep, setCurrentStep] = useState<Step>('wallet')
  const [selectedNodes, setSelectedNodes] = useState<WorkerNode[]>([])
  const [projectData, setProjectData] = useState<ProjectUploadData | null>(null)
  const [deployment, setDeployment] = useState<Deployment | null>(null)

  // Get current wallet account from dapp-kit
  const currentAccount = useCurrentAccount()

  const steps = [
    { id: 'wallet', title: '지갑 연결', icon: Wallet, description: 'Sui 지갑을 연결하여 시작하세요' },
    { id: 'nodes', title: '노드 선택', icon: Server, description: '배포할 워커노드를 선택하세요' },
    { id: 'upload', title: '코드 업로드', icon: Upload, description: '프로젝트를 업로드하세요' },
    { id: 'deploy', title: '배포 설정', icon: Settings, description: '배포 환경을 설정하세요' },
    { id: 'monitor', title: '모니터링', icon: Activity, description: '실시간으로 모니터링하세요' }
  ]

  const isStepCompleted = (stepId: string) => {
    switch (stepId) {
      case 'wallet': return currentAccount !== null
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

  // Auto-advance when wallet is connected
  useEffect(() => {
    if (currentAccount && currentStep === 'wallet') {
      setCurrentStep('nodes')
    } else if (!currentAccount && currentStep !== 'wallet') {
      // Reset if wallet disconnected
      setCurrentStep('wallet')
      setSelectedNodes([])
      setProjectData(null)
      setDeployment(null)
    }
  }, [currentAccount, currentStep])

  const handleNodesSelect = (nodes: WorkerNode[]) => {
    setSelectedNodes(nodes)
    if (nodes.length > 0) {
      setCurrentStep('upload')
    }
  }

  const handleProjectUpload = async (files: File[]) => {
    // Project upload completed - data will be set when upload is fully done
    const mockProjectData: ProjectUploadData = {
      files,
      name: 'my-project',
      description: 'My awesome project'
    }
    setProjectData(mockProjectData)
    // Don't automatically move to next step - let user see upload progress
    // setCurrentStep('deploy') will be called by ProjectUpload component when ready
  }

  // New function to handle successful upload completion
  const handleUploadComplete = (uploadResult: { success: boolean; message: string; cid_code?: string; blobId?: string }) => {
    console.log('Upload completed with result:', uploadResult)
    // Only move to deploy step after upload is actually complete
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

  const handleRoleSelect = (role: 'user' | 'provider') => {
    setSelectedRole(role)
  }

  const handleRoleChange = () => {
    setSelectedRole(null)
    setCurrentStep('wallet')
    setSelectedNodes([])
    setProjectData(null)
    setDeployment(null)
  }

  // Show role selector if no role is selected
  if (!selectedRole) {
    return <RoleSelector onRoleSelect={handleRoleSelect} />
  }

  // Show provider dashboard if provider role is selected
  if (selectedRole === 'provider') {
    return <ProviderDashboard onRoleChange={handleRoleChange} />
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'wallet':
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">지갑 연결</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Sui 네트워크에 연결하려면 지갑을 연결해주세요.
              </p>
              <div className="flex justify-center">
                <ConnectButton className="w-full max-w-sm" />
              </div>
              {currentAccount && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">연결된 주소:</p>
                  <p className="text-xs font-mono mt-1">{currentAccount.address}</p>
                </div>
              )}
            </Card>
          </div>
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
            onUploadComplete={handleUploadComplete}
            maxFileSize={500 * 1024 * 1024} // 500MB for docker images
            acceptedFileTypes={[
              '.zip', '.tar.gz', '.tgz', '.tar',
              '.docker', '.dockerimage',
              'Dockerfile', '.dockerfile',
              '.yaml', '.yml',  // Docker compose files
              '*'  // Accept all files
            ]}
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
              <Badge variant="outline" className="ml-2">
                {selectedRole === 'user' ? '서비스 사용자' : '노드 제공자'}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRoleChange}
              >
                역할 변경
              </Button>
            </div>
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
