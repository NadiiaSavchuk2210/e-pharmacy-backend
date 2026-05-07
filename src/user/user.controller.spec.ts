import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
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
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
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
): AuthenticatedRequest =>
  ({
    headers: { authorization: `Bearer ${token}` },
    user,
  }) as unknown as AuthenticatedRequest;

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

    it('delegates to UserService.register and returns its result', async () => {
      mockUserService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(dto);

      expect(mockUserService.register).toHaveBeenCalledTimes(1);
      expect(mockUserService.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockAuthResponse);
    });

    it('propagates errors thrown by UserService.register', async () => {
      mockUserService.register.mockRejectedValue(
        new Error('User already exists'),
      );

      await expect(controller.register(dto)).rejects.toThrow(
        'User already exists',
      );
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────

  describe('POST /user/login', () => {
    const dto: LoginUserDto = {
      email: 'jane@example.com',
      password: 'Secret123!',
    };

    it('delegates to UserService.login and returns its result', () => {
      mockUserService.login.mockReturnValue(mockAuthResponse);

      const result = controller.login(dto);

      expect(mockUserService.login).toHaveBeenCalledTimes(1);
      expect(mockUserService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockAuthResponse);
    });

    it('propagates UnauthorizedException on bad credentials', () => {
      mockUserService.login.mockImplementation(() => {
        throw new UnauthorizedException('Invalid email or password');
      });

      expect(() => controller.login(dto)).toThrow(UnauthorizedException);
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

    it('strips Bearer prefix and passes the token to UserService.refreshAccessToken', () => {
      mockUserService.refreshAccessToken.mockReturnValue(refreshResult);
      const req = buildRequest(refreshToken);

      const result = controller.refresh(req);

      expect(mockUserService.refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
      );
      expect(result).toBe(refreshResult);
    });

    it('handles a missing Authorization header gracefully (empty string after slice)', () => {
      mockUserService.refreshAccessToken.mockReturnValue(refreshResult);
      const req = {
        headers: { authorization: undefined },
      } as unknown as AuthenticatedRequest;

      controller.refresh(req);

      expect(mockUserService.refreshAccessToken).toHaveBeenCalledWith('');
    });

    it('propagates UnauthorizedException on invalid/expired refresh token', () => {
      mockUserService.refreshAccessToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid authentication token');
      });
      const req = buildRequest('bad.token');

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

      const result = controller.logout(req);

      expect(mockUserService.logout).toHaveBeenCalledWith(token, mockUser);
      expect(result).toEqual({ message: 'Successfully logged out' });
    });

    it('returns the message from UserService.logout', () => {
      mockUserService.logout.mockReturnValue({
        message: 'Successfully logged out',
      });
      const req = buildRequest('any.token', mockUser);

      expect(controller.logout(req)).toEqual({
        message: 'Successfully logged out',
      });
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

  // ─── AuthGuard integration ───────────────────────────────────────────────

  describe('AuthGuard protection', () => {
    it('rejects unauthenticated requests to GET /user/logout', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UserController],
        providers: [{ provide: UserService, useValue: mockUserService }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate: () => {
            throw new UnauthorizedException();
          },
        })
        .compile();

      const guardedController = module.get<UserController>(UserController);
      const req = {
        headers: {},
        user: undefined,
      } as unknown as AuthenticatedRequest;

      expect(() => guardedController.logout(req)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects unauthenticated requests to GET /user/profile', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UserController],
        providers: [{ provide: UserService, useValue: mockUserService }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate: () => {
            throw new UnauthorizedException();
          },
        })
        .compile();

      const guardedController = module.get<UserController>(UserController);
      const req = {
        headers: {},
        user: undefined,
      } as unknown as AuthenticatedRequest;

      expect(() => guardedController.getProfile(req)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
