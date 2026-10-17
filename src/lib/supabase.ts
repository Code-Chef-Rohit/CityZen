import {
  isConfigured,
  supabase,
  supabasePrimary,
  supabaseReplica,
  getReplicaClusterStats,
  resetReplicaClusterStats,
  testClusterLatency,
  fetchPostgresReplicationStatus,
  setCustomReplicaUrl,
  getCustomReplicaUrl,
  type ReplicaClusterStats,
  type QueryLogEntry,
  type ClusterNodeInfo,
} from './databaseReplicaRouter';

export {
  isConfigured,
  supabase,
  supabasePrimary,
  supabaseReplica,
  getReplicaClusterStats,
  resetReplicaClusterStats,
  testClusterLatency,
  fetchPostgresReplicationStatus,
  setCustomReplicaUrl,
  getCustomReplicaUrl,
  type ReplicaClusterStats,
  type QueryLogEntry,
  type ClusterNodeInfo,
};

export default supabase;
