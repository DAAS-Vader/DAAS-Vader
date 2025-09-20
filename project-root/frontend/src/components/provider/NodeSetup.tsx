'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Server,
  Cpu,
  HardDrive,
  Zap,
  Coins,
  Plus,
  Minus,
  ArrowRight,
  Info,
  CheckCircle,
  Globe,
  AlertTriangle
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { WalletInfo } from '@/types'
import { nodeRegistryService } from '@/services/nodeRegistry'
import { REGIONS } from '@/contracts/types'

interface ResourceConfig {
  cpu: number
  memory: number
  storage: number
  bandwidth: number
  region: string
}

interface NodeSetupProps {
  onNodeCreate: () => void
  onCancel: () => void
  walletInfo: WalletInfo | null
  onRoleChange?: () => void
}

const NodeSetup: React.FC<NodeSetupProps> = ({ onNodeCreate, onCancel, walletInfo, onRoleChange }) => {
  const [resources, setResources] = useState<ResourceConfig>({
    cpu: 4,
    memory: 8,
    storage: 100,
    bandwidth: 1000,
    region: 'Asia-Seoul'
  })

  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateResource = (key: keyof ResourceConfig, increment: boolean) => {
    setResources(prev => {
      const step = key === 'bandwidth' ? 100 : 1
      const newValue = increment ? prev[key] + step : Math.max(0, prev[key] - step)
      return { ...prev, [key]: newValue }
    })
  }

  const handleCreateNode = async () => {
    if (!walletInfo?.address) {
      setError('Wallet is not connected.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      console.log(`🔑 Node provider address: ${walletInfo.address}`)

      // Register node using actual contract service
      const result = await nodeRegistryService.registerNode(
        null as any, // TODO: pass actual signer
        {
          cpu_cores: resources.cpu,
          memory_gb: resources.memory,
          storage_gb: resources.storage,
          bandwidth_mbps: resources.bandwidth,
          region: resources.region,
        }
      )

      console.log('✅ Node registration completed:', result)
      console.log(`📝 Node ${walletInfo.address} has been registered to the contract`)

      // Move to dashboard on success
      onNodeCreate()
    } catch (err) {
      console.error('Node creation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to create node.')
    } finally {
      setIsCreating(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40 -mx-6 px-6 -mt-6 mb-8">
          <div className="max-w-7xl mx-auto py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">D</span>
                </div>
                <h1 className="text-xl font-bold">DaaS Platform</h1>
                <Badge variant="outline" className="ml-2">
                  Node Provider
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {walletInfo?.connected && (
                  <Badge variant="secondary">
                    {walletInfo.balance.toFixed(2)} SUI
                  </Badge>
                )}
                {onRoleChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRoleChange}
                  >
                    Change Role
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Create Worker Node</h1>
          <p className="text-muted-foreground text-lg">
            Configure computing resources and create a node on the network
          </p>
        </motion.div>

        {/* Step Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold">
                1
              </div>
              <span className="ml-2 font-medium">Resource Setup</span>
            </div>
            <div className="w-12 h-px bg-muted-foreground/30" />
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted-foreground/20 rounded-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
                2
              </div>
              <span className="ml-2 text-muted-foreground">Node Creation</span>
            </div>
            <div className="w-12 h-px bg-muted-foreground/30" />
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted-foreground/20 rounded-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
                3
              </div>
              <span className="ml-2 text-muted-foreground">Start Operation</span>
            </div>
          </div>
        </motion.div>

        {/* Resource Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-8 mb-6">
            <h3 className="text-xl font-semibold mb-6">Computing Resources to Provide</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CPU */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">CPU Cores</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('cpu', false)}
                    disabled={resources.cpu <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="text-center mb-2">
                      <span className="text-2xl font-bold">{resources.cpu}</span>
                      <span className="text-sm text-muted-foreground ml-1">cores</span>
                    </div>
                    <Progress value={(resources.cpu / 16) * 100} className="h-2" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('cpu', true)}
                    disabled={resources.cpu >= 16}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Memory */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Memory</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('memory', false)}
                    disabled={resources.memory <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="text-center mb-2">
                      <span className="text-2xl font-bold">{resources.memory}</span>
                      <span className="text-sm text-muted-foreground ml-1">GB</span>
                    </div>
                    <Progress value={(resources.memory / 64) * 100} className="h-2" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('memory', true)}
                    disabled={resources.memory >= 64}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Storage */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Storage</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('storage', false)}
                    disabled={resources.storage <= 10}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="text-center mb-2">
                      <span className="text-2xl font-bold">{resources.storage}</span>
                      <span className="text-sm text-muted-foreground ml-1">GB</span>
                    </div>
                    <Progress value={(resources.storage / 1000) * 100} className="h-2" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('storage', true)}
                    disabled={resources.storage >= 1000}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Bandwidth */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">Network Bandwidth</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('bandwidth', false)}
                    disabled={resources.bandwidth <= 100}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="text-center mb-2">
                      <span className="text-2xl font-bold">{resources.bandwidth}</span>
                      <span className="text-sm text-muted-foreground ml-1">Mbps</span>
                    </div>
                    <Progress value={(resources.bandwidth / 10000) * 100} className="h-2" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('bandwidth', true)}
                    disabled={resources.bandwidth >= 10000}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Region */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium">Service Region</span>
                </div>
                <div className="flex-1">
                  <select
                    value={resources.region}
                    onChange={(e) => setResources(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full p-3 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {REGIONS.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground mt-2">
                    Provide computing resources in the selected region
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="p-4 mb-6 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            </Card>
          )}

          {/* Create Node Button */}
          <div className="text-center">
            <Button
              onClick={handleCreateNode}
              disabled={isCreating || !walletInfo?.address}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white px-8 py-3 text-lg"
              size="lg"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating node...
                </>
              ) : (
                <>
                  Create Node
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground mt-4">
              You can change settings anytime after node creation
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default NodeSetup