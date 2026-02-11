/**
 * Client Data Cache Manager
 * Stores all active clients for offline browsing and self-assignment
 */

import { offlineCache } from './offlineCache';
import { apiCall } from './api';

export interface CachedClient {
  id: number;
  company_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  total_bait_stations_inside: number;
  total_bait_stations_outside: number;
  total_insect_monitors_light: number;
  total_insect_monitors_box: number;
  status: string;
  // Contact information
  contacts?: Array<{
    id: number;
    name: string;
    role?: string;
    phone?: string;
    email?: string;
    is_primary: boolean;
  }>;
}

export interface ClientCacheData {
  clients: CachedClient[];
  lastUpdated: number;
  version: number;
}

export interface Chemical {
  id: number;
  name: string;
  active_ingredients: string | null;
  usage_type: string;
  quantity_unit: string;
  safety_information: string | null;
}

export interface ChemicalsCacheData {
  chemicals: Chemical[];
  lastUpdated: number;
  version: number;
}

const CLIENT_CACHE_KEY = 'available_clients';
const ASSIGNED_CLIENTS_KEY = 'assigned_clients';
const CHEMICALS_CACHE_KEY = 'chemicals';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

class ClientCacheManager {
  /**
   * Download all active clients from server for offline use
   */
  async downloadAllClients(): Promise<{
    success: boolean;
    assignedCount: number;
    availableCount: number;
    chemicalsCount: number;
    totalClients: number;
    error?: string;
  }> {
    try {
      console.log('[ClientCache] Downloading all data for offline use...');
      
      // Use sync endpoint to get complete client data
      const response = await apiCall('/api/pco/sync/full');
      
      if (!response.success) {
        return { 
          success: false, 
          assignedCount: 0, 
          availableCount: 0, 
          chemicalsCount: 0,
          totalClients: 0,
          error: response.message || 'Failed to download data' 
        };
      }

      const clients = response.data?.clients || [];
      const chemicals = response.data?.chemicals || [];
      const assignedCount = clients.length;
      const chemicalsCount = chemicals.length;

      // Warm common caches used in PCO flows
      await Promise.allSettled([
        apiCall('/api/pco/sync/clients?include_contacts=true'),
        apiCall('/api/pco/sync/clients?include_contacts=false'),
        apiCall('/api/pco/sync/chemicals'),
        apiCall('/api/pco/chemicals/fumigation')
      ]);
      
      // Cache assigned clients
      const clientCacheData: ClientCacheData = {
        clients,
        lastUpdated: Date.now(),
        version: 1
      };
      offlineCache.set(ASSIGNED_CLIENTS_KEY, clientCacheData, CACHE_TTL);
      
      // Cache chemicals for offline report creation
      const chemicalsCacheData: ChemicalsCacheData = {
        chemicals,
        lastUpdated: Date.now(),
        version: 1
      };
      offlineCache.set(CHEMICALS_CACHE_KEY, chemicalsCacheData, CACHE_TTL);
      
      console.log(`[ClientCache] Downloaded and cached ${assignedCount} assigned clients`);
      console.log(`[ClientCache] Downloaded and cached ${chemicalsCount} chemicals`);

      // DISABLED: Preload previous report data for assigned clients (used for pre-fill)
      // Will re-enable this via settings panel later
      // await this.preloadLastReportsForClients(clients);
      
      // Also download available (unassigned) clients for browsing
      const availableResult = await this.downloadAvailableClients();
      const availableCount = availableResult.count;
      const totalClients = assignedCount + availableCount;

      if (!availableResult.success) {
        return {
          success: false,
          assignedCount,
          availableCount,
          chemicalsCount,
          totalClients,
          error: 'Failed to download available clients'
        };
      }
      
      return { 
        success: true, 
        assignedCount, 
        availableCount, 
        chemicalsCount,
        totalClients
      };
    } catch (error) {
      console.error('[ClientCache] Error downloading data:', error);
      return { 
        success: false, 
        assignedCount: 0,
        availableCount: 0,
        chemicalsCount: 0,
        totalClients: 0,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Preload last report data for assigned clients to enable offline pre-fill
   * TEMPORARILY DISABLED - Will add settings toggle later
   */
  /* DISABLED FOR NOW
  private async preloadLastReportsForClients(
    clients: Array<{ id: number; company_name?: string }>
  ): Promise<void> {
    if (!clients.length) {
      return;
    }

    const BATCH_SIZE = 3;
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (client) => {
          const endpoint = `/api/pco/reports/last-for-client/${client.id}`;
          try {
            const response = await apiCall(endpoint);
            if (response?.success) {
              console.log(
                `[ClientCache] Cached last report for client ${client.id} ${client.company_name ? `(${client.company_name})` : ''}`
              );
            }
          } catch (error) {
            // Missing previous report data is expected for some clients
          }
        })
      );

      if (i + BATCH_SIZE < clients.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  */

  /**
   * Download available clients for self-assignment browsing
   */
  async downloadAvailableClients(): Promise<{ success: boolean; count: number }> {
    try {
      console.log('[ClientCache] Downloading available clients for browsing...');
      
      // Get all available clients (paginated, but fetch all)
      const allClients: any[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 10) { // Safety limit: max 10 pages (250 clients)
        const response = await apiCall(`/api/pco/clients/available?page=${page}&limit=25`);
        
        if (response.success && response.data?.clients) {
          allClients.push(...response.data.clients);
          hasMore = response.data.pagination?.has_next || false;
          page++;
        } else {
          hasMore = false;
        }
        
        // Small delay to avoid overwhelming server
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const cacheData: ClientCacheData = {
        clients: allClients,
        lastUpdated: Date.now(),
        version: 1
      };
      
      offlineCache.set(CLIENT_CACHE_KEY, cacheData, CACHE_TTL);
      
      console.log(`[ClientCache] Downloaded and cached ${allClients.length} available clients`);
      
      return { success: true, count: allClients.length };
    } catch (error) {
      console.error('[ClientCache] Error downloading available clients:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Get available clients from cache (for offline browsing)
   */
  getAvailableClients(searchQuery?: string): CachedClient[] {
    const cached = offlineCache.get<ClientCacheData>(CLIENT_CACHE_KEY);
    
    if (!cached) {
      console.log('[ClientCache] No cached available clients found');
      return [];
    }

    let clients = cached.clients;
    
    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      clients = clients.filter(client =>
        client.company_name.toLowerCase().includes(query) ||
        client.city.toLowerCase().includes(query) ||
        client.address_line1.toLowerCase().includes(query)
      );
    }
    
    return clients;
  }

  /**
   * Get assigned clients from cache (for offline schedule viewing)
   */
  getAssignedClients(): CachedClient[] {
    const cached = offlineCache.get<ClientCacheData>(ASSIGNED_CLIENTS_KEY);
    
    if (!cached) {
      console.log('[ClientCache] No cached assigned clients found');
      return [];
    }

    return cached.clients;
  }

  /**
   * Check if client cache exists and is valid
   */
  hasAvailableClientsCache(): boolean {
    return offlineCache.has(CLIENT_CACHE_KEY);
  }

  /**
   * Check if assigned clients cache exists
   */
  hasAssignedClientsCache(): boolean {
    return offlineCache.has(ASSIGNED_CLIENTS_KEY);
  }

  /**
   * Get cache age in milliseconds
   */
  getCacheAge(): number | null {
    const cached = offlineCache.get<ClientCacheData>(CLIENT_CACHE_KEY);
    if (!cached) return null;
    return Date.now() - cached.lastUpdated;
  }

  /**
   * Check if cache needs refresh (older than 24 hours while online)
   */
  shouldRefresh(): boolean {
    const age = this.getCacheAge();
    if (age === null) return true; // No cache
    
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return age > twentyFourHours;
  }

  /**
   * Remove a client from available cache (after self-assignment)
   */
  removeFromAvailableCache(clientId: number): void {
    const cached = offlineCache.get<ClientCacheData>(CLIENT_CACHE_KEY);
    
    if (cached) {
      cached.clients = cached.clients.filter(c => c.id !== clientId);
      offlineCache.set(CLIENT_CACHE_KEY, cached, CACHE_TTL);
      console.log(`[ClientCache] Removed client ${clientId} from available cache`);
    }
  }

  /**
   * Add client to assigned cache (after self-assignment)
   */
  addToAssignedCache(client: CachedClient): void {
    const cached = offlineCache.get<ClientCacheData>(ASSIGNED_CLIENTS_KEY);
    
    if (cached) {
      // Check if already exists
      const exists = cached.clients.some(c => c.id === client.id);
      if (!exists) {
        cached.clients.push(client);
        offlineCache.set(ASSIGNED_CLIENTS_KEY, cached, CACHE_TTL);
        console.log(`[ClientCache] Added client ${client.id} to assigned cache`);
      }
    }
  }

  /**
   * Get cached chemicals for offline report creation
   */
  getChemicals(): Chemical[] {
    const cached = offlineCache.get<ChemicalsCacheData>(CHEMICALS_CACHE_KEY);
    return cached?.chemicals || [];
  }

  /**
   * Clear all client caches
   */
  clearCache(): void {
    offlineCache.remove(CLIENT_CACHE_KEY);
    offlineCache.remove(ASSIGNED_CLIENTS_KEY);
    offlineCache.remove(CHEMICALS_CACHE_KEY);
    console.log('[ClientCache] All client caches cleared');
  }

  /**
   * Get cache stats
   */
  getStats(): {
    availableClients: number;
    assignedClients: number;
    chemicals: number;
    lastUpdated: Date | null;
    cacheAge: string | null;
  } {
    const availableCached = offlineCache.get<ClientCacheData>(CLIENT_CACHE_KEY);
    const assignedCached = offlineCache.get<ClientCacheData>(ASSIGNED_CLIENTS_KEY);
    const chemicalsCached = offlineCache.get<ChemicalsCacheData>(CHEMICALS_CACHE_KEY);
    
    const lastUpdated = availableCached?.lastUpdated || assignedCached?.lastUpdated;
    const age = this.getCacheAge();
    
    return {
      availableClients: availableCached?.clients.length || 0,
      assignedClients: assignedCached?.clients.length || 0,
      chemicals: chemicalsCached?.chemicals.length || 0,
      lastUpdated: lastUpdated ? new Date(lastUpdated) : null,
      cacheAge: age ? this.formatAge(age) : null
    };
  }

  /**
   * Format cache age for display
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }
}

// Singleton instance
export const clientCache = new ClientCacheManager();

export default clientCache;
