import * as tarStream from 'tar-stream';
import * as zlib from 'zlib';
import { Readable } from 'stream';
import { WalrusSDKService } from '../services/walrusSDKService.js';
import { ServiceError } from '../types/index.js';

export class TarExtractor {
  /**
   * Extract a specific file from a tar.gz archive stored in Walrus
   */
  static async extractFileFromWalrus(cid: string, targetFilePath: string): Promise<Buffer> {
    try {
      console.log(`📁 Extracting file "${targetFilePath}" from Walrus CID: ${cid}`);

      // Download the tar.gz from Walrus using SDK
      const walrusSDKService = new WalrusSDKService();
      const bundleData = await walrusSDKService.downloadBundle(cid);

      return new Promise((resolve, reject) => {
        const extract = tarStream.extract();
        const gunzip = zlib.createGunzip();
        let fileFound = false;

        extract.on('entry', (header, stream, next) => {
          // Check if this is the file we're looking for
          if (header.name === targetFilePath || header.name.endsWith(`/${targetFilePath}`)) {
            console.log(`✅ Found target file: ${header.name}`);
            fileFound = true;

            // Collect the file data
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => {
              chunks.push(chunk);
            });

            stream.on('end', () => {
              const fileContent = Buffer.concat(chunks);
              console.log(`📄 Extracted ${fileContent.length} bytes`);
              resolve(fileContent);
            });

            stream.on('error', (err) => {
              reject(new ServiceError(`Error reading file ${targetFilePath}: ${err.message}`, 500));
            });
          } else {
            // Skip this file
            stream.resume();
          }

          next();
        });

        extract.on('finish', () => {
          if (!fileFound) {
            reject(new ServiceError(`File ${targetFilePath} not found in archive`, 404));
          }
        });

        extract.on('error', (err) => {
          reject(new ServiceError(`Tar extraction failed: ${err.message}`, 500));
        });

        // Create a readable stream from the buffer and pipe through gunzip to tar extract
        const readable = new Readable();
        readable.push(bundleData);
        readable.push(null); // End the stream

        readable.pipe(gunzip).pipe(extract);
      });

    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(`File extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * List all files in a tar.gz archive
   */
  static async listFilesFromWalrus(cid: string): Promise<string[]> {
    try {
      console.log(`📋 Listing files from Walrus CID: ${cid}`);

      // Download the tar.gz from Walrus using SDK
      const walrusSDKService = new WalrusSDKService();
      const bundleData = await walrusSDKService.downloadBundle(cid);

      return new Promise((resolve, reject) => {
        const extract = tarStream.extract();
        const gunzip = zlib.createGunzip();
        const fileList: string[] = [];

        extract.on('entry', (header, stream, next) => {
          // Skip directories
          if (header.type !== 'file') {
            stream.resume();
            next();
            return;
          }

          fileList.push(header.name);
          stream.resume(); // Skip file content, we only want the list
          next();
        });

        extract.on('finish', () => {
          console.log(`✅ Found ${fileList.length} files in archive`);
          resolve(fileList);
        });

        extract.on('error', (err) => {
          reject(new ServiceError(`Tar listing failed: ${err.message}`, 500));
        });

        // Create a readable stream from the buffer and pipe through gunzip to tar extract
        const readable = new Readable();
        readable.push(bundleData);
        readable.push(null); // End the stream

        readable.pipe(gunzip).pipe(extract);
      });

    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(`File listing error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Get file metadata without downloading content
   */
  static async getFileMetadata(cid: string, targetFilePath: string): Promise<{
    name: string;
    size: number;
    type: string;
    mode: number;
  } | null> {
    try {
      console.log(`📊 Getting metadata for "${targetFilePath}" from Walrus CID: ${cid}`);

      // Download the tar.gz from Walrus using SDK
      const walrusSDKService = new WalrusSDKService();
      const bundleData = await walrusSDKService.downloadBundle(cid);

      return new Promise((resolve, reject) => {
        const extract = tarStream.extract();
        const gunzip = zlib.createGunzip();
        let fileFound = false;

        extract.on('entry', (header, stream, next) => {
          // Check if this is the file we're looking for
          if (header.name === targetFilePath || header.name.endsWith(`/${targetFilePath}`)) {
            console.log(`✅ Found target file metadata: ${header.name}`);
            fileFound = true;

            resolve({
              name: header.name,
              size: header.size || 0,
              type: header.type as string,
              mode: header.mode || 0
            });

            stream.resume(); // Skip file content
          } else {
            stream.resume(); // Skip this file
          }

          next();
        });

        extract.on('finish', () => {
          if (!fileFound) {
            resolve(null);
          }
        });

        extract.on('error', (err) => {
          reject(new ServiceError(`Tar metadata extraction failed: ${err.message}`, 500));
        });

        // Create a readable stream from the buffer and pipe through gunzip to tar extract
        const readable = new Readable();
        readable.push(bundleData);
        readable.push(null); // End the stream

        readable.pipe(gunzip).pipe(extract);
      });

    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(`Metadata extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
}