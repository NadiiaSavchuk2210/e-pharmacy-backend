import { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  exp: number;
};

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
