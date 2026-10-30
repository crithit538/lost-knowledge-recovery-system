'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadLogs(selected) {
    setLoading(true);
    setError('');

    try {
      const query = selected
        ? `?action=${encodeURIComponent(selected)}`
        : '';
      const response = await fetch(`/api/audit${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load audit log.');
      }

      setLogs(data.logs || []);
      if (!selected) setActions(data.actions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/');
      return;
    }

    if (status === 'authenticated' && session?.user?.role === 'admin') {
      loadLogs(filter);
    }
  }, [status, session, router, filter]);

  if (status === 'loading') {
    return <main style={styles.message}>Loading...</main>;
  }

  if (session?.user?.role !== 'admin') {
    return <main style={styles.message}>Redirecting...</main>;
  }

  return (
    <main style={styles.page}>
      <button onClick={() => router.push('/')} style={styles.back}>
        Back to Dashboard
      </button>

      <h1 style={styles.heading}>Audit Log</h1>
      <p style={styles.subtitle}>
        A record of key administrative actions in the system.
      </p>

      <div style={styles.filterRow}>
        <label htmlFor="action-filter">Filter by action: </label>
        <select
          id="action-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All actions</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Recent Activity</h2>

        {loading && <p style={styles.muted}>Loading audit log...</p>}

        {!loading &&
          logs.map((log) => (
            <div key={log.log_id} style={styles.logRow}>
              <div style={styles.logInfo}>
                <strong>{log.action.replaceAll('_', ' ')}</strong>
                <span>{log.details || 'No details'}</span>
                <span>
                  By {log.actor_name || 'Unknown'} - {log.target_table || '-'}
                  {log.target_id ? ` #${log.target_id}` : ''}
                </span>
              </div>
              <span style={styles.time}>
                {new Date(log.logged_at).toLocaleString()}
              </span>
            </div>
          ))}

        {!loading && logs.length === 0 && (
          <p style={styles.muted}>No audit entries yet.</p>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f6f9',
    padding: '38px',
    color: '#172033',
    fontFamily: 'Arial, sans-serif',
  },
  message: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
  },
  back: {
    border: 'none',
    background: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    marginBottom: '22px',
  },
  heading: {
    fontSize: '28px',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#64748b',
    marginBottom: '25px',
  },
  filterRow: {
    marginBottom: '20px',
    fontSize: '14px',
  },
  select: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
  },
  card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '25px',
    maxWidth: '1000px',
  },
  sectionTitle: {
    fontSize: '19px',
    marginBottom: '18px',
  },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '15px',
    borderTop: '1px solid #e2e8f0',
    padding: '16px 0',
  },
  logInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#64748b',
  },
  time: {
    fontSize: '12px',
    color: '#64748b',
  },
  error: {
    color: '#b91c1c',
    marginBottom: '15px',
  },
  muted: {
    color: '#64748b',
  },
};