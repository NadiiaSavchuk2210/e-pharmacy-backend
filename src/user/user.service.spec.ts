import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Decode a base64url-encoded JWT segment without verifying. */
function decodePayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

/** Build a minimal UserDocument-like object. */
function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'user-id-123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1234567890',
    role: 'user',
    passwordHash: '',
    ...overrides,
  };
}

// ─── Shared mock plumbing ─────────────────────────────────────────────────────

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockTokenBlacklistService = {
  add: jest.fn(),
  isBlacklisted: jest.fn(),
};

const TEST_SECRET = 'test-secret-value';

/** Re-create the NestJS module, optionally overriding env. */
async function createModule(env: Record<string, string> = {}) {
  process.env['AUTH_TOKEN_SECRET'] = env['AUTH_TOKEN_SECRET'] ?? TEST_SECRET;
  process.env['AUTH_TOKEN_TTL'] = env['AUTH_TOKEN_TTL'] ?? '';
  process.env['AUTH_REFRESH_TOKEN_TTL'] = env['AUTH_REFRESH_TOKEN_TTL'] ?? '';

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UserService,
      { provide: getModelToken(User.name), useValue: mockUserModel },
      ConfigService,
      { provide: TokenBlacklistService, useValue: mockTokenBlacklistService },
    ],
  }).compile();

  return module.get<UserService>(UserService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTokenBlacklistService.isBlacklisted.mockReturnValue(false);
    service = await createModule();
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      name: '  Jane Doe  ',
      email: '  JANE@Example.COM  ',
      phone: '  +1234567890  ',
      password: 'Secret123!',
    };

    it('creates a user with normalised email, name, and phone', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      const stored = makeUser({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
      });
      mockUserModel.create.mockResolvedValue(stored);

      await service.register(dto);

      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1234567890',
        }),
      );
    });

    it('stores a hashed password, never the plaintext', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      const stored = makeUser();
      mockUserModel.create.mockResolvedValue(stored);

      await service.register(dto);

      const [firstCall] = mockUserModel.create.mock.calls as [
        { passwordHash: string },
      ][];
      const { passwordHash } = firstCall[0];
      expect(passwordHash).not.toBe(dto.password);
      expect(passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('returns access token, refresh token, and user shape', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());

      const result = await service.register(dto);

      expect(result).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: expect(Number),
        token: expect(String),
        refreshToken: expect(String),
        user: {
          id: 'user-id-123',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1234567890',
          role: 'user',
        },
      });
    });

    it('throws ConflictException when the email is already taken', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => makeUser() });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns auth response on valid credentials', async () => {
      // Register first to obtain a real password hash.
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      let capturedHash = '';
      mockUserModel.create.mockImplementation(
        (data: { passwordHash: string }) => {
          capturedHash = data.passwordHash;
          return makeUser({ passwordHash: capturedHash });
        },
      );
      await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '123',
        password: 'Secret123!',
      });

      // Now login with that hash in the DB.
      const stored = makeUser({ passwordHash: capturedHash });
      mockUserModel.findOne.mockReturnValue(stored);

      const result = await service.login({
        email: 'jane@example.com',
        password: 'Secret123!',
      });

      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('jane@example.com');
    });

    it('normalises email before lookup (trims + lowercases)', async () => {
      mockUserModel.findOne.mockReturnValue(null);

      await expect(
        service.login({ email: '  JANE@Example.COM  ', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockUserModel.findOne.mockReturnValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      let capturedHash = '';
      mockUserModel.create.mockImplementation(
        (data: { passwordHash: string }) => {
          capturedHash = data.passwordHash;
          return makeUser({ passwordHash: capturedHash });
        },
      );
      await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '123',
        password: 'CorrectPassword',
      });

      const stored = makeUser({ passwordHash: capturedHash });
      mockUserModel.findOne.mockReturnValue(stored);

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses the same error message for missing user and wrong password (no enumeration)', async () => {
      mockUserModel.findOne.mockReturnValue(null);
      const noUser = await service
        .login({ email: 'ghost@x.com', password: 'p' })
        .catch((e: UnauthorizedException) => e);

      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      let capturedHash = '';
      mockUserModel.create.mockImplementation(
        (data: { passwordHash: string }) => {
          capturedHash = data.passwordHash;
          return makeUser({ passwordHash: capturedHash });
        },
      );
      await service.register({
        name: 'J',
        email: 'jane@example.com',
        phone: '1',
        password: 'right',
      });
      const stored = makeUser({ passwordHash: capturedHash });
      mockUserModel.findOne.mockReturnValue(stored);
      const badPass = await service
        .login({ email: 'jane@example.com', password: 'wrong' })
        .catch((e: UnauthorizedException) => e);

      expect((noUser as UnauthorizedException).message).toBe(
        (badPass as UnauthorizedException).message,
      );
    });
  });

  // ─── getProfile / getUserInfo ───────────────────────────────────────────────

  describe('getProfile', () => {
    const user = {
      sub: 'u1',
      name: 'Jane',
      email: 'j@x.com',
      phone: '123',
      role: 'admin',
      type: 'access' as const,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('returns all five profile fields', () => {
      expect(service.getProfile(user)).toEqual({
        id: 'u1',
        name: 'Jane',
        email: 'j@x.com',
        phone: '123',
        role: 'admin',
      });
    });
  });

  describe('getUserInfo', () => {
    const user = {
      sub: 'u1',
      name: 'Jane',
      email: 'j@x.com',
      phone: '123',
      role: 'user',
      type: 'access' as const,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('returns only id, name, and email', () => {
      const result = service.getUserInfo(user);
      expect(result).toEqual({ id: 'u1', name: 'Jane', email: 'j@x.com' });
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('role');
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('adds the token to the blacklist with the correct expiry', () => {
      const user = {
        sub: 'u1',
        name: 'Jane',
        email: 'j@x.com',
        phone: '1',
        role: 'user',
        type: 'access' as const,
        exp: 9999999999,
      };

      service.logout('some.token', user);

      expect(mockTokenBlacklistService.add).toHaveBeenCalledWith(
        'some.token',
        9999999999,
      );
    });

    it('returns a success message', () => {
      const user = {
        sub: 'u1',
        name: 'Jane',
        email: 'j@x.com',
        phone: '1',
        role: 'user',
        type: 'access' as const,
        exp: 9999999999,
      };

      expect(service.logout('t', user)).toEqual({
        message: 'Successfully logged out',
      });
    });
  });

  // ─── verifyToken ───────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    /** Obtain a real signed access token via register. */
    async function issueToken(
      type: 'access' | 'refresh' = 'access',
    ): Promise<string> {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());
      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });
      return type === 'access' ? result.token : result.refreshToken;
    }

    it('returns the parsed payload for a valid token', async () => {
      const token = await issueToken();
      const payload = service.verifyToken(token);
      expect(payload.email).toBe('jane@example.com');
      expect(payload.type).toBe('access');
    });

    it('throws on a token with wrong number of segments', () => {
      expect(() => service.verifyToken('only.two')).toThrow(
        UnauthorizedException,
      );
      expect(() => service.verifyToken('one')).toThrow(UnauthorizedException);
    });

    it('throws on a tampered payload', async () => {
      const token = await issueToken();
      const [header, , sig] = token.split('.');
      const tampered = JSON.stringify({
        email: 'hacker@evil.com',
        type: 'access',
        exp: 9999999999,
      });
      const badPayload = Buffer.from(tampered).toString('base64url');
      expect(() =>
        service.verifyToken(`${header}.${badPayload}.${sig}`),
      ).toThrow(UnauthorizedException);
    });

    it('throws on a tampered signature', async () => {
      const token = await issueToken();
      expect(() => service.verifyToken(`${token}x`)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws on an expired token', () => {
      // Manually craft a token with exp in the past.
      const expiredPayload = {
        sub: 'u1',
        email: 'j@x.com',
        name: 'J',
        phone: '1',
        role: 'user',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) - 1,
      };
      // Use the service to create a properly signed token, then verify.
      // Access private createToken via bracket notation.
      const token = (
        service as unknown as { createToken: (p: object) => string }
      ).createToken(expiredPayload);
      expect(() => service.verifyToken(token)).toThrow(
        'Authentication token has expired',
      );
    });

    it('throws on a blacklisted token', async () => {
      const token = await issueToken();
      mockTokenBlacklistService.isBlacklisted.mockReturnValue(true);
      expect(() => service.verifyToken(token)).toThrow(
        'Authentication token has been revoked',
      );
    });

    it('rejects a token signed with a different secret', async () => {
      const serviceB = await createModule({
        AUTH_TOKEN_SECRET: 'other-secret',
      });
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());
      const { token } = await serviceB.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });

      // Original service (different secret) should reject it.
      service = await createModule({ AUTH_TOKEN_SECRET: TEST_SECRET });
      expect(() => service.verifyToken(token)).toThrow(UnauthorizedException);
    });
  });

  // ─── refreshAccessToken ────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    async function issueRefreshToken(): Promise<string> {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());
      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });
      return result.refreshToken;
    }

    it('returns a new access token with type "access"', async () => {
      const refreshToken = await issueRefreshToken();
      const result = service.refreshAccessToken(refreshToken);

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBeGreaterThan(0);
      const payload = decodePayload(result.token);
      expect(payload['type']).toBe('access');
    });

    it('preserves the user identity in the new access token', async () => {
      const refreshToken = await issueRefreshToken();
      const result = service.refreshAccessToken(refreshToken);
      const payload = decodePayload(result.token);

      expect(payload['email']).toBe('jane@example.com');
      expect(payload['sub']).toBe('user-id-123');
    });

    it('throws when given an access token instead of a refresh token', async () => {
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());
      const { token: accessToken } = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });

      expect(() => service.refreshAccessToken(accessToken)).toThrow(
        'Invalid token type',
      );
    });

    it('throws on an invalid/expired refresh token', () => {
      expect(() => service.refreshAccessToken('bad.token.here')).toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── TTL / config parsing ──────────────────────────────────────────────────

  describe('TTL configuration', () => {
    it('uses AUTH_TOKEN_TTL from env when set to a valid number', async () => {
      const svc = await createModule({ AUTH_TOKEN_TTL: '7200' });
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());

      const { expiresIn } = await svc.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });

      expect(expiresIn).toBe(7200);
    });

    it('falls back to 3600s when AUTH_TOKEN_TTL is absent', async () => {
      const svc = await createModule({ AUTH_TOKEN_TTL: '' });
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());

      const { expiresIn } = await svc.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });

      expect(expiresIn).toBe(3600);
    });

    it('falls back to default when AUTH_TOKEN_TTL is non-numeric', async () => {
      const svc = await createModule({ AUTH_TOKEN_TTL: 'banana' });
      mockUserModel.findOne.mockReturnValue({ lean: () => null });
      mockUserModel.create.mockResolvedValue(makeUser());

      const { expiresIn } = await svc.register({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '1',
        password: 'pw',
      });

      expect(expiresIn).toBe(3600);
    });

    it('falls back to default when AUTH_TOKEN_TTL is zero or negative', async () => {
      for (const val of ['0', '-60']) {
        const svc = await createModule({ AUTH_TOKEN_TTL: val });
        mockUserModel.findOne.mockReturnValue({ lean: () => null });
        mockUserModel.create.mockResolvedValue(makeUser());

        const { expiresIn } = await svc.register({
          name: 'Jane',
          email: 'jane@example.com',
          phone: '1',
          password: 'pw',
        });

        expect(expiresIn).toBe(3600);
      }
    });
  });

  it('revokes the current token on logout', async () => {
    findOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    createMock.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      role: 'user',
      passwordHash: 'stored-hash',
    });

    const result = await service.register({
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      password: 'StrongPass1!',
    });

    expect(service.verifyToken(result.token)).toEqual(
      expect.objectContaining({
        email: 'nadiia@example.com',
      }),
    );

    expect(service.logout(result.token)).toEqual(
      expect.objectContaining({
        message: 'Logout successful. Remove the token on the client.',
      }),
    );
    expect(() => service.verifyToken(result.token)).toThrow(
      UnauthorizedException,
    );
  });
});
