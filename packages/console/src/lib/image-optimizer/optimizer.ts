/**
 * Image Optimizer
 * Main class that manages the Web Worker and provides the public API
 */

import type {
  OptimizeOptions,
  OptimizedResult,
  PreviewResult,
  WorkerResponse,
} from "./types";
import { fileToDataUrl } from "./utils";

type PendingRequest = {
  resolve: (result: OptimizedResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
};

/**
 * ImageOptimizer manages a Web Worker for image processing
 */
export class ImageOptimizer {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();

  /**
   * Get or create the Web Worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      // Vite handles ?worker imports
      this.worker = new Worker(
        new URL("./optimizer.worker.ts", import.meta.url),
        { type: "module" }
      );

      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    }
    return this.worker;
  }

  /**
   * Handle messages from the worker
   */
  private handleMessage(e: MessageEvent<WorkerResponse>): void {
    const { id, result, error, progress } = e.data;
    const pending = this.pending.get(id);

    if (!pending) return;

    // Progress update
    if (progress !== undefined && progress < 100 && pending.onProgress) {
      pending.onProgress(progress);
      return;
    }

    // Error
    if (error) {
      pending.reject(new Error(error));
      this.pending.delete(id);
      return;
    }

    // Success
    if (result) {
      pending.resolve(result);
      this.pending.delete(id);
    }
  }

  /**
   * Handle worker errors
   */
  private handleError(e: ErrorEvent): void {
    console.error("Image optimizer worker error:", e);

    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      pending.reject(new Error(`Worker error: ${e.message}`));
      this.pending.delete(id);
    }

    // Terminate the broken worker
    this.terminate();
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Optimize an image file
   * @param file - Image file to optimize
   * @param options - Optimization options
   * @param onProgress - Optional progress callback (0-100)
   * @returns Promise resolving to optimized result
   */
  async optimize(
    file: File,
    options: OptimizeOptions,
    onProgress?: (progress: number) => void
  ): Promise<OptimizedResult> {
    const id = this.generateId();

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });

      this.getWorker().postMessage({
        id,
        type: "optimize",
        file,
        options,
      });
    });
  }

  /**
   * Preview optimization result with before/after comparison
   */
  async preview(
    file: File,
    options: OptimizeOptions,
    onProgress?: (progress: number) => void
  ): Promise<PreviewResult> {
    // Get original data URL first
    const originalDataUrl = await fileToDataUrl(file);

    // Run optimization
    const result = await this.optimize(file, options, onProgress);

    return {
      ...result,
      originalDataUrl,
    };
  }

  /**
   * Cancel all pending operations
   */
  cancelAll(): void {
    for (const [id, pending] of this.pending) {
      pending.reject(new Error("Operation cancelled"));
      this.pending.delete(id);
    }
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    this.cancelAll();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Check if worker is active
   */
  get isActive(): boolean {
    return this.worker !== null;
  }

  /**
   * Get count of pending operations
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}

/**
 * Singleton optimizer instance
 * Use this for most cases to share the worker
 */
export const imageOptimizer = new ImageOptimizer();

/**
 * Convenience function to optimize an image
 */
export async function optimizeImage(
  file: File,
  options: OptimizeOptions,
  onProgress?: (progress: number) => void
): Promise<OptimizedResult> {
  return imageOptimizer.optimize(file, options, onProgress);
}

/**
 * Convenience function to preview an optimization
 */
export async function previewOptimization(
  file: File,
  options: OptimizeOptions,
  onProgress?: (progress: number) => void
): Promise<PreviewResult> {
  return imageOptimizer.preview(file, options, onProgress);
}
