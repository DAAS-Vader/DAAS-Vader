'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Activity, Coins, TrendingUp, Server, Shield, Search, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workerRegistryService, PoolStats } from '@/services/workerRegistryService'

const StakingPoolStats: React.FC = () => {
  const [poolStats, setPoolStats] = useState<PoolStats>({
    totalWorkers: 0,
    activeWorkers: 0,
    totalStake: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workerNodeId, setWorkerNodeId] = useState('')
  const [workerStake, setWorkerStake] = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    const fetchPoolStats = async () => {
      try {
        setLoading(true)
        const stats = await workerRegistryService.getPoolStats()
        setPoolStats(stats)
        setError(null)
      } catch (err) {
        console.error('Error fetching pool stats:', err)
        setError('Failed to load staking pool statistics')
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchPoolStats()

    // Refresh every 10 seconds
    const interval = setInterval(fetchPoolStats, 10000)

    return () => clearInterval(interval)
  }, [])

  const activeRate = poolStats.totalWorkers > 0
    ? (poolStats.activeWorkers / poolStats.totalWorkers * 100).toFixed(1)
    : '0'

  const handleSearchWorkerStake = async () => {
    if (!workerNodeId.trim()) {
      alert('워커 노드 ID를 입력해주세요')
      return
    }

    setSearchLoading(true)
    setWorkerStake(null)

    try {
      const stake = await workerRegistryService.getWorkerStake(workerNodeId.trim())
      setWorkerStake(stake)
    } catch (error) {
      console.error('Error fetching worker stake:', error)
      alert('워커 스테이킹 정보를 가져오는데 실패했습니다')
    } finally {
      setSearchLoading(false)
    }
  }

  const statsCards = [
    {
      title: '전체 워커',
      value: poolStats.totalWorkers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      description: '등록된 전체 워커 노드'
    },
    {
      title: '활성 워커',
      value: poolStats.activeWorkers,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      description: `활성률: ${activeRate}%`
    },
    {
      title: '총 스테이킹',
      value: `${workerRegistryService.formatStake(poolStats.totalStake)} SUI`,
      icon: Coins,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      description: '전체 스테이킹 금액'
    }
  ]

  if (loading && poolStats.totalWorkers === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
          <div className="w-4 h-4 bg-primary rounded-full animate-pulse delay-75" />
          <div className="w-4 h-4 bg-primary rounded-full animate-pulse delay-150" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="text-red-600 text-center">{error}</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">워커 스테이킹 풀</h3>
            <p className="text-sm text-muted-foreground">Worker Registry 실시간 통계</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Shield className="w-3 h-3" />
          On-chain
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Activity Indicator */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">네트워크 활동</h4>
            <p className="text-xs text-muted-foreground">
              {poolStats.activeWorkers} / {poolStats.totalWorkers} 워커 활성
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-green-500">{activeRate}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${activeRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">평균 스테이킹</p>
            <p className="text-sm font-semibold">
              {poolStats.totalWorkers > 0
                ? workerRegistryService.formatStake(poolStats.totalStake / poolStats.totalWorkers)
                : '0'} SUI
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">활성률</p>
            <p className="text-sm font-semibold">{activeRate}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">비활성 워커</p>
            <p className="text-sm font-semibold">
              {poolStats.totalWorkers - poolStats.activeWorkers}
            </p>
          </div>
        </div>
      </Card>

      {/* Worker Stake Query Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h4 className="text-sm font-medium">개별 워커 스테이킹 조회</h4>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="워커 노드 ID 입력 (예: worker-001)"
              value={workerNodeId}
              onChange={(e) => setWorkerNodeId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchWorkerStake()}
              className="flex-1"
            />
            <Button
              onClick={handleSearchWorkerStake}
              disabled={searchLoading}
              size="sm"
              className="gap-2"
            >
              {searchLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              조회
            </Button>
          </div>

          {workerStake !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-muted rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">워커 ID</p>
                  <p className="font-mono text-xs mt-1">{workerNodeId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">스테이킹 금액</p>
                  <p className="text-lg font-bold text-primary">
                    {workerRegistryService.formatStake(workerStake)} SUI
                  </p>
                </div>
              </div>
              {workerStake === 0 && (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚠️ 해당 워커가 존재하지 않거나 스테이킹이 없습니다
                </p>
              )}
            </motion.div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default StakingPoolStats