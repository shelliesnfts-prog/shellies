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
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every 1 hour
  },
  callbacks: {
    async session({ session, token }) {
      session.address = token.address;
      session.chainId = token.chainId;
      return session;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.address = user.address;
        token.chainId = user.chainId;
      }
      
      // On update, refresh the token data
      if (trigger === 'update') {
        // Token will be refreshed with existing data
        return token;
      }
      
      return token;
    },
  },
  events: {
    async signOut({ token }) {
      // Clear any server-side session data if needed
      console.log('User signed out:', token.address);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};