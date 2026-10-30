import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email and Password',

      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await pool.query(
          `SELECT user_id, full_name, email, password_hash, role, status
           FROM app_user
           WHERE email = $1`,
          [credentials.email.trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (!user || user.status !== 'active') {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!passwordMatches) {
          return null;
        }

        return {
          id: String(user.user_id),
          name: user.full_name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};