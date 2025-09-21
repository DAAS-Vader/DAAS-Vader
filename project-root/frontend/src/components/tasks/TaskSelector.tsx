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
import { moveRegistryAdapter, isRegistryConfigured } from '@/services/moveRegistryAdapter'

interface TaskSelectorProps {
  onSelect: (task: Task | null) => void
  selectedTask: Task | null
}

const TaskSelector: React.FC<TaskSelectorProps> = ({
  onSelect,
  selectedTask
}) => {
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'reward' | 'deadline' | 'created'>('reward')
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilter>({
    minReward: 0,
    maxDuration: 100,
    requiredTags: [],
    maxCPU: 10,
    maxMemory: 20
  })

  // Load tasks from Docker Registry contract
  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!isRegistryConfigured()) {
          console.log('❌ Docker Registry not configured')
          setError('Docker Registry not configured')
          setAvailableTasks([])
          setFilteredTasks([])
          return
        }

        console.log('✅ Docker Registry configured, loading tasks...')

        console.log('🔍 Loading tasks from Docker Registry...')
        const images = await moveRegistryAdapter.getAllImages()
        console.log('📦 Found', images.length, 'images in registry')

        if (images.length > 0) {
          const tasks = moveRegistryAdapter.convertToTasks(images)
          console.log('✅ Converted to', tasks.length, 'tasks')
          setAvailableTasks(tasks)
          setFilteredTasks(tasks)
        } else {
          console.log('📭 No images in registry')
          setAvailableTasks([])
          setFilteredTasks([])
        }
      } catch (err) {
        console.error('❌ Failed to load tasks from registry:', err)
        setError(`Registry error: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setAvailableTasks([])
        setFilteredTasks([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTasks()
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

    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  const formatCreatedTime = (created: Date) => {
    const now = new Date()
    const diff = now.getTime() - created.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ago`
    return `${minutes}m ago`
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Available Tasks</h2>
          <p className="text-muted-foreground">
            {isLoading ? 'Loading tasks from Docker Registry...' :
             error ? `Error: ${error}` :
             `Select a task from the pool ${selectedTask ? '(1 selected)' : ''}`}
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {isLoading ? 'Loading...' : `${filteredTasks.length} available`}
        </Badge>
      </div>

      {/* 검색 및 필터 */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-48 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          >
            <option value="reward">Highest Reward</option>
            <option value="deadline">Earliest Deadline</option>
            <option value="created">Most Recent</option>
          </select>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
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
                <label className="text-sm font-medium mb-2 block">Min Reward</label>
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
                <label className="text-sm font-medium mb-2 block">Max Duration</label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={6}
                  value={filters.maxDuration}
                  onChange={(e) => setFilters({...filters, maxDuration: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-muted-foreground mt-1">{filters.maxDuration} hours</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Max CPU</label>
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
                <label className="text-sm font-medium mb-2 block">Max Memory</label>
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
                      {formatTimeRemaining(task.deadline)} left
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
              <h3 className="font-semibold">Selected Task: {selectedTask.name}</h3>
              <p className="text-sm text-muted-foreground">
                Expected Reward: {selectedTask.reward} SUI
              </p>
            </div>
            <Badge variant="default">Selected</Badge>
          </div>
        </Card>
      )}

      {filteredTasks.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            {error ? (
              <>
                <p>Failed to load tasks from registry.</p>
                <p className="text-sm">Check console for details.</p>
              </>
            ) : availableTasks.length === 0 ? (
              <>
                <p>No tasks available in the registry.</p>
                <p className="text-sm">Upload some Docker images to see tasks here.</p>
              </>
            ) : (
              <>
                <p>No tasks match your search criteria.</p>
                <p className="text-sm">Try different search terms or filters.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskSelector