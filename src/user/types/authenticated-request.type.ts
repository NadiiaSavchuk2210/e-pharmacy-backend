import { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
  exp: number;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
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

export type AuthError = {
  message: string;
  code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'UNAUTHORIZED';
};

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  token: string;
  cookies: Record<string, string | undefined>;
}
