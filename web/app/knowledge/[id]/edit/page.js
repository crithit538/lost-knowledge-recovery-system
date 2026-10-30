'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function EditKnowledgePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [criticality, setCriticality] = useState('3');
  const [itemStatus, setItemStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role === 'viewer') {
      router.push('/knowledge');
      return;
    }

    if (status !== 'authenticated' || !id) return;

    async function loadItem() {
      try {
        const [itemResponse, categoryResponse] = await Promise.all([
          fetch(`/api/knowledge/${id}`),
          fetch('/api/knowledge'),
        ]);

        const itemData = await itemResponse.json();
        const categoryData = await categoryResponse.json();

        if (!itemResponse.ok) {
          throw new Error(itemData.error || 'Unable to load item.');
        }

        if (!categoryResponse.ok) {
          throw new Error('Unable to load categories.');
        }

        const item = itemData.item;

        setTitle(item.title || '');
        setContent(item.body || '');
        setCategory(item.category || '');
        setCriticality(String(item.criticality || 3));
        setItemStatus(item.status || 'draft');
        setCategories(categoryData.categories || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [status, session, id, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: content,
          category,
          criticality: Number(criticality),
          status: itemStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unable to update item.');
        return;
      }

      router.push(`/knowledge/${id}`);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) {
    return <p style={{ padding: '30px' }}>Loading...</p>;
  }

  return (
    <main style={{ maxWidth: '850px', margin: '40px auto', padding: '24px' }}>
      <button onClick={() => router.push(`/knowledge/${id}`)}>
        Back to Knowledge Item
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '24px' }}>
        Edit Knowledge Item
      </h1>

      <form onSubmit={handleSubmit}>
        <label>Title</label>
        <input
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />

        <label>Content</label>
        <textarea
          required
          maxLength={50000}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <label>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        >
          <option value="">No category</option>
          {categories.map((name) => (
            <option key={name} value={name}>{name}</option>
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
          {saving ? 'Saving...' : 'Save Changes'}
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