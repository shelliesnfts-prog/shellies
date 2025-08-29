import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage } from 'siwe';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Ethereum',
      credentials: {
        message: {
          label: 'Message',
          type: 'text',
          placeholder: '0x0',
        },
        signature: {
          label: 'Signature',
          type: 'text',
          placeholder: '0x0',
        },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.message || !credentials?.signature) {
            return null;
          }

          const siwe = new SiweMessage(JSON.parse(credentials.message));
          const fields = await siwe.verify({
            signature: credentials.signature,
          });

          if (fields.success) {
            return {
              id: siwe.address,
              address: siwe.address,
              chainId: siwe.chainId,
            };
          }
          return null;
        } catch (error) {
          console.error('SIWE verification failed:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      session.address = token.address;
      session.chainId = token.chainId;
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.address = user.address;
        token.chainId = user.chainId;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};