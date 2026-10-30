'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password, or your account is inactive.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f4f6f8',
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white',
          padding: '35px',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ marginBottom: '8px' }}>
          Lost Knowledge Recovery
        </h1>

        <p style={{ color: '#666', marginBottom: '25px' }}>
          Sign in to your account
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            padding: '11px',
            margin: '8px 0 18px',
            boxSizing: 'border-box',
          }}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            padding: '11px',
            margin: '8px 0 18px',
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <p style={{ color: 'red', marginBottom: '15px' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: '#1d4ed8',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}