
'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }

    if (status === 'authenticated') {
      fetch('/api/dashboard')
        .then(async (response) => {
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Unable to load dashboard');
          }

          return result;
        })
        .then(setData)
        .catch((err) => setError(err.message));
    }
  }, [status, router]);

  if (status === 'loading' || !data) {
    return (
      <main style={styles.loading}>
        {error || 'Loading your dashboard...'}
      </main>
    );
  }

  const stats = [
    { label: 'Total Knowledge', value: data.stats.total_items },
    { label: 'Published', value: data.stats.published_items },
    { label: 'Drafts', value: data.stats.draft_items },
    { label: 'Critical Items', value: data.stats.critical_items },
  ];

  return (
    <main style={styles.layout}>
      <aside style={styles.sidebar}>
        <h2 style={styles.brand}>Knowledge Recovery</h2>

        <nav style={styles.nav}>
  <div style={styles.activeNav}>Dashboard</div>

  <div style={styles.navItem} onClick={() => router.push('/knowledge')}>
    Knowledge Library
  </div>

  <div style={styles.navItem} onClick={() => router.push('/recovery-requests')}>
    Recovery Requests
  </div>

  <div style={styles.navItem} onClick={() => router.push('/my-contributions')}>
    My Contributions
  </div>

  {session.user.role === 'admin' && (
    <>
      <p style={styles.role}>ADMIN</p>
      <div
        style={styles.navItem}
        onClick={() => router.push('/users')}
      >
        User Management
      </div>
    </>
  )}
</nav>

        <div style={styles.sidebarBottom}>
          <p style={styles.role}>
            {session.user.role.toUpperCase()}
          </p>
          <button
            style={styles.logout}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>OVERVIEW</p>
            <h1>Dashboard</h1>
            <p style={styles.subtitle}>
              Welcome back, {session.user.name}
            </p>
          </div>

          <div style={styles.profile}>
            <div style={styles.avatar}>
              {session.user.name.charAt(0)}
            </div>
            <div>
              <strong>{session.user.name}</strong>
              <p style={styles.muted}>{session.user.role}</p>
            </div>
          </div>
        </header>

        <div style={styles.statsGrid}>
          {stats.map((stat) => (
            <article key={stat.label} style={styles.statCard}>
              <p style={styles.muted}>{stat.label}</p>
              <h2>{stat.value}</h2>
            </article>
          ))}
        </div>

        {data.atRiskCount !== null && (
          <article style={styles.riskCard}>
            <div>
              <p style={styles.riskLabel}>KNOWLEDGE AT RISK</p>
              <h2>{data.atRiskCount} items need attention</h2>
              <p style={styles.muted}>
                These items belong to employees who have departed.
              </p>
            </div>
            <div style={styles.riskNumber}>{data.atRiskCount}</div>
          </article>
        )}

        <section style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <div>
              <h2>Recent Knowledge</h2>
              <p style={styles.muted}>
                Recently updated organizational knowledge
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Criticality</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {data.recentItems.map((item) => (
                  <tr key={item.item_id}>
                    <td><strong>{item.title}</strong></td>
                    <td>{item.owner}</td>
                    <td>{item.category || 'Uncategorized'}</td>
                    <td>{item.criticality}/5</td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'Arial, sans-serif',
    color: '#334155',
  },
  layout: {
    minHeight: '100vh',
    display: 'flex',
    background: '#f4f6f9',
    fontFamily: 'Arial, sans-serif',
    color: '#172033',
  },
  sidebar: {
    width: '245px',
    background: '#172554',
    color: 'white',
    padding: '28px 18px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  brand: {
    fontSize: '19px',
    lineHeight: 1.4,
    padding: '0 10px 35px',
  },
  nav: {
    display: 'grid',
    gap: '9px',
  },
  activeNav: {
    background: '#29458a',
    padding: '13px',
    borderRadius: '7px',
    fontWeight: 'bold',
  },
  navItem: {
  padding: '13px',
  color: '#cbd5e1',
  cursor: 'pointer',
},
  sidebarBottom: {
    marginTop: 'auto',
  },
  role: {
    color: '#bfdbfe',
    fontSize: '12px',
    margin: '20px 10px',
    fontWeight: 'bold',
  },
  logout: {
    width: '100%',
    padding: '12px',
    background: '#ffffff',
    color: '#172554',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    minWidth: 0,
    padding: '38px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '32px',
  },
  eyebrow: {
    color: '#64748b',
    fontSize: '12px',
    letterSpacing: '1.5px',
    marginBottom: '9px',
  },
  subtitle: {
    color: '#64748b',
    marginTop: '8px',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '43px',
    height: '43px',
    borderRadius: '50%',
    background: '#dbeafe',
    color: '#1d4ed8',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 'bold',
    fontSize: '19px',
  },
  muted: {
    color: '#64748b',
    fontSize: '13px',
    marginTop: '5px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '18px',
    marginBottom: '25px',
  },
  statCard: {
    background: 'white',
    padding: '23px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  riskCard: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '10px',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    gap: '15px',
  },
  riskLabel: {
    color: '#c2410c',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  riskNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#c2410c',
  },
  tableCard: {
    background: 'white',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px',
  },
  tableHeader: {
    marginBottom: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
  },
  status: {
    padding: '5px 9px',
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
};
