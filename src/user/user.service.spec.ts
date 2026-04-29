import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';

describe('UserService', () => {
  let service: UserService;
  let findOneMock: jest.Mock;
  let createMock: jest.Mock;

  beforeEach(async () => {
    findOneMock = jest.fn();
    createMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: findOneMock,
            create: createMock,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'AUTH_TOKEN_TTL' ? '3600' : undefined,
            ),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'AUTH_TOKEN_SECRET') {
                return 'test-secret';
              }

              throw new Error(`Unexpected config key ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers a new user and returns a token', async () => {
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
      email: 'NADIIA@example.com',
      phone: '+380991112233',
      password: 'StrongPass1!',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nadiia',
        email: 'nadiia@example.com',
        phone: '+380991112233',
      }),
    );
    expect(createMock.mock.calls[0][0].passwordHash).not.toBe('StrongPass1!');
    expect(result.user.email).toBe('nadiia@example.com');
    expect(result.tokenType).toBe('Bearer');
    expect(result.token).toEqual(expect.any(String));
  });

  it('throws when registering with an existing email', async () => {
    findOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'nadiia@example.com',
      }),
    });

    await expect(
      service.register({
        name: 'Nadiia',
        email: 'nadiia@example.com',
        phone: '+380991112233',
        password: 'StrongPass1!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in an existing user with the correct password', async () => {
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
    const registerResult = await service.register({
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      password: 'StrongPass1!',
    });

    findOneMock.mockReturnValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      role: 'user',
      passwordHash: createMock.mock.calls[0][0].passwordHash,
    });

    const result = await service.login({
      email: 'nadiia@example.com',
      password: 'StrongPass1!',
    });

    expect(result.user).toEqual(registerResult.user);
    expect(result.token).toEqual(expect.any(String));
  });

  it('throws when the password is incorrect', async () => {
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
    const registerResult = await service.register({
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      password: 'StrongPass1!',
    });

    findOneMock.mockReturnValue({
      _id: registerResult.user.id,
      name: 'Nadiia',
      email: 'nadiia@example.com',
      phone: '+380991112233',
      role: 'user',
      passwordHash: createMock.mock.calls[0][0].passwordHash,
    });

    await expect(
      service.login({
        email: 'nadiia@example.com',
        password: 'WrongPass1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies a token and returns its payload', async () => {
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
        sub: '507f1f77bcf86cd799439011',
        email: 'nadiia@example.com',
      }),
    );
  });
});
