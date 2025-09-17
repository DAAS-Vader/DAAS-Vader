"use client"

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Zap,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Server,
  Clock,
  Eye,
  Download,
  BarChart3,
  PieChart,
  Settings
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeploymentMetrics, LogEntry, Alert, Deployment } from '@/types'

interface MonitoringDashboardProps {
  deployment: Deployment
  realTime?: boolean
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  deployment,
  realTime = true
}) => {
  const [metrics, setMetrics] = useState<DeploymentMetrics>({
    requests: 12540,
    errors: 23,
    avgLatency: 145,
    uptime: 99.8,
    cost: 2.45,
    lastUpdated: new Date()
  })

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 5000),
      level: 'info',
      message: 'Application started successfully',
      source: 'main',
      deploymentId: deployment.id
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 15000),
      level: 'warn',
      message: 'High memory usage detected: 85%',
      source: 'system',
      deploymentId: deployment.id
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 30000),
      level: 'error',
      message: 'Database connection timeout',
      source: 'database',
      deploymentId: deployment.id
    }
  ])

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'performance',
      title: '응답 시간 증가',
      message: '평균 응답 시간이 150ms를 초과했습니다.',
      severity: 'medium',
      createdAt: new Date(Date.now() - 300000),
      resolved: false
    },
    {
      id: '2',
      type: 'cost',
      title: '예산 초과 경고',
      message: '일일 예산의 80%를 사용했습니다.',
      severity: 'high',
      createdAt: new Date(Date.now() - 600000),
      resolved: false
    }
  ])

  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')

  // 실시간 데이터 업데이트 시뮬레이션
  useEffect(() => {
    if (!realTime) return

    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        requests: prev.requests + Math.floor(Math.random() * 10),
        errors: prev.errors + (Math.random() > 0.9 ? 1 : 0),
        avgLatency: Math.max(50, prev.avgLatency + (Math.random() - 0.5) * 20),
        cost: prev.cost + Math.random() * 0.01,
        lastUpdated: new Date()
      }))

      // 랜덤 로그 추가
      if (Math.random() > 0.8) {
        const newLog: LogEntry = {
          id: Date.now().toString(),
          timestamp: new Date(),
          level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)] as any,
          message: `Random log message ${Date.now()}`,
          source: 'system',
          deploymentId: deployment.id
        }
        setLogs(prev => [newLog, ...prev.slice(0, 9)]) // 최대 10개 로그만 유지
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [realTime, deployment.id])

  const getMetricTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100
    return {
      isUp: change > 0,
      value: Math.abs(change).toFixed(1)
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR')
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300'
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-300'
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300'
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-300'
      default: return 'text-gray-700 bg-gray-100 border-gray-300'
    }
  }

  const errorRate = (metrics.errors / metrics.requests) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">모니터링 대시보드</h2>
          <p className="text-muted-foreground">
            {deployment.projectId} - {deployment.version}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={deployment.status === 'running' ? 'default' : 'secondary'}
            className={deployment.status === 'running' ? 'bg-green-500' : ''}
          >
            {deployment.status === 'running' ? '실행중' : deployment.status}
          </Badge>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            설정
          </Button>

          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            리포트
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['1h', '24h', '7d', '30d'] as const).map(range => (
          <Button
            key={range}
            variant={selectedTimeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange(range)}
          >
            {range}
          </Button>
        ))}
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 요청</p>
                <p className="text-2xl font-bold">{metrics.requests.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-green-600">+12.3%</span>
              <span className="text-muted-foreground ml-1">전일 대비</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">에러율</p>
                <p className="text-2xl font-bold">{errorRate.toFixed(2)}%</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingDown className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-green-600">-2.1%</span>
              <span className="text-muted-foreground ml-1">전일 대비</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">평균 응답시간</p>
                <p className="text-2xl font-bold">{Math.round(metrics.avgLatency)}ms</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="w-4 h-4 text-red-600 mr-1" />
              <span className="text-red-600">+8.5%</span>
              <span className="text-muted-foreground ml-1">전일 대비</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">일일 비용</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.cost)} SUI</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <span className="text-muted-foreground">예산: {formatCurrency(deployment.resources.budget)} SUI</span>
            </div>
            <Progress
              value={(metrics.cost / deployment.resources.budget) * 100}
              className="mt-2 h-1"
            />
          </Card>
        </motion.div>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            성능
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Eye className="w-4 h-4 mr-2" />
            로그
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            알림
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Server className="w-4 h-4 mr-2" />
            리소스
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">응답 시간 분포</h3>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <PieChart className="w-16 h-16 mr-4" />
                <span>차트는 곧 구현될 예정입니다</span>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">요청량 추이</h3>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mr-4" />
                <span>차트는 곧 구현될 예정입니다</span>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">가동률</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>전체 가동률</span>
                <span className="font-semibold">{metrics.uptime}%</span>
              </div>
              <Progress value={metrics.uptime} className="h-2" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {deployment.nodes.map((node, index) => (
                  <div key={node.id} className="p-3 bg-muted/50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{node.name}</span>
                      <Badge variant="outline">
                        {node.performance.uptime}%
                      </Badge>
                    </div>
                    <Progress value={node.performance.uptime} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">실시간 로그</h3>
              <div className="flex items-center gap-2">
                {realTime && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-muted-foreground">실시간</span>
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded border text-sm ${getLogLevelColor(log.level)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.source}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p>{log.message}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">활성 알림</h3>
              <Badge variant="outline">
                {alerts.filter(a => !a.resolved).length}개 미해결
              </Badge>
            </div>

            <div className="space-y-3">
              {alerts.map(alert => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded border ${getAlertSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.createdAt.toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      해결
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">CPU 사용률</h3>
              <div className="space-y-3">
                {deployment.nodes.map(node => (
                  <div key={node.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{node.name}</span>
                      <span>{Math.floor(Math.random() * 100)}%</span>
                    </div>
                    <Progress value={Math.random() * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">메모리 사용률</h3>
              <div className="space-y-3">
                {deployment.nodes.map(node => (
                  <div key={node.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{node.name}</span>
                      <span>{Math.floor(Math.random() * 100)}%</span>
                    </div>
                    <Progress value={Math.random() * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">네트워크 트래픽</h3>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <Activity className="w-16 h-16 mr-4" />
              <span>네트워크 차트는 곧 구현될 예정입니다</span>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MonitoringDashboard