import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage } from 'siwe';

const nextAuthOptions: NextAuthOptions = {
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
            console.error('Missing message or signature');
            return null;
          }

          console.log('Received credentials:', {
            message: credentials.message,
            signature: credentials.signature?.substring(0, 20) + '...'
          });

          // Parse the message - it might be a JSON string or a direct message
          let messageObj;
          try {
            // Try parsing as JSON first
            messageObj = JSON.parse(credentials.message);
          } catch (e) {
            // If JSON parsing fails, treat as direct SIWE message string
            console.log('Message is not JSON, treating as direct SIWE message');
            messageObj = credentials.message;
          }

          const siwe = new SiweMessage(messageObj);
          
          console.log('SIWE message parsed:', {
            address: siwe.address,
            chainId: siwe.chainId,
            domain: siwe.domain
          });

          const fields = await siwe.verify({
            signature: credentials.signature,
          });

          console.log('SIWE verification result:', fields);

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

const handler = NextAuth(nextAuthOptions);

export { handler as GET, handler as POST };