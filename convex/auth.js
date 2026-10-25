import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

// Email + password accounts. On sign-up we also capture the person's name
// and which portal they belong to (parent / educator / director).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId)
      if (user?.accessStatus === 'suspended') throw new Error('Your daycare access has ended. Contact the owner.')
    },
  },
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email,
          name: params.name ?? '',
          role: ['parent', 'staff', 'admin'].includes(params.role) ? params.role : 'parent', // 'parent' | 'staff' | 'admin'
        }
      },
    }),
  ],
})
