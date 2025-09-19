import { Octokit } from '@octokit/rest';
import axios from 'axios';
import * as tar from 'tar';
import { config } from '../config/index.js';
import { ProcessedBundle, ServiceError } from '../types/index.js';
import { FileProcessor } from '../utils/fileProcessor.js';

export class GitHubService {
  private octokit: Octokit;
  
  constructor(installationId?: number) {
    // Initialize with GitHub App authentication if available
    if (config.github.appId && config.github.privateKeyPem && installationId) {
      this.octokit = new Octokit({
        auth: {
          type: 'installation',
          installationId,
          appId: config.github.appId,
          privateKey: config.github.privateKeyPem
        }
      });
    } else {
      // Fallback to no auth (for public repos)
      this.octokit = new Octokit();
    }
  }
  
  /**
   * Download and process GitHub repository
   */
  async downloadAndProcessRepo(
    owner: string,
    repo: string,
    ref: string = 'main',
    ignorePatterns: string[] = []
  ): Promise<ProcessedBundle> {
    try {
      // Get repository info to validate access
      const repoInfo = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      if (!repoInfo.data) {
        throw new ServiceError(`Repository ${owner}/${repo} not found`, 404);
      }
      
      // Download tarball
      const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
      
      const response = await axios.get(tarballUrl, {
        responseType: 'stream',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DAAS-Vader/1.0'
        },
        timeout: config.limits.requestTimeout
      });
      
      if (response.status !== 200) {
        throw new ServiceError(
          `Failed to download repository: ${response.statusText}`,
          response.status
        );
      }
      
      // Process the tarball stream
      return await this.processTarballStream(response.data, ignorePatterns);
      
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 502;
        const message = error.response?.data?.message || error.message;
        
        if (status === 404) {
          throw new ServiceError('Repository not found or not accessible', 404);
        }
        
        if (status === 403) {
          throw new ServiceError('Access denied to repository', 403);
        }
        
        throw new ServiceError(`GitHub API error: ${message}`, status);
      }
      
      throw new ServiceError(`GitHub service error: ${error instanceof Error ? error.message : 'Unknown error'}`, 502);
    }
  }
  
  /**
   * Process tarball stream and separate secrets from code
   */
  private async processTarballStream(
    tarballStream: NodeJS.ReadableStream,
    ignorePatterns: string[]
  ): Promise<ProcessedBundle> {
    return new Promise((resolve, reject) => {
      const fileProcessor = new FileProcessor(ignorePatterns);
      const secretFiles = new Map<string, Uint8Array>();
      const codeFiles = new Map<string, Uint8Array>();
      const ignored: string[] = [];
      
      const extract = tar.extract();
      
      extract.on('entry', (header, stream, next) => {
        const filePath = this.normalizeGitHubPath(header.name);
        
        // Skip directories
        if (header.type === 'directory') {
          stream.resume();
          next();
          return;
        }
        
        // Collect file data
        const chunks: Buffer[] = [];
        
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        stream.on('end', () => {
          const fileData = new Uint8Array(Buffer.concat(chunks));
          
          // Apply ignore patterns
          if (this.shouldIgnoreFile(filePath, ignorePatterns)) {
            ignored.push(filePath);
          } else if (this.isSecretFile(filePath)) {
            secretFiles.set(filePath, fileData);
          } else {
            codeFiles.set(filePath, fileData);
          }
          
          next();
        });
        
        stream.on('error', (err: any) => {
          reject(new ServiceError(`Error processing file ${filePath}: ${err.message}`, 500));
        });
      });
      
      extract.on('finish', () => {
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
      
      extract.on('error', (err) => {
        reject(new ServiceError(`Tarball extraction failed: ${err.message}`, 500));
      });
      
      // Pipe the tarball stream to the extractor
      tarballStream.pipe(extract);
    });
  }
  
  /**
   * Normalize GitHub tarball paths (remove root directory)
   */
  private normalizeGitHubPath(tarPath: string): string {
    // GitHub tarballs have a root directory like "repo-name-commit-hash/"
    const pathParts = tarPath.split('/');
    if (pathParts.length > 1) {
      return pathParts.slice(1).join('/');
    }
    return tarPath;
  }
  
  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(filePath: string, customIgnorePatterns: string[]): boolean {
    const allPatterns = [...config.defaultIgnorePatterns, ...customIgnorePatterns];
    const minimatch = require('minimatch');
    
    return allPatterns.some(pattern => 
      minimatch(filePath, pattern, { dot: true })
    );
  }
  
  /**
   * Check if file is a secret file
   */
  private isSecretFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    
    // Check if it matches .env patterns
    const isEnvFile = /^\.env(\..+)?$/.test(fileName);
    
    if (!isEnvFile) return false;
    
    // Exclude example/sample/template files
    const isExcluded = /\.(example|sample|template)$/.test(fileName);
    
    return !isExcluded;
  }
  
  /**
   * Validate file sizes
   */
  private validateFileSizes(secretFiles: Map<string, Uint8Array>, codeFiles: Map<string, Uint8Array>): void {
    // Check individual secret file sizes
    for (const [path, data] of secretFiles) {
      if (data.length > config.limits.secretFileSize) {
        throw new ServiceError(
          `Secret file ${path} exceeds limit of ${config.limits.secretFileSize} bytes`,
          413
        );
      }
    }
    
    // Check total secret bundle size
    const totalSecretSize = Array.from(secretFiles.values())
      .reduce((total, data) => total + data.length, 0);
    
    if (totalSecretSize > config.limits.secretBundleSize) {
      throw new ServiceError(
        `Total secret files size ${totalSecretSize} exceeds limit of ${config.limits.secretBundleSize} bytes`,
        413
      );
    }
    
    // Check code bundle size
    const totalCodeSize = Array.from(codeFiles.values())
      .reduce((total, data) => total + data.length, 0);
    
    if (totalCodeSize > config.limits.codeBundleSize) {
      throw new ServiceError(
        `Code bundle size ${totalCodeSize} exceeds limit of ${config.limits.codeBundleSize} bytes`,
        413
      );
    }
  }
  
  /**
   * Validate repository access
   */
  async validateRepoAccess(owner: string, repo: string): Promise<boolean> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      return response.status === 200;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get repository default branch
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      return response.data.default_branch || 'main';
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceError(`Failed to get repository info: ${errorMessage}`, 502);
    }
  }
}