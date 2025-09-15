import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { AuthenticatedRequest, UploadResponse, GitHubUploadRequest, ValidationError } from '../types/index.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { SealService } from '../services/sealService.js';
import { WalrusService } from '../services/walrusService.js';
import { GitHubService } from '../services/githubService.js';
import { ProjectBundleModel } from '../db/models.js';
import { TarExtractor } from '../utils/tarExtractor.js';
import { SuiIndexerService } from '../services/suiIndexerService.js';

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
    const suiIndexerService = new SuiIndexerService();

    // Upload code bundle to Walrus
    const codeBundle = await fileProcessor.createTarBundle(codeFiles);
    const walrusResponse = await walrusService.uploadCodeBundle(codeBundle);

    // TODO: zkLogin 인증 구현 후 실제 지갑 주소 사용
    const walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a'; // 해커톤용 임시 지갑 주소

    // Sui 인덱서에 업로드 이벤트 전송
    await suiIndexerService.linkWalletToBlob({
      walletAddress,
      blobId: walrusResponse.cid,
      projectMetadata: {
        projectType,
        totalFiles,
        fileTree,
        source: files.length === 1 ? 'zip-upload' : 'dir-upload'
      }
    });

    // Upload secrets to Seal (if any)
    let sealResponse = null;
    if (secretFiles.size > 0) {
      const secretBundle = await fileProcessor.createTarBundle(secretFiles);
      sealResponse = await sealService.encryptAndUpload(secretBundle);
    }

    // Save to database (skip if DB is not available)
    try {
      const projectBundle = await ProjectBundleModel.create({
        user_id: walletAddress,
        source: files.length === 1 ? 'zip-upload' : 'dir-upload',
        cid_code: walrusResponse.cid,
        cid_env: sealResponse?.cid,
        size_code: walrusResponse.size,
        size_env: sealResponse ? Buffer.from(await fileProcessor.createTarBundle(secretFiles)).length : undefined,
        files_env: fileProcessor.generateFileInfo(secretFiles),
        ignored,
        file_tree: fileTree,
        project_type: projectType,
        total_files: totalFiles
      });
      console.log('✅ Project saved to database:', projectBundle.id);
    } catch (dbError) {
      console.warn('⚠️ Could not save to database (DB might be unavailable):', dbError);
      // Continue without database - data is still stored on Walrus/IPFS
    }
    
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
    
    // Save to database (optional)
    // TODO: zkLogin 인증 구현 후 실제 지갑 주소 사용
    const walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a'; // 해커톤용 임시 지갑 주소

    let projectBundle;
    try {
      projectBundle = await ProjectBundleModel.create({
        user_id: walletAddress,
        source: 'github',
        repo,
        ref,
        cid_code: walrusResponse.cid,
        cid_env: sealResponse?.cid,
        size_code: walrusResponse.size,
        size_env: sealResponse ? Buffer.from(await fileProcessor.createTarBundle(secretFiles)).length : undefined,
        files_env: fileProcessor.generateFileInfo(secretFiles),
        ignored,
        file_tree: fileTree,
        project_type: projectType,
        total_files: totalFiles
      });
      console.log('✅ Project stored in Walrus and saved to database:', projectBundle.id);
    } catch (dbError) {
      console.warn('⚠️ Could not save to database (DB might be unavailable):', dbError);
      // Continue without database - project is still stored in Walrus
      projectBundle = {
        id: 'temp-' + Date.now(),
        cid_code: walrusResponse.cid,
        cid_env: sealResponse?.cid
      };
    }
    
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
 * 사용자의 프로젝트 번들 목록 조회
 */
router.get('/bundles', async (req: Request, res: Response) => {
  try {
    // const authReq = req as AuthenticatedRequest; // 해커톤용으로 제거
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // TODO: zkLogin 인증 구현 후 실제 지갑 주소 사용
    const walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a'; // 해커톤용 임시 지갑 주소

    // Try to get bundles from database
    let bundles = [];
    try {
      bundles = await ProjectBundleModel.findByWalletAddress(walletAddress, limit, offset);
    } catch (dbError) {
      console.warn('⚠️ Could not fetch bundles from database:', dbError);
      // Return empty list when DB is unavailable
    }

    res.status(200).json({
      bundles,
      pagination: {
        limit,
        offset,
        count: bundles.length
      }
    });
    
  } catch (error) {
    console.error('List bundles error:', error);
    res.status(500).json({
      error: 'Failed to list bundles',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /project/bundles/:id
 * 특정 프로젝트 번들 세부 정보 조회
 */
router.get('/bundles/:id', async (req: Request, res: Response) => {
  try {
    // const authReq = req as AuthenticatedRequest; // 해커톤용으로 제거
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'Bundle ID required',
        message: 'Bundle ID is required in the URL parameters'
      });
      return;
    }

    let bundle;
    try {
      bundle = await ProjectBundleModel.findById(id);
    } catch (dbError) {
      console.warn('⚠️ Could not fetch bundle from database:', dbError);
      res.status(503).json({
        error: 'Database unavailable',
        message: 'Database is not available. Please try again later.'
      });
      return;
    }

    if (!bundle) {
      res.status(404).json({
        error: 'Bundle not found',
        message: 'Project bundle not found'
      });
      return;
    }

    // Check ownership (disabled for hackathon)
    // if (bundle.user_id !== '00000000-0000-0000-0000-000000000001') {
    //   res.status(403).json({
    //     error: 'Access denied',
    //     message: 'You do not have access to this bundle'
    //   });
    //   return;
    // }

    res.status(200).json(bundle);
    
  } catch (error) {
    console.error('Get bundle error:', error);
    res.status(500).json({
      error: 'Failed to get bundle',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /project/bundles/:id/tree
 * 프로젝트 번들의 파일 트리 구조 조회
 */
router.get('/bundles/:id/tree', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { path: treePath } = req.query;

    if (!id) {
      res.status(400).json({
        error: 'Bundle ID required',
        message: 'Bundle ID is required in the URL parameters'
      });
      return;
    }

    let bundle;
    try {
      bundle = await ProjectBundleModel.findById(id);
    } catch (dbError) {
      console.warn('⚠️ Could not fetch bundle from database:', dbError);
      res.status(503).json({
        error: 'Database unavailable',
        message: 'Database is not available. Please try again later.'
      });
      return;
    }

    if (!bundle) {
      res.status(404).json({
        error: 'Bundle not found',
        message: 'Project bundle not found'
      });
      return;
    }

    if (!bundle.file_tree) {
      res.status(404).json({
        error: 'File tree not available',
        message: 'File tree not generated for this bundle'
      });
      return;
    }

    // If no specific path requested, return full tree
    if (!treePath || treePath === '' || treePath === '/') {
      res.status(200).json({
        tree: bundle.file_tree,
        project_type: bundle.project_type,
        total_files: bundle.total_files
      });
      return;
    }

    // Navigate to specific path in tree
    const pathParts = (treePath as string).split('/').filter(part => part.length > 0);
    let currentNode = bundle.file_tree;

    for (const part of pathParts) {
      if (currentNode.type !== 'directory' || !currentNode.children || !currentNode.children[part]) {
        res.status(404).json({
          error: 'Path not found',
          message: `Path ${treePath} not found in project`
        });
        return;
      }
      currentNode = currentNode.children[part];
    }

    res.status(200).json({
      node: currentNode,
      path: treePath
    });

  } catch (error) {
    console.error('Get file tree error:', error);
    res.status(500).json({
      error: 'Failed to get file tree',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /project/bundles/:id/files/*
 * 프로젝트 번들에서 파일 내용 조회
 */
router.get('/bundles/:id/files/*', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filePath = req.params[0]; // This captures the wildcard path

    if (!id) {
      res.status(400).json({
        error: 'Bundle ID required',
        message: 'Bundle ID is required in the URL parameters'
      });
      return;
    }

    if (!filePath) {
      res.status(400).json({
        error: 'File path required',
        message: 'File path is required'
      });
      return;
    }

    let bundle;
    try {
      bundle = await ProjectBundleModel.findById(id);
    } catch (dbError) {
      console.warn('⚠️ Could not fetch bundle from database:', dbError);
      res.status(503).json({
        error: 'Database unavailable',
        message: 'Database is not available. Please try again later.'
      });
      return;
    }

    if (!bundle) {
      res.status(404).json({
        error: 'Bundle not found',
        message: 'Project bundle not found'
      });
      return;
    }

    // Check if file exists in tree
    if (bundle.file_tree) {
      const pathParts = filePath.split('/').filter(part => part.length > 0);
      let currentNode = bundle.file_tree;

      for (const part of pathParts) {
        if (currentNode.type !== 'directory' || !currentNode.children || !currentNode.children[part]) {
          res.status(404).json({
            error: 'File not found',
            message: `File ${filePath} not found in project`
          });
          return;
        }
        currentNode = currentNode.children[part];
      }

      if (currentNode.type !== 'file') {
        res.status(400).json({
          error: 'Path is directory',
          message: `Path ${filePath} is a directory, not a file`
        });
        return;
      }
    }

    try {
      // Extract file content from Walrus
      const fileContent = await TarExtractor.extractFileFromWalrus(bundle.cid_code, filePath);

      // Get file info from tree for MIME type
      let mimeType = 'application/octet-stream';
      if (bundle.file_tree) {
        const pathParts = filePath.split('/').filter(part => part.length > 0);
        let currentNode = bundle.file_tree;

        for (const part of pathParts) {
          if (currentNode.children && currentNode.children[part]) {
            currentNode = currentNode.children[part];
          }
        }

        if (currentNode.type === 'file' && currentNode.mimeType) {
          mimeType = currentNode.mimeType;
        }
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileContent.length);
      res.setHeader('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);

      // Send file content
      res.status(200).send(fileContent);

    } catch (extractError) {
      console.error('File extraction error:', extractError);

      if (extractError instanceof Error && extractError.message.includes('not found')) {
        res.status(404).json({
          error: 'File not found in archive',
          message: `File ${filePath} not found in stored archive`
        });
        return;
      }

      res.status(500).json({
        error: 'File extraction failed',
        message: 'Failed to extract file from storage'
      });
      return;
    }

  } catch (error) {
    console.error('Get file content error:', error);
    res.status(500).json({
      error: 'Failed to get file content',
      message: 'Internal server error'
    });
  }
});

export default router;