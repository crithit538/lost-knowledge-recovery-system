'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function MyContributionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }

    if (status === 'authenticated') {
      fetch('/api/knowledge?mine=true')
        .then((res) => res.json())
        .then((data) => setItems(data.items || []))
        .catch((error) => console.error(error))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === 'loading' || loading) {
    return <main style={{ padding: 40 }}>Loading your contributions...</main>;
  }

  return (
    <main style={{ padding: '32px', maxWidth: 1100, margin: 'auto' }}>
      <button onClick={() => router.push('/')}>← Dashboard</button>

      <h1 style={{ fontSize: 30, fontWeight: 'bold', marginTop: 24 }}>
        My Contributions
      </h1>

      <p style={{ color: '#666', marginTop: 8 }}>
        Knowledge entries created or owned by you.
      </p>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <strong>{items.length}</strong> contribution(s)
      </div>

      {items.length === 0 ? (
        <p>You haven't contributed any knowledge items yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {items.map((item) => (
            <div
              key={item.item_id}
              onClick={() => router.push(`/knowledge/${item.item_id}`)}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 20,
                cursor: 'pointer',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 'bold' }}>
                {item.title}
              </h2>

              <p style={{ color: '#666', marginTop: 8 }}>
                {item.category_name || 'Uncategorized'} · Criticality:{' '}
                {item.criticality}
              </p>

              <p style={{ marginTop: 8 }}>
                Status: <strong>{item.status}</strong>
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}