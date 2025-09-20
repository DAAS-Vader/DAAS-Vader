import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { AuthenticatedRequest, UploadResponse, GitHubUploadRequest, ValidationError, WalrusTransactionRequest, UserWalletUploadRequest } from '../types/index.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { SealService } from '../services/sealService.js';
import { WalrusSDKService } from '../services/walrusSDKService.js';
import { GitHubService } from '../services/githubService.js';
import { DockerBuilderService } from '../services/dockerBuilderService.js';
import { getBuildMonitoringIntegration } from '../services/buildMonitoringIntegration.js';

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
 *
 * ⚠️ DEPRECATED: 이 엔드포인트는 서버 지갑을 사용합니다.
 * 사용자 지갑 업로드를 위해서는 /prepare-upload 와 /complete-upload 를 사용하세요.
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

    const walrusSDKService = new WalrusSDKService();
    const walrusResponse = await walrusSDKService.uploadCodeBundle(codeBundle, uploadOptions);

    // 인증된 사용자의 지갑 주소 사용
    const walletAddress = authReq.walletAddress;

    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles.size > 0) {
      const secretBundle = await fileProcessor.createTarBundle(secretFiles);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }

    console.log('⚠️ DEPRECATED: Server wallet upload used, consider user wallet upload');
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

    const walrusSDKService = new WalrusSDKService();
    const walrusResponse = await walrusSDKService.uploadCodeBundle(codeBundle, uploadOptions);
    
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
 * Docker Builder Service를 통한 컨테이너 빌드
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
    const dockerBuilderService = new DockerBuilderService();

    // 1. Docker Builder Service 상태 확인
    const dockerBuilderAvailable = await dockerBuilderService.healthCheck();
    if (!dockerBuilderAvailable) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Docker Builder Service를 사용할 수 없습니다.'
      });
    }

    // 2. Walrus에서 코드 번들 다운로드
    let codeBundle: Buffer;
    try {
      const walrusSDKService = new WalrusSDKService();
      codeBundle = await walrusSDKService.downloadBundle(bundleId);
      console.log('✅ Walrus에서 코드 번들 다운로드 완료:', codeBundle.length, 'bytes');
    } catch (error) {
      console.error('❌ Walrus 다운로드 실패:', error);
      return res.status(404).json({
        error: 'Bundle Not Found',
        message: '지정된 bundleId의 코드를 찾을 수 없습니다.'
      });
    }

    // 3. Docker 빌드 실행
    try {
      const buildId = await dockerBuilderService.startBuild({
        bundleId,
        buildOptions: {
          platform: 'linux/amd64',
          labels: {
            'daas.wallet': walletAddress,
            'daas.timestamp': Date.now().toString(),
            'daas.service': 'docker-builder'
          }
        }
      });

      // 모니터링 연동 (이전 BuildService에서 하던 일)
      const monitoringIntegration = getBuildMonitoringIntegration();
      setImmediate(async () => {
        try {
          // 기본 빌드 노드 정보로 모니터링 설정
          await monitoringIntegration.onBuildComplete(buildId, [{
            nodeId: `build-${buildId}`,
            nodeIp: 'localhost',
            nodeName: 'local-builder',
            nodeType: 'build-runtime' as const
          }]);
        } catch (error) {
          console.error('Failed to setup monitoring:', error);
        }
      });

      // Docker 빌드 상태 확인
      const buildStatus = await dockerBuilderService.getBuildStatus(buildId);
      const buildResult = {
        imageUrl: `docker-builder://${buildId}`,
        buildHash: buildId,
        attestation: 'docker-builder'
      };
      const buildLogs = buildStatus?.logs || [];

      console.log('✅ Docker 빌드 완료:', {
        imageUrl: buildResult.imageUrl,
        buildHash: buildResult.buildHash.substring(0, 16) + '...'
      });

      return res.status(200).json({
        success: true,
        imageUrl: buildResult.imageUrl,
        buildHash: buildResult.buildHash,
        attestation: buildResult.attestation,
        logs: buildLogs,
        walletAddress,
        timestamp: Date.now(),
        buildMethod: 'docker-builder',
        message: 'Docker Builder Service를 통한 빌드가 완료되었습니다.'
      });

    } catch (error) {
      console.error('❌ Docker 빌드 실패:', error);
      return res.status(500).json({
        error: 'Build Failed',
        message: error instanceof Error ? error.message : 'Docker 빌드 중 오류가 발생했습니다.',
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

/**
 * POST /project/prepare-upload
 * 사용자 지갑 업로드를 위한 트랜잭션 준비
 */
router.post('/prepare-upload', upload.any(), async (req: Request, res: Response) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('No files provided');
    }

    // 요청에서 무시 패턴 파싱
    const ignorePatterns: string[] = [];
    if (req.body.ignorePatterns) {
      if (typeof req.body.ignorePatterns === 'string') {
        try {
          const parsed = JSON.parse(req.body.ignorePatterns);
          ignorePatterns.push(...parsed);
        } catch {
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
        throw new ValidationError('tar.gz upload not yet implemented');
      }
    } else {
      // Process directory upload (multiple files)
      processedBundle = await fileProcessor.processDirectoryUploadWithTree(files);
    }

    const { secretFiles, codeFiles, ignored } = processedBundle;

    // Check if we have any code files
    if (codeFiles.size === 0) {
      throw new ValidationError('No code files found to upload');
    }

    // 인증된 사용자의 지갑 주소 사용
    const userWalletAddress = authReq.walletAddress;

    // Walrus SDK 서비스 초기화
    const walrusSDKService = new WalrusSDKService();

    // 사용자 지갑 잔액 확인
    const walletBalance = await walrusSDKService.getUserWalletBalance(userWalletAddress);

    if (!walletBalance.hasEnoughWal) {
      res.status(400).json({
        error: 'Insufficient WAL Balance',
        message: 'User wallet does not have enough WAL tokens for upload',
        walletInfo: walletBalance
      });
      return;
    }

    // Upload code bundle to Walrus (트랜잭션 준비)
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);

    const uploadOptions = {
      fileName: `project_${Date.now()}.tar`,
      mimeType: 'application/tar',
      epochs: 5,
    };

    const txRequest = await walrusSDKService.prepareUploadTransaction(
      codeBundle,
      userWalletAddress,
      uploadOptions
    );

    // Secret files 정보 포함하여 응답
    const response = {
      ...txRequest,
      secretFiles: {
        count: secretFiles.size,
        files: fileProcessor.generateFileInfo(secretFiles)
      },
      ignored
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Transaction preparation error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Transaction Preparation Failed',
      message: 'Failed to prepare upload transaction'
    });
  }
});

/**
 * POST /project/complete-upload
 * 사용자가 서명한 트랜잭션을 실행하고 결과 확인
 */
router.post('/complete-upload', async (req: Request, res: Response) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { signedTransaction, secretFiles }: UserWalletUploadRequest & { secretFiles?: any[] } = req.body;

    if (!signedTransaction) {
      throw new ValidationError('Signed transaction is required');
    }

    // 인증된 사용자의 지갑 주소 사용
    const userWalletAddress = authReq.walletAddress;

    // Walrus SDK 서비스 초기화
    const walrusSDKService = new WalrusSDKService();

    // 서명된 트랜잭션 실행
    const walrusResponse = await walrusSDKService.executeUserSignedTransaction({
      signedTransaction,
      walletAddress: userWalletAddress
    });

    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles && secretFiles.length > 0) {
      const sealService = new SealService();
      const fileProcessor = new FileProcessor();

      // Convert secret files back to Map format
      const secretFilesMap = new Map<string, Uint8Array>();
      secretFiles.forEach(file => {
        secretFilesMap.set(file.path, new Uint8Array(file.data));
      });

      const secretBundle = await fileProcessor.createTarBundle(secretFilesMap);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }

    console.log('✅ User wallet upload completed:', walrusResponse.cid);

    // Prepare response
    const response: UploadResponse = {
      cid_code: walrusResponse.cid,
      size_code: walrusResponse.size,
      files_env: secretFiles ? secretFiles.map(f => ({ path: f.path, size: f.size })) : [],
      ignored: []
    };

    if (sealResponse) {
      response.cid_env = sealResponse.cid;
      response.dek_version = sealResponse.dek_version;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Upload completion error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Upload Completion Failed',
      message: 'Failed to complete upload process'
    });
  }
});

/**
 * GET /project/wallet-balance/:address
 * 사용자 지갑의 WAL 토큰 잔액 확인
 * 새로운 클라이언트 사이드 업로드 시스템용
 */
router.get('/wallet-balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      throw new ValidationError('Wallet address is required');
    }

    const walrusSDKService = new WalrusSDKService();
    const walletBalance = await walrusSDKService.getUserWalletBalance(address);

    res.status(200).json(walletBalance);

  } catch (error) {
    console.error('Wallet balance check error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Balance Check Failed',
      message: 'Failed to check wallet balance'
    });
  }
});

export default router;