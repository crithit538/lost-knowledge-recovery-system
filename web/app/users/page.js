'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  async function loadUsers() {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load users.');
      }

      setUsers(data.users || []);
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
      loadUsers();
    }
  }, [status, session, router]);

  async function updateStatus(user) {
    const action = user.status === 'active' ? 'depart' : 'reactivate';

    const confirmation = action === 'depart'
      ? `Mark ${user.full_name} as departed?`
      : `Reactivate ${user.full_name}?`;

    if (!window.confirm(confirmation)) return;

    setUpdating(user.user_id);
    setError('');

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.user_id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update user.');
      }

      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  }

  if (status === 'loading' || loading) {
    return <main style={styles.message}>Loading users...</main>;
  }

  if (session?.user?.role !== 'admin') {
    return <main style={styles.message}>Redirecting...</main>;
  }

  return (
    <main style={styles.page}>
      <button onClick={() => router.push('/')} style={styles.back}>
        Back to Dashboard
      </button>

      <h1 style={styles.heading}>User Management</h1>
      <p style={styles.subtitle}>
        View employees and manage their account status.
      </p>

      <div style={styles.summary}>
        <div style={styles.summaryCard}>
          <strong>{users.length}</strong>
          <span>Total Users</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{users.filter((u) => u.status === 'active').length}</strong>
          <span>Active Users</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{users.filter((u) => u.status === 'departed').length}</strong>
          <span>Departed Users</span>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Employee Directory</h2>

        {users.map((user) => (
          <div key={user.user_id} style={styles.userRow}>
            <div style={styles.userInfo}>
              <strong>{user.full_name}</strong>
              <span>{user.email}</span>
              <span>
                {user.department || 'No department'} · {user.role}
              </span>
              <span>
                Status: {user.status}
                {user.departed_on
                  ? ` · Departed on ${new Date(user.departed_on).toLocaleDateString()}`
                  : ''}
              </span>
            </div>

            {user.user_id !== Number(session?.user?.id) && (
              <button
                onClick={() => updateStatus(user)}
                disabled={updating === user.user_id}
                style={{
                  ...styles.actionButton,
                  background: user.status === 'active' ? '#dc2626' : '#15803d',
                  opacity: updating === user.user_id ? 0.6 : 1,
                }}
              >
                {updating === user.user_id
                  ? 'Updating...'
                  : user.status === 'active'
                    ? 'Mark Departed'
                    : 'Reactivate'}
              </button>
            )}
          </div>
        ))}

        {users.length === 0 && (
          <p style={styles.muted}>No users found.</p>
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
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '25px',
  },
  summaryCard: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    minWidth: '150px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
  userRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    borderTop: '1px solid #e2e8f0',
    padding: '18px 0',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#64748b',
  },
  actionButton: {
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 14px',
    cursor: 'pointer',
  },
  error: {
    color: '#b91c1c',
    marginBottom: '15px',
  },
  muted: {
    color: '#64748b',
  },
};