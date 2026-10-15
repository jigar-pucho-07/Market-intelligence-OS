'use client';
// AuthContext — the signed-in person, as the server read them from the session cookie (a DTO: id, email, name, role —
// never a password hash, never a token). login / logout / codes / profile / password call Server Actions; nothing about
// the session lives in the browser beyond the HttpOnly cookie the server set.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as actions from '../app/actions';
import { rememberWho } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ user: initial, children }) {
  const router = useRouter();
  const [user, setUser] = useState(initial ?? null);
  useEffect(() => { setUser(initial ?? null); }, [initial]);
  useEffect(() => { rememberWho(user?.name); }, [user]);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { success: false, message: 'Please enter email and password' };
    const r = await actions.signIn({ email, password });
    if (r.ok) { setUser(r.user); router.refresh(); return { success: true, user: r.user }; }
    return { success: false, message: r.message };
  }, [router]);

  const loginAsPersona = useCallback(async (role) => {
    const r = await actions.signInAsPersona({ role });
    if (r.ok) { setUser(r.user); router.refresh(); return { success: true, user: r.user }; }
    return { success: false, message: r.message };
  }, [router]);

  const sendOtp = useCallback(async (email) => { const r = await actions.requestCode({ email }); return r.ok ? { success: true, delivery: r.delivery } : { success: false, message: r.message }; }, []);
  const verifyOtp = useCallback(async (email, code) => {
    const r = await actions.verifyCode({ email, code });
    if (r.ok) { setUser(r.user); router.refresh(); return { success: true, user: r.user }; }
    return { success: false, message: r.message };
  }, [router]);

  const updateProfile = useCallback(async (patch) => {
    if (patch.name) { const r = await actions.updateProfile({ name: patch.name }); if (!r.ok) return r; }
    setUser((prev) => ({ ...(prev || {}), ...patch })); router.refresh(); return { ok: true };
  }, [router]);

  const changePassword = useCallback(async (_email, currentPassword, newPassword) => {
    const r = await actions.changePassword({ current: currentPassword || '', next: newPassword || '' });
    return r.ok ? { success: true } : { success: false, message: r.message };
  }, []);

  const logout = useCallback(async () => { await actions.signOut(); setUser(null); router.push('/login'); router.refresh(); }, [router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, loading: false, mode: 'db', login, loginAsPersona, logout, updateProfile, changePassword, sendOtp, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
