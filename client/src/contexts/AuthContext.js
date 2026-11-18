'use client';

/**
 * AuthContext - Authentication state management for RemoteView.
 * Provides user, token, login/register/logout functionality
 * and automatic token validation on mount.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginAPI, registerAPI, getMeAPI } from '@/lib/api';
import Cookies from 'js-cookie';

/** @type {React.Context<AuthContextValue>} */
const AuthContext = createContext(null);

/**
 * @typedef {object} AuthContextValue
 * @property {object|null} user - The authenticated user object
 * @property {string|null} token - The JWT token
 * @property {boolean} loading - Whether auth state is being resolved
 * @property {boolean} isAuthenticated - Whether the user is authenticated
 * @property {function} login - Log in with email and password
 * @property {function} register - Register a new account
 * @property {function} logout - Log out and clear credentials
 */

/**
 * Authentication Provider
 * Wraps the application to provide auth state and actions.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Store the token in localStorage and a cookie
   * @param {string} newToken
   */
  const storeToken = useCallback((newToken) => {
    localStorage.setItem('remoteview_token', newToken);
    Cookies.set('remoteview_token', newToken, { expires: 7, sameSite: 'Lax' });
    setToken(newToken);
  }, []);

  /**
   * Clear the token from all storage
   */
  const clearToken = useCallback(() => {
    localStorage.removeItem('remoteview_token');
    Cookies.remove('remoteview_token');
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Validate the stored token and fetch user data on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('remoteview_token');
        if (!storedToken) {
          setLoading(false);
          return;
        }

        setToken(storedToken);
        const data = await getMeAPI();
        setUser(data.user || data);
      } catch (error) {
        console.warn('[Auth] Token validation failed:', error.message);
        clearToken();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [clearToken]);

  /**
   * Log in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The authenticated user
   * @throws {Error} If login fails
   */
  const login = useCallback(async (email, password) => {
    const data = await loginAPI(email, password);
    const authToken = data.token;
    const authUser = data.user || data;

    storeToken(authToken);
    setUser(authUser);

    return authUser;
  }, [storeToken]);

  /**
   * Register a new account
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The created user
   * @throws {Error} If registration fails
   */
  const register = useCallback(async (name, email, password) => {
    const data = await registerAPI(name, email, password);
    const authToken = data.token;
    const authUser = data.user || data;

    storeToken(authToken);
    setUser(authUser);

    return authUser;
  }, [storeToken]);

  /**
   * Log out: clear credentials and redirect to login
   */
  const logout = useCallback(() => {
    clearToken();
    router.push('/login');
  }, [clearToken, router]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * @returns {AuthContextValue}
 * @throws {Error} If used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
