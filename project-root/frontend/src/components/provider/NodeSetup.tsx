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
import { mockNodeRegistryService } from '@/services/mockNodeService'
import { REGIONS } from '@/contracts/types'

interface ResourceConfig {
  cpu: number
  memory: number
  storage: number
  bandwidth: number
  pricePerHour: number
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
    pricePerHour: 0.05,
    region: 'Asia-Seoul'
  })

  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateResource = (key: keyof ResourceConfig, increment: boolean) => {
    setResources(prev => {
      const step = key === 'pricePerHour' ? 0.01 : key === 'bandwidth' ? 100 : 1
      const newValue = increment ? prev[key] + step : Math.max(0, prev[key] - step)
      return { ...prev, [key]: newValue }
    })
  }

  const handleCreateNode = async () => {
    if (!walletInfo?.address) {
      setError('지갑이 연결되지 않았습니다.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Mock 서비스를 사용하여 노드 등록
      await mockNodeRegistryService.registerNode(walletInfo.address, {
        cpu_cores: resources.cpu,
        memory_gb: resources.memory,
        storage_gb: resources.storage,
        bandwidth_mbps: resources.bandwidth,
        region: resources.region,
      })

      // 성공 시 대시보드로 이동
      onNodeCreate()
    } catch (err) {
      console.error('노드 생성 실패:', err)
      setError(err instanceof Error ? err.message : '노드 생성에 실패했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const estimatedMonthlyRevenue = resources.pricePerHour * 24 * 30 * 0.7 // 70% 가동률 기준
  const marketAvgPrice = 0.06 // 시장 평균 가격
  const priceCompetitiveness = resources.pricePerHour <= marketAvgPrice ? 'competitive' : 'high'

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
                  노드 제공자
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
                    역할 변경
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                >
                  취소
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
          <h1 className="text-4xl font-bold mb-2">워커 노드 생성</h1>
          <p className="text-muted-foreground text-lg">
            컴퓨팅 자원을 설정하고 네트워크에 노드를 생성하세요
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
              <span className="ml-2 font-medium">자원 설정</span>
            </div>
            <div className="w-12 h-px bg-muted-foreground/30" />
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted-foreground/20 rounded-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
                2
              </div>
              <span className="ml-2 text-muted-foreground">노드 생성</span>
            </div>
            <div className="w-12 h-px bg-muted-foreground/30" />
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted-foreground/20 rounded-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
                3
              </div>
              <span className="ml-2 text-muted-foreground">운영 시작</span>
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
            <h3 className="text-xl font-semibold mb-6">제공할 컴퓨팅 자원</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CPU */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">CPU 코어</span>
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
                      <span className="text-sm text-muted-foreground ml-1">코어</span>
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
                  <span className="font-medium">메모리</span>
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
                  <span className="font-medium">스토리지</span>
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
                  <span className="font-medium">네트워크 대역폭</span>
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
                  <span className="font-medium">서비스 지역</span>
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
                    선택한 지역에서 컴퓨팅 자원을 제공합니다
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-8 mb-6">
            <h3 className="text-xl font-semibold mb-6">가격 설정</h3>

            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="w-5 h-5 text-green-500" />
                  <span className="font-medium">시간당 가격</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('pricePerHour', false)}
                    disabled={resources.pricePerHour <= 0.01}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="text-center min-w-24">
                    <span className="text-3xl font-bold text-green-600">
                      {resources.pricePerHour.toFixed(2)}
                    </span>
                    <p className="text-sm text-muted-foreground">SUI/시간</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateResource('pricePerHour', true)}
                    disabled={resources.pricePerHour >= 1}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    priceCompetitiveness === 'competitive' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm text-muted-foreground">
                    {priceCompetitiveness === 'competitive' ? '경쟁력 있는 가격' : '평균보다 높은 가격'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Revenue Estimation */}
          <Card className="p-8 mb-8">
            <h3 className="text-xl font-semibold mb-6">예상 수익</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">일일 예상 수익</p>
                <p className="text-2xl font-bold text-green-600">
                  {(estimatedMonthlyRevenue / 30).toFixed(2)} SUI
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">월 예상 수익</p>
                <p className="text-2xl font-bold text-green-600">
                  {estimatedMonthlyRevenue.toFixed(2)} SUI
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">연 예상 수익</p>
                <p className="text-2xl font-bold text-green-600">
                  {(estimatedMonthlyRevenue * 12).toFixed(2)} SUI
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  수익 예상치 안내
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  실제 수익은 네트워크 수요, 노드 성능, 가동률 등에 따라 달라질 수 있습니다.
                  위 수치는 70% 가동률을 기준으로 한 추정값입니다.
                </p>
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
                  노드 생성 중...
                </>
              ) : (
                <>
                  노드 생성하기
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground mt-4">
              노드 생성 후 언제든지 설정을 변경할 수 있습니다
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default NodeSetup