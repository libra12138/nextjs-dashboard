import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { db } from '@/app/lib/db';
import bcrypt from 'bcrypt';

async function getUser(email: string) {
  try {
    return await db.users.findFirst({
      where: {
        email,
      },
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string() })
          .safeParse(credentials);
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          //检查密码
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
          //如果密码匹配，则要返回用户，否则返回 null 以阻止用户登录。
        }
        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
