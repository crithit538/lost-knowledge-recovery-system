'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function NewKnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [criticality, setCriticality] = useState('3');
  const [itemStatus, setItemStatus] = useState('draft');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');

    if (session?.user?.role === 'viewer') {
      router.push('/knowledge');
    }

    if (session?.user?.role === 'admin' ||
        session?.user?.role === 'contributor') {
      fetch('/api/knowledge')
        .then((res) => res.json())
        .then((data) => setCategories(data.categories || []))
        .catch(() => setError('Unable to load categories.'));
    }
  }, [status, session, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: content,
          categoryId: categoryId || null,
          criticality: Number(criticality),
          status: itemStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unable to create knowledge item.');
        return;
      }

      router.push(`/knowledge/${data.item.item_id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <p>Loading...</p>;

  return (
    <main style={{ maxWidth: '850px', margin: '40px auto', padding: '24px' }}>
      <button onClick={() => router.push('/knowledge')}>
        Back to Knowledge Library
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '24px' }}>
        Add Knowledge Item
      </h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Document important information so it can be recovered and reused.
      </p>

      <form onSubmit={handleSubmit}>
        <label>Title</label>
        <input
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter knowledge item title"
          style={inputStyle}
        />

        <label>Content</label>
        <textarea
          required
          maxLength={50000}
          rows={9}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write the knowledge, steps, or procedure..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <label>Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={inputStyle}
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <label>Criticality</label>
        <select
          value={criticality}
          onChange={(e) => setCriticality(e.target.value)}
          style={inputStyle}
        >
          <option value="1">1 - Low</option>
          <option value="2">2 - Moderate</option>
          <option value="3">3 - Medium</option>
          <option value="4">4 - High</option>
          <option value="5">5 - Critical</option>
        </select>

        <label>Status</label>
        <select
          value={itemStatus}
          onChange={(e) => setItemStatus(e.target.value)}
          style={inputStyle}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>

        {error && (
          <p style={{ color: 'red', marginTop: '16px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: '20px',
            padding: '12px 22px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Create Knowledge Item'}
        </button>
      </form>
    </main>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: '11px',
  marginTop: '8px',
  marginBottom: '20px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  fontSize: '15px',
};