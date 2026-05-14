import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { UserService } from '../user.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let verifyTokenMock: jest.Mock;

  beforeEach(() => {
    verifyTokenMock = jest.fn().mockReturnValue({
      sub: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      phone: '+380991112233',
      role: 'user',
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    guard = new AuthGuard({
      verifyToken: verifyTokenMock,
    } as unknown as UserService);
  });

  it('attaches the authenticated user to the request', () => {
    const request = {
      headers: {
        authorization: 'Bearer signed-token',
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(verifyTokenMock).toHaveBeenCalledWith('signed-token');
    expect(request).toHaveProperty('user');
  });

  it('throws when the authorization header is missing', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects refresh tokens on protected routes', () => {
    verifyTokenMock.mockReturnValue({
      sub: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      phone: '+380991112233',
      role: 'user',
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Bearer refresh-token',
          },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
