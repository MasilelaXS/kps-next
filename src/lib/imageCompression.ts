/**
 * Image Compression & Optimization Utility
 * Rock-solid wrapper around browser-image-compression library
 * Optimized for report photos and signatures with proper error handling
 */

import browserImageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  fileType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

class ImageCompressionService {
  /**
   * Default compression settings optimized for report photos
   */
  private readonly DEFAULT_OPTIONS = {
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
    fileType: 'image/jpeg' as const,
    useWebWorker: true,
    maxIteration: 10
  };

  /**
   * Compress an image from a File object
   * Uses browser-image-compression for reliable, memory-efficient compression
   */
  async compressFile(
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      // Validate input
      if (!file || !(file instanceof File)) {
        throw new Error('Invalid file object');
      }

      if (!file.type.startsWith('image/')) {
        throw new Error(`Invalid file type: ${file.type}. Expected image.`);
      }

      const originalSize = file.size;

      // Prepare options for browser-image-compression
      const compressionOptions = {
        maxWidthOrHeight: options.maxWidth || options.maxHeight || this.DEFAULT_OPTIONS.maxWidthOrHeight,
        initialQuality: options.quality ?? this.DEFAULT_OPTIONS.initialQuality,
        fileType: options.fileType || this.DEFAULT_OPTIONS.fileType,
        useWebWorker: this.DEFAULT_OPTIONS.useWebWorker,
        maxIteration: this.DEFAULT_OPTIONS.maxIteration
      };

      // Compress using browser-image-compression
      const compressedFile = await browserImageCompression(file, compressionOptions);
      
      // Get dimensions
      const metadata = await this.getImageMetadata(compressedFile);

      // Convert to data URL
      const dataUrl = await this.fileToDataUrl(compressedFile);
      
      const compressedSize = compressedFile.size;
      const compressionRatio = compressedSize / originalSize;

      // If compression made file larger, use original
      const useOriginal = compressedSize >= originalSize;
      
      if (useOriginal) {
        console.warn('[ImageCompression] Compression increased size, using original');
        const originalDataUrl = await this.fileToDataUrl(file);
        const originalMetadata = await this.getImageMetadata(file);
        
        return {
          dataUrl: originalDataUrl,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          width: originalMetadata.width,
          height: originalMetadata.height
        };
      }

      return {
        dataUrl,
        originalSize,
        compressedSize,
        compressionRatio,
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('[ImageCompression] Compression failed:', error);
      throw new Error(
        `Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compress an image from a data URL
   */
  async compressDataUrl(
    dataUrl: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      // Validate data URL
      if (!dataUrl || typeof dataUrl !== 'string') {
        throw new Error('Invalid data URL');
      }

      if (!dataUrl.startsWith('data:image/')) {
        throw new Error('Invalid data URL format');
      }

      // Convert data URL to File
      const file = await this.dataUrlToFile(dataUrl, 'image.jpg');
      
      // Compress the file
      return await this.compressFile(file, options);
    } catch (error) {
      console.error('[ImageCompression] Data URL compression failed:', error);
      throw new Error(
        `Data URL compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compress a canvas element (for signatures)
   * Synchronous operation for immediate feedback
   */
  compressCanvas(
    canvas: HTMLCanvasElement,
    options: CompressionOptions = {}
  ): CompressionResult {
    try {
      // Validate canvas
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Invalid canvas element');
      }

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has zero dimensions');
      }

      const {
        maxWidth = 800,
        maxHeight = 400,
        quality = 0.9,
        fileType = 'image/png'
      } = options;

      // Calculate dimensions maintaining aspect ratio
      let width = canvas.width;
      let height = canvas.height;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      
      if (ratio < 1) {
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // Create compression canvas
      const compressCanvas = document.createElement('canvas');
      compressCanvas.width = width;
      compressCanvas.height = height;
      
      const ctx = compressCanvas.getContext('2d', { 
        alpha: fileType === 'image/png',
        willReadFrequently: false
      });

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // For JPEG, fill white background (no transparency)
      if (fileType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw original canvas onto compression canvas with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, width, height);

      // Get data URLs
      const originalDataUrl = canvas.toDataURL(fileType, 1.0);
      const compressedDataUrl = compressCanvas.toDataURL(fileType, quality);

      // Calculate sizes
      const originalSize = this.estimateDataUrlSize(originalDataUrl);
      const compressedSize = this.estimateDataUrlSize(compressedDataUrl);

      // If compression made it larger, use original
      if (compressedSize >= originalSize) {
        console.warn('[ImageCompression] Canvas compression increased size, using original');
        return {
          dataUrl: originalDataUrl,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          width: canvas.width,
          height: canvas.height
        };
      }

      return {
        dataUrl: compressedDataUrl,
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        width,
        height
      };
    } catch (error) {
      console.error('[ImageCompression] Canvas compression failed:', error);
      throw new Error(
        `Canvas compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compress signature canvas with optimized settings
   * PNG format preserves transparency, 0.9 quality for clarity
   */
  compressSignature(canvas: HTMLCanvasElement): CompressionResult {
    return this.compressCanvas(canvas, {
      maxWidth: 800,
      maxHeight: 400,
      quality: 0.9,
      fileType: 'image/png'
    });
  }

  /**
   * Compress photo with optimized settings for photos
   * JPEG format for better compression, various size presets
   */
  async compressPhoto(
    file: File,
    maxSize: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<CompressionResult> {
    const sizePresets = {
      small: { maxWidth: 800, maxHeight: 600, quality: 0.75 },
      medium: { maxWidth: 1280, maxHeight: 960, quality: 0.80 },
      large: { maxWidth: 1920, maxHeight: 1080, quality: 0.85 }
    };

    const preset = sizePresets[maxSize];
    
    return this.compressFile(file, {
      maxWidth: preset.maxWidth,
      maxHeight: preset.maxHeight,
      quality: preset.quality,
      fileType: 'image/jpeg'
    });
  }

  /**
   * Batch compress multiple images with proper error handling
   * Continues on individual failures
   */
  async compressBatch(
    files: File[],
    options: CompressionOptions = {}
  ): Promise<Array<{ success: boolean; result?: CompressionResult; error?: string; filename: string }>> {
    const results: Array<{ success: boolean; result?: CompressionResult; error?: string; filename: string }> = [];

    for (const file of files) {
      try {
        const result = await this.compressFile(file, options);
        results.push({
          success: true,
          result,
          filename: file.name
        });
      } catch (error) {
        console.error(`[ImageCompression] Failed to compress ${file.name}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          filename: file.name
        });
      }
    }

    return results;
  }

  /**
   * Helper: Convert File to data URL
   */
  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('File read timeout (30s)'));
      }, 30000);
      
      reader.onload = (e) => {
        clearTimeout(timeout);
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('File read error'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Helper: Convert data URL to File
   */
  private async dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Helper: Get image dimensions from File
   */
  private async getImageMetadata(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load timeout (30s)'));
      }, 30000);
      
      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }

  /**
   * Estimate data URL size in bytes
   */
  private estimateDataUrlSize(dataUrl: string): number {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    
    const base64Data = dataUrl.split(',')[1] || '';
    const padding = (base64Data.match(/=/g) || []).length;
    return Math.floor((base64Data.length / 4) * 3) - padding;
  }

  /**
   * Format bytes for human-readable display
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Check if compression would be beneficial
   */
  shouldCompress(dataUrl: string, thresholdKB: number = 100): boolean {
    const sizeBytes = this.estimateDataUrlSize(dataUrl);
    return sizeBytes > thresholdKB * 1024;
  }
}

// Export singleton instance
export const imageCompression = new ImageCompressionService();

// Export class for testing
export { ImageCompressionService };
