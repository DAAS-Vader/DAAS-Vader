'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProjectUpload from '@/components/ProjectUpload'
import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit'
import { Upload, Home } from 'lucide-react'
import Link from 'next/link'

export default function UploadPage() {
  const currentAccount = useCurrentAccount()

  const handleProjectUpload = async (files: File[]) => {
    console.log('Files uploaded:', files)
  }

  const handleUploadComplete = (uploadResult: {
    success: boolean;
    message: string;
    cid_code?: string;
    blobId?: string
  }) => {
    console.log('Upload completed with result:', uploadResult)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">D</span>
              </div>
              <h1 className="text-xl font-bold">DaaS Platform</h1>
              <Badge variant="outline" className="ml-2">
                Direct Upload
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
              {!currentAccount && <ConnectButton />}
              {currentAccount && (
                <div className="text-sm text-muted-foreground">
                  {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Direct Upload to Walrus</h1>
            <p className="text-muted-foreground">
              Upload your project or Docker image directly to Walrus storage
            </p>
          </div>

          {/* Upload Component */}
          <Card className="p-6">
            {!currentAccount ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Please connect your wallet to upload files
                </p>
                <ConnectButton className="mx-auto" />
              </div>
            ) : (
              <ProjectUpload
                onFileUpload={handleProjectUpload}
                onUploadComplete={handleUploadComplete}
                maxFileSize={500 * 1024 * 1024} // 500MB for docker images
                acceptedFileTypes={[
                  '.zip', '.tar.gz', '.tgz', '.tar', 
                  '.docker', '.dockerimage',
                  'Dockerfile', '.dockerfile',
                  '.yaml', '.yml',  // Docker compose files
                  '*'  // Accept all files
                ]}
              />
            )}
          </Card>

          {/* Info Section */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-primary">📦</span>
                Supported Formats
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• ZIP archives (.zip)</li>
                <li>• Tar archives (.tar, .tar.gz, .tgz)</li>
                <li>• Docker images (.docker, .dockerimage)</li>
                <li>• Individual files</li>
              </ul>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-primary">🚀</span>
                Upload Features
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• SDK-first with HTTP fallback</li>
                <li>• Automatic retry on failure</li>
                <li>• Progress tracking</li>
                <li>• Max size: 500MB</li>
              </ul>
            </Card>
          </div>

          {/* Quick Instructions */}
          <Card className="mt-4 p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Quick Instructions</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. Connect your Sui wallet</p>
              <p>2. Choose between file upload or Docker image upload</p>
              <p>3. Select or drag your files</p>
              <p>4. Click upload and wait for completion</p>
              <p>5. Copy the blob ID for future reference</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}