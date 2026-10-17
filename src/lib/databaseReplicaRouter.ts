import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Configuration from environment
const rawPrimaryUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const envReplicaUrl = (import.meta.env.VITE_SUPABASE_READ_REPLICA_URL || '').trim();

// Local storage key for dynamic runtime replica testing in Admin Dashboard
const RUNTIME_REPLICA_STORAGE_KEY = 'cityzen_runtime_replica_url';

export const isConfigured = !!(rawPrimaryUrl && anonKey);

// Normalize URL (strip trailing slashes)
const normalizeUrl = (u: string) => u.replace(/\/+$/, '');
const primaryUrl = normalizeUrl(rawPrimaryUrl);

// Retrieve active replica URL (custom runtime override takes precedence if set, otherwise env)
export function getActiveReplicaUrls(): string[] {
  let customUrl = '';
  try {
    customUrl = localStorage.getItem(RUNTIME_REPLICA_STORAGE_KEY) || '';
  } catch {
    // localStorage not accessible
  }

  const source = customUrl || envReplicaUrl;
  if (!source) return [];

  return source
    .split(',')
    .map((u: string) => normalizeUrl(u.trim()))
    .filter((u: string) => u && u !== primaryUrl);
}

export function setCustomReplicaUrl(url: string | null): void {
  try {
    if (!url || !url.trim() || normalizeUrl(url.trim()) === primaryUrl) {
      localStorage.removeItem(RUNTIME_REPLICA_STORAGE_KEY);
    } else {
      localStorage.setItem(RUNTIME_REPLICA_STORAGE_KEY, normalizeUrl(url.trim()));
    }
    reinitializeReplicaPool();
  } catch (e) {
    console.warn('Could not persist custom replica URL:', e);
  }
}

export function getCustomReplicaUrl(): string | null {
  try {
    return localStorage.getItem(RUNTIME_REPLICA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export type QueryNode = 'PRIMARY' | 'REPLICA' | 'PRIMARY_FALLBACK';
export type QueryOperationType = 'READ' | 'WRITE';

export interface QueryLogEntry {
  id: string;
  timestamp: string;
  type: QueryOperationType;
  table: string;
  node: QueryNode;
  url: string;
  latencyMs: number;
  status: 'SUCCESS' | 'FAILOVER' | 'ERROR';
  errorMessage?: string;
}

export interface ClusterNodeInfo {
  id: string;
  role: 'primary' | 'replica';
  url: string;
  isConfigured: boolean;
  isHealthy: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  queryCount: number;
  failCount: number;
}

export interface ReplicaClusterStats {
  isReplicaDedicated: boolean;
  primaryNode: ClusterNodeInfo;
  replicaNodes: ClusterNodeInfo[];
  totalQueries: number;
  primaryWrites: number;
  replicaReads: number;
  primaryFallbackReads: number;
  failoverCount: number;
  avgLatencyMs: number;
  recentQueries: QueryLogEntry[];
}

// Global runtime cluster metrics
const clusterMetrics = {
  totalQueries: 0,
  primaryWrites: 0,
  replicaReads: 0,
  primaryFallbackReads: 0,
  failoverCount: 0,
  totalLatencyMs: 0,
  primaryQueriesCount: 0,
  replicaQueriesCount: 0,
  primaryFailuresCount: 0,
  recentQueries: [] as QueryLogEntry[],
};

function recordQueryLog(entry: Omit<QueryLogEntry, 'id' | 'timestamp'>) {
  const log: QueryLogEntry = {
    id: 'qry_' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    ...entry,
  };
  clusterMetrics.recentQueries.unshift(log);
  if (clusterMetrics.recentQueries.length > 30) {
    clusterMetrics.recentQueries.pop();
  }
}

// Node Health Tracker & Circuit Breaker
interface ReplicaHealthState {
  url: string;
  client: SupabaseClient;
  consecutiveFailures: number;
  isHealthy: boolean;
  lastFailureTime: number;
  lastLatencyMs: number | null;
  queryCount: number;
  failCount: number;
}

// Initialize Primary Leader Client
export const primaryClient: SupabaseClient = isConfigured
  ? createClient(primaryUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as any);

// Replica Client Pool
let replicaPool: ReplicaHealthState[] = [];
let roundRobinIndex = 0;

function createReplicaClient(replicaUrl: string): SupabaseClient {
  return createClient(replicaUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init = {}) => {
        try {
          // Forward active authenticated user JWT to replica so RLS policies work seamlessly
          if (primaryClient?.auth) {
            const sessionRes = await primaryClient.auth.getSession();
            const token = sessionRes?.data?.session?.access_token;
            if (token) {
              const headers = new Headers(init.headers || {});
              headers.set('Authorization', `Bearer ${token}`);
              headers.set('apikey', anonKey);
              init.headers = headers;
            }
          }
        } catch {
          // Session fetch failed, fallback to anon headers
        }
        return fetch(input, init);
      },
    },
  });
}

function reinitializeReplicaPool() {
  if (!isConfigured) {
    replicaPool = [];
    return;
  }

  const urls = getActiveReplicaUrls();
  replicaPool = urls.map((url) => {
    // Preserve existing health state if same URL was already tracked
    const existing = replicaPool.find((p) => p.url === url);
    return (
      existing || {
        url,
        client: createReplicaClient(url),
        consecutiveFailures: 0,
        isHealthy: true,
        lastFailureTime: 0,
        lastLatencyMs: null,
        queryCount: 0,
        failCount: 0,
      }
    );
  });
}

// Initial setup
reinitializeReplicaPool();

// Circuit Breaker: Pick a healthy replica, or return null if none healthy
function getHealthyReplica(): ReplicaHealthState | null {
  if (replicaPool.length === 0) return null;

  const now = Date.now();
  // Cooldown check: if a node failed previously and 30s passed, give it another chance
  for (const node of replicaPool) {
    if (!node.isHealthy && now - node.lastFailureTime > 30000) {
      node.isHealthy = true;
      node.consecutiveFailures = 0;
    }
  }

  const healthyNodes = replicaPool.filter((n) => n.isHealthy);
  if (healthyNodes.length === 0) return null;

  const selected = healthyNodes[roundRobinIndex % healthyNodes.length];
  roundRobinIndex++;
  return selected;
}

function markReplicaFailure(node: ReplicaHealthState) {
  node.failCount++;
  node.consecutiveFailures++;
  node.lastFailureTime = Date.now();
  if (node.consecutiveFailures >= 3) {
    node.isHealthy = false;
    console.warn(`[ReadReplica Router] Circuit breaker triggered: Replica ${node.url} marked unhealthy for 30s.`);
  }
}

function markReplicaSuccess(node: ReplicaHealthState, latencyMs: number) {
  node.queryCount++;
  node.consecutiveFailures = 0;
  node.isHealthy = true;
  node.lastLatencyMs = latencyMs;
}

// Helper to wrap chained PostgREST queries with transparent failover and latency tracking
function wrapChainedBuilder(
  builder: any,
  table: string,
  isRead: boolean,
  history: Array<{ prop: string; args: any[] }>,
  targetNode: QueryNode,
  targetUrl: string,
  replicaNode: ReplicaHealthState | null
): any {
  return new Proxy(builder, {
    get(target, prop: string | symbol, receiver) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }

      // Handle query execution via .then(resolve, reject)
      if (prop === 'then') {
        return function (resolve: (val: any) => void, reject: (err: any) => void) {
          const startTime = performance.now();

          return target.then(
            (res: any) => {
              const latencyMs = Math.round(performance.now() - startTime);
              clusterMetrics.totalLatencyMs += latencyMs;
              clusterMetrics.totalQueries++;

              // Check if read query failed on replica and can be retried on Primary
              if (isRead && res?.error && replicaNode) {
                markReplicaFailure(replicaNode);
                clusterMetrics.failoverCount++;

                console.warn(
                  `[ReadReplica Router] Read replica error on table "${table}": ${res.error.message || res.error}. Failing over to Primary leader...`
                );

                // Seamlessly replay exact query chain on Primary leader
                let fallback = (primaryClient as any).from(table);
                for (const step of history) {
                  if (typeof fallback[step.prop] === 'function') {
                    fallback = fallback[step.prop](...step.args);
                  }
                }

                return fallback.then(
                  (fbRes: any) => {
                    const totalLatency = Math.round(performance.now() - startTime);
                    clusterMetrics.primaryFallbackReads++;
                    clusterMetrics.primaryQueriesCount++;
                    recordQueryLog({
                      type: 'READ',
                      table,
                      node: 'PRIMARY_FALLBACK',
                      url: primaryUrl,
                      latencyMs: totalLatency,
                      status: 'FAILOVER',
                    });
                    resolve(fbRes);
                  },
                  (fbErr: any) => {
                    recordQueryLog({
                      type: 'READ',
                      table,
                      node: 'PRIMARY_FALLBACK',
                      url: primaryUrl,
                      latencyMs: Math.round(performance.now() - startTime),
                      status: 'ERROR',
                      errorMessage: fbErr?.message,
                    });
                    reject(fbErr);
                  }
                );
              }

              // Normal successful response
              if (isRead) {
                if (replicaNode) {
                  markReplicaSuccess(replicaNode, latencyMs);
                  clusterMetrics.replicaReads++;
                  clusterMetrics.replicaQueriesCount++;
                } else {
                  clusterMetrics.primaryFallbackReads++;
                  clusterMetrics.primaryQueriesCount++;
                }
              } else {
                clusterMetrics.primaryWrites++;
                clusterMetrics.primaryQueriesCount++;
              }

              recordQueryLog({
                type: isRead ? 'READ' : 'WRITE',
                table,
                node: targetNode,
                url: targetUrl,
                latencyMs,
                status: res?.error ? 'ERROR' : 'SUCCESS',
                errorMessage: res?.error?.message,
              });

              return resolve(res);
            },
            (err: any) => {
              // Network or unhandled rejection on replica
              if (isRead && replicaNode) {
                markReplicaFailure(replicaNode);
                clusterMetrics.failoverCount++;

                console.warn(
                  `[ReadReplica Router] Network error contacting replica ${replicaNode.url}. Replaying on Primary leader...`
                );

                let fallback = (primaryClient as any).from(table);
                for (const step of history) {
                  if (typeof fallback[step.prop] === 'function') {
                    fallback = fallback[step.prop](...step.args);
                  }
                }

                return fallback.then(
                  (fbRes: any) => {
                    const totalLatency = Math.round(performance.now() - startTime);
                    clusterMetrics.primaryFallbackReads++;
                    clusterMetrics.primaryQueriesCount++;
                    recordQueryLog({
                      type: 'READ',
                      table,
                      node: 'PRIMARY_FALLBACK',
                      url: primaryUrl,
                      latencyMs: totalLatency,
                      status: 'FAILOVER',
                    });
                    resolve(fbRes);
                  },
                  reject
                );
              }

              clusterMetrics.totalQueries++;
              recordQueryLog({
                type: isRead ? 'READ' : 'WRITE',
                table,
                node: targetNode,
                url: targetUrl,
                latencyMs: Math.round(performance.now() - startTime),
                status: 'ERROR',
                errorMessage: err?.message || String(err),
              });
              return reject(err);
            }
          );
        };
      }

      if (prop === 'catch') {
        return function (reject: any) {
          return (receiver as any).then(null, reject);
        };
      }

      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return function (...args: any[]) {
          const newHistory = [...history, { prop, args }];
          const nextBuilder = orig.apply(target, args);
          return wrapChainedBuilder(
            nextBuilder,
            table,
            isRead,
            newHistory,
            targetNode,
            targetUrl,
            replicaNode
          );
        };
      }

      return orig;
    },
  });
}

// Create Table-level proxy that routes .select() to replica and mutations to primary
function createTableProxy(table: string): any {
  return {
    select(...args: any[]) {
      const replica = getHealthyReplica();
      const targetClient = replica ? replica.client : primaryClient;
      const targetNode: QueryNode = replica ? 'REPLICA' : 'PRIMARY';
      const targetUrl = replica ? replica.url : primaryUrl;

      const builder = (targetClient as any).from(table).select(...args);
      return wrapChainedBuilder(
        builder,
        table,
        true,
        [{ prop: 'select', args }],
        targetNode,
        targetUrl,
        replica
      );
    },
    insert(...args: any[]) {
      const builder = (primaryClient as any).from(table).insert(...args);
      return wrapChainedBuilder(
        builder,
        table,
        false,
        [{ prop: 'insert', args }],
        'PRIMARY',
        primaryUrl,
        null
      );
    },
    update(...args: any[]) {
      const builder = (primaryClient as any).from(table).update(...args);
      return wrapChainedBuilder(
        builder,
        table,
        false,
        [{ prop: 'update', args }],
        'PRIMARY',
        primaryUrl,
        null
      );
    },
    delete(...args: any[]) {
      const builder = (primaryClient as any).from(table).delete(...args);
      return wrapChainedBuilder(
        builder,
        table,
        false,
        [{ prop: 'delete', args }],
        'PRIMARY',
        primaryUrl,
        null
      );
    },
    upsert(...args: any[]) {
      const builder = (primaryClient as any).from(table).upsert(...args);
      return wrapChainedBuilder(
        builder,
        table,
        false,
        [{ prop: 'upsert', args }],
        'PRIMARY',
        primaryUrl,
        null
      );
    },
  };
}

// Build Smart Routed Proxy for Supabase
function createSmartRouterClient(): SupabaseClient {
  if (!isConfigured) return null as any;

  return new Proxy(primaryClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => createTableProxy(table);
      }

      if (prop === 'rpc') {
        return function (fnName: string, args?: any, options?: any) {
          const startTime = performance.now();
          const p = (primaryClient as any).rpc(fnName, args, options);
          return p.then(
            (res: any) => {
              const latencyMs = Math.round(performance.now() - startTime);
              clusterMetrics.totalQueries++;
              clusterMetrics.primaryQueriesCount++;
              recordQueryLog({
                type: 'READ',
                table: `rpc:${fnName}`,
                node: 'PRIMARY',
                url: primaryUrl,
                latencyMs,
                status: res?.error ? 'ERROR' : 'SUCCESS',
                errorMessage: res?.error?.message,
              });
              return res;
            },
            (err: any) => {
              recordQueryLog({
                type: 'READ',
                table: `rpc:${fnName}`,
                node: 'PRIMARY',
                url: primaryUrl,
                latencyMs: Math.round(performance.now() - startTime),
                status: 'ERROR',
                errorMessage: err?.message,
              });
              throw err;
            }
          );
        };
      }

      // Convenience properties to directly access primary or replica client
      if (prop === 'primary') return primaryClient;
      if (prop === 'replica') {
        const rep = getHealthyReplica();
        return rep ? rep.client : primaryClient;
      }
      if (prop === 'clusterStats') return getReplicaClusterStats();
      if (prop === 'testLatency') return testClusterLatency;

      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return orig.bind(target);
      }
      return orig;
    },
  });
}

export const supabase = createSmartRouterClient();
export const supabasePrimary = primaryClient;
export const supabaseReplica = () => {
  const r = getHealthyReplica();
  return r ? r.client : primaryClient;
};

// Diagnostic & Cluster Monitoring Utilities
export function getReplicaClusterStats(): ReplicaClusterStats {
  const urls = getActiveReplicaUrls();
  const isDedicated = urls.length > 0;

  const replicaNodes: ClusterNodeInfo[] = replicaPool.map((node, index) => ({
    id: `replica-${index + 1}`,
    role: 'replica',
    url: node.url,
    isConfigured: true,
    isHealthy: node.isHealthy,
    latencyMs: node.lastLatencyMs,
    lastCheckedAt: node.lastFailureTime ? new Date(node.lastFailureTime).toLocaleTimeString() : null,
    queryCount: node.queryCount,
    failCount: node.failCount,
  }));

  const avgLatency =
    clusterMetrics.totalQueries > 0
      ? Math.round(clusterMetrics.totalLatencyMs / clusterMetrics.totalQueries)
      : 0;

  return {
    isReplicaDedicated: isDedicated,
    primaryNode: {
      id: 'primary-leader',
      role: 'primary',
      url: primaryUrl,
      isConfigured: isConfigured,
      isHealthy: true,
      latencyMs: null,
      lastCheckedAt: new Date().toLocaleTimeString(),
      queryCount: clusterMetrics.primaryQueriesCount,
      failCount: clusterMetrics.primaryFailuresCount,
    },
    replicaNodes,
    totalQueries: clusterMetrics.totalQueries,
    primaryWrites: clusterMetrics.primaryWrites,
    replicaReads: clusterMetrics.replicaReads,
    primaryFallbackReads: clusterMetrics.primaryFallbackReads,
    failoverCount: clusterMetrics.failoverCount,
    avgLatencyMs: avgLatency,
    recentQueries: [...clusterMetrics.recentQueries],
  };
}

export function resetReplicaClusterStats(): void {
  clusterMetrics.totalQueries = 0;
  clusterMetrics.primaryWrites = 0;
  clusterMetrics.replicaReads = 0;
  clusterMetrics.primaryFallbackReads = 0;
  clusterMetrics.failoverCount = 0;
  clusterMetrics.totalLatencyMs = 0;
  clusterMetrics.primaryQueriesCount = 0;
  clusterMetrics.replicaQueriesCount = 0;
  clusterMetrics.primaryFailuresCount = 0;
  clusterMetrics.recentQueries = [];
  for (const node of replicaPool) {
    node.queryCount = 0;
    node.failCount = 0;
    node.consecutiveFailures = 0;
    node.isHealthy = true;
  }
}

// Measure roundtrip latency to Primary and configured Replicas
export async function testClusterLatency(): Promise<{
  primaryLatencyMs: number | null;
  replicaLatencies: Record<string, number | null>;
  timestamp: string;
}> {
  const result = {
    primaryLatencyMs: null as number | null,
    replicaLatencies: {} as Record<string, number | null>,
    timestamp: new Date().toLocaleTimeString(),
  };

  // Test Primary
  if (primaryClient) {
    try {
      const t0 = performance.now();
      await primaryClient.from('environmental_readings').select('id').limit(1);
      result.primaryLatencyMs = Math.round(performance.now() - t0);
    } catch {
      result.primaryLatencyMs = null;
    }
  }

  // Test each configured replica
  for (const node of replicaPool) {
    try {
      const t0 = performance.now();
      await node.client.from('environmental_readings').select('id').limit(1);
      const lat = Math.round(performance.now() - t0);
      node.lastLatencyMs = lat;
      node.isHealthy = true;
      result.replicaLatencies[node.url] = lat;
    } catch {
      node.isHealthy = false;
      result.replicaLatencies[node.url] = null;
    }
  }

  return result;
}

// Call postgres replication diagnostic RPC if deployed
export async function fetchPostgresReplicationStatus(): Promise<{
  supported: boolean;
  data?: any;
  error?: string;
}> {
  if (!primaryClient) return { supported: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await (primaryClient as any).rpc('get_database_replication_status');
    if (error) {
      return { supported: false, error: error.message };
    }
    return { supported: true, data };
  } catch (e: any) {
    return { supported: false, error: e?.message || 'Replication status RPC unavailable' };
  }
}
