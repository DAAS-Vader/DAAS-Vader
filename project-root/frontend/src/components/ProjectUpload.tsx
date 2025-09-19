"use client"

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Github, File, X, Check, AlertCircle, Folder, GitBranch, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { WalletInfo } from '@/types'

interface FileUpload {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
  path: string // 파일의 전체 경로
}

interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  children: { [key: string]: FileTreeNode }
  files: FileUpload[]
  isExpanded: boolean
}

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string
  stargazers_count: number
  language: string
  updated_at: string
}

interface ProjectUploadProps {
  onFileUpload?: (files: File[]) => Promise<void>
  onGitHubConnect?: (repo: GitHubRepo) => Promise<void>
  maxFileSize?: number
  acceptedFileTypes?: string[]
  backendUrl?: string
  walletInfo?: WalletInfo | null
}

const ProjectUpload: React.FC<ProjectUploadProps> = ({
  onFileUpload,
  onGitHubConnect,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.json', '.md', '.txt'],
  backendUrl = 'http://localhost:3001',
  walletInfo
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'github'>('upload')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [githubToken, setGithubToken] = useState('')
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [uploadResponse, setUploadResponse] = useState<any>(null)
  const [isDirectoryMode, setIsDirectoryMode] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    const allFiles: File[] = []

    // 폴더와 파일을 모두 처리하는 함수
    const traverseFileTree = (item: any): Promise<File[]> => {
      return new Promise((resolve) => {
        if (item.isFile) {
          item.file((file: File) => {
            resolve([file])
          })
        } else if (item.isDirectory) {
          const dirReader = item.createReader()
          const files: File[] = []

          const readEntries = () => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length) {
                for (const entry of entries) {
                  const entryFiles = await traverseFileTree(entry)
                  files.push(...entryFiles)
                }
                readEntries() // 더 많은 항목이 있을 수 있으므로 재귀적으로 호출
              } else {
                resolve(files)
              }
            })
          }
          readEntries()
        }
      })
    }

    // 모든 아이템을 처리
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry) {
          const files = await traverseFileTree(entry)
          allFiles.push(...files)
        }
      }
    }

    // 아이템이 없으면 기본 파일 처리
    if (allFiles.length === 0) {
      const files = Array.from(e.dataTransfer.files)
      allFiles.push(...files)
    }

    handleFiles(allFiles)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }, [])

  const handleSelectFiles = useCallback(() => {
    setIsDirectoryMode(false)
    fileInputRef.current?.click()
  }, [])

  const handleSelectFolder = useCallback(() => {
    setIsDirectoryMode(true)
    folderInputRef.current?.click()
  }, [])

  // 파일 트리 구조 생성
  const buildFileTree = useCallback((uploads: FileUpload[]): FileTreeNode => {
    const root: FileTreeNode = {
      name: 'root',
      type: 'folder',
      children: {},
      files: [],
      isExpanded: true
    }

    uploads.forEach(upload => {
      const pathParts = upload.path.split('/').filter(part => part.length > 0)
      let currentNode = root

      // 경로의 각 부분을 순회하며 트리 구조 생성
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (!currentNode.children[part]) {
          currentNode.children[part] = {
            name: part,
            type: 'folder',
            children: {},
            files: [],
            isExpanded: expandedFolders.has(pathParts.slice(0, i + 1).join('/'))
          }
        }
        currentNode = currentNode.children[part]
      }

      // 마지막 부분은 파일
      const fileName = pathParts[pathParts.length - 1] || upload.file.name
      currentNode.files.push(upload)
    })

    return root
  }, [expandedFolders])

  // 폴더 토글 함수
  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }, [])

  // 파일 트리 노드 렌더링
  const renderFileTreeNode = useCallback((node: FileTreeNode, path: string = '', depth: number = 0) => {
    const items = []

    // 폴더들 먼저 렌더링
    Object.entries(node.children).forEach(([name, childNode]) => {
      const fullPath = path ? `${path}/${name}` : name
      const isExpanded = expandedFolders.has(fullPath)

      items.push(
        <motion.div
          key={`folder-${fullPath}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`select-none ${depth > 0 ? 'ml-' + (depth * 4) : ''}`}
        >
          <div
            className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50"
            onClick={() => toggleFolder(fullPath)}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <Folder className="w-4 h-4 text-blue-500" />
            </motion.div>
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              ({Object.keys(childNode.children).length + childNode.files.length}개 항목)
            </span>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderFileTreeNode(childNode, fullPath, depth + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )
    })

    // 파일들 렌더링
    node.files.forEach(upload => {
      items.push(
        <motion.div
          key={upload.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className={`flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 ${depth > 0 ? 'ml-' + (depth * 4) : ''}`}
        >
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            <File className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{upload.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(upload.file.size)}</p>
            {upload.status === 'uploading' && (
              <Progress value={upload.progress} className="mt-2 h-1" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {upload.status === 'completed' && (
              <Check className="w-5 h-5 text-green-500" />
            )}
            {upload.status === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={() => {
                setUploads(prev => prev.filter(u => u.id !== upload.id))
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </motion.div>
      )
    })

    return items
  }, [expandedFolders, setUploads])

  const handleFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      const filePath = (file as any).webkitRelativePath || file.name

      // 제외할 폴더/파일 패턴
      const excludePatterns = [
        'node_modules/',
        '.git/',
        '.next/',
        'dist/',
        'build/',
        '.cache/',
        'coverage/',
        '.env',
        '.env.local',
        '.env.development',
        '.env.production',
        '.DS_Store',
        'Thumbs.db',
        '*.log'
      ]

      // 제외 패턴에 해당하는지 확인
      const shouldExclude = excludePatterns.some(pattern => {
        if (pattern.endsWith('/')) {
          // 폴더 패턴
          return filePath.includes(pattern)
        } else if (pattern.includes('*')) {
          // 와일드카드 패턴
          const regex = new RegExp(pattern.replace('*', '.*'))
          return regex.test(filePath)
        } else {
          // 정확한 파일명
          return filePath.includes(pattern)
        }
      })

      return !shouldExclude && acceptedFileTypes.includes(extension) && file.size <= maxFileSize
    })

    const newUploads: FileUpload[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading',
      path: (file as any).webkitRelativePath || file.name // 웹킷 상대 경로 또는 파일명
    }))

    setUploads(prev => [...prev, ...newUploads])

    // 실제 파일 업로드 진행
    try {
      const formData = new FormData()
      validFiles.forEach(file => {
        formData.append('files', file)
      })

      // 업로드 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploads(prev => prev.map(u => {
          if (newUploads.find(nu => nu.id === u.id)) {
            const newProgress = Math.min(u.progress + Math.random() * 15, 90)
            return { ...u, progress: newProgress }
          }
          return u
        }))
      }, 300)

      let response: Response
      try {
        if (!walletInfo?.authSignature) {
          throw new Error('지갑 인증이 필요합니다.')
        }

        response = await fetch(`${backendUrl}/api/project/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${walletInfo.authSignature}`,
          },
          body: formData,
        })
      } catch (fetchError) {
        clearInterval(progressInterval)
        console.warn('백엔드 서버에 연결할 수 없습니다. 데모 모드로 진행합니다.')

        // 데모 모드: 가짜 성공 응답
        setTimeout(() => {
          setUploads(prev => prev.map(u => {
            if (newUploads.find(nu => nu.id === u.id)) {
              return { ...u, progress: 100, status: 'completed' as const }
            }
            return u
          }))

          setUploadResponse({
            success: true,
            message: '데모 모드: 파일이 성공적으로 업로드되었습니다.',
            files: validFiles.map(f => f.name),
            size_code: validFiles.reduce((total, f) => total + f.size, 0)
          })
        }, 1000)

        if (onFileUpload) {
          await onFileUpload(validFiles)
        }
        return
      }

      clearInterval(progressInterval)

      if (response.ok) {
        const result = await response.json()
        setUploadResponse(result)

        // 업로드 완료 상태로 업데이트
        setUploads(prev => prev.map(u => {
          if (newUploads.find(nu => nu.id === u.id)) {
            return { ...u, progress: 100, status: 'completed' as const }
          }
          return u
        }))

        if (onFileUpload) {
          await onFileUpload(validFiles)
        }
      } else {
        // 에러 상태로 업데이트
        setUploads(prev => prev.map(u => {
          if (newUploads.find(nu => nu.id === u.id)) {
            return { ...u, status: 'error' as const }
          }
          return u
        }))
      }
    } catch (error) {
      console.error('Upload error:', error)
      // 에러 상태로 업데이트
      setUploads(prev => prev.map(u => {
        if (newUploads.find(nu => nu.id === u.id)) {
          return { ...u, status: 'error' as const }
        }
        return u
      }))
    }
  }, [acceptedFileTypes, maxFileSize, onFileUpload, backendUrl, walletInfo])

  const removeUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }, [])

  const connectGitHub = useCallback(async () => {
    if (!githubToken) return

    setIsConnecting(true)
    try {
      // GitHub API를 통해 실제 저장소 목록 가져오기
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      })

      if (response.ok) {
        const repos = await response.json()
        setGithubRepos(repos.slice(0, 10)) // 최대 10개 저장소만 표시
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('error')
      }
    } catch (error) {
      console.error('GitHub connection error:', error)
      setConnectionStatus('error')
    } finally {
      setIsConnecting(false)
    }
  }, [githubToken])

  const selectRepo = useCallback(async (repo: GitHubRepo) => {
    setSelectedRepo(repo)

    try {
      if (!walletInfo?.authSignature) {
        throw new Error('지갑 인증이 필요합니다.')
      }

      const response = await fetch(`${backendUrl}/api/project/from-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${walletInfo.authSignature}`,
        },
        body: JSON.stringify({
          repo: repo.full_name,
          ref: 'main',
          installation_id: 1, // 임시 installation ID
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setUploadResponse(result)

        if (onGitHubConnect) {
          await onGitHubConnect(repo)
        }
      }
    } catch (error) {
      console.error('GitHub repo selection error:', error)
    }
  }, [onGitHubConnect, backendUrl, walletInfo])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-4">
            DAAS 프로젝트 업로드
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            파일을 직접 업로드하거나 GitHub 저장소를 연결하여 블록체인에 안전하게 저장하세요
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              지갑 주소: {walletInfo?.address ?
                `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}` :
                '연결되지 않음'
              }
            </Badge>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-2xl">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'github')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  파일 업로드
                </TabsTrigger>
                <TabsTrigger value="github" className="flex items-center gap-2">
                  <Github className="w-4 h-4" />
                  GitHub 연동
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-6">
                <motion.div
                  className={`relative border-2 border-dashed rounded-xl p-8 md:p-12 transition-all duration-300 ${
                    isDragOver
                      ? 'border-primary bg-primary/5 scale-[1.02]'
                      : 'border-border hover:border-primary/50 hover:bg-muted/20'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptedFileTypes.join(',')}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory="true"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="text-center">
                    <motion.div
                      animate={{
                        scale: isDragOver ? 1.1 : 1,
                        rotate: isDragOver ? 5 : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <Upload className="w-8 h-8 text-primary" />
                    </motion.div>

                    <h3 className="text-xl font-semibold mb-2">
                      {isDragOver ? '파일/폴더를 여기에 놓으세요' : '파일 또는 폴더를 업로드'}
                    </h3>
                    <div className="flex gap-2 justify-center mb-4">
                      <Button
                        variant="link"
                        className="p-2 h-auto font-medium text-primary"
                        onClick={handleSelectFiles}
                      >
                        📄 파일 선택
                      </Button>
                      <span className="text-muted-foreground">또는</span>
                      <Button
                        variant="link"
                        className="p-2 h-auto font-medium text-primary"
                        onClick={handleSelectFolder}
                      >
                        📁 폴더 선택
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                      {acceptedFileTypes.slice(0, 6).map(type => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                      {acceptedFileTypes.length > 6 && (
                        <Badge variant="secondary" className="text-xs">
                          +{acceptedFileTypes.length - 6}개 더
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-3">
                      최대 파일 크기: {formatFileSize(maxFileSize)}
                    </p>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {uploads.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <h4 className="font-medium text-sm text-muted-foreground">업로드된 파일</h4>
{(() => {
                        const fileTree = buildFileTree(uploads)
                        return renderFileTreeNode(fileTree)
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                {uploadResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <h4 className="font-medium text-green-600 mb-2">업로드 성공!</h4>
                    <div className="text-sm text-green-600 space-y-1">
                      <p>Walrus Blob ID: <code className="bg-green-500/20 px-1 rounded">{uploadResponse.cid_code}</code></p>
                      <p>파일 크기: {formatFileSize(uploadResponse.size_code)}</p>
                      <p>파일 수: {uploadResponse.files_env?.length || 0}개</p>
                    </div>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="github" className="space-y-6">
                {connectionStatus === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-6"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Github className="w-8 h-8 text-primary" />
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-2">GitHub에 연결</h3>
                      <p className="text-muted-foreground">
                        GitHub Personal Access Token을 입력하여 저장소를 가져오세요
                      </p>
                    </div>

                    <div className="max-w-md mx-auto space-y-4">
                      <Input
                        type="password"
                        placeholder="GitHub Personal Access Token"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="bg-background/50"
                      />
                      <Button
                        onClick={connectGitHub}
                        disabled={!githubToken || isConnecting}
                        className="w-full"
                      >
                        {isConnecting ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                          />
                        ) : (
                          'GitHub 연결'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {connectionStatus === 'connected' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">저장소 목록</h4>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                        연결됨
                      </Badge>
                    </div>

                    <div className="grid gap-3">
                      {githubRepos.map(repo => (
                        <motion.div
                          key={repo.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedRepo?.id === repo.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/20'
                          }`}
                          onClick={() => selectRepo(repo)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                <Folder className="w-4 h-4 text-primary" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm">{repo.name}</h5>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {repo.description || '설명이 없습니다'}
                                </p>

                                <div className="flex items-center gap-4 mt-2">
                                  {repo.language && (
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                                      <span className="text-xs text-muted-foreground">{repo.language}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{repo.stargazers_count}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <GitBranch className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">main</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {selectedRepo?.id === repo.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                              >
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {selectedRepo && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-lg bg-primary/5 border border-primary/20"
                      >
                        <p className="text-sm text-primary font-medium">
                          선택됨: {selectedRepo.full_name}
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {connectionStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">연결 실패</h3>
                      <p className="text-muted-foreground">
                        GitHub에 연결할 수 없습니다. 토큰을 확인하고 다시 시도해주세요.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setConnectionStatus('idle')}
                    >
                      다시 시도
                    </Button>
                  </motion.div>
                )}

                {uploadResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <h4 className="font-medium text-green-600 mb-2">GitHub 저장소 업로드 성공!</h4>
                    <div className="text-sm text-green-600 space-y-1">
                      <p>Walrus Blob ID: <code className="bg-green-500/20 px-1 rounded">{uploadResponse.cid_code}</code></p>
                      <p>파일 크기: {formatFileSize(uploadResponse.size_code)}</p>
                      <p>파일 수: {uploadResponse.files_env?.length || 0}개</p>
                    </div>
                  </motion.div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default ProjectUpload