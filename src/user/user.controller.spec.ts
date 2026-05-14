import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Response } from 'express';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthGuard } from './guards/auth.guard';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './types/authenticated-request.type';

const mockUser: AuthenticatedUser = {
  sub: 'user-id-123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  role: 'user',
  type: 'access',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockAuthResponse = {
  user: {
    id: mockUser.sub,
    name: mockUser.name,
    email: mockUser.email,
    phone: mockUser.phone,
    role: mockUser.role,
  },
  token: 'access.token.here',
  refreshToken: 'refresh.token.here',
  refreshTokenExpiresIn: 604800,
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
};

const mockAuthResponseBody = {
  user: mockAuthResponse.user,
  token: mockAuthResponse.token,
  tokenType: mockAuthResponse.tokenType,
  expiresIn: mockAuthResponse.expiresIn,
};

const mockUserService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshAccessToken: jest.fn(),
  logout: jest.fn(),
  getUserInfo: jest.fn(),
  getProfile: jest.fn(),
};

const buildRequest = (
  token: string,
  user?: AuthenticatedUser,
  cookies?: Record<string, string>,
): AuthenticatedRequest =>
  ({
    headers: { authorization: `Bearer ${token}` },
    user,
    cookies,
  }) as unknown as AuthenticatedRequest;

type MockResponse = {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
};

const buildResponse = (): MockResponse => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const asResponse = (response: MockResponse): Response =>
  response as unknown as Response;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  // ─── register ────────────────────────────────────────────────────────────

  describe('POST /user/register', () => {
    const dto: RegisterUserDto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      password: 'Secret123!',
    };

    it('sets the refresh cookie and returns the auth body without refreshToken', async () => {
      mockUserService.register.mockResolvedValue(mockAuthResponse);
      const res = buildResponse();

      const result = await controller.register(dto, asResponse(res));

      expect(mockUserService.register).toHaveBeenCalledTimes(1);
      expect(mockUserService.register).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockAuthResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: mockAuthResponse.refreshTokenExpiresIn * 1000,
        }),
      );
      expect(result).toEqual(mockAuthResponseBody);
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('propagates errors thrown by UserService.register', async () => {
      mockUserService.register.mockRejectedValue(
        new Error('User already exists'),
      );

      await expect(
        controller.register(dto, asResponse(buildResponse())),
      ).rejects.toThrow('User already exists');
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────

  describe('POST /user/login', () => {
    const dto: LoginUserDto = {
      email: 'jane@example.com',
      password: 'Secret123!',
    };

    it('sets the refresh cookie and returns the auth body without refreshToken', async () => {
      mockUserService.login.mockReturnValue(mockAuthResponse);
      const res = buildResponse();

      const result = await controller.login(dto, asResponse(res));

      expect(mockUserService.login).toHaveBeenCalledTimes(1);
      expect(mockUserService.login).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockAuthResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: mockAuthResponse.refreshTokenExpiresIn * 1000,
        }),
      );
      expect(result).toEqual(mockAuthResponseBody);
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('propagates UnauthorizedException on bad credentials', async () => {
      mockUserService.login.mockImplementation(() => {
        throw new UnauthorizedException('Invalid email or password');
      });

      await expect(
        controller.login(dto, asResponse(buildResponse())),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────

  describe('POST /user/refresh', () => {
    const refreshToken = 'valid.refresh.token';
    const refreshResult = {
      token: 'new.access.token',
      tokenType: 'Bearer' as const,
      expiresIn: 3600,
    };

    it('reads refreshToken from parsed cookies', () => {
      mockUserService.refreshAccessToken.mockReturnValue(refreshResult);
      const req = buildRequest('', undefined, { refreshToken });

      const result = controller.refresh(req);

      expect(mockUserService.refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
      );
      expect(result).toBe(refreshResult);
    });

    it('falls back to parsing the Cookie header', () => {
      mockUserService.refreshAccessToken.mockReturnValue(refreshResult);
      const req = {
        headers: { cookie: `theme=dark; refreshToken=${refreshToken}` },
      } as unknown as AuthenticatedRequest;

      controller.refresh(req);

      expect(mockUserService.refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
      );
    });

    it('handles a missing refresh cookie gracefully', () => {
      mockUserService.refreshAccessToken.mockReturnValue(refreshResult);
      const req = {
        headers: {},
      } as unknown as AuthenticatedRequest;

      controller.refresh(req);

      expect(mockUserService.refreshAccessToken).toHaveBeenCalledWith('');
    });

    it('propagates UnauthorizedException on invalid/expired refresh token', () => {
      mockUserService.refreshAccessToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid authentication token');
      });
      const req = buildRequest('', undefined, { refreshToken: 'bad.token' });

      expect(() => controller.refresh(req)).toThrow(UnauthorizedException);
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────

  describe('GET /user/logout', () => {
    it('passes the raw token and authenticated user to UserService.logout', () => {
      const token = 'valid.access.token';
      mockUserService.logout.mockReturnValue({
        message: 'Successfully logged out',
      });
      const req = buildRequest(token, mockUser);
      const res = buildResponse();

      const result = controller.logout(req, asResponse(res));

      expect(mockUserService.logout).toHaveBeenCalledWith(token, mockUser);
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
      expect(result).toEqual({ message: 'Successfully logged out' });
    });

    it('returns the message from UserService.logout', () => {
      mockUserService.logout.mockReturnValue({
        message: 'Successfully logged out',
      });
      const req = buildRequest('any.token', mockUser);

      expect(controller.logout(req, asResponse(buildResponse()))).toEqual({
        message: 'Successfully logged out',
      });
    });

    it('clears the refresh cookie even when the access token is missing', () => {
      const req = {
        headers: {},
      } as unknown as AuthenticatedRequest;
      const res = buildResponse();

      expect(controller.logout(req, asResponse(res))).toEqual({
        message: 'Successfully logged out',
      });
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
      expect(mockUserService.logout).not.toHaveBeenCalled();
    });

    it('still clears the refresh cookie when token revocation fails', () => {
      mockUserService.logout.mockImplementation(() => {
        throw new UnauthorizedException('Invalid authentication token');
      });
      const res = buildResponse();

      expect(
        controller.logout(buildRequest('bad.token'), asResponse(res)),
      ).toEqual({
        message: 'Successfully logged out',
      });
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
    });
  });

  // ─── getUserInfo ─────────────────────────────────────────────────────────

  describe('GET /user/user-info', () => {
    it('returns the user info from the authenticated user', () => {
      const userInfo = {
        id: mockUser.sub,
        name: mockUser.name,
        email: mockUser.email,
      };
      mockUserService.getUserInfo.mockReturnValue(userInfo);
      const req = buildRequest('token', mockUser);

      const result = controller.getUserInfo(req);

      expect(mockUserService.getUserInfo).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(userInfo);
    });
  });

  // ─── getProfile ──────────────────────────────────────────────────────────

  describe('GET /user/profile', () => {
    it('returns the full profile from the authenticated user', () => {
      const profile = {
        id: mockUser.sub,
        name: mockUser.name,
        email: mockUser.email,
        phone: mockUser.phone,
        role: mockUser.role,
      };
      mockUserService.getProfile.mockReturnValue(profile);
      const req = buildRequest('token', mockUser);

      const result = controller.getProfile(req);

      expect(mockUserService.getProfile).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(profile);
    });
  });

  describe('guard metadata', () => {
    const getGuards = (methodName: keyof UserController): unknown[] => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        UserController.prototype[methodName],
      ) as unknown;

      return Array.isArray(guards) ? guards : [];
    };

    it('protects user-info and profile with AuthGuard', () => {
      expect(getGuards('getUserInfo')).toContain(AuthGuard);
      expect(getGuards('getProfile')).toContain(AuthGuard);
    });
  });
});
