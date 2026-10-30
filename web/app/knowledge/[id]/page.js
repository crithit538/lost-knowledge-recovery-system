
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function KnowledgeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [item, setItem] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !id) return;

    const controller = new AbortController();

    async function loadItem() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/knowledge/${id}`, {
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load knowledge item.');
        }

        setItem(data.item);
        setVersions(data.versions);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadItem();

    return () => controller.abort();
  }, [status, id]);

  async function submitRequest(event) {
    event.preventDefault();

    setSubmitting(true);
    setRequestError('');
    setSuccess('');

    try {
      const response = await fetch('/api/recovery-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: Number(id),
          topic,
          details,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit request.');
      }

      setSuccess(
        `Request submitted successfully! Request ID: ${data.request.request_id}`
      );
      setTopic('');
      setDetails('');
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || loading) {
    return <main style={styles.message}>Loading knowledge item...</main>;
  }

  if (status === 'unauthenticated') {
    return <main style={styles.message}>Redirecting to login...</main>;
  }

  if (error || !item) {
    return (
      <main style={styles.page}>
        <button onClick={() => router.push('/knowledge')} style={styles.back}>
          ← Back to Knowledge Library
        </button>
        <p style={styles.error}>{error || 'Knowledge item not found.'}</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <button onClick={() => router.push('/knowledge')} style={styles.back}>
        ← Back to Knowledge Library
      </button>

      <section style={styles.card}>
        <div style={styles.top}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <span style={styles.category}>
      {item.category || 'Uncategorized'}
    </span>

    <span
      style={{
        ...styles.status,
        ...(item.status === 'published'
          ? styles.published
          : styles.draft),
      }}
    >
      {item.status}
    </span>
  </div>

  {['admin', 'contributor'].includes(session?.user?.role) && (
    <button
      onClick={() => router.push(`/knowledge/${id}/edit`)}
      style={styles.editButton}
    >
      Edit Knowledge
    </button>
  )}
</div>

        <h1 style={styles.heading}>{item.title}</h1>

        <div style={styles.metadata}>
          <span>Owner: {item.owner || 'Unknown'}</span>
          <span>Criticality: {item.criticality}/5</span>
          <span>
            Created: {new Date(item.created_at).toLocaleDateString()}
          </span>
          <span>
            Last updated: {new Date(item.updated_at).toLocaleDateString()}
          </span>
        </div>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Knowledge Content</h2>

        <p style={styles.body}>{item.body || 'No content available.'}</p>
      </section>

     <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Version History</h2>

        {versions.length === 0 ? (
          <p style={styles.muted}>
            No previous versions are available for this item.
          </p>
        ) : (
          versions.map((version) => (
            <div key={version.version_id} style={styles.version}>
              <div style={styles.versionTop}>
                <strong>Version {version.version_no}</strong>
                <span style={styles.muted}>
                  {new Date(version.edited_at).toLocaleString()}
                </span>
              </div>
              <p style={styles.body}>{version.body}</p>
            </div>
          ))
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Request Knowledge Recovery</h2>

        <p style={styles.muted}>
          Need additional information or help recovering missing knowledge?
          Submit a request below.
        </p>

        <form onSubmit={submitRequest} style={styles.form}>
          <label style={styles.label}>Request Topic *</label>

          <input
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What information do you need?"
            maxLength={255}
            required
            style={styles.input}
          />

          <label style={styles.label}>Additional Details</label>

          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe the information you are trying to recover..."
            maxLength={5000}
            rows={5}
            style={styles.textarea}
          />

          {requestError && (
            <p style={styles.error}>{requestError}</p>
          )}

          {success && (
            <p style={styles.success}>{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitButton,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Recovery Request'}
          </button>
        </form>
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
    fontFamily: 'Arial, sans-serif',
  },
  back: {
    border: 'none',
    background: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '22px',
  },
  editButton: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '9px 16px',
    fontSize: '13px',
    cursor: 'pointer',
  },card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '28px',
    marginBottom: '22px',
    maxWidth: '1000px',
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  category: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  status: {
    padding: '6px 11px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  published: {
    background: '#dcfce7',
    color: '#166534',
  },
  draft: {
    background: '#fef3c7',
    color: '#92400e',
  },
  heading: {
    fontSize: '29px',
    lineHeight: 1.4,
    marginBottom: '20px',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px 24px',
    color: '#64748b',
    fontSize: '13px',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '25px 0',
  },
  sectionTitle: {
    fontSize: '19px',
    marginBottom: '16px',
  },
  body: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
  },
  muted: {
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.7,
    marginBottom: '18px',
  },
  version: {
    borderTop: '1px solid #e2e8f0',
    padding: '18px 0',
  },
  versionTop: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '12px',
    fontSize: '13px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#475569',
  },
  input: {
    padding: '12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
  },
  textarea: {
    padding: '12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    resize: 'vertical',
    fontFamily: 'Arial, sans-serif',
  },
  submitButton: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '13px 18px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  error: {
    color: '#b91c1c',
    fontSize: '13px',
  },
  success: {
    color: '#166534',
    background: '#dcfce7',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
  },
};
