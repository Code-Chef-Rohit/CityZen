-- Migration: Read Replica Diagnostics & Health Metrics RPC
-- Description: Provides PostgreSQL cluster replication status, WAL positions, replication lag, and node role for CityZen

CREATE OR REPLACE FUNCTION get_database_replication_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_recovery boolean;
  v_current_wal text;
  v_replicas json;
  v_replay_lag interval;
  v_connections integer;
  v_db_size_bytes bigint;
  v_db_size_pretty text;
  v_server_version text;
  v_result json;
BEGIN
  -- Check if this database node is in recovery (read replica) or primary leader
  SELECT pg_is_in_recovery() INTO v_is_recovery;
  SELECT version() INTO v_server_version;

  -- Active client connections
  SELECT count(*) FROM pg_stat_activity WHERE state = 'active' INTO v_connections;

  -- Database size
  SELECT pg_database_size(current_database()) INTO v_db_size_bytes;
  SELECT pg_size_pretty(v_db_size_bytes) INTO v_db_size_pretty;

  IF v_is_recovery THEN
    -- On Read Replica / Standby:
    SELECT pg_last_wal_replay_lsn()::text INTO v_current_wal;
    SELECT now() - pg_last_xact_replay_timestamp() INTO v_replay_lag;
    v_replicas := '[]'::json;
  ELSE
    -- On Primary Leader:
    SELECT pg_current_wal_lsn()::text INTO v_current_wal;
    v_replay_lag := '0 seconds'::interval;

    SELECT COALESCE(
      json_agg(
        json_build_object(
          'application_name', application_name,
          'client_addr', client_addr::text,
          'state', state,
          'sync_state', sync_state,
          'sent_lsn', sent_lsn::text,
          'write_lsn', write_lsn::text,
          'flush_lsn', flush_lsn::text,
          'replay_lsn', replay_lsn::text,
          'write_lag', write_lag::text,
          'flush_lag', flush_lag::text,
          'replay_lag', replay_lag::text
        )
      ),
      '[]'::json
    )
    FROM pg_stat_replication
    INTO v_replicas;
  END IF;

  v_result := json_build_object(
    'is_recovery', v_is_recovery,
    'node_role', CASE WHEN v_is_recovery THEN 'read_replica' ELSE 'primary_leader' END,
    'current_wal_lsn', COALESCE(v_current_wal, 'N/A'),
    'replay_lag', COALESCE(v_replay_lag::text, '00:00:00'),
    'active_replicas', COALESCE(v_replicas, '[]'::json),
    'replica_count', COALESCE(json_array_length(v_replicas), 0),
    'active_connections', COALESCE(v_connections, 0),
    'database_size_bytes', COALESCE(v_db_size_bytes, 0),
    'database_size_pretty', COALESCE(v_db_size_pretty, '0 MB'),
    'server_version', v_server_version,
    'checked_at', now()
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', SQLERRM,
      'is_recovery', false,
      'node_role', 'primary_leader',
      'replica_count', 0,
      'active_replicas', '[]'::json,
      'checked_at', now()
    );
END;
$$;

-- Grant execution to authenticated users and anon client
GRANT EXECUTE ON FUNCTION get_database_replication_status() TO authenticated, anon, service_role;
COMMENT ON FUNCTION get_database_replication_status() IS 'Returns PostgreSQL cluster topology, WAL replication positions, and standby nodes status for CityZen administrator console.';
