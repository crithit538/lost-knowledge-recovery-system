'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function KnowledgeLibrary() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState('keyword'); // 'keyword' | 'semantic'
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
        if (searchMode === 'semantic') {
          const trimmed = search.trim();
          if (!trimmed) {
            // Load base items when query is empty in semantic mode
            const res = await fetch('/api/knowledge', { signal: controller.signal });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to load knowledge.');
            setItems(data.items || []);
            setCategories(data.categories || []);
          } else {
            const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
              signal: controller.signal,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Semantic search failed.');
            setItems(data.results || []);
          }
        } else {
          // Standard Keyword Search
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

          setItems(result.items || []);
          setCategories(result.categories || []);
        }
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

    // Debounce typing slightly
    const timer = setTimeout(() => {
      loadKnowledge();
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, search, searchMode, category, itemStatus, criticality]);

  function clearFilters() {
    setSearch('');
    setSearchMode('keyword');
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

  const canAdd = session?.user && ['admin', 'contributor'].includes(session.user.role);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {canAdd && (
            <button
              onClick={() => router.push('/knowledge/new')}
              style={styles.addButton}
            >
              + Add Knowledge
            </button>
          )}

          <div style={styles.count}>
            {items.length} {items.length === 1 ? 'item' : 'items'} found
          </div>
        </div>
      </header>

      <section style={styles.filterCard}>
        <div style={styles.searchWrapper}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <label style={styles.label}>
              {searchMode === 'semantic' ? 'AI Semantic Search (Qdrant Cloud)' : 'Search knowledge'}
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSearchMode('keyword')}
                style={{
                  ...styles.modeToggle,
                  background: searchMode === 'keyword' ? '#2563eb' : '#f1f5f9',
                  color: searchMode === 'keyword' ? '#ffffff' : '#475569',
                }}
              >
                Keyword Match
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('semantic')}
                style={{
                  ...styles.modeToggle,
                  background: searchMode === 'semantic' ? '#16a34a' : '#f1f5f9',
                  color: searchMode === 'semantic' ? '#ffffff' : '#475569',
                }}
              >
                AI Semantic Search
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder={
              searchMode === 'semantic'
                ? "Describe what you need (e.g. 'steps for billing deploy' or 'database outage')..."
                : "Search titles or content..."
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={styles.input}
          />
        </div>

        {searchMode === 'keyword' && (
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
        )}

        {searchMode === 'semantic' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Semantic search ranks knowledge items by meaning using 384-dimensional Qdrant vectors.
            </span>
            <button onClick={clearFilters} style={styles.clearButton}>
              Reset search
            </button>
          </div>
        )}
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

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {item.score !== undefined && (
                    <span style={styles.scoreBadge}>
                      {Math.round(item.score * 100)}% Match
                    </span>
                  )}

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
              </div>

              <h2 style={styles.itemTitle}>{item.title}</h2>

              {item.snippet && (
                <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                  {item.snippet}...
                </p>
              )}

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
  addButton: {
    background: '#2563eb',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
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
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#475569',
  },
  modeToggle: {
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '11px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: 'white',
    color: '#172033',
    fontSize: '14px',
    boxSizing: 'border-box',
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
    fontSize: '13px',
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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
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
  scoreBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    background: '#dcfce7',
    color: '#166534',
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
    marginBottom: '12px',
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
    gridColumn: '1 / -1',
  },
  error: {
    color: '#b91c1c',
    marginBottom: '18px',
  },
};
