'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function TransferPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [departed, setDeparted] = useState([]);
  const [targets, setTargets] = useState([]);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const response = await fetch('/api/transfer');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load transfer data.');
      }

      setDeparted(data.departed || []);
      setTargets(data.targets || []);
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
      loadData();
    }
  }, [status, session, router]);

  async function handleTransfer() {
    setError('');
    setMessage('');

    if (!fromUserId || !toUserId) {
      setError('Please choose both users.');
      return;
    }

    const from = departed.find((u) => String(u.user_id) === fromUserId);
    const to = targets.find((u) => String(u.user_id) === toUserId);

    if (
      !window.confirm(
        `Transfer all knowledge items from ${from?.full_name} to ${to?.full_name}?`
      )
    ) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: Number(fromUserId),
          toUserId: Number(toUserId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to transfer knowledge.');
      }

      setMessage(
        `${data.moved} item(s) transferred from ${from?.full_name} to ${to?.full_name}.`
      );
      setFromUserId('');
      setToUserId('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || loading) {
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

      <h1 style={styles.heading}>Knowledge Transfer</h1>
      <p style={styles.subtitle}>
        Move the knowledge items of a departed employee to an active
        colleague.
      </p>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Departed Employees</h2>

        {departed.map((user) => (
          <div key={user.user_id} style={styles.userRow}>
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
            <span>
              {user.item_count} item(s) still owned
              {user.departed_on
                ? ` - departed on ${new Date(user.departed_on).toLocaleDateString()}`
                : ''}
            </span>
          </div>
        ))}

        {departed.length === 0 && (
          <p style={styles.muted}>No departed employees.</p>
        )}
      </section>

      <section style={{ ...styles.card, marginTop: '24px' }}>
        <h2 style={styles.sectionTitle}>Transfer Knowledge</h2>

        <label style={styles.label} htmlFor="from-user">
          From (departed employee)
        </label>
        <select
          id="from-user"
          value={fromUserId}
          onChange={(e) => setFromUserId(e.target.value)}
          style={styles.select}
        >
          <option value="">Select a departed employee</option>
          {departed.map((user) => (
            <option
              key={user.user_id}
              value={user.user_id}
              disabled={user.item_count === 0}
            >
              {user.full_name} ({user.item_count} items)
            </option>
          ))}
        </select>

        <label style={styles.label} htmlFor="to-user">
          To (active employee)
        </label>
        <select
          id="to-user"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          style={styles.select}
        >
          <option value="">Select a receiving employee</option>
          {targets.map((user) => (
            <option key={user.user_id} value={user.user_id}>
              {user.full_name} ({user.role})
            </option>
          ))}
        </select>

        <button
          onClick={handleTransfer}
          disabled={submitting}
          style={{
            ...styles.actionButton,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Transferring...' : 'Transfer Knowledge'}
        </button>
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
    flexDirection: 'column',
    gap: '6px',
    borderTop: '1px solid #e2e8f0',
    padding: '14px 0',
    fontSize: '13px',
    color: '#64748b',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    marginTop: '14px',
    marginBottom: '6px',
  },
  select: {
    width: '100%',
    maxWidth: '420px',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
  },
  actionButton: {
    display: 'block',
    marginTop: '22px',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '11px 16px',
    cursor: 'pointer',
  },
  error: {
    color: '#b91c1c',
    marginBottom: '15px',
  },
  success: {
    color: '#15803d',
    marginBottom: '15px',
  },
  muted: {
    color: '#64748b',
  },
};