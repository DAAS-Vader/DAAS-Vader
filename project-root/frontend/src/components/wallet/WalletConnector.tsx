"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WalletInfo } from '@/types'
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useSignPersonalMessage, useWallets } from '@mysten/dapp-kit'

interface WalletConnectorProps {
  onConnect: (wallet: WalletInfo) => void
  onDisconnect: () => void
  currentWallet?: WalletInfo | null
}

interface SupportedWallet {
  id: 'Suiet' | 'Slush'
  name: string
  icon: string
  description: string
  downloadUrl: string
}

const WalletConnector: React.FC<WalletConnectorProps> = ({
  onConnect,
  onDisconnect,
  currentWallet
}) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Use Mysten dapp-kit hooks for real wallet integration
  const currentAccount = useCurrentAccount()
  const { mutate: connect } = useConnectWallet()
  const { mutate: disconnect } = useDisconnectWallet()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()
  const wallets = useWallets()

  // Generate authentication signature for API calls
  const generateAuthSignature = async (walletAddress: string): Promise<string> => {
    console.log('🔐 [AUTH] Starting authentication signature generation')
    console.log('🔐 [AUTH] Wallet Address:', walletAddress)

    try {
      const timestamp = Date.now()
      const message = `DaaS Authentication\nTimestamp: ${timestamp}\nWallet: ${walletAddress}`

      console.log('🔐 [AUTH] Timestamp:', timestamp)
      console.log('🔐 [AUTH] Message to sign:', message)
      console.log('🔐 [AUTH] Message bytes length:', new TextEncoder().encode(message).length)

      // Sign message for authentication - proper implementation without workarounds
      console.log('🔐 [AUTH] Calling signPersonalMessage...')
      const signature = await new Promise<string>((resolve, reject) => {
        signPersonalMessage(
          { message: new TextEncoder().encode(message) },
          {
            onSuccess: (result) => {
              console.log('✅ [AUTH] Signature successful!')
              console.log('✅ [AUTH] Signature result:', result)
              console.log('✅ [AUTH] Signature length:', result.signature.length)
              resolve(result.signature)
            },
            onError: (error) => {
              console.error('❌ [AUTH] Signature failed:', error)
              console.error('❌ [AUTH] Error type:', typeof error)
              console.error('❌ [AUTH] Error message:', error?.message)
              reject(new Error(`Signature failed: ${error?.message || error?.toString() || 'Unknown error'}`))
            }
          }
        )
      })

      const authData = {
        walletAddress,
        signature,
        message,
        timestamp
      }

      console.log('✅ [AUTH] Authentication data generated successfully')
      console.log('✅ [AUTH] Auth data keys:', Object.keys(authData))
      console.log('✅ [AUTH] Auth data size:', JSON.stringify(authData).length, 'bytes')

      return JSON.stringify(authData)
    } catch (error) {
      console.error('💥 [AUTH] CRITICAL ERROR in generateAuthSignature')
      console.error('💥 [AUTH] Error:', error)
      console.error('💥 [AUTH] Error stack:', error?.stack)
      // Throw error instead of returning null to properly identify the issue
      throw new Error(`Authentication signature required but failed: ${error?.message || error?.toString()}`)
    }
  }

  const supportedWallets: SupportedWallet[] = [
    {
      id: 'Suiet',
      name: 'Suiet Wallet',
      icon: '💎',
      description: 'Sui 전용 지갑',
      downloadUrl: 'https://chrome.google.com/webstore/detail/suiet-sui-wallet'
    },
    {
      id: 'Slush',
      name: 'Slush Wallet',
      icon: '🌊',
      description: 'Sui 생태계 지갑',
      downloadUrl: 'https://chrome.google.com/webstore/detail/slush-wallet'
    }
  ]

  const connectWallet = async (walletType: 'Suiet' | 'Slush') => {
    console.log('🔌 [WALLET] Starting wallet connection process')
    console.log('🔌 [WALLET] Requested wallet type:', walletType)
    console.log('🔌 [WALLET] Available wallets count:', wallets.length)
    console.log('🔌 [WALLET] Available wallets:', wallets.map(w => ({ name: w.name, version: w.version })))

    setIsConnecting(true)
    setConnectionError(null)

    try {
      console.log('🔍 [WALLET] Searching for target wallet...')

      // Find the specific wallet by name
      const targetWallet = wallets.find(wallet => {
        const walletName = wallet.name.toLowerCase()
        const targetType = walletType.toLowerCase()

        console.log('🔍 [WALLET] Checking wallet:', walletName, 'against target:', targetType)

        const matches = walletName.includes(targetType) ||
               (targetType === 'suiet' && walletName.includes('suiet')) ||
               (targetType === 'slush' && (walletName.includes('slush') || walletName.includes('slush wallet')))

        console.log('🔍 [WALLET] Match result:', matches)
        return matches
      })

      if (!targetWallet) {
        console.error('❌ [WALLET] Target wallet not found')
        console.error('❌ [WALLET] Requested:', walletType)
        console.error('❌ [WALLET] Available:', wallets.map(w => w.name))
        throw new Error(`${walletType} 지갑을 찾을 수 없습니다. 브라우저에 확장프로그램이 설치되어 있는지 확인해주세요.`)
      }

      console.log('✅ [WALLET] Target wallet found:', targetWallet.name)
      console.log('✅ [WALLET] Wallet details:', {
        name: targetWallet.name,
        version: targetWallet.version,
        accounts: targetWallet.accounts?.length || 0
      })

      // Connect to specific wallet using mysten dapp-kit
      console.log('🔗 [WALLET] Initiating connection...')
      connect(
        { wallet: targetWallet },
        {
          onSuccess: () => {
            console.log('🎉 [WALLET] Connection successful!')
            console.log('🎉 [WALLET] Setting isConnecting to false')
            setIsConnecting(false)
          },
          onError: (error) => {
            console.error('💥 [WALLET] Connection failed in onError callback')
            console.error('💥 [WALLET] Error details:', error)
            console.error('💥 [WALLET] Error type:', typeof error)
            console.error('💥 [WALLET] Error message:', error?.message)

            const errorMessage = `지갑 연결에 실패했습니다. ${error?.message || error?.toString() || ''} 브라우저에 지갑 확장프로그램이 설치되어 있는지 확인해주세요.`
            console.error('💥 [WALLET] Formatted error message:', errorMessage)

            setConnectionError(errorMessage)
            setIsConnecting(false)
          }
        }
      )
    } catch (error) {
      console.error('💥 [WALLET] Exception in connectWallet function')
      console.error('💥 [WALLET] Error:', error)
      console.error('💥 [WALLET] Error stack:', error?.stack)

      const errorMessage = `지갑 연결에 실패했습니다. ${error?.message || error?.toString() || ''} 브라우저에 지갑 확장프로그램이 설치되어 있는지 확인해주세요.`
      console.error('💥 [WALLET] Setting error message:', errorMessage)

      setConnectionError(errorMessage)
      setIsConnecting(false)
    }
  }

  // Effect to handle wallet connection state changes
  useEffect(() => {
    console.log('🔄 [EFFECT] useEffect triggered')
    console.log('🔄 [EFFECT] currentAccount:', currentAccount)
    console.log('🔄 [EFFECT] isDisconnecting:', isDisconnecting)
    console.log('🔄 [EFFECT] isConnecting:', isConnecting)

    const handleWalletConnection = async () => {
      console.log('🔄 [EFFECT] handleWalletConnection called')

      // Don't handle connection if we're in the process of disconnecting
      if (isDisconnecting) {
        console.log('🔄 [EFFECT] Skipping - currently disconnecting')
        return
      }

      if (currentAccount && currentAccount.address) {
        console.log('🔄 [EFFECT] Current account found, initializing wallet')
        console.log('🔄 [EFFECT] Account address:', currentAccount.address)

        try {
          // Get wallet balance - simplified for now
          let suiBalance = 0
          console.log('🔄 [EFFECT] Setting balance to:', suiBalance)

          // Generate auth signature for API calls
          console.log('🔄 [EFFECT] Generating auth signature...')
          const authSignature = await generateAuthSignature(currentAccount.address)
          console.log('🔄 [EFFECT] Auth signature generated successfully')

          const walletInfo: WalletInfo = {
            connected: true,
            address: currentAccount.address,
            balance: suiBalance,
            provider: 'suiet', // Default to suiet
            authSignature
          }

          console.log('🔄 [EFFECT] Wallet info created:', {
            ...walletInfo,
            authSignature: authSignature.substring(0, 50) + '...'
          })

          console.log('🔄 [EFFECT] Calling onConnect...')
          onConnect(walletInfo)
          setIsConnecting(false)
          console.log('🔄 [EFFECT] Wallet connection process completed')
        } catch (error) {
          console.error('💥 [EFFECT] Failed to initialize wallet:', error)
          console.error('💥 [EFFECT] Error type:', typeof error)
          console.error('💥 [EFFECT] Error message:', error?.message)

          if (error?.message?.includes('Authentication signature required')) {
            const errorMsg = `인증 서명에 실패했습니다: ${error.message}`
            console.error('💥 [EFFECT] Auth signature error:', errorMsg)
            setConnectionError(errorMsg)
          } else {
            const errorMsg = `지갑 초기화에 실패했습니다: ${error?.message || error?.toString() || '알 수 없는 오류'}`
            console.error('💥 [EFFECT] General initialization error:', errorMsg)
            setConnectionError(errorMsg)
          }
          setIsConnecting(false)
        }
      } else if (!currentAccount && !isDisconnecting) {
        console.log('🔄 [EFFECT] No current account and not disconnecting, setting isConnecting to false')
        setIsConnecting(false)
      } else {
        console.log('🔄 [EFFECT] No action needed')
      }
    }

    handleWalletConnection()
  }, [currentAccount, isDisconnecting, onConnect])

  const disconnectWallet = async () => {
    console.log('🔌 [DISCONNECT] Starting wallet disconnection')
    console.log('🔌 [DISCONNECT] Current account before disconnect:', currentAccount?.address)

    setIsDisconnecting(true)
    try {
      // Clear local storage to prevent auto-reconnection
      console.log('🔌 [DISCONNECT] Clearing localStorage...')
      localStorage.removeItem('daas-wallet')

      console.log('🔌 [DISCONNECT] Calling disconnect()...')
      disconnect()

      console.log('🔌 [DISCONNECT] Calling onDisconnect()...')
      onDisconnect()

      console.log('🔌 [DISCONNECT] Clearing connection error...')
      setConnectionError(null)

      // Keep disconnecting state for a moment to prevent immediate reconnection
      console.log('🔌 [DISCONNECT] Setting timeout to reset disconnecting state...')
      setTimeout(() => {
        console.log('🔌 [DISCONNECT] Timeout completed, setting isDisconnecting to false')
        setIsDisconnecting(false)
      }, 1000)

      console.log('🔌 [DISCONNECT] Disconnection process completed')
    } catch (error) {
      console.error('💥 [DISCONNECT] Failed to disconnect wallet:', error)
      console.error('💥 [DISCONNECT] Error type:', typeof error)
      console.error('💥 [DISCONNECT] Error message:', (error as any)?.message)

      setConnectionError('지갑 연결 해제에 실패했습니다.')
      setIsDisconnecting(false)
    }
  }

  const copyAddress = async () => {
    if (currentWallet?.address) {
      await navigator.clipboard.writeText(currentWallet.address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const refreshBalance = async () => {
    if (currentWallet) {
      // 실제로는 지갑 API를 호출하여 잔액을 새로고침
      // Mock 구현
      const updatedWallet: WalletInfo = {
        ...currentWallet,
        balance: Math.random() * 1000
      }
      onConnect(updatedWallet)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBalance = (balance: number) => {
    return balance.toLocaleString('ko-KR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const getWalletIcon = (provider: string) => {
    const providerMap: Record<string, string> = {
      'suiet': 'Suiet',
      'slush': 'Slush'
    }
    const walletId = providerMap[provider] || provider
    const wallet = supportedWallets.find(w => w.id === walletId)
    return wallet?.icon || '💼'
  }

  if (currentWallet?.connected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getWalletIcon(currentWallet.provider)}</span>
                <div>
                  <h3 className="font-semibold">
                    {currentWallet.provider === 'suiet' ? 'Suiet Wallet' : 'Slush Wallet'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatAddress(currentWallet.address)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-4 h-4 p-0"
                      onClick={copyAddress}
                    >
                      {copiedAddress ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                연결됨
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshBalance}
                className="w-8 h-8"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={disconnectWallet}
                className="w-8 h-8 text-red-500 hover:text-red-600"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SUI 잔액</span>
              <div className="text-right">
                <span className="font-semibold text-lg">
                  {formatBalance(currentWallet.balance)} SUI
                </span>
                <p className="text-xs text-muted-foreground">
                  ≈ ${(currentWallet.balance * 2.5).toFixed(2)} USD
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium">계정 정보</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">계정 등급</span>
              <Badge variant="outline">Starter</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">스테이킹 가능</span>
              <span className="text-green-600">✓ 예</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">네트워크</span>
              <span>Sui Mainnet</span>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">지갑 연결</h2>
        <p className="text-muted-foreground">
          DaaS 플랫폼을 사용하려면 Sui 지갑을 연결해주세요
        </p>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {connectionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Options */}
      <div className="space-y-3">
        {supportedWallets.map(wallet => (
          <motion.div
            key={wallet.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                isConnecting ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={() => connectWallet(wallet.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wallet.icon}</span>
                  <div>
                    <h3 className="font-semibold">{wallet.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {wallet.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={wallet.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {isConnecting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Button variant="ghost" size="sm">
                      연결
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Security Notice */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-medium text-blue-900">보안 안내</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 지갑 연결 시 개인키는 절대 공유되지 않습니다</li>
              <li>• 모든 트랜잭션은 사용자의 명시적 승인이 필요합니다</li>
              <li>• 브라우저를 닫으면 연결이 자동으로 해제됩니다</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Help Links */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          지갑이 없으신가요?
        </p>
        <div className="flex justify-center gap-2">
          {supportedWallets.map(wallet => (
            <a
              key={wallet.id}
              href={wallet.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 text-sm underline"
            >
              {wallet.name} 설치
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default WalletConnector