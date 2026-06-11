import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

// Email + password accounts. On sign-up we also capture the person's name
// and which portal they belong to (parent / educator / director).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email,
          name: params.name ?? '',
          role: params.role ?? 'parent', // 'parent' | 'staff' | 'admin'
        }
      },
    }),
  ],
})
