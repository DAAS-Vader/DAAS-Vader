'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Upload,
  Settings,
  Activity,
  CheckCircle
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import RoleSelector from '@/components/RoleSelector'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import ProjectUpload from '@/components/ProjectUpload'
import ContractingLoader from '@/components/ContractingLoader'
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard'
import ProviderDashboard from '@/components/provider/ProviderDashboard'
import MinRequirementsSetup from '@/components/MinRequirementsSetup'
import { WalletInfo, ProjectUploadData, Deployment } from '@/types'
import { jobRequestService } from '@/services/jobRequestService'

type UserRole = 'user' | 'provider' | null
type Step = 'wallet' | 'requirements' | 'upload' | 'contracting' | 'monitor'

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<UserRole>(null)
  const [currentStep, setCurrentStep] = useState<Step>('wallet')
  const [projectData, setProjectData] = useState<ProjectUploadData | null>(null)
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [isCheckingJobs, setIsCheckingJobs] = useState(false)
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [minRequirements, setMinRequirements] = useState<{
    min_cpu_cores: number
    min_memory_gb: number
    min_storage_gb: number
    max_price_per_hour: number
  } | null>(null)

  // Get current wallet account from dapp-kit
  const currentAccount = useCurrentAccount()

  const steps = [
    { id: 'wallet', title: 'Connect Wallet', icon: Wallet, description: 'Connect your Sui wallet to get started' },
    { id: 'requirements', title: 'Set Min Requirements', icon: Settings, description: 'Set minimum hardware specifications' },
    { id: 'upload', title: 'Upload Code', icon: Upload, description: 'Upload your project' },
    { id: 'monitor', title: 'Monitoring', icon: Activity, description: 'Monitor in real-time' }
  ]

  const isStepCompleted = (stepId: string) => {
    switch (stepId) {
      case 'wallet': return walletInfo !== null
      case 'requirements': return minRequirements !== null
      case 'upload': return projectData !== null
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
    if (currentAccount && currentStep === 'wallet' && !walletInfo) {
      const wallet: WalletInfo = {
        connected: true,
        address: currentAccount.address,
        balance: 0,
        provider: 'suiet'
      }
      handleWalletConnect(wallet)
    } else if (!currentAccount && currentStep !== 'wallet') {
      // Reset if wallet disconnected
      handleWalletDisconnect()
    }
  }, [currentAccount, currentStep, walletInfo])

  const handleWalletConnect = async (wallet: WalletInfo) => {
    setWalletInfo(wallet)
    setIsCheckingJobs(true)

    try {
      // Check user's active jobs
      console.log(`🔍 Checking active jobs for user ${wallet.address}...`)
      const userActiveJobs = await jobRequestService.getUserActiveJobs(wallet.address)

      if (userActiveJobs.length > 0) {
        console.log(`✅ Found ${userActiveJobs.length} active jobs`)
        // If there are active jobs, go to monitoring step
        setCurrentStep('monitor')
      } else {
        console.log(`📝 No active jobs, moving to requirements setup step`)
        setCurrentStep('requirements')
      }
    } catch (error) {
      console.error('Failed to check active jobs:', error)
      // On error, default to requirements setup step
      setCurrentStep('requirements')
    } finally {
      setIsCheckingJobs(false)
    }
  }

  const handleWalletDisconnect = () => {
    setWalletInfo(null)
    setCurrentStep('wallet')
    setProjectData(null)
    setDeployment(null)
    setMinRequirements(null)
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
    // Automatically move to contracting step after upload completion
    setCurrentStep('contracting')
  }

  const handleContractingComplete = () => {
    // Automatically create deployment and move to monitoring after contracting completion
    const mockDeployment: Deployment = {
      id: 'deploy-1',
      projectId: 'project-1',
      version: 'v1.0.0',
      nodes: [], // Node selection step removed
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
    setProjectData(null)
    setDeployment(null)
    setMinRequirements(null)
  }

  const handleMinRequirementsComplete = (requirements: {
    min_cpu_cores: number
    min_memory_gb: number
    min_storage_gb: number
    max_price_per_hour: number
  }) => {
    setMinRequirements(requirements)
    setCurrentStep('upload')
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
              <h3 className="text-lg font-semibold mb-4">Connect Wallet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Please connect your wallet to connect to the Sui network.
              </p>
              <div className="flex justify-center">
                <ConnectButton className="w-full max-w-sm" />
              </div>
              {currentAccount && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Connected Address:</p>
                  <p className="text-xs font-mono mt-1">{currentAccount.address}</p>
                </div>
              )}
            </Card>
            {isCheckingJobs && (
              <div className="text-center p-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Checking active jobs...</p>
              </div>
            )}
          </div>
        )

      case 'requirements':
        return (
          <MinRequirementsSetup
            onComplete={handleMinRequirementsComplete}
            onCancel={() => setCurrentStep('wallet')}
          />
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
            minRequirements={minRequirements}
          />
        )

      case 'contracting':
        return (
          <ContractingLoader
            onComplete={handleContractingComplete}
            projectName={projectData?.name || 'Your Project'}
          />
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
              <img
                src="/DAAS-VADER.svg"
                alt="DaaS Platform Logo"
                className="w-12 h-12"
              />
              <h1 className="text-xl font-bold">DaaS Platform</h1>
              <Badge variant="outline" className="ml-2">
                {selectedRole === 'user' ? 'Service User' : 'Node Provider'}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/staking'}
              >
                Staking Status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRoleChange}
              >
                Change Role
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
