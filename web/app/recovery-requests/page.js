
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RecoveryRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [success, setSuccess] = useState('');

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }

    if (status === 'authenticated') {
      loadRequests();
    }
  }, [status, router]);

  async function loadRequests() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/recovery-requests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load requests.');
      }

      setRequests(data.requests || []);
      setContributors(data.contributors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(requestId) {
    const assignedValue = document.getElementById(
      `assignee-${requestId}`
    ).value;

    const selectedStatus = document.getElementById(
      `status-${requestId}`
    ).value;

    const assignedTo = assignedValue === ''
      ? null
      : Number(assignedValue);

    if (selectedStatus === 'assigned' && assignedTo === null) {
      setError('Please select a contributor before assigning the request.');
      return;
    }

    try {
      setSavingId(requestId);
      setError('');
      setSuccess('');

      const response = await fetch(
        `/api/recovery-requests/${requestId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: selectedStatus,
            assignedTo,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update request.');
      }

      setSuccess(`Request #${requestId} updated successfully.`);
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  function getStatusStyle(requestStatus) {
    const styles = {
      open: {
        background: '#fff3cd',
        color: '#856404',
      },
      assigned: {
        background: '#dbeafe',
        color: '#1e40af',
      },
      resolved: {
        background: '#d1fae5',
        color: '#065f46',
      },
    };

    return styles[requestStatus] || {};
  }

  const pageStyle = {
    minHeight: '100vh',
    background: '#f5f6fa',
    padding: '40px 6%',
    color: '#1f2937',
  };

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '22px',
    marginBottom: '16px',
  };

  const selectStyle = {
    padding: '9px',
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    background: '#ffffff',
    minWidth: '150px',
  };

  if (status === 'loading' || loading) {
    return <main style={pageStyle}>Loading recovery requests...</main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            border: 'none',
            background: 'none',
            color: '#2563eb',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '15px',
          }}
        >
          ← Back to Dashboard
        </button>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '25px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '30px', margin: '0 0 8px' }}>
              Recovery Requests
            </h1>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Track requests for missing organizational knowledge.
            </p>
          </div>

          <button
            onClick={loadRequests}
            style={{
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '14px',
            marginBottom: '25px',
          }}
        >
          {[
            ['Total Requests', requests.length],
            ['Open', requests.filter((r) => r.status === 'open').length],
            ['Assigned', requests.filter((r) => r.status === 'assigned').length],
            ['Resolved', requests.filter((r) => r.status === 'resolved').length],
          ].map(([label, count]) => (
            <div key={label} style={cardStyle}>
              <p style={{ color: '#6b7280', margin: '0 0 8px' }}>
                {label}
              </p>
              <h2 style={{ fontSize: '28px', margin: 0 }}>{count}</h2>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ color: '#b91c1c', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: '#047857', marginBottom: '16px' }}>
            {success}
          </p>
        )}

        {!error && requests.length === 0 && (
          <div style={cardStyle}>No recovery requests found.</div>
        )}

        {requests.map((request) => (
          <article key={request.request_id} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ fontSize: '18px', margin: 0 }}>
                {request.topic}
              </h3>

              <span
                style={{
                  ...getStatusStyle(request.status),
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {request.status}
              </span>
            </div>

            <p style={{ color: '#6b7280', fontSize: '13px' }}>
              Request ID: #{request.request_id}
            </p>

            {request.details && (
              <p style={{ margin: '12px 0', lineHeight: 1.6 }}>
                {request.details}
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginTop: '16px',
                fontSize: '14px',
                color: '#4b5563',
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Knowledge Item:</strong>{' '}
                {request.item_id ? `#${request.item_id}` : 'Not linked'}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Requester ID:</strong> {request.requester_id}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Assigned To:</strong>{' '}
                {request.assigned_to ?? 'Not assigned'}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Submitted:</strong> {formatDate(request.created_at)}
              </p>

              {request.resolved_at && (
                <p style={{ margin: 0 }}>
                  <strong>Resolved:</strong> {formatDate(request.resolved_at)}
                </p>
              )}
            </div>

            {isAdmin && (
              <div
                style={{
                  borderTop: '1px solid #e5e7eb',
                  marginTop: '20px',
                  paddingTop: '18px',
                }}
              >
                <h4 style={{ margin: '0 0 12px' }}>
                  Admin Controls
                </h4>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <select
                    id={`assignee-${request.request_id}`}
                    defaultValue={request.assigned_to ?? ''}
                    style={selectStyle}
                  >
                    <option value="">Not assigned</option>
                    {contributors.map((person) => (
                      <option
                        key={person.user_id}
                        value={person.user_id}
                      >
                        {person.full_name}
                      </option>
                    ))}
                  </select>

                  <select
                    id={`status-${request.request_id}`}
                    defaultValue={request.status}
                    style={selectStyle}
                  >
                    <option value="open">Open</option>
                    <option value="assigned">Assigned</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  <button
                    onClick={() => updateRequest(request.request_id)}
                    disabled={savingId === request.request_id}
                    style={{
                      padding: '10px 18px',
                      border: 'none',
                      borderRadius: '7px',
                      background: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                      opacity: savingId === request.request_id ? 0.6 : 1,
                    }}
                  >
                    {savingId === request.request_id
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
