'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function TransferPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [departed, setDeparted] = useState([]);
  const [targets, setTargets] = useState([]);
  const [items, setItems] = useState([]);
  const [fromUserId, setFromUserId] = useState('');
  const [batchToUserId, setBatchToUserId] = useState('');
  const [itemTargets, setItemTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transferringItemId, setTransferringItemId] = useState(null);
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
      setItems(data.items || []);
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

  // Filter tasks for the selected departed employee
  const selectedDepartedItems = items.filter(
    (item) => String(item.owner_id) === String(fromUserId)
  );

  const selectedDepartedUser = departed.find(
    (u) => String(u.user_id) === String(fromUserId)
  );

  // Transfer a single prioritized task
  async function handleSingleTransfer(item) {
    setError('');
    setMessage('');

    const targetId = itemTargets[item.item_id] || batchToUserId;

    if (!targetId) {
      setError(`Please select a recipient for task "${item.title}".`);
      return;
    }

    const to = targets.find((u) => String(u.user_id) === String(targetId));

    if (
      !window.confirm(
        `Transfer Priority ${item.priority_rank} task "${item.title}" to ${to?.full_name}?`
      )
    ) {
      return;
    }

    setTransferringItemId(item.item_id);

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: Number(fromUserId),
          toUserId: Number(targetId),
          itemId: Number(item.item_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to transfer task.');
      }

      setMessage(
        `✓ [Priority ${item.priority_rank}] "${item.title}" successfully transferred to ${to?.full_name}.`
      );
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferringItemId(null);
    }
  }

  // Batch transfer all items for the departed user
  async function handleBatchTransfer() {
    setError('');
    setMessage('');

    if (!fromUserId || !batchToUserId) {
      setError('Please choose both the departed employee and the receiving employee.');
      return;
    }

    const from = departed.find((u) => String(u.user_id) === fromUserId);
    const to = targets.find((u) => String(u.user_id) === batchToUserId);

    if (
      !window.confirm(
        `Transfer all ${selectedDepartedItems.length} knowledge items from ${from?.full_name} to ${to?.full_name} in prioritized order?`
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
          toUserId: Number(batchToUserId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to transfer knowledge.');
      }

      setMessage(
        `✓ Successfully transferred ${data.moved} item(s) from ${from?.full_name} to ${to?.full_name} in priority order.`
      );
      setFromUserId('');
      setBatchToUserId('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getPriorityBadgeStyle(criticality) {
    switch (criticality) {
      case 5:
        return { background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' };
      case 4:
        return { background: '#ffedd5', color: '#9a3412', border: '1px solid #fb923c' };
      case 3:
        return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
      case 2:
        return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
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
        &larr; Back to Dashboard
      </button>

      <h1 style={styles.heading}>Knowledge Transfer & Task Prioritization</h1>
      <p style={styles.subtitle}>
        Identify and transfer critical knowledge items of departed employees. High-criticality tasks are prioritized first to prevent operational failure.
      </p>

      {error && <div style={styles.errorBox}>{error}</div>}
      {message && <div style={styles.successBox}>{message}</div>}

      {/* Overview of Departed Employees */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Departed Employees Overview</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Departed Date</th>
                <th style={styles.th}>Items Remaining</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {departed.map((user) => (
                <tr key={user.user_id} style={styles.tr}>
                  <td style={styles.td}><strong>{user.full_name}</strong></td>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>
                    {user.departed_on ? new Date(user.departed_on).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: user.item_count > 0 ? '#fee2e2' : '#dcfce7',
                      color: user.item_count > 0 ? '#991b1b' : '#166534',
                    }}>
                      {user.item_count} items
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => setFromUserId(String(user.user_id))}
                      disabled={user.item_count === 0}
                      style={{
                        ...styles.selectUserBtn,
                        opacity: user.item_count === 0 ? 0.4 : 1,
                        cursor: user.item_count === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {String(fromUserId) === String(user.user_id) ? 'Selected' : 'View Priority Queue'}
                    </button>
                  </td>
                </tr>
              ))}
              {departed.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>
                    No departed employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Select departed employee selector */}
      <section style={{ ...styles.card, marginTop: '24px' }}>
        <h2 style={styles.sectionTitle}>Select Departed Employee to Manage</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '280px' }}>
            <label style={styles.label} htmlFor="from-user">Departed Employee</label>
            <select
              id="from-user"
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              style={styles.select}
            >
              <option value="">Select an employee to prioritize</option>
              {departed.map((user) => (
                <option key={user.user_id} value={user.user_id} disabled={user.item_count === 0}>
                  {user.full_name} ({user.item_count} items remaining)
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Prioritized Task Transfer Queue */}
      {fromUserId && (
        <section style={{ ...styles.card, marginTop: '24px', border: '2px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ ...styles.sectionTitle, margin: 0, color: '#1e3a8a' }}>
                Transfer Priority Queue for {selectedDepartedUser?.full_name}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                Tasks sorted by urgency. Items with <strong>Priority 1 (Criticality 5)</strong> must be transferred first.
              </p>
            </div>
            <span style={{ fontSize: '13px', background: '#eff6ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>
              {selectedDepartedItems.length} Task(s) Pending Transfer
            </span>
          </div>

          {selectedDepartedItems.length === 0 ? (
            <p style={{ ...styles.muted, marginTop: '18px' }}>
              All knowledge items for this user have already been transferred or archived.
            </p>
          ) : (
            <div style={{ marginTop: '20px', overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={{ ...styles.th, width: '130px' }}>Priority Order</th>
                    <th style={styles.th}>Task / Knowledge Title</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Criticality</th>
                    <th style={{ ...styles.th, minWidth: '220px' }}>Assign Recipient</th>
                    <th style={{ ...styles.th, width: '140px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDepartedItems.map((item, idx) => (
                    <tr key={item.item_id} style={{ ...styles.tr, background: idx === 0 ? '#fffbeb' : 'white' }}>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.priorityBadge,
                          ...getPriorityBadgeStyle(item.criticality),
                        }}>
                          {idx === 0 ? '★ ' : ''}Priority {item.priority_rank}
                        </span>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                          {item.criticality === 5 ? 'Transfer 1st' : item.criticality === 4 ? 'Transfer 2nd' : 'Routine'}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <strong>{item.title}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Item ID: #{item.item_id} &bull; Status: {item.status}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.categoryBadge}>{item.category_name}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 'bold', color: item.criticality >= 4 ? '#b91c1c' : '#334155' }}>
                          Level {item.criticality} / 5
                        </span>
                      </td>
                      <td style={styles.td}>
                        <select
                          value={itemTargets[item.item_id] || batchToUserId || ''}
                          onChange={(e) =>
                            setItemTargets({ ...itemTargets, [item.item_id]: e.target.value })
                          }
                          style={styles.miniSelect}
                        >
                          <option value="">Choose active employee</option>
                          {targets.map((target) => (
                            <option key={target.user_id} value={target.user_id}>
                              {target.full_name} ({target.role})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => handleSingleTransfer(item)}
                          disabled={transferringItemId === item.item_id}
                          style={{
                            ...styles.transferSingleBtn,
                            opacity: transferringItemId === item.item_id ? 0.6 : 1,
                          }}
                        >
                          {transferringItemId === item.item_id ? 'Transferring...' : 'Transfer Task'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch Transfer All Section */}
          {selectedDepartedItems.length > 0 && (
            <div style={styles.batchSection}>
              <h3 style={{ fontSize: '16px', margin: '0 0 10px 0', color: '#1e293b' }}>
                Batch Transfer All Remaining Tasks in Priority Order
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>
                Or select one active employee to receive all {selectedDepartedItems.length} tasks from {selectedDepartedUser?.full_name} simultaneously.
              </p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={batchToUserId}
                  onChange={(e) => setBatchToUserId(e.target.value)}
                  style={{ ...styles.select, maxWidth: '320px' }}
                >
                  <option value="">Select receiving employee for all</option>
                  {targets.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.role})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleBatchTransfer}
                  disabled={submitting || !batchToUserId}
                  style={{
                    ...styles.actionButton,
                    opacity: submitting || !batchToUserId ? 0.6 : 1,
                    cursor: submitting || !batchToUserId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Transferring All...' : `Transfer All ${selectedDepartedItems.length} Items in Priority Order`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
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
    fontFamily: 'Arial, sans-serif',
  },
  back: {
    border: 'none',
    background: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    marginBottom: '22px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  heading: {
    fontSize: '28px',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#64748b',
    marginBottom: '25px',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '25px',
    maxWidth: '1100px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: '19px',
    marginBottom: '14px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  thRow: {
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  th: {
    padding: '12px 14px',
    color: '#475569',
    fontWeight: '600',
  },
  tr: {
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '12px 14px',
    verticalAlign: 'middle',
  },
  priorityBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '11px',
    letterSpacing: '0.3px',
  },
  categoryBadge: {
    background: '#f1f5f9',
    color: '#475569',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  selectUserBtn: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#1e293b',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  transferSingleBtn: {
    background: '#1d4ed8',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '6px',
    color: '#334155',
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    background: 'white',
  },
  miniSelect: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    background: 'white',
  },
  batchSection: {
    marginTop: '26px',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
  },
  actionButton: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: '600',
  },
  errorBox: {
    background: '#fee2e2',
    border: '1px solid #f87171',
    color: '#991b1b',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '18px',
    fontSize: '14px',
  },
  successBox: {
    background: '#dcfce7',
    border: '1px solid #86efac',
    color: '#166534',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '18px',
    fontSize: '14px',
  },
  muted: {
    color: '#64748b',
    fontSize: '14px',
  },
};
