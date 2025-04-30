export interface User {
  id: string;
  email: string;
}

export type Role = 'admin' | 'danisman' | 'izleyici';

export interface Personnel {
  id: string;
  name: string;
  surname: string;
  verimor_extension: string;
  avatar_url?: string | null; // Avatar URL'i opsiyonel olarak eklendi
}

export interface UserWithRole extends User {
  roles: Role[];
  personnel?: Personnel; // Personnel tipini kullan
}

export type AuthState = {
  user: UserWithRole | null;
  isLoading: boolean;
  error: string | null;
};

export type AuthActions = {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

export type AuthStore = AuthState & AuthActions;