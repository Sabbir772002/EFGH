// hooks/useAuth.ts
// Re-exports useAuth from AuthContext so all existing imports keep working.
// Auth state is now a single React Context shared across the whole app —
// this fixes the infinite loading loop where each component had its own
// isolated isLoading state that never synced.

export { useAuth } from '@/context/AuthContext';
