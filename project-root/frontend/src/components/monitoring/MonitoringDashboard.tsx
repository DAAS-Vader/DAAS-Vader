"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Settings,
  Cpu,
  HardDrive,
  Wifi
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
      title: 'Response Time Increase',
      message: 'Average response time exceeded 150ms.',
      severity: 'medium',
      createdAt: new Date(Date.now() - 300000),
      resolved: false
    },
    {
      id: '2',
      type: 'cost',
      title: 'Budget Overage Warning',
      message: 'Used 80% of daily budget.',
      severity: 'high',
      createdAt: new Date(Date.now() - 600000),
      resolved: false
    }
  ])

  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [chartData, setChartData] = useState<number[]>([65, 59, 80, 81, 56, 55, 70, 72, 68, 75, 82, 78])
  const [pieData, setPieData] = useState([
    { name: 'Success', value: 85, color: 'bg-green-500' },
    { name: 'Warning', value: 10, color: 'bg-yellow-500' },
    { name: 'Error', value: 5, color: 'bg-red-500' }
  ])
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memoryHistory, setMemoryHistory] = useState<number[]>([])

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

      // 차트 데이터 업데이트
      setChartData(prev => [...prev.slice(1), Math.floor(Math.random() * 100)])

      // CPU & Memory 히스토리 업데이트
      const newCpu = Math.floor(Math.random() * 100)
      const newMemory = Math.floor(Math.random() * 100)
      setCpuHistory(prev => [...prev.slice(-19), newCpu])
      setMemoryHistory(prev => [...prev.slice(-19), newMemory])

      // 파이 차트 데이터 업데이트
      const success = 80 + Math.floor(Math.random() * 15)
      const warning = Math.floor(Math.random() * 10) + 5
      const error = 100 - success - warning
      setPieData([
        { name: 'Success', value: success, color: 'bg-green-500' },
        { name: 'Warning', value: warning, color: 'bg-yellow-500' },
        { name: 'Error', value: error, color: 'bg-red-500' }
      ])

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
          <h2 className="text-2xl font-bold">Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            {deployment.projectId} - {deployment.version}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={deployment.status === 'running' ? 'default' : 'secondary'}
            className={deployment.status === 'running' ? 'bg-green-500' : ''}
          >
            {deployment.status === 'running' ? 'Running' : deployment.status}
          </Badge>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Report
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
          <Card className="p-4 overflow-hidden relative group">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <motion.p
                    key={metrics.requests}
                    className="text-2xl font-bold"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {metrics.requests.toLocaleString()}
                  </motion.p>
                </div>
                <motion.div
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.3 }}
                >
                  <Activity className="w-5 h-5 text-blue-600" />
                </motion.div>
              </div>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-green-600">+12.3%</span>
                <span className="text-muted-foreground ml-1">vs yesterday</span>
              </div>
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
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
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
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
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
                <p className="text-sm font-medium text-muted-foreground">Daily Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.cost)} SUI</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <span className="text-muted-foreground">Budget: {formatCurrency(deployment.resources.budget)} SUI</span>
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
            Performance
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Eye className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Server className="w-4 h-4 mr-2" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                Response Time Distribution
              </h3>
              <div className="h-64 relative">
                {/* 파이 차트 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full -rotate-90">
                      {(() => {
                        let offset = 0
                        return pieData.map((item, index) => {
                          const percent = item.value
                          const strokeDasharray = `${percent} ${100 - percent}`
                          const currentOffset = offset
                          offset += percent
                          return (
                            <motion.circle
                              key={item.name}
                              cx="50%"
                              cy="50%"
                              r="40%"
                              fill="none"
                              strokeWidth="20%"
                              className={item.color.replace('bg-', 'stroke-')}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={-currentOffset}
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1, delay: index * 0.2 }}
                            />
                          )
                        })
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl font-bold">{pieData[0].value}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                  </div>
                </div>
                {/* 범례 */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="text-xs">{item.name}: {item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Request Volume Trend
              </h3>
              <div className="h-64 relative">
                <div className="absolute inset-0 flex items-end justify-between px-2">
                  {chartData.map((value, index) => (
                    <motion.div
                      key={`bar-${index}`}
                      className="flex-1 mx-0.5"
                      initial={{ height: 0 }}
                      animate={{ height: `${value}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    >
                      <div
                        className="bg-gradient-to-t from-primary to-primary/60 rounded-t hover:opacity-80 transition-opacity"
                        style={{ height: '100%' }}
                      />
                    </motion.div>
                  ))}
                </div>
                {/* Y축 레이블 */}
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                {/* X축 레이블 */}
                <div className="absolute bottom-0 left-8 right-0 h-6 flex justify-between text-xs text-muted-foreground px-2">
                  {['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'].map((hour) => (
                    <span key={hour}>{hour}</span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Uptime</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Overall Uptime</span>
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
              <h3 className="font-semibold">Real-time Logs</h3>
              <div className="flex items-center gap-2">
                {realTime && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-muted-foreground">Real-time</span>
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
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
              <h3 className="font-semibold">Active Alerts</h3>
              <Badge variant="outline">
                {alerts.filter(a => !a.resolved).length} unresolved
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
                      Resolve
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
              <h3 className="font-semibold mb-4 flex items-center">
                <Cpu className="w-5 h-5 mr-2" />
                CPU Usage
              </h3>
              <div className="h-48 relative">
                {/* 실시간 라인 차트 */}
                <svg className="w-full h-full">
                  <motion.polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                    points={cpuHistory.map((v, i) => `${i * (100 / 19)},${100 - v}`).join(' ')}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 text-center">
                  <p className="text-2xl font-bold">{cpuHistory[cpuHistory.length - 1] || 0}%</p>
                  <p className="text-xs text-muted-foreground">Current Usage</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center">
                <HardDrive className="w-5 h-5 mr-2" />
                Memory Usage
              </h3>
              <div className="h-48 relative">
                {/* 실시간 라인 차트 */}
                <svg className="w-full h-full">
                  <motion.polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-purple-500"
                    points={memoryHistory.map((v, i) => `${i * (100 / 19)},${100 - v}`).join(' ')}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 text-center">
                  <p className="text-2xl font-bold">{memoryHistory[memoryHistory.length - 1] || 0}%</p>
                  <p className="text-xs text-muted-foreground">Current Usage</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              <Wifi className="w-5 h-5 mr-2" />
              Network Traffic
            </h3>
            <div className="h-64 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Inbound</h4>
                  <div className="space-y-2">
                    <motion.div
                      className="h-32 bg-gradient-to-t from-blue-500/20 to-blue-500/5 rounded"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 1 }}
                      style={{ transformOrigin: 'bottom' }}
                    >
                      <div className="p-4 text-center pt-8">
                        <p className="text-2xl font-bold">
                          {Math.floor(Math.random() * 100)} Mbps
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Outbound</h4>
                  <div className="space-y-2">
                    <motion.div
                      className="h-32 bg-gradient-to-t from-green-500/20 to-green-500/5 rounded"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 1, delay: 0.2 }}
                      style={{ transformOrigin: 'bottom' }}
                    >
                      <div className="p-4 text-center pt-8">
                        <p className="text-2xl font-bold">
                          {Math.floor(Math.random() * 100)} Mbps
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MonitoringDashboard