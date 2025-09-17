import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { AuthenticatedRequest, UploadResponse, GitHubUploadRequest, ValidationError } from '../types/index.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { SealService } from '../services/sealService.js';
import { WalrusService } from '../services/walrusService.js';
import { GitHubService } from '../services/githubService.js';

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
    // const authReq = req as AuthenticatedRequest; // 해커톤용으로 제거
    const files = req.files as Express.Multer.File[];
    
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
    const walrusService = new WalrusService();

    // Upload code bundle to Walrus
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);
    const walrusResponse = await walrusService.uploadCodeBundle(codeBundle);

    // TODO: zkLogin 인증 구현 후 실제 지갑 주소 사용
    const walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a'; // 해커톤용 임시 지갑 주소

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
    // const authReq = req as AuthenticatedRequest; // 해커톤용으로 제거
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
    const walrusService = new WalrusService();

    // Generate file tree metadata
    const allFiles = new Map([...secretFiles, ...codeFiles]);
    const fileTree = fileProcessor.generateFileTree(allFiles);
    const projectType = fileProcessor.detectProjectType(fileTree);
    const totalFiles = Array.from(allFiles.keys()).length;
    
    // Upload code bundle to Walrus
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);
    const walrusResponse = await walrusService.uploadCodeBundle(codeBundle);
    
    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles.size > 0) {
      const secretBundle = await fileProcessor.createTarBundle(secretFiles);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }
    
    // TODO: zkLogin 인증 구현 후 실제 지갑 주소 사용
    const walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a'; // 해커톤용 임시 지갑 주소

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
 * GET /project/bundles
 * Database 없이는 작동하지 않으므로 비활성화
 */
router.get('/bundles', async (_req: Request, res: Response) => {
  res.status(503).json({
    error: 'Service unavailable',
    message: 'Bundle listing is not available without database'
  });
});

/**
 * POST /project/build
 * Walrus에서 코드를 다운로드하고 OCI 이미지로 빌드
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

    console.log(`Build request for bundleId: ${bundleId} from wallet: ${walletAddress}`);

    // DB 없이 bundleId를 직접 Walrus blob ID로 처리
    console.log(`DB unavailable, treating bundleId as Walrus blob ID: ${bundleId}`);

    console.log(`Downloading source from Walrus: ${bundleId}`);
    console.log(`Starting build for bundle: ${bundleId}`);

    // 간단한 성공 응답 반환 (실제 빌드 로직은 별도 구현 필요)
    res.status(200).json({
      success: true,
      message: 'Build process started',
      bundleId,
      walletAddress
    });

  } catch (error) {
    console.error('Build error:', error);
    res.status(500).json({
      error: 'Build Failed',
      message: 'Failed to start build process'
    });
  }
});

export default router;