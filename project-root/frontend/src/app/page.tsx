'use client'

import ProjectUpload from '@/components/ProjectUpload'

export default function Home() {
  return (
    <main>
      <ProjectUpload
        onFileUpload={async (files) => {
          console.log('파일 업로드:', files)
        }}
        onGitHubConnect={async (repo) => {
          console.log('GitHub 저장소 선택:', repo)
        }}
        maxFileSize={50 * 1024 * 1024} // 50MB
        acceptedFileTypes={[
          '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs',
          '.json', '.md', '.txt', '.html', '.css', '.scss', '.less',
          '.php', '.rb', '.kt', '.swift', '.dart', '.vue', '.svelte'
        ]}
        backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}
      />
    </main>
  )
}
