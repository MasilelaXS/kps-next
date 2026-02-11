/**
 * Service Worker Registration & Management
 * Handles registration, updates, and cleanup with version awareness
 */

export interface ServiceWorkerStatus {
  registered: boolean;
  version: string | null;
  updateAvailable: boolean;
  installing: boolean;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Set<(status: ServiceWorkerStatus) => void> = new Set();

  /**
   * Register service worker
   */
  async register(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[SW] Service Worker not supported');
      return;
    }

    try {
      // Inject current version into service worker
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
      
      // Fetch service worker template and replace version
      const swResponse = await fetch('/service-worker.js');
      const swCode = await swResponse.text();
      const versionedSW = swCode.replace('{{VERSION}}', appVersion);
      
      // Create a blob with the versioned service worker
      const blob = new Blob([versionedSW], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      
      // Register the service worker
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      console.log('[SW] Registered successfully with version:', appVersion);

      // Clean up blob URL
      URL.revokeObjectURL(swUrl);

      // Setup update listeners
      this.setupUpdateListeners();

      // Check for updates periodically (every 30 minutes)
      setInterval(() => {
        this.checkForUpdates();
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  }

  /**
   * Setup listeners for service worker updates
   */
  private setupUpdateListeners(): void {
    if (!this.registration) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      console.log('[SW] Update found, installing new version...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] New version available');
          this.notifyListeners();
        }
      });
    });

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed, new service worker active');
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
  }

  /**
   * Handle messages from service worker
   */
  private handleMessage(data: any): void {
    if (data.type === 'SYNC_QUEUE') {
      // Trigger offline queue sync
      window.dispatchEvent(new CustomEvent('sw-sync-queue'));
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('[SW] Checked for updates');
    } catch (error) {
      console.error('[SW] Update check failed:', error);
    }
  }

  /**
   * Get current service worker status
   */
  async getStatus(): Promise<ServiceWorkerStatus> {
    if (!this.registration) {
      return {
        registered: false,
        version: null,
        updateAvailable: false,
        installing: false
      };
    }

    const updateAvailable = !!this.registration.waiting;
    const installing = !!this.registration.installing;

    // Get version from service worker
    let version: string | null = null;
    try {
      if (navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        const versionPromise = new Promise<string>((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data.version || 'unknown');
          };
        });

        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );

        version = await Promise.race([
          versionPromise,
          new Promise<string>((resolve) => setTimeout(() => resolve('unknown'), 1000))
        ]);
      }
    } catch (error) {
      console.error('[SW] Failed to get version:', error);
    }

    return {
      registered: true,
      version,
      updateAvailable,
      installing
    };
  }

  /**
   * Activate waiting service worker
   */
  async activateUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      console.log('[SW] No waiting service worker to activate');
      return;
    }

    // Send skip waiting message
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Wait for controller change
    return new Promise((resolve) => {
      const handleControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    });
  }

  /**
   * Unregister service worker (for version updates)
   */
  async unregister(): Promise<void> {
    if (!this.registration) return;

    try {
      const success = await this.registration.unregister();
      if (success) {
        console.log('[SW] Unregistered successfully');
        this.registration = null;
      }
    } catch (error) {
      console.error('[SW] Unregister failed:', error);
    }
  }

  /**
   * Clear all service worker caches
   */
  async clearCaches(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.filter(name => name.startsWith('kps-')).map(name => caches.delete(name))
      );
      console.log('[SW] Cleared all caches');
    } catch (error) {
      console.error('[SW] Cache clear failed:', error);
    }
  }

  /**
   * Request background sync
   */
  async requestSync(tag: string = 'sync-offline-queue'): Promise<void> {
    if (!this.registration) {
      console.log('[SW] No registration available');
      return;
    }

    try {
      // Check if background sync is supported
      if ('sync' in this.registration) {
        await (this.registration as any).sync.register(tag);
        console.log('[SW] Background sync requested:', tag);
      } else {
        console.log('[SW] Background sync not supported');
      }
    } catch (error) {
      console.error('[SW] Background sync request failed:', error);
    }
  }

  /**
   * Add status change listener
   */
  addListener(callback: (status: ServiceWorkerStatus) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove status change listener
   */
  removeListener(callback: (status: ServiceWorkerStatus) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach(listener => listener(status));
    
    // Dispatch custom event for UI components
    if (typeof window !== 'undefined' && status.updateAvailable) {
      window.dispatchEvent(new CustomEvent('serviceWorkerUpdate', { detail: status }));
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.listeners.clear();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Auto-register on load (client-side only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    serviceWorkerManager.register();
  });
}
