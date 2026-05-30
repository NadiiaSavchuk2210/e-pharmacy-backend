import { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  avatar?: string;
  type: 'access' | 'refresh';
  exp: number;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar?: string;
};

export type AuthResponse = {
  user: SafeUser;
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

export type AuthSession = AuthResponse & {
  refreshToken: string;
  refreshTokenExpiresIn: number;
};

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  token: string;
  cookies: Record<string, string | undefined>;
}

export interface OptionalAuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
  cookies: Record<string, string | undefined>;
}
