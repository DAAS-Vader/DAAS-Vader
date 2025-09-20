'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, FileText, Loader2, Rocket, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface ContractingLoaderProps {
  onComplete: () => void
  projectName?: string
}

const ContractingLoader: React.FC<ContractingLoaderProps> = ({ onComplete, projectName = 'Your Project' }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const steps = [
    { icon: FileText, text: '계약 조건 확인 중...', duration: 1000 },
    { icon: Shield, text: '스마트 컨트랙트 생성 중...', duration: 1200 },
    { icon: Rocket, text: '배포 노드 매칭 중...', duration: 800 },
  ]

  useEffect(() => {
    console.log('ContractingLoader useEffect - currentStep:', currentStep, 'isComplete:', isComplete)
    let timer: NodeJS.Timeout

    if (currentStep < steps.length) {
      console.log('Setting timer for next step, duration:', steps[currentStep].duration)
      timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, steps[currentStep].duration)
    } else if (currentStep === steps.length && !isComplete) {
      // 모든 단계 완료 후 성공 메시지 표시
      console.log('All steps completed, showing success message')
      setIsComplete(true)
    }

    return () => {
      if (timer) {
        console.log('Cleaning up timer')
        clearTimeout(timer)
      }
    }
  }, [currentStep, steps.length])

  // 별도의 useEffect로 완료 후 이동 처리
  useEffect(() => {
    if (isComplete) {
      console.log('Component is complete, setting timer for onComplete')
      const completeTimer = setTimeout(() => {
        console.log('Calling onComplete after 1 second!')
        onComplete()
      }, 1000) // 성공 메시지 1초 표시 후 이동

      return () => {
        console.log('Cleaning up complete timer')
        clearTimeout(completeTimer)
      }
    }
  }, [isComplete, onComplete])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center space-y-6">
            {/* 로딩 아이콘 또는 성공 아이콘 */}
            <div className="relative">
              {!isComplete ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center"
                >
                  <Loader2 className="w-10 h-10 text-primary" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="w-20 h-20 text-green-500" />
                </motion.div>
              )}
            </div>

            {/* 프로젝트 이름 */}
            <h2 className="text-xl font-semibold text-center">
              {projectName}
            </h2>

            {/* 상태 텍스트 */}
            {!isComplete ? (
              <div className="space-y-4 w-full">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = index === currentStep
                  const isCompleted = index < currentStep

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: isCompleted || isActive ? 1 : 0.3,
                        x: 0
                      }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center space-x-3 ${
                        isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isActive ? (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Icon className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                      <span className="text-sm font-medium">{step.text}</span>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-2"
              >
                <p className="text-lg font-semibold text-green-600">
                  계약 체결 완료!
                </p>
                <p className="text-sm text-muted-foreground">
                  잠시 후 모니터링 페이지로 이동합니다...
                </p>
              </motion.div>
            )}

            {/* 진행 바 */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: "0%" }}
                animate={{
                  width: isComplete ? "100%" : `${((currentStep + 1) / (steps.length + 1)) * 100}%`
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export default ContractingLoader