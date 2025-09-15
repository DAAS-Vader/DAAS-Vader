import * as path from 'path';
import { minimatch } from 'minimatch';
import * as tarStream from 'tar-stream';
import * as zlib from 'zlib';
import * as yauzl from 'yauzl';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { ProcessedBundle, ProcessedBundleResult, FileInfo, FileTreeNode, ValidationError } from '../types/index.js';

const pipelineAsync = promisify(pipeline);

// Secret file patterns (following PRD specs)
const SECRET_PATTERNS = [
  /^\.env(\..+)?$/,  // .env, .env.local, .env.production, etc.
];

// Exclude these from secrets even if they match patterns
const SECRET_EXCLUDE_PATTERNS = [
  /\.example$/,
  /\.sample$/,
  /\.template$/
];

export class FileProcessor {
  private ignorePatterns: string[];
  
  constructor(customIgnorePatterns: string[] = []) {
    this.ignorePatterns = [
      ...config.defaultIgnorePatterns,
      ...customIgnorePatterns
    ];
  }
  
  /**
   * Check if a file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    console.log(`🔍 Checking ignore patterns for: ${filePath} - DISABLED FOR HACKATHON`);
    // Temporarily disable all ignore patterns for hackathon
    return false;
  }
  
  /**
   * Check if a file is a secret file
   */
  private isSecretFile(filename: string): boolean {
    const baseName = path.basename(filename);
    
    // Check if it matches secret patterns
    const isSecret = SECRET_PATTERNS.some(pattern => pattern.test(baseName));
    
    if (!isSecret) return false;
    
    // Exclude example/sample/template files
    const isExcluded = SECRET_EXCLUDE_PATTERNS.some(pattern => 
      pattern.test(baseName)
    );
    
    return !isExcluded;
  }
  
  /**
   * Calculate file hash
   */
  private calculateHash(data: Uint8Array): string {
    return createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Validate file sizes
   */
  private validateFileSizes(secretFiles: Map<string, Uint8Array>, codeFiles: Map<string, Uint8Array>): void {
    // Check individual secret file sizes
    for (const [path, data] of secretFiles) {
      if (data.length > config.limits.secretFileSize) {
        throw new ValidationError(
          `Secret file ${path} exceeds limit of ${config.limits.secretFileSize} bytes`
        );
      }
    }
    
    // Check total secret bundle size
    const totalSecretSize = Array.from(secretFiles.values())
      .reduce((total, data) => total + data.length, 0);
    
    if (totalSecretSize > config.limits.secretBundleSize) {
      throw new ValidationError(
        `Total secret files size ${totalSecretSize} exceeds limit of ${config.limits.secretBundleSize} bytes`
      );
    }
    
    // Check code bundle size
    const totalCodeSize = Array.from(codeFiles.values())
      .reduce((total, data) => total + data.length, 0);
    
    if (totalCodeSize > config.limits.codeBundleSize) {
      throw new ValidationError(
        `Code bundle size ${totalCodeSize} exceeds limit of ${config.limits.codeBundleSize} bytes`
      );
    }
  }
  
  /**
   * Process directory upload (multiple files)
   */
  async processDirectoryUpload(files: Express.Multer.File[]): Promise<ProcessedBundle> {
    console.log(`📁 Processing ${files.length} files:`, files.map(f => f.originalname));

    const secretFiles = new Map<string, Uint8Array>();
    const codeFiles = new Map<string, Uint8Array>();
    const ignored: string[] = [];

    for (const file of files) {
      const relativePath = file.originalname;
      console.log(`📄 Processing file: ${relativePath}`);

      // Check if file should be ignored
      if (this.shouldIgnore(relativePath)) {
        console.log(`🚫 Ignoring file: ${relativePath}`);
        ignored.push(relativePath);
        continue;
      }
      
      const fileData = new Uint8Array(file.buffer);
      
      // Separate secrets from code
      if (this.isSecretFile(relativePath)) {
        console.log(`🔐 Secret file: ${relativePath}`);
        secretFiles.set(relativePath, fileData);
      } else {
        console.log(`📝 Code file: ${relativePath}`);
        codeFiles.set(relativePath, fileData);
      }
    }

    console.log(`✅ Final counts - Code: ${codeFiles.size}, Secrets: ${secretFiles.size}, Ignored: ${ignored.length}`);

    // Validate file sizes
    this.validateFileSizes(secretFiles, codeFiles);
    
    return {
      secretFiles,
      codeFiles,
      ignored
    };
  }
  
  /**
   * Process ZIP upload
   */
  async processZipUpload(zipBuffer: Buffer): Promise<ProcessedBundle> {
    return new Promise((resolve, reject) => {
      const secretFiles = new Map<string, Uint8Array>();
      const codeFiles = new Map<string, Uint8Array>();
      const ignored: string[] = [];
      
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          const relativePath = entry.fileName;
          
          // Skip directories
          if (relativePath.endsWith('/')) {
            zipfile.readEntry();
            return;
          }
          
          // Check if file should be ignored
          if (this.shouldIgnore(relativePath)) {
            ignored.push(relativePath);
            zipfile.readEntry();
            return;
          }
          
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const chunks: Buffer[] = [];
            
            readStream.on('data', (chunk) => {
              chunks.push(chunk);
            });
            
            readStream.on('end', () => {
              const fileData = new Uint8Array(Buffer.concat(chunks));
              
              // Separate secrets from code
              if (this.isSecretFile(relativePath)) {
                secretFiles.set(relativePath, fileData);
              } else {
                codeFiles.set(relativePath, fileData);
              }
              
              zipfile.readEntry();
            });
            
            readStream.on('error', reject);
          });
        });
        
        zipfile.on('end', () => {
          try {
            // Validate file sizes
            this.validateFileSizes(secretFiles, codeFiles);
            
            resolve({
              secretFiles,
              codeFiles,
              ignored
            });
          } catch (error) {
            reject(error);
          }
        });
        
        zipfile.on('error', reject);
      });
    });
  }
  
  /**
   * Create tar.gz bundle from files
   */
  async createTarBundle(files: Map<string, Uint8Array>): Promise<Buffer> {
    // Check if files map is empty
    if (files.size === 0) {
      throw new Error('No files to create archive from');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Create pack stream and gzip stream
      const pack = tarStream.pack();
      const gzip = zlib.createGzip();

      // Pipe pack through gzip
      pack.pipe(gzip);

      gzip.on('data', (chunk) => {
        chunks.push(chunk);
      });

      gzip.on('error', reject);
      pack.on('error', reject);

      gzip.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Add each file to the tar pack
      for (const [filePath, fileData] of files) {
        const entry = pack.entry({
          name: filePath,
          size: fileData.length
        });

        entry.write(Buffer.from(fileData));
        entry.end();
      }

      // Finalize the pack
      pack.finalize();
    });
  }
  
  /**
   * Generate file info array for response
   */
  generateFileInfo(files: Map<string, Uint8Array>): FileInfo[] {
    return Array.from(files.entries()).map(([path, data]) => ({
      path,
      size: data.length,
      sha256: this.calculateHash(data)
    }));
  }

  /**
   * Generate file tree from files map
   */
  generateFileTree(files: Map<string, Uint8Array>): FileTreeNode {
    const root: FileTreeNode = {
      name: '/',
      type: 'directory',
      path: '/',
      children: {}
    };

    for (const [filePath, fileData] of files) {
      this.addToFileTree(root, filePath, {
        size: fileData.length,
        mimeType: this.getMimeType(filePath)
      });
    }

    return root;
  }

  /**
   * Add file to tree structure
   */
  private addToFileTree(root: FileTreeNode, filePath: string, fileInfo: { size: number; mimeType: string }): void {
    // Normalize path and split into parts
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const parts = normalizedPath.split('/').filter(part => part.length > 0);

    let current = root;
    let currentPath = '/';

    // Navigate/create directories
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

      if (!current.children) {
        current.children = {};
      }

      if (!current.children![part]) {
        current.children![part] = {
          name: part,
          type: 'directory',
          path: currentPath,
          children: {}
        };
      }

      current = current.children![part];
    }

    // Add the file
    const fileName = parts[parts.length - 1];
    if (!fileName) return; // Skip if no filename

    const fullPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;

    if (!current.children) {
      current.children = {};
    }

    current.children![fileName] = {
      name: fileName,
      type: 'file',
      path: fullPath,
      size: fileInfo.size,
      mimeType: fileInfo.mimeType
    };
  }

  /**
   * Detect project type based on file tree
   */
  detectProjectType(fileTree: FileTreeNode): string {
    const hasDir = (name: string) => fileTree.children?.[name]?.type === 'directory';
    const hasFile = (name: string) => fileTree.children?.[name]?.type === 'file';

    // Check for specific framework patterns
    if (hasDir('functions') && hasFile('vercel.json')) return 'vercel';
    if (hasDir('netlify') && hasFile('netlify.toml')) return 'netlify';
    if (hasDir('build') && hasFile('package.json')) return 'static-spa';
    if (hasFile('Dockerfile')) return 'docker';
    if (hasFile('package.json') && hasDir('src')) return 'nodejs';
    if (hasFile('index.html') && hasDir('assets')) return 'static-html';
    if (hasFile('package.json')) return 'npm-package';

    return 'static';
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Count total files in file tree
   */
  private countFiles(node: FileTreeNode): number {
    if (node.type === 'file') return 1;

    let count = 0;
    if (node.children) {
      for (const child of Object.values(node.children)) {
        count += this.countFiles(child);
      }
    }
    return count;
  }

  /**
   * Enhanced process methods with file tree generation
   */
  async processDirectoryUploadWithTree(files: Express.Multer.File[]): Promise<ProcessedBundleResult> {
    const processedBundle = await this.processDirectoryUpload(files);
    const allFiles = new Map([...processedBundle.secretFiles, ...processedBundle.codeFiles]);

    const fileTree = this.generateFileTree(allFiles);
    const projectType = this.detectProjectType(fileTree);
    const totalFiles = this.countFiles(fileTree);

    return {
      ...processedBundle,
      fileTree,
      projectType,
      totalFiles
    };
  }

  async processZipUploadWithTree(zipBuffer: Buffer): Promise<ProcessedBundleResult> {
    const processedBundle = await this.processZipUpload(zipBuffer);
    const allFiles = new Map([...processedBundle.secretFiles, ...processedBundle.codeFiles]);

    const fileTree = this.generateFileTree(allFiles);
    const projectType = this.detectProjectType(fileTree);
    const totalFiles = this.countFiles(fileTree);

    return {
      ...processedBundle,
      fileTree,
      projectType,
      totalFiles
    };
  }
}