import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,        // { id, username, role: 'admin'|'school', school: {...} }

      setTokens: (access, refresh) =>
        set({ token: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: 'rra-auth' }
  )
)
