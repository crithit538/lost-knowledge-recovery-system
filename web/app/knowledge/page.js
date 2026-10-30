
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function KnowledgeLibrary() {
  const { status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [itemStatus, setItemStatus] = useState('');
  const [criticality, setCriticality] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const controller = new AbortController();

    async function loadKnowledge() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          search,
          category,
          status: itemStatus,
          criticality,
        });

        const response = await fetch(
          `/api/knowledge?${params.toString()}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load knowledge.');
        }

        setItems(result.items);
        setCategories(result.categories);
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

    loadKnowledge();

    return () => controller.abort();
  }, [status, search, category, itemStatus, criticality]);

  function clearFilters() {
    setSearch('');
    setCategory('');
    setItemStatus('');
    setCriticality('');
  }

  if (status === 'loading') {
    return <main style={styles.loading}>Loading...</main>;
  }

  if (status === 'unauthenticated') {
    return <main style={styles.loading}>Redirecting to login...</main>;
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <button
            onClick={() => router.push('/')}
            style={styles.backButton}
          >
            ← Dashboard
          </button>

          <h1 style={styles.heading}>Knowledge Library</h1>

          <p style={styles.subtitle}>
            Browse and discover organizational knowledge
          </p>
        </div>

        <div style={styles.count}>
          {items.length} {items.length === 1 ? 'item' : 'items'} found
        </div>
      </header>

      <section style={styles.filterCard}>
        <div style={styles.searchWrapper}>
          <label style={styles.label}>Search knowledge</label>
          <input
            type="text"
            placeholder="Search titles or content..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.filters}>
          <div>
            <label style={styles.label}>Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={styles.input}
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Status</label>
            <select
              value={itemStatus}
              onChange={(event) => setItemStatus(event.target.value)}
              style={styles.input}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div>
            <label style={styles.label}>Criticality</label>
            <select
              value={criticality}
              onChange={(event) => setCriticality(event.target.value)}
              style={styles.input}
            >
              <option value="">All levels</option>
              <option value="5">5 - Very High</option>
              <option value="4">4 - High</option>
              <option value="3">3 - Medium</option>
              <option value="2">2 - Low</option>
              <option value="1">1 - Very Low</option>
            </select>
          </div>

          <button onClick={clearFilters} style={styles.clearButton}>
            Clear filters
          </button>
        </div>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.results}>
        {loading ? (
          <p style={styles.message}>Loading knowledge items...</p>
        ) : items.length === 0 ? (
          <p style={styles.message}>No matching knowledge items found.</p>
        ) : (
          items.map((item) => (
            <article
  key={item.item_id}
  style={{ ...styles.itemCard, cursor: 'pointer' }}
  onClick={() => router.push(`/knowledge/${item.item_id}`)}
>
              <div style={styles.itemTop}>
                <span style={styles.category}>{item.category || 'Uncategorized'}</span>

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

              <h2 style={styles.itemTitle}>{item.title}</h2>

              <div style={styles.itemBottom}>
                <span>Owner: {item.owner || 'Unknown'}</span>
                <span>Criticality: {item.criticality}/5</span>
              </div>
            </article>
          ))
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
    fontFamily: 'Arial, sans-serif',
    color: '#172033',
  },
  loading: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '28px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    marginBottom: '15px',
    fontSize: '14px',
  },
  heading: {
    fontSize: '30px',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#64748b',
  },
  count: {
    background: 'white',
    padding: '12px 18px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontWeight: 'bold',
  },
  filterCard: {
    background: 'white',
    padding: '24px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
  },
  searchWrapper: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#475569',
  },
  input: {
    width: '100%',
    padding: '11px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: 'white',
    color: '#172033',
    fontSize: '14px',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '15px',
    alignItems: 'end',
  },
  clearButton: {
    padding: '11px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#334155',
  },
  results: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
  },
  itemCard: {
    background: 'white',
    padding: '22px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px',
  },
  category: {
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  status: {
    padding: '5px 9px',
    borderRadius: '20px',
    fontSize: '11px',
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
  itemTitle: {
    fontSize: '18px',
    lineHeight: 1.5,
    cursor: 'pointer',
    marginBottom: '20px',
  },
  itemBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
    color: '#64748b',
    fontSize: '12px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '14px',
  },
  message: {
    color: '#64748b',
    padding: '30px',
    textAlign: 'center',
    background: 'white',
    borderRadius: '10px',
  },
  error: {
    color: '#b91c1c',
    marginBottom: '18px',
  },
};
