import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser } from '../types';
import {
  login as apiLogin,
  fetchCurrentUser,
  getStoredToken,
  removeStoredToken,
} from '../services/api';

interface ActiveEntity {
  id: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  activeEntity: ActiveEntity;
  setActiveEntity: (entity: ActiveEntity) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
}

const DEFAULT_ENTITY: ActiveEntity = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Root Entity',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [activeEntity, setActiveEntity] = useState<ActiveEntity>(DEFAULT_ENTITY);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function initAuth() {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const authUser = await fetchCurrentUser();
          setUser(authUser);
          setActiveEntity({
            id: authUser.entity_id,
            name: authUser.entity_name,
          });
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          removeStoredToken();
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }

    initAuth();
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    setToken(res.token);
    setUser({
      user_id: res.user_id,
      username: res.username,
      display_name: res.display_name,
      profile_name: res.profile_name,
      entity_id: res.entity_id,
      entity_name: res.entity_name,
    });
    setActiveEntity({
      id: res.entity_id,
      name: res.entity_name,
    });
    setLoginModalOpen(false);
  };

  const handleLogout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
    setActiveEntity(DEFAULT_ENTITY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeEntity,
        setActiveEntity,
        login: handleLogin,
        logout: handleLogout,
        isLoading,
        loginModalOpen,
        setLoginModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
