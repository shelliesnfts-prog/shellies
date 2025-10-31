import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage } from 'siwe';

// Ink chain ID
const INK_CHAIN_ID = 57073;

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
            console.error('Missing credentials');
            return null;
          }

          const siwe = new SiweMessage(credentials.message);
          
          // Verify the signature
          const fields = await siwe.verify({
            signature: credentials.signature,
          });

          if (!fields.success) {
            console.error('SIWE verification failed');
            return null;
          }

          // Log chain mismatch but still allow authentication
          // RainbowKit will handle prompting the user to switch networks
          if (siwe.chainId !== INK_CHAIN_ID) {
            console.warn('User authenticated on wrong chain:', {
              provided: siwe.chainId,
              expected: INK_CHAIN_ID,
              address: siwe.address
            });
          }

          return {
            id: siwe.address,
            address: siwe.address,
            chainId: siwe.chainId,
          };
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