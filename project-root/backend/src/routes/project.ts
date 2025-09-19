import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { AuthenticatedRequest, UploadResponse, GitHubUploadRequest, ValidationError } from '../types/index.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { SealService } from '../services/sealService.js';
import { walrusService } from '../services/walrusService.js';
import { GitHubService } from '../services/githubService.js';
import { NautilusService } from '../services/nautilusService.js';

const router = Router();

// 파일 업로드를 위한 multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.limits.codeBundleSize,
    files: 1000 // 최대 파일 수
  }
});

/**
 * POST /project/upload
 * 프로젝트 디렉토리나 ZIP 파일을 업로드하고 비밀 정보와 코드를 분리
 */
router.post('/upload', upload.any(), async (req: Request, res: Response) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const files = req.files as Express.Multer.File[];
    const { userKeypairSeed } = req.body; // 사용자 키페어 시드 (선택사항)
    
    if (!files || files.length === 0) {
      throw new ValidationError('No files provided');
    }
    
    // 요청에서 무시 패턴 파싱
    const ignorePatterns: string[] = [];
    if (req.body.ignorePatterns) {
      if (typeof req.body.ignorePatterns === 'string') {
        // JSON 문자열이거나 쉼표로 구분된 문자열일 수 있음
        try {
          const parsed = JSON.parse(req.body.ignorePatterns);
          ignorePatterns.push(...parsed);
        } catch {
          // 쉼표로 구분된 문자열로 처리
          ignorePatterns.push(...req.body.ignorePatterns.split(',').map((p: string) => p.trim()));
        }
      } else if (Array.isArray(req.body.ignorePatterns)) {
        ignorePatterns.push(...req.body.ignorePatterns);
      }
    }
    
    const fileProcessor = new FileProcessor(ignorePatterns);
    let processedBundle;

    // 단일 ZIP/TAR 파일인지 여러 파일인지 확인
    const firstFile = files[0];
    if (files.length === 1 && firstFile && firstFile.originalname && firstFile.buffer && (
      firstFile.originalname.endsWith('.zip') ||
      firstFile.originalname.endsWith('.tar.gz') ||
      firstFile.originalname.endsWith('.tgz')
    )) {
      // Process ZIP file
      if (firstFile.originalname.endsWith('.zip')) {
        processedBundle = await fileProcessor.processZipUploadWithTree(firstFile.buffer);
      } else {
        // TODO: Add tar.gz processing
        throw new ValidationError('tar.gz upload not yet implemented');
      }
    } else {
      // Process directory upload (multiple files)
      processedBundle = await fileProcessor.processDirectoryUploadWithTree(files);
    }

    const { secretFiles, codeFiles, ignored, fileTree, projectType, totalFiles } = processedBundle;

    // Check if we have any code files
    if (codeFiles.size === 0) {
      throw new ValidationError('No code files found to upload');
    }

    // 서비스 초기화
    const sealService = new SealService();
    // Use Walrus SDK service

    // Upload code bundle to Walrus
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);
    
    // Upload options for SDK mode (always provide metadata)
    const uploadOptions = {
      fileName: `project_${Date.now()}.tar`,
      mimeType: 'application/tar',
      epochs: 5,
      userKeypairSeed, // 사용자의 니모닉 (선택사항)
    };

    const walrusResponse = await walrusService.uploadCodeBundle(codeBundle, uploadOptions);

    // 인증된 사용자의 지갑 주소 사용
    const walletAddress = authReq.walletAddress;

    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles.size > 0) {
      const secretBundle = await fileProcessor.createTarBundle(secretFiles);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }

    console.log('✅ Project uploaded to Walrus:', walrusResponse.cid);
    
    // Prepare response
    const response: UploadResponse = {
      cid_code: walrusResponse.cid,
      size_code: walrusResponse.size,
      files_env: fileProcessor.generateFileInfo(secretFiles),
      ignored
    };
    
    if (sealResponse) {
      response.cid_env = sealResponse.cid;
      response.dek_version = sealResponse.dek_version;
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Project upload error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'Upload Failed',
      message: 'Failed to process and upload project'
    });
  }
});

/**
 * POST /project/from-github
 * GitHub에서 다운로드하고 업로드와 동일한 방식으로 처리
 */
router.post('/from-github', async (req: Request, res: Response) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { repo, ref = 'main', installation_id, ignorePatterns = [] }: GitHubUploadRequest = req.body;
    
    if (!repo) {
      throw new ValidationError('Repository is required');
    }
    
    // Parse repository owner/name
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new ValidationError('Repository must be in format "owner/repo"');
    }
    
    // Initialize GitHub service
    const githubService = new GitHubService(installation_id);
    
    // Validate repository access
    const hasAccess = await githubService.validateRepoAccess(owner, repoName);
    if (!hasAccess) {
      throw new ValidationError('Repository not found or not accessible');
    }
    
    // Download and process repository
    const processedBundle = await githubService.downloadAndProcessRepo(
      owner,
      repoName,
      ref,
      ignorePatterns
    );
    
    const { secretFiles, codeFiles, ignored } = processedBundle;

    // 서비스 초기화
    const fileProcessor = new FileProcessor();
    const sealService = new SealService();
    // Use Walrus SDK service

    // Generate file tree metadata
    const allFiles = new Map([...secretFiles, ...codeFiles]);
    const fileTree = fileProcessor.generateFileTree(allFiles);
    const projectType = fileProcessor.detectProjectType(fileTree);
    const totalFiles = Array.from(allFiles.keys()).length;
    
    // Upload code bundle to Walrus
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);

    // Upload options for SDK mode (always provide metadata)
    const uploadOptions = {
      fileName: `github_project_${Date.now()}.tar`,
      mimeType: 'application/tar',
      epochs: 5,
    };

    const walrusResponse = await walrusService.uploadCodeBundle(codeBundle, uploadOptions);
    
    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles.size > 0) {
      const secretBundle = await fileProcessor.createTarBundle(secretFiles);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }
    
    // 인증된 사용자의 지갑 주소 사용
    const walletAddress = authReq.walletAddress;

    console.log('✅ GitHub project uploaded to Walrus:', walrusResponse.cid);
    
    // Prepare response
    const response: UploadResponse = {
      cid_code: walrusResponse.cid,
      size_code: walrusResponse.size,
      files_env: fileProcessor.generateFileInfo(secretFiles),
      ignored
    };
    
    if (sealResponse) {
      response.cid_env = sealResponse.cid;
      response.dek_version = sealResponse.dek_version;
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('GitHub upload error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'GitHub Upload Failed',
      message: 'Failed to process repository from GitHub'
    });
  }
});

/**
 * POST /project/build
 * Nautilus 보안 엔클레이브를 통한 컨테이너 빌드
 */
router.post('/build', async (req: Request, res: Response) => {
  try {
    const { bundleId, walletAddress } = req.body;

    if (!bundleId || !walletAddress) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'bundleId and walletAddress are required'
      });
    }

    console.log('🔨 보안 빌드 시작:', { bundleId, wallet: walletAddress.substring(0, 10) + '...' });

    // 서비스 초기화
    // Use Walrus SDK service for consistency
    const nautilusService = new NautilusService();

    // 1. Nautilus 기능 확인 (환경 변수로 비활성화 가능)
    const isNautilusEnabled = process.env.ENABLE_NAUTILUS === 'true';
    let isNautilusAvailable = false;

    if (isNautilusEnabled) {
      isNautilusAvailable = await nautilusService.healthCheck();
      if (!isNautilusAvailable) {
        console.warn('⚠️ Nautilus 서버를 사용할 수 없습니다. Docker Builder Service로 폴백합니다.');
      }
    } else {
      console.info('ℹ️ Nautilus 기능이 비활성화되어 있습니다. Docker Builder Service를 사용합니다.');
    }

    if (!isNautilusAvailable) {
      // Check if Docker Builder Service is available as fallback
      const dockerBuilderAvailable = await nautilusService.checkDockerBuilderHealth();
      if (!dockerBuilderAvailable) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: isNautilusEnabled
            ? 'Nautilus 보안 빌드 서버와 Docker Builder Service 모두 사용할 수 없습니다.'
            : 'Docker Builder Service를 사용할 수 없습니다. (Nautilus는 비활성화됨)'
        });
      }
    }

    // 2. Walrus에서 코드 번들 다운로드
    let codeBundle: Buffer;
    try {
      codeBundle = await walrusService.downloadBundle(bundleId);
      console.log('✅ Walrus에서 코드 번들 다운로드 완료:', codeBundle.length, 'bytes');
    } catch (error) {
      console.error('❌ Walrus 다운로드 실패:', error);
      return res.status(404).json({
        error: 'Bundle Not Found',
        message: '지정된 bundleId의 코드를 찾을 수 없습니다.'
      });
    }

    // 3. 보안 빌드 실행 (Nautilus 또는 Docker Builder Service)
    try {
      let buildResult;
      let buildLogs: string[] = [];
      let buildMethod = 'unknown';

      if (isNautilusAvailable) {
        // Nautilus 보안 빌드 사용
        buildMethod = 'nautilus';
        buildResult = await nautilusService.secureBuild(bundleId, walletAddress);
        buildLogs = await nautilusService.getBuildLogs(buildResult.buildHash);
      } else {
        // Docker Builder Service 폴백 사용
        buildMethod = 'docker-builder';
        const buildId = await nautilusService.buildWithDockerService(bundleId, walletAddress, {
          platform: 'linux/amd64',
          labels: {
            'daas.wallet': walletAddress,
            'daas.fallback': 'true',
            'daas.reason': 'nautilus-unavailable'
          }
        });

        // Docker 빌드 상태 확인
        const buildStatus = await nautilusService.getDockerBuildStatus(buildId);
        buildResult = {
          imageUrl: `docker-builder://${buildId}`,
          buildHash: buildId,
          attestation: 'docker-builder-fallback' // Docker Builder에는 Nautilus 스타일 증명 없음
        };
        buildLogs = buildStatus?.logs || [];
      }

      console.log(`✅ ${buildMethod} 빌드 완료:`, {
        imageUrl: buildResult.imageUrl,
        buildHash: buildResult.buildHash.substring(0, 16) + '...',
        method: buildMethod
      });

      return res.status(200).json({
        success: true,
        imageUrl: buildResult.imageUrl,
        buildHash: buildResult.buildHash,
        attestation: buildResult.attestation,
        logs: buildLogs,
        walletAddress,
        timestamp: Date.now(),
        buildMethod,
        message: buildMethod === 'nautilus'
          ? 'Nautilus 보안 엔클레이브에서 빌드가 완료되었습니다.'
          : 'Docker Builder Service를 통한 빌드가 완료되었습니다. (Nautilus 대신 사용)'
      });

    } catch (error) {
      console.error('❌ Nautilus 빌드 실패:', error);
      return res.status(500).json({
        error: 'Build Failed',
        message: error instanceof Error ? error.message : 'Nautilus 보안 빌드 중 오류가 발생했습니다.',
        bundleId,
        walletAddress
      });
    }

  } catch (error) {
    console.error('❌ 빌드 프로세스 오류:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: '빌드 요청 처리 중 예상치 못한 오류가 발생했습니다.'
    });
  }
});

export default router;