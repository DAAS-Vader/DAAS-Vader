'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Server,
  Coins,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Settings,
  Play,
  Pause,
  Zap,
  Users,
  Globe,
  Plus
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WalletInfo } from '@/types'
import { nodeRegistryService } from '@/services/nodeRegistry'
import { NodeMetadata, NODE_STATUS } from '@/contracts/types'

interface ResourceConfig {
  cpu: number
  memory: number
  storage: number
  bandwidth: number
  pricePerHour: number
}

// NodeMetadata를 사용하도록 변경했으므로 인터페이스 제거

interface ActiveJob {
  id: string
  projectName: string
  client: string
  startTime: Date
  estimatedDuration: number
  payment: number
  status: 'running' | 'pending' | 'completed'
  resourceUsage: {
    cpu: number
    memory: number
    storage: number
  }
}

interface NodeOperationDashboardProps {
  onNodeCreate: () => void
  walletInfo: WalletInfo | null
  onWalletDisconnect: () => void
  onRoleChange?: () => void
}

const NodeOperationDashboard: React.FC<NodeOperationDashboardProps> = ({
  onNodeCreate,
  walletInfo,
  onWalletDisconnect,
  onRoleChange
}) => {
  const [nodeMetadata, setNodeMetadata] = useState<NodeMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 노드 정보 로드
  useEffect(() => {
    const loadNodeInfo = async () => {
      if (!walletInfo?.address) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const exists = await nodeRegistryService.nodeExists(walletInfo.address)

        if (exists) {
          const metadata = await nodeRegistryService.getNodeMetadata(walletInfo.address)
          setNodeMetadata(metadata)
        } else {
          setNodeMetadata(null)
        }
      } catch (error) {
        console.error('노드 정보 로드 실패:', error)
        setNodeMetadata(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadNodeInfo()
  }, [walletInfo?.address])

  // 실시간 작업 요청 이벤트 구독
  useEffect(() => {
    if (!walletInfo?.address || !nodeMetadata) {
      return
    }

    console.log(`📡 제공자 ${walletInfo.address}의 작업 요청 이벤트 구독 시작`)

    // 브라우저 알림 권한 요청
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log(`🔔 알림 권한: ${permission}`)
      })
    }

    const unsubscribe = jobRequestService.subscribeToJobEvents(
      walletInfo.address,
      (eventData) => {
        console.log('🔔 새로운 작업 요청 수신:', eventData)

        // 브라우저 알림 표시
        if (Notification.permission === 'granted') {
          new Notification('새로운 작업 요청', {
            body: `프로젝트: ${eventData.projectName}\n예상 수익: ${eventData.offeredPrice} SUI`,
            icon: '/favicon.ico'
          })
        }

        // 화면에 토스트 메시지 표시 (실제 구현에서는 toast 라이브러리 사용)
        alert(`🔔 새로운 작업 요청!\n프로젝트: ${eventData.projectName}\n예상 수익: ${eventData.offeredPrice} SUI`)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [walletInfo?.address, nodeMetadata])

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">노드 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case NODE_STATUS.ACTIVE:
        return <Badge className="bg-green-500">활성</Badge>
      case NODE_STATUS.INACTIVE:
        return <Badge variant="secondary">비활성</Badge>
      case NODE_STATUS.MAINTENANCE:
        return <Badge variant="outline">유지보수</Badge>
      default:
        return <Badge variant="outline">알 수 없음</Badge>
    }
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case NODE_STATUS.ACTIVE:
        return '활성'
      case NODE_STATUS.INACTIVE:
        return '비활성'
      case NODE_STATUS.MAINTENANCE:
        return '유지보수'
      default:
        return '알 수 없음'
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto">
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
                {walletInfo?.connected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onWalletDisconnect}
                  >
                    연결 해제
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 노드가 등록되지 않은 경우 */}
        {!nodeMetadata ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Server className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">노드를 생성해보세요</h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              컴퓨팅 자원을 제공하고 수익을 얻으세요. 노드를 생성하여 DaaS 네트워크에 참여할 수 있습니다.
            </p>
            <Button
              onClick={onNodeCreate}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 px-8 py-3 text-lg"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              첫 번째 노드 생성하기
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">노드 운영 대시보드</h1>
                <p className="text-muted-foreground">
                  실시간 수익과 노드 현황을 모니터링하세요
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${nodeMetadata.status === NODE_STATUS.ACTIVE ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">
                    노드 {getStatusText(nodeMetadata.status)}
                  </span>
                </div>
                {getStatusBadge(nodeMetadata.status)}
                <Button
                  onClick={onNodeCreate}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  노드 설정
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">CPU 코어</p>
                      <h3 className="text-2xl font-bold text-blue-600">
                        {nodeMetadata.cpu_cores}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">메모리</p>
                      <h3 className="text-2xl font-bold text-green-600">
                        {nodeMetadata.memory_gb} GB
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Server className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">스토리지</p>
                      <h3 className="text-2xl font-bold text-orange-600">
                        {nodeMetadata.storage_gb} GB
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">등록일</p>
                      <h3 className="text-lg font-bold text-purple-600">
                        {new Date(nodeMetadata.registered_at).toLocaleDateString()}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Main Content - 노드가 등록된 경우만 표시 */}
        {nodeMetadata && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">개요</TabsTrigger>
              <TabsTrigger value="node">노드 관리</TabsTrigger>
              <TabsTrigger value="monitoring">모니터링</TabsTrigger>
            </TabsList>

            {/* 개요 탭 */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 노드 자원 정보 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">노드 자원 정보</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">CPU:</span>
                          <span className="font-medium ml-2">{nodeMetadata.cpu_cores} 코어</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">메모리:</span>
                          <span className="font-medium ml-2">{nodeMetadata.memory_gb} GB</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">스토리지:</span>
                          <span className="font-medium ml-2">{nodeMetadata.storage_gb} GB</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">대역폭:</span>
                          <span className="font-medium ml-2">{nodeMetadata.bandwidth_mbps} Mbps</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">지역:</span>
                          <span className="font-semibold">{nodeMetadata.region}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* 성능 지표 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">노드 정보</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">노드 상태</span>
                        <div className="flex items-center gap-2">
                          {nodeMetadata.status === NODE_STATUS.ACTIVE ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                          <span className="text-sm">{getStatusText(nodeMetadata.status)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">등록일</span>
                        <span className="font-semibold">{new Date(nodeMetadata.registered_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">마지막 업데이트</span>
                        <span className="font-semibold">{new Date(nodeMetadata.last_updated).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">제공자 주소</span>
                        <span className="font-semibold text-xs">{nodeMetadata.provider_address.slice(0, 12)}...</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* 노드 관리 탭 */}
            <TabsContent value="node" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">노드 관리</h3>
                    {getStatusBadge(nodeMetadata.status)}
                  </div>

                  <div className="border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-semibold text-lg">My Node</h4>
                        <p className="text-sm text-muted-foreground">
                          등록일: {new Date(nodeMetadata.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600 text-lg">
                          {getStatusText(nodeMetadata.status)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          노드 상태
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                      <div>
                        <span className="text-muted-foreground text-sm">CPU:</span>
                        <p className="font-medium text-lg">{nodeMetadata.cpu_cores} 코어</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">메모리:</span>
                        <p className="font-medium text-lg">{nodeMetadata.memory_gb} GB</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">스토리지:</span>
                        <p className="font-medium text-lg">{nodeMetadata.storage_gb} GB</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">대역폭:</span>
                        <p className="font-medium text-lg">{nodeMetadata.bandwidth_mbps} Mbps</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                      <div>
                        <span className="text-muted-foreground text-sm">지역:</span>
                        <p className="font-medium">{nodeMetadata.region}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">등록일:</span>
                        <p className="font-medium">{new Date(nodeMetadata.registered_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">마지막 업데이트:</span>
                        <p className="font-medium">{new Date(nodeMetadata.last_updated).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">제공자 주소:</span>
                        <p className="font-medium text-xs">{nodeMetadata.provider_address.slice(0, 8)}...</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {nodeMetadata.status === 'active' ? (
                        <Button variant="outline">
                          <Pause className="w-4 h-4 mr-2" />
                          노드 일시정지
                        </Button>
                      ) : (
                        <Button variant="outline" className="bg-green-50 hover:bg-green-100">
                          <Play className="w-4 h-4 mr-2" />
                          노드 시작
                        </Button>
                      )}
                      <Button variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        설정 변경
                      </Button>
                      <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        노드 삭제
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </TabsContent>


          {/* 모니터링 탭 */}
          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">전체 자원 사용률</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>CPU</span>
                        <span>68%</span>
                      </div>
                      <Progress value={68} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>메모리</span>
                        <span>54%</span>
                      </div>
                      <Progress value={54} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>스토리지</span>
                        <span>23%</span>
                      </div>
                      <Progress value={23} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>네트워크 대역폭</span>
                        <span>67%</span>
                      </div>
                      <Progress value={67} />
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">시스템 상태</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">연결 상태</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">연결됨</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">마지막 동기화</span>
                      <span className="text-sm">2분 전</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">활성 연결</span>
                      <span className="text-sm">14개</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">대기열</span>
                      <span className="text-sm">2개 작업</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  )
}

export default NodeOperationDashboard