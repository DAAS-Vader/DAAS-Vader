'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Clock,
  Cpu,
  HardDrive,
  Award,
  Calendar,
  User,
  Tag,
  ExternalLink
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Task, TaskFilter } from '@/types'

interface TaskSelectorProps {
  onSelect: (task: Task | null) => void
  selectedTask: Task | null
}

// 더미 데이터 - 실제로는 contract pool에서 가져올 예정
const generateMockTasks = (): Task[] => [
  {
    id: 'task-1',
    name: 'React Dashboard 배포',
    description: 'React 기반의 관리자 대시보드 애플리케이션을 배포하고 운영',
    walrusBlobUrl: 'https://walrus.blob/abc123',
    requiredResources: {
      cpu: 2,
      memory: 4,
      storage: 10
    },
    reward: 50,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    status: 'available',
    createdBy: '0x1234...5678',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
    estimatedDuration: 24,
    tags: ['React', 'Dashboard', 'Frontend']
  },
  {
    id: 'task-2',
    name: 'Node.js API 서버',
    description: 'Express.js 기반 REST API 서버 배포 및 데이터베이스 연동',
    walrusBlobUrl: 'https://walrus.blob/def456',
    requiredResources: {
      cpu: 4,
      memory: 8,
      storage: 20
    },
    reward: 120,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5일 후
    status: 'available',
    createdBy: '0xabcd...efgh',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5시간 전
    estimatedDuration: 48,
    tags: ['Node.js', 'API', 'Backend', 'Database']
  },
  {
    id: 'task-3',
    name: 'Python ML 모델 서빙',
    description: 'TensorFlow 기반 머신러닝 모델 추론 서버 배포',
    walrusBlobUrl: 'https://walrus.blob/ghi789',
    requiredResources: {
      cpu: 8,
      memory: 16,
      storage: 50
    },
    reward: 300,
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10일 후
    status: 'available',
    createdBy: '0x9876...1234',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1시간 전
    estimatedDuration: 72,
    tags: ['Python', 'ML', 'TensorFlow', 'AI']
  },
  {
    id: 'task-4',
    name: '도커 컨테이너 배포',
    description: 'Docker 이미지를 이용한 마이크로서비스 배포',
    walrusBlobUrl: 'https://walrus.blob/jkl012',
    requiredResources: {
      cpu: 2,
      memory: 4,
      storage: 15
    },
    reward: 80,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
    status: 'available',
    createdBy: '0x5555...6666',
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30분 전
    estimatedDuration: 12,
    tags: ['Docker', 'Microservice', 'Container']
  },
  {
    id: 'task-5',
    name: 'Next.js 웹사이트',
    description: 'Next.js 기반 기업 웹사이트 배포 및 SEO 최적화',
    walrusBlobUrl: 'https://walrus.blob/mno345',
    requiredResources: {
      cpu: 1,
      memory: 2,
      storage: 5
    },
    reward: 35,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 후
    status: 'available',
    createdBy: '0x7777...8888',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6시간 전
    estimatedDuration: 18,
    tags: ['Next.js', 'Website', 'SEO', 'Frontend']
  }
]

const TaskSelector: React.FC<TaskSelectorProps> = ({
  onSelect,
  selectedTask
}) => {
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'reward' | 'deadline' | 'created'>('reward')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<TaskFilter>({
    minReward: 0,
    maxDuration: 100,
    requiredTags: [],
    maxCPU: 10,
    maxMemory: 20
  })

  // 더미 데이터 로드 (실제로는 contract에서 가져올 예정)
  useEffect(() => {
    const mockTasks = generateMockTasks()
    setAvailableTasks(mockTasks)
    setFilteredTasks(mockTasks)
  }, [])

  // 검색 및 필터링
  useEffect(() => {
    let filtered = availableTasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesReward = task.reward >= filters.minReward
      const matchesDuration = task.estimatedDuration <= filters.maxDuration
      const matchesResources = task.requiredResources.cpu <= filters.maxCPU &&
                              task.requiredResources.memory <= filters.maxMemory

      return matchesSearch && matchesReward && matchesDuration && matchesResources
    })

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'reward':
          return b.reward - a.reward
        case 'deadline':
          return a.deadline.getTime() - b.deadline.getTime()
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
        default:
          return 0
      }
    })

    setFilteredTasks(filtered)
  }, [availableTasks, searchTerm, filters, sortBy])

  const handleTaskSelect = (task: Task) => {
    const isSelected = selectedTask?.id === task.id

    if (isSelected) {
      onSelect(null)
    } else {
      onSelect(task)
    }
  }

  const formatTimeRemaining = (deadline: Date) => {
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}일 ${hours}시간`
    return `${hours}시간`
  }

  const formatCreatedTime = (created: Date) => {
    const now = new Date()
    const diff = now.getTime() - created.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}시간 전`
    return `${minutes}분 전`
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">사용 가능한 Task</h2>
          <p className="text-muted-foreground">
            Task Pool에서 수행할 작업을 선택하세요 {selectedTask ? '(1개 선택됨)' : ''}
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {filteredTasks.length}개 사용 가능
        </Badge>
      </div>

      {/* 검색 및 필터 */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Task 이름, 설명, 태그로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-48 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          >
            <option value="reward">보상 높은 순</option>
            <option value="deadline">마감 빠른 순</option>
            <option value="created">최신 순</option>
          </select>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            필터
          </Button>
        </div>

        {/* 상세 필터 */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">최소 보상</label>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={filters.minReward}
                  onChange={(e) => setFilters({...filters, minReward: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-muted-foreground mt-1">{filters.minReward} SUI</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">최대 소요시간</label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={6}
                  value={filters.maxDuration}
                  onChange={(e) => setFilters({...filters, maxDuration: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-muted-foreground mt-1">{filters.maxDuration}시간</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">최대 CPU</label>
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={1}
                  value={filters.maxCPU}
                  onChange={(e) => setFilters({...filters, maxCPU: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-muted-foreground mt-1">{filters.maxCPU} Core</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">최대 메모리</label>
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={filters.maxMemory}
                  onChange={(e) => setFilters({...filters, maxMemory: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-muted-foreground mt-1">{filters.maxMemory} GB</div>
              </div>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Task 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTasks.map((task) => {
          const isSelected = selectedTask?.id === task.id

          return (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className={`p-6 cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleTaskSelect(task)}
              >
                <div className="space-y-4">
                  {/* 헤더 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{task.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                        <Award className="h-4 w-4" />
                        {task.reward} SUI
                      </div>
                    </div>
                  </div>

                  {/* 태그 */}
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* 요구사항 */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span>{task.requiredResources.cpu} Core</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span>{task.requiredResources.memory} GB</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{task.estimatedDuration}h</span>
                    </div>
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.createdBy.slice(0, 6)}...{task.createdBy.slice(-4)}
                      </span>
                      <span>{formatCreatedTime(task.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-orange-600">
                      <Calendar className="h-3 w-3" />
                      {formatTimeRemaining(task.deadline)} 남음
                    </div>
                  </div>

                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* 선택된 Task 요약 */}
      {selectedTask && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">선택된 Task: {selectedTask.name}</h3>
              <p className="text-sm text-muted-foreground">
                예상 보상: {selectedTask.reward} SUI
              </p>
            </div>
            <Badge variant="default">선택됨</Badge>
          </div>
        </Card>
      )}

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>검색 조건에 맞는 Task가 없습니다.</p>
            <p className="text-sm">다른 검색어나 필터를 시도해보세요.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskSelector