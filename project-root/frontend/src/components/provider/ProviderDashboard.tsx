'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, ArrowRight, CheckCircle, Server, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import TaskSelector from '@/components/tasks/TaskSelector'
import NodeSetup from './NodeSetup'
import { WalletInfo, Task } from '@/types'
import { nodeRegistryService } from '@/services/nodeRegistry'
import StakingPoolStats from '../StakingPoolStats'

type Step = 'wallet' | 'node' | 'tasks' | 'deploy'
type ViewState = 'wallet' | 'node' | 'node-setup' | 'tasks' | 'deploy'

interface ProviderDashboardProps {
  onRoleChange?: () => void
}

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ onRoleChange }) => {
  const [currentStep, setCurrentStep] = useState<Step>('wallet')
  const [currentView, setCurrentView] = useState<ViewState>('wallet')
  const currentAccount = useCurrentAccount()
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [hasNode, setHasNode] = useState(false)
  const [isCheckingNode, setIsCheckingNode] = useState(false)

  const steps = [
    { id: 'wallet', title: 'Connect Wallet', icon: Wallet, description: 'Connect your Sui wallet to get started' },
    { id: 'node', title: 'Create Node', icon: Plus, description: 'Create a node to provide resources' },
    { id: 'tasks', title: 'Select Task', icon: Server, description: 'Choose a task from the task pool' },
    { id: 'deploy', title: 'Deploy & Execute', icon: CheckCircle, description: 'Deploy and execute the selected task' }
  ]

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
      handleWalletDisconnect()
    }
  }, [currentAccount, currentStep, walletInfo])

  const handleWalletConnect = async (wallet: WalletInfo) => {
    setWalletInfo(wallet)
    setHasNode(false)
    setCurrentStep('node')
    setCurrentView('node')
  }

  const handleWalletDisconnect = () => {
    setWalletInfo(null)
    setCurrentStep('wallet')
    setCurrentView('wallet')
    setSelectedTask(null)
    setHasNode(false)
  }

  const handleNodeCreate = () => {
    setCurrentView('node-setup')
  }

  const handleNodeSetupComplete = () => {
    setHasNode(true)
    setCurrentStep('tasks')
    setCurrentView('tasks')
  }

  const handleNodeSetupCancel = () => {
    setCurrentView('node')
  }

  const handleTasksSelect = (task: Task | null) => {
    setSelectedTask(task)
  }

  const handleStartDeploy = async () => {
    if (!selectedTask) return

    setIsDeploying(true)

    try {
      // TODO: integrate contract calls to select task and start deployment
      console.log('Starting deployment for selected task:', selectedTask)

      // Dummy deployment simulation
      await new Promise(resolve => setTimeout(resolve, 2000))

      setCurrentStep('deploy')
      setCurrentView('deploy')
      console.log('Deployment completed successfully')
    } catch (error) {
      console.error('Deployment failed:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  const isStepCompleted = (stepId: string) => {
    switch (stepId) {
      case 'wallet': return walletInfo !== null
      case 'node': return hasNode
      case 'tasks': return selectedTask !== null
      case 'deploy': return currentStep === 'deploy'
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

  // Handling NodeSetup view
  if (currentView === 'node-setup') {
    return (
      <NodeSetup
        onNodeCreate={handleNodeSetupComplete}
        onCancel={handleNodeSetupCancel}
        walletInfo={walletInfo}
        onRoleChange={onRoleChange}
      />
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'wallet':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Get started as a provider</h2>
              <p className="text-muted-foreground text-lg">
                Connect your wallet to work on tasks
              </p>
            </motion.div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Connect Wallet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Connect to the Sui network to access the task pool.
              </p>
              <div className="flex justify-center">
                <ConnectButton className="w-full max-w-sm" />
              </div>
              {currentAccount && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Connected address:</p>
                  <p className="text-xs font-mono mt-1">{currentAccount.address}</p>
                </div>
              )}
              {isCheckingNode && (
                <div className="text-center p-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Checking node registration status...</p>
                </div>
              )}
            </Card>
          </div>
        )

      case 'node':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Create Node</h2>
              <p className="text-muted-foreground text-lg">
                Create a node to execute tasks
              </p>
            </motion.div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create a new node</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You need to create a node before taking on tasks.
                After creating a node you can choose tasks from the pool.
              </p>
              <div className="flex justify-center">
                <Button
                  onClick={handleNodeCreate}
                  className="w-full max-w-sm"
                >
                  Create node
                  <Plus className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )

      case 'tasks':
        return (
          <div className="space-y-6">
            <StakingPoolStats/>
            <TaskSelector
              onSelect={handleTasksSelect}
              selectedTask={selectedTask}
            />
            {selectedTask && (
              <div className="flex justify-end">
                <Button
                  onClick={handleStartDeploy}
                  disabled={isDeploying}
                  className="min-w-32"
                >
                  {isDeploying ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deploying...
                    </div>
                  ) : (
                    <>
                      Start deployment
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )

      case 'deploy':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Deployment complete!</h2>
              <p className="text-muted-foreground text-lg">
                The selected task has been deployed successfully
              </p>
            </motion.div>

            {selectedTask && (
              <>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">{selectedTask.name}</h3>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Running
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-6">{selectedTask.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-semibold">{selectedTask.requiredResources.cpu}</div>
                      <div className="text-sm text-muted-foreground">CPU cores</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-semibold">{selectedTask.requiredResources.memory}GB</div>
                      <div className="text-sm text-muted-foreground">Memory</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-semibold">{selectedTask.requiredResources.storage}GB</div>
                      <div className="text-sm text-muted-foreground">Storage</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-semibold">{selectedTask.estimatedDuration} hours</div>
                      <div className="text-sm text-muted-foreground">Estimated duration</div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Walrus Blob URL:</span>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <a
                        href={selectedTask.walrusBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all text-sm"
                      >
                        {selectedTask.walrusBlobUrl}
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedTask.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-800">Estimated reward</h3>
                      <p className="text-sm text-green-600">
                        Reward you will receive upon completion
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {selectedTask.reward} SUI
                    </div>
                  </div>
                </Card>
              </>
            )}

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTask(null)
                  setCurrentStep('tasks')
                  setCurrentView('tasks')
                }}
              >
                Choose another task
              </Button>
            </div>
          </div>
        )

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
                Task provider
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {onRoleChange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRoleChange}
                >
                  Change role
                </Button>
              )}
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
          className="max-w-6xl mx-auto"
        >
          {renderStepContent()}
        </motion.div>
      </div>
    </div>
  )
}

export default ProviderDashboard