"use client"

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Package, File, X, Folder, CheckCircle2, XCircle, Loader, HardDrive, FileText, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { WalletInfo } from '@/types'
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { uploadToWalrus, type WalrusProjectUploadResult } from '@/lib/walrus-client'
import { PACKAGE_ID, REGISTRY_ID } from '@/lib/docker-registry'
import { Transaction } from '@mysten/sui/transactions'

interface FileUpload {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
  path: string
  type: 'project' | 'docker'
}

// TypeScript declaration for webkitdirectory
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
  }
}

interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  path: string
  size?: number
  children?: FileTreeNode[]
  isExpanded?: boolean
}


// Match the parent component's expected interface
interface UploadResult {
  success: boolean
  message: string
  cid_code?: string
  blobId?: string
}

interface ProjectUploadProps {
  onFileUpload?: (files: File[]) => Promise<void>
  onUploadComplete?: (uploadResult: UploadResult) => void
  maxFileSize?: number
  acceptedFileTypes?: string[]
  walletInfo?: WalletInfo | null
  minRequirements?: {
    min_cpu_cores: number
    min_memory_gb: number
    min_storage_gb: number
    max_price_per_hour: number
  } | null
}

const ProjectUpload: React.FC<ProjectUploadProps> = ({
  onUploadComplete,
  maxFileSize = 500 * 1024 * 1024, // 500MB for docker images
  acceptedFileTypes = ['.zip', '.tar.gz', '.tgz', '.tar', '.docker', '.dockerimage'],
  walletInfo,
  minRequirements
}) => {
  // Wallet hooks
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [activeTab, setActiveTab] = useState<'project' | 'docker'>('project')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [uploadResponse, setUploadResponse] = useState<WalrusProjectUploadResult | null>(null)
  const [dockerImageName, setDockerImageName] = useState('')
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'idle' | 'preparing' | 'processing' | 'uploading' | 'completed' | 'error'
    message: string
    txHash?: string
    blobId?: string
    percentage?: number
  }>({ stage: 'idle', message: '' })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dockerFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const resetUploadState = useCallback(() => {
    setUploadProgress({ stage: 'idle', message: '' })
    setUploads([])
    setUploadResponse(null)
    setFileTree([])
    setSelectedFiles([])
  }, [])

  // 파일 트리 생성 함수 - 개선된 버전
  const buildFileTree = (files: File[]): FileTreeNode[] => {
    const root: Map<string, FileTreeNode> = new Map()

    files.forEach(file => {
      const pathParts = file.webkitRelativePath ?
        file.webkitRelativePath.split('/') :
        [file.name]

      let currentPath = ''
      let parentNode: FileTreeNode | null = null

      pathParts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isFile = index === pathParts.length - 1

        if (!root.has(currentPath)) {
          const newNode: FileTreeNode = {
            name: part,
            type: isFile ? 'file' : 'folder',
            path: currentPath,
            size: isFile ? file.size : undefined,
            children: isFile ? undefined : [],
            isExpanded: index === 0 // 첫 번째 레벨만 기본 열림
          }

          root.set(currentPath, newNode)

          // 부모 노드에 연결
          if (parentNode && parentNode.children) {
            parentNode.children.push(newNode)
          }
        }

        if (!isFile) {
          parentNode = root.get(currentPath) || null
        }
      })
    })

    // 최상위 노드만 반환
    const topLevelNodes: FileTreeNode[] = []
    root.forEach((node, path) => {
      if (!path.includes('/')) {
        topLevelNodes.push(node)
      }
    })

    // 이름순으로 정렬 (폴더 먼저, 그 다음 파일)
    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      }).map(node => {
        if (node.children) {
          return { ...node, children: sortNodes(node.children) }
        }
        return node
      })
    }

    return sortNodes(topLevelNodes)
  }

  // 파일 트리 토글
  const toggleTreeNode = (path: string) => {
    const toggleNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          return { ...node, isExpanded: !node.isExpanded }
        }
        if (node.children) {
          return { ...node, children: toggleNode(node.children) }
        }
        return node
      })
    }
    setFileTree(toggleNode(fileTree))
  }

  // 파일 트리 렌더링
  const renderFileTree = (nodes: FileTreeNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.path} className="select-none">
        <div
          className={`flex items-center py-1 px-2 hover:bg-muted/50 rounded cursor-pointer`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => node.type === 'folder' && toggleTreeNode(node.path)}
        >
          {node.type === 'folder' ? (
            <>
              {node.isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1 text-muted-foreground" />
              )}
              {node.isExpanded ? (
                <FolderOpen className="w-4 h-4 mr-2 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 mr-2 text-blue-500" />
              )}
            </>
          ) : (
            <File className="w-4 h-4 mr-2 ml-5 text-muted-foreground" />
          )}
          <span className="text-sm">{node.name}</span>
          {node.size && (
            <span className="ml-auto text-xs text-muted-foreground">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        {node.type === 'folder' && node.isExpanded && node.children && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderFileTree(node.children, level + 1)}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    ))
  }

  // Walrus에 직접 업로드하는 함수
  const uploadToWalrusDirectly = useCallback(async (files: File[], imageNam: string = '') => {
    try {
      if (!currentAccount) {
        throw new Error('지갑을 먼저 연결해주세요')
      }

      setUploadProgress({
        stage: 'preparing',
        message: activeTab === 'docker' ? 'Docker 이미지 준비 중...' : '프로젝트 준비 중...',
        percentage: 10
      })

      setUploadProgress({
        stage: 'uploading',
        message: 'Walrus에 업로드 중...',
        percentage: 50
      })

      let result: WalrusProjectUploadResult

      if (files.length === 1 && (files[0].name.endsWith('.zip') || files[0].name.endsWith('.tar') || files[0].name.endsWith('.tar.gz'))) {
        // 단일 압축 파일은 직접 업로드
        const uploadResult = await uploadToWalrus(files[0], {
          walletAddress: currentAccount.address,
          epochs: 10,
          permanent: false,
          metadata: {
            projectName: activeTab === 'docker' ? (imageNam || files[0].name) : files[0].name,
            fileType: activeTab === 'docker' ? 'docker-image' : 'project-archive',
            uploadType: activeTab
          }
        })

        result = {
          status: uploadResult.status === 'error' ? 'error' : 'success',
          codeBlobId: uploadResult.blobId,
          codeUrl: uploadResult.url,
          codeSize: uploadResult.size,
          error: uploadResult.error
        }
      } else {
        // 여러 파일들은 JSON으로 묶어서 업로드
        const filesData: Array<{ path: string; content: string; size: number }> = []

        for (const file of files) {
          const content = await file.text()
          filesData.push({
            path: file.webkitRelativePath || file.name,
            content,
            size: file.size
          })
        }

        const projectData = {
          projectName: activeTab === 'docker' ? imageNam : 'project-folder',
          fileType: 'project-folder',
          uploadType: activeTab,
          timestamp: new Date().toISOString(),
          totalFiles: files.length,
          totalSize: files.reduce((sum, f) => sum + f.size, 0),
          files: filesData,
          isArchive: false
        }

        // JSON을 Blob으로 변환하여 업로드
        const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })

        const uploadResult = await uploadToWalrus(jsonBlob, {
          walletAddress: currentAccount.address,
          epochs: 10,
          permanent: false,
          metadata: {
            projectName: projectData.projectName,
            fileType: projectData.fileType,
            totalFiles: projectData.totalFiles
          }
        })

        result = {
          status: uploadResult.status === 'error' ? 'error' : 'success',
          codeBlobId: uploadResult.blobId,
          codeUrl: uploadResult.url,
          codeSize: uploadResult.size,
          error: uploadResult.error
        }
      }

      if (result.status === 'success' || result.status === 'partial') {
        // Walrus 업로드 성공 후 온체인 등록
        const blobId = result.codeBlobId || result.dockerBlobId || 'unknown'
        const downloadUrl = result.codeUrl || result.dockerUrl || 'unknown'

        setUploadProgress({
          stage: 'uploading',
          message: '블록체인에 등록 중...',
          blobId: blobId,
          txHash: downloadUrl,
          percentage: 80
        })

        setUploadResponse(result)

        // 콘솔에 다운로드 URL 출력
        if (result.codeUrl) {
          console.log('🌐 프로젝트 다운로드 URL:', result.codeUrl)
          console.log('💾 프로젝트 Blob ID:', result.codeBlobId)
        }
        if (result.dockerUrl) {
          console.log('🐳 Docker 이미지 다운로드 URL:', result.dockerUrl)
          console.log('💾 Docker Blob ID:', result.dockerBlobId)
        }

        // 업로드된 파일 정보를 온체인에 등록 (Docker와 Project 모두)
        if (downloadUrl !== 'unknown') {
          try {
            console.log('📝 온체인 등록 시작...')

            // Transaction 생성
            const tx = new Transaction()

            // Clock 객체 참조
            const clockId = '0x6'

            // URL 배열 생성 (백업 URL 포함 가능)
            const urls = [downloadUrl]

            // Walrus aggregator URL 추가 (백업)
            if (blobId !== 'unknown') {
              urls.push(`https://aggregator-devnet.walrus.space/v1/${blobId}`)
              urls.push(`https://publisher-devnet.walrus.space/v1/${blobId}`)
            }

            // register_docker_image 함수 호출 (최소 요구 사양 포함)
            tx.moveCall({
              target: `${PACKAGE_ID}::docker_registry::register_docker_image`,
              arguments: [
                tx.object(REGISTRY_ID),
                tx.pure.vector('string', urls),
                tx.pure.string(imageNam || files[0].name),
                tx.pure.u64(files.reduce((sum, f) => sum + f.size, 0)),
                tx.pure.string(activeTab === 'docker' ? 'docker' : 'project'),
                tx.pure.u32(minRequirements?.min_cpu_cores ?? 1),
                tx.pure.u32(minRequirements?.min_memory_gb ?? 1),
                tx.pure.u32(minRequirements?.min_storage_gb ?? 10),
                tx.pure.u64(minRequirements?.max_price_per_hour ?? 100),
                tx.object(clockId),
              ],
            })

            // 지갑 연결 및 권한 재확인
            if (!currentAccount) {
              throw new Error('지갑이 연결되지 않았습니다. 지갑을 다시 연결해주세요.')
            }

            // 패키지 ID 유효성 검사
            if (!PACKAGE_ID || !REGISTRY_ID) {
              throw new Error('Docker Registry 컨트랙트가 배포되지 않았습니다. 시뮬레이션 모드로 전환하거나 관리자에게 문의하세요.')
            }

            console.log('🔐 트랜잭션 서명 시작')
            console.log('📦 패키지 ID:', PACKAGE_ID)
            console.log('🗄️ 레지스트리 ID:', REGISTRY_ID)
            console.log('👤 계정:', currentAccount.address)

            // 트랜잭션 서명 및 실행
            signAndExecuteTransaction(
              {
                transaction: tx,
              },
              {
                onSuccess: (txResult) => {
                  console.log('✅ 온체인 등록 성공!')
                  console.log('📜 Transaction digest:', txResult.digest)
                  console.log('🔍 Explorer URL:', `https://testnet.suivision.xyz/txblock/${txResult.digest}`)

                  setUploadProgress({
                    stage: 'completed',
                    message: '업로드 및 온체인 등록 완료!',
                    blobId: blobId,
                    txHash: txResult.digest,
                    percentage: 100
                  })

                  if (onUploadComplete) {
                    console.log('🚀 Calling onUploadComplete from ProjectUpload (blockchain registered)')
                    onUploadComplete({
                      success: true,
                      message: `${activeTab === 'docker' ? 'Docker 이미지' : '프로젝트'}가 블록체인에 성공적으로 등록되었습니다`,
                      cid_code: blobId,
                      blobId: blobId
                    })
                  } else {
                    console.log('⚠️ onUploadComplete callback is not provided!')
                  }
                },
                onError: (error) => {
                  console.error('❌ 온체인 등록 실패:', error)

                  let errorMessage = '온체인 등록 실패'

                  // 권한 관련 오류 처리
                  if (error.message?.includes('NoPermissionError') || error.message?.includes('-4003')) {
                    errorMessage = '지갑 권한이 거부되었습니다. 지갑에서 트랜잭션을 승인해주세요.'
                  } else if (error.message?.includes('Insufficient gas')) {
                    errorMessage = 'SUI 잔액이 부족합니다. 가스비를 위한 SUI가 필요합니다.'
                  } else if (error.message?.includes('Package object does not exist')) {
                    errorMessage = '컨트랙트가 배포되지 않았습니다. 관리자에게 문의하세요.'
                  } else {
                    errorMessage = `온체인 등록 실패: ${error.message}`
                  }

                  setUploadProgress({
                    stage: 'error',
                    message: errorMessage,
                    percentage: 0
                  })
                }
              }
            )
          } catch (error) {
            console.error('트랜잭션 생성 실패:', error)
            // Walrus 업로드는 성공했지만 온체인 등록 실패
            setUploadProgress({
              stage: 'completed',
              message: 'Walrus 업로드 완료 (온체인 등록 실패)',
              blobId: blobId,
              txHash: downloadUrl,
              percentage: 100
            })
          }
        } else {
          // 프로젝트 파일인 경우 또는 Docker가 아닌 경우
          setUploadProgress({
            stage: 'completed',
            message: '업로드 완료!',
            blobId: blobId,
            txHash: downloadUrl,
            percentage: 100
          })

          if (onUploadComplete) {
            console.log('🚀 Calling onUploadComplete from ProjectUpload (walrus only)')
            onUploadComplete({
              success: true,
              message: '업로드가 성공적으로 완료되었습니다',
              cid_code: result.codeBlobId,
              blobId: blobId
            })
          } else {
            console.log('⚠️ onUploadComplete callback is not provided!')
          }
        }
      } else {
        throw new Error(result.error || '업로드 실패')
      }

      return result
    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress({
        stage: 'error',
        message: `업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        percentage: 0
      })
      throw error
    }
  }, [activeTab, currentAccount, onUploadComplete, signAndExecuteTransaction])


  const handleFolderSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setSelectedFiles(fileArray)
    const tree = buildFileTree(fileArray)
    setFileTree(tree)

    // 폴더가 선택되면 자동으로 업로드 시작하지 않고 사용자가 확인 후 업로드하도록
    console.log(`${fileArray.length}개 파일이 선택되었습니다`)
  }, [])

  const handleUploadSelectedFiles = useCallback(async () => {
    if (!currentAccount) {
      alert('지갑을 먼저 연결해주세요')
      return
    }

    if (selectedFiles.length === 0) {
      alert('업로드할 파일을 선택해주세요')
      return
    }

    resetUploadState()

    // 파일 업로드 항목 추가
    const newUploads: FileUpload[] = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      progress: 0,
      status: 'uploading' as const,
      path: file.webkitRelativePath || file.name,
      type: 'project' as const
    }))

    setUploads(newUploads)

    try {
      await uploadToWalrusDirectly(selectedFiles, '')

      // 업로드 상태 업데이트
      setUploads(prev => prev.map(u => ({ ...u, status: 'completed', progress: 100 })))
    } catch (error) {
      console.error('Upload error:', error)
      setUploads(prev => prev.map(u => ({ ...u, status: 'error', progress: 0 })))
    }
  }, [currentAccount, selectedFiles, uploadToWalrusDirectly, resetUploadState])

  const handleFiles = useCallback(async (files: File[], uploadType: 'project' | 'docker') => {
    if (!currentAccount) {
      alert('지갑을 먼저 연결해주세요')
      return
    }

    resetUploadState()

    // 파일 유효성 검사
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} exceeds size limit`)
        return false
      }

      if (uploadType === 'docker') {
        // Docker 이미지 및 설정 파일 허용
        const fileName = file.name.toLowerCase()
        const isValid = fileName.endsWith('.tar') ||
                       fileName.endsWith('.tar.gz') ||
                       fileName.endsWith('.tgz') ||
                       fileName.endsWith('.json') ||  // deploy.json
                       fileName.endsWith('.yaml') ||   // docker-compose.yaml
                       fileName.endsWith('.yml') ||    // docker-compose.yml
                       fileName === 'dockerfile' ||    // Dockerfile (빌드용)
                       file.type === 'application/x-tar' ||
                       file.type === 'application/gzip' ||
                       file.type === 'application/json'
        if (!isValid) {
          console.error(`File ${file.name} is not a valid Docker deployment file`)
        }
        return isValid
      } else {
        // 프로젝트 파일 확장자 확인
        const fileName = file.name.toLowerCase()
        // acceptedFileTypes에 '*'가 있으면 모든 파일 허용
        if (acceptedFileTypes.includes('*')) {
          return true
        }
        // Dockerfile 특별 처리
        if (fileName === 'dockerfile' || fileName.startsWith('dockerfile')) {
          return true
        }
        // 일반 확장자 확인
        const isValid = acceptedFileTypes.some(type => {
          if (type === 'Dockerfile') {
            return fileName === 'dockerfile'
          }
          return file.name.endsWith(type)
        })
        if (!isValid) {
          console.error(`File ${file.name} has invalid extension`)
        }
        return isValid
      }
    })

    if (validFiles.length === 0) {
      setUploadProgress({
        stage: 'error',
        message: uploadType === 'docker' ?
          'Docker 이미지 tar 파일(.tar, .tar.gz)만 업로드 가능합니다' :
          '유효한 프로젝트 파일을 선택해주세요'
      })
      return
    }

    // 새 업로드 항목 추가
    const newUploads: FileUpload[] = validFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      progress: 0,
      status: 'uploading' as const,
      path: file.name,
      type: uploadType
    }))

    setUploads(prev => [...prev, ...newUploads])

    try {
      // 모든 유효한 파일 업로드
      const imageName = uploadType === 'docker' ? dockerImageName : ''

      await uploadToWalrusDirectly(validFiles, imageName)

      // 업로드 상태 업데이트
      setUploads(prev => prev.map(u =>
        validFiles.includes(u.file) ? { ...u, status: 'completed', progress: 100 } : u
      ))

    } catch (error) {
      console.error('Upload error:', error)
      setUploads(prev => prev.map(u =>
        validFiles.includes(u.file) ? { ...u, status: 'error', progress: 0 } : u
      ))
    }
  }, [currentAccount, maxFileSize, acceptedFileTypes, dockerImageName, uploadToWalrusDirectly, resetUploadState])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    handleFiles(Array.from(files), activeTab)
  }, [activeTab, handleFiles])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)

    const files = Array.from(event.dataTransfer.files)
    handleFiles(files, activeTab)
  }, [activeTab, handleFiles])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const removeUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }, [])

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
            DAAS 업로드
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            프로젝트 파일 또는 Docker 이미지를 블록체인에 안전하게 저장하세요
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            
            {walletInfo?.balance && (
              <Badge variant="outline">잔액: {walletInfo.balance} SUI</Badge>
            )}
          </div>
        </motion.div>

        <Card className="backdrop-blur-xl bg-background/50 border-primary/10">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'project' | 'docker')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="project" className="data-[state=active]:bg-primary/10">
                <Folder className="w-4 h-4 mr-2" />
                프로젝트 업로드
              </TabsTrigger>
              <TabsTrigger value="docker" className="data-[state=active]:bg-primary/10">
                <Package className="w-4 h-4 mr-2" />
                Docker 이미지 업로드
              </TabsTrigger>
            </TabsList>

            <TabsContent value="project" className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                  ${isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple

                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory="true"
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                />

                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">프로젝트 파일 업로드</p>
                <p className="text-sm text-muted-foreground mb-4">
                  파일을 드래그하거나 클릭하여 선택하세요
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  지원 형식: .zip, .tar.gz, .tgz (최대 {formatFileSize(maxFileSize)})
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <File className="w-4 h-4 mr-2" />
                    파일 선택
                  </Button>
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    variant="outline"
                  >
                    <Folder className="w-4 h-4 mr-2" />
                    폴더 선택
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="docker" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Docker 이미지 이름</label>
                  <Input
                    placeholder="예: myapp:latest"
                    value={dockerImageName}
                    onChange={(e) => setDockerImageName(e.target.value)}
                    className="mb-4"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <h3 className="font-medium mb-2 flex items-center">
                    <HardDrive className="w-4 h-4 mr-2" />
                    Docker 이미지 준비 방법
                  </h3>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Docker 이미지 빌드: <code className="bg-background px-1 rounded">docker build -t myapp .</code></li>
                    <li>이미지를 tar 파일로 저장: <code className="bg-background px-1 rounded">docker save myapp:latest -o myapp.tar</code></li>
                    <li>생성된 tar 파일을 여기에 업로드</li>
                  </ol>
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                    ${isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <input
                    ref={dockerFileInputRef}
                    type="file"
                    accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Docker 이미지 파일 업로드</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    tar 파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    지원 형식: .tar, .tar.gz, .tgz (최대 {formatFileSize(maxFileSize)})
                  </p>
                  <Button
                    onClick={() => dockerFileInputRef.current?.click()}
                    variant="outline"
                    disabled={!dockerImageName}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Docker 이미지 선택
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* 선택된 파일 트리 표시 */}
        {fileTree.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="p-6 backdrop-blur-xl bg-background/50 border-primary/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">선택된 파일</h3>
                  <Badge variant="secondary">
                    {selectedFiles.length}개 파일 ({formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))})
                  </Badge>
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-lg p-2">
                  {renderFileTree(fileTree)}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFileTree([])
                      setSelectedFiles([])
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    취소
                  </Button>
                  <Button
                    onClick={handleUploadSelectedFiles}
                    disabled={selectedFiles.length === 0}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    업로드 시작
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* 업로드 상태 표시 */}
        {uploadProgress.stage !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="p-6 backdrop-blur-xl bg-background/50 border-primary/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">업로드 진행 상황</h3>
                  {uploadProgress.stage === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {uploadProgress.stage === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {['preparing', 'processing', 'uploading'].includes(uploadProgress.stage) && (
                    <Loader className="w-5 h-5 animate-spin text-primary" />
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{uploadProgress.message}</p>
                  {uploadProgress.percentage && (
                    <Progress value={uploadProgress.percentage} className="h-2" />
                  )}
                </div>

                {uploadProgress.blobId && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Blob ID: <code className="bg-muted px-1 rounded">{uploadProgress.blobId}</code>
                    </p>
                    {uploadProgress.txHash && uploadProgress.txHash !== 'unknown' && (
                      <p className="text-xs text-muted-foreground">
                        다운로드 URL: <a href={uploadProgress.txHash} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{uploadProgress.txHash}</a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* 업로드 완료 후 파일 트리 구조 표시 */}
        {uploads.length > 0 && uploadProgress.stage === 'completed' && fileTree.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="p-6 backdrop-blur-xl bg-background/50 border-primary/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    업로드 완료된 파일
                  </h3>
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    {selectedFiles.length}개 파일 업로드 완료
                  </Badge>
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-lg p-2 bg-muted/20">
                  {renderFileTree(fileTree)}
                </div>
                {uploadResponse && (
                  <div className="pt-2 border-t space-y-1">
                    {uploadResponse.codeBlobId && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          코드 Blob ID: <code className="bg-muted px-1 rounded">{uploadResponse.codeBlobId}</code>
                        </p>
                        {uploadResponse.codeUrl && (
                          <p className="text-xs text-muted-foreground">
                            다운로드 URL: <a href={uploadResponse.codeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{uploadResponse.codeUrl}</a>
                          </p>
                        )}
                      </>
                    )}
                    {uploadResponse.dockerBlobId && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Docker Blob ID: <code className="bg-muted px-1 rounded">{uploadResponse.dockerBlobId}</code>
                        </p>
                        {uploadResponse.dockerUrl && (
                          <p className="text-xs text-muted-foreground">
                            Docker 다운로드 URL: <a href={uploadResponse.dockerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{uploadResponse.dockerUrl}</a>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* 업로드된 개별 파일 목록 (파일 트리가 없을 때만 표시) */}
        {uploads.length > 0 && uploadProgress.stage === 'completed' && fileTree.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 space-y-2"
          >
            {uploads.map((upload) => (
              <Card key={upload.id} className="p-4 backdrop-blur-xl bg-background/50 border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {upload.type === 'docker' ? (
                      <Package className="w-5 h-5 text-primary" />
                    ) : (
                      <FileText className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">{upload.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(upload.file.size)} • {upload.type === 'docker' ? 'Docker 이미지' : '프로젝트 파일'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {upload.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {upload.status === 'error' && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    {upload.status === 'uploading' && (
                      <Loader className="w-5 h-5 animate-spin text-primary" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUpload(upload.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {upload.status === 'uploading' && upload.progress > 0 && (
                  <Progress value={upload.progress} className="h-1 mt-2" />
                )}
              </Card>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default ProjectUpload