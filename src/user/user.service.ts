import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  scrypt as scryptCallback,
} from 'crypto';
import { Model } from 'mongoose';
import { promisify } from 'util';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { User, type UserDocument } from './schemas/user.schema';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';
import type {
  AuthenticatedUser,
  AuthSession,
} from './types/authenticated-request.type';

const scrypt = promisify(scryptCallback);

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(registerUserDto: RegisterUserDto): Promise<AuthSession> {
    const email = registerUserDto.email.trim().toLowerCase();
    const phone = registerUserDto.phone.trim();
    const name = registerUserDto.name.trim();

    const existingUser = await this.userModel.findOne({ email }).lean();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.hashPassword(registerUserDto.password);
    const createdUser = await this.userModel.create({
      name,
      email,
      phone,
      passwordHash,
    });

    return this.buildAuthResponse(createdUser);
  }

  async login(loginUserDto: LoginUserDto): Promise<AuthSession> {
    const email = loginUserDto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.verifyPassword(
      loginUserDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  getProfile(authenticatedUser: AuthenticatedUser) {
    return {
      id: authenticatedUser.sub,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      phone: authenticatedUser.phone,
      role: authenticatedUser.role,
    };
  }

  getUserInfo(authenticatedUser: AuthenticatedUser) {
    return {
      id: authenticatedUser.sub,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
    };
  }

  logout(token: string, authenticatedUser = this.verifyToken(token)) {
    this.tokenBlacklistService.add(token, authenticatedUser.exp);
    return {
      message: 'Successfully logged out',
    };
  }

  verifyToken(token: string): AuthenticatedUser {
    if (this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Authentication token has been revoked');
    }

    const tokenParts = token.split('.');

    if (tokenParts.length !== 3) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const [headerPart, payloadPart, signaturePart] = tokenParts;

    if (!headerPart || !payloadPart || !signaturePart) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const expectedSignature = this.sign(`${headerPart}.${payloadPart}`);
    const receivedSignature = Buffer.from(signaturePart);
    const validSignature = Buffer.from(expectedSignature);

    if (
      receivedSignature.length !== validSignature.length ||
      !timingSafeEqual(receivedSignature, validSignature)
    ) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const parsedPayload = this.parseTokenPayload(payloadPart);

    if (parsedPayload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Authentication token has expired');
    }

    return parsedPayload;
  }

  refreshAccessToken(refreshToken: string) {
    const authenticatedUser = this.verifyToken(refreshToken);

    if (authenticatedUser.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenTtlSeconds = this.getTokenTtlSeconds();
    const authToken = this.createToken({
      ...authenticatedUser,
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
    });

    return {
      token: authToken,
      tokenType: 'Bearer' as const,
      expiresIn: tokenTtlSeconds,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedPasswordHash: string,
  ): Promise<boolean> {
    const [salt, storedHash] = storedPasswordHash.split(':');

    if (!salt || !storedHash) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    if (storedHashBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedHashBuffer, derivedKey);
  }

  private buildAuthResponse(
    user: UserDocument | (User & { _id: unknown }),
  ): AuthSession {
    const tokenTtlSeconds = this.getTokenTtlSeconds();
    const refreshTokenTtlSeconds = this.getRefreshTokenTtlSeconds();
    const basePayload = {
      sub: this.extractUserId(user),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
    const authToken = this.createToken({
      ...basePayload,
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
    });
    const refreshToken = this.createToken({
      ...basePayload,
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + refreshTokenTtlSeconds,
    });

    return {
      user: {
        id: this.extractUserId(user),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: authToken,
      refreshToken,
      refreshTokenExpiresIn: refreshTokenTtlSeconds,
      tokenType: 'Bearer' as const,
      expiresIn: tokenTtlSeconds,
    };
  }

  private createToken(payload: AuthenticatedUser): string {
    const headerPart = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.sign(`${headerPart}.${payloadPart}`);

    return `${headerPart}.${payloadPart}.${signature}`;
  }

  private sign(payloadPart: string): string {
    return createHmac('sha256', this.getTokenSecret())
      .update(payloadPart)
      .digest('base64url');
  }

  private getTokenSecret(): string {
    return this.configService.getOrThrow<string>('AUTH_TOKEN_SECRET');
  }

  private getTokenTtlSeconds(): number {
    const tokenTtl = this.configService.get<string>('AUTH_TOKEN_TTL');

    if (!tokenTtl) {
      return 60 * 60;
    }

    const parsedTokenTtl = Number.parseInt(tokenTtl, 10);

    return Number.isNaN(parsedTokenTtl) || parsedTokenTtl <= 0
      ? 60 * 60
      : parsedTokenTtl;
  }

  private getRefreshTokenTtlSeconds(): number {
    const tokenTtl = this.configService.get<string>('AUTH_REFRESH_TOKEN_TTL');

    if (!tokenTtl) {
      return 60 * 60 * 24 * 7;
    }

    const parsedTokenTtl = Number.parseInt(tokenTtl, 10);

    return Number.isNaN(parsedTokenTtl) || parsedTokenTtl <= 0
      ? 60 * 60 * 24 * 7
      : parsedTokenTtl;
  }

  private parseTokenPayload(payloadPart: string): AuthenticatedUser {
    try {
      const parsedPayload = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf8'),
      ) as Partial<AuthenticatedUser>;

      if (
        !parsedPayload.sub ||
        !parsedPayload.email ||
        !parsedPayload.name ||
        !parsedPayload.phone ||
        !parsedPayload.role ||
        (parsedPayload.type !== 'access' && parsedPayload.type !== 'refresh') ||
        typeof parsedPayload.exp !== 'number'
      ) {
        throw new Error('Token payload is incomplete');
      }

      return parsedPayload as AuthenticatedUser;
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractUserId(
    user: UserDocument | (User & { _id: unknown }),
  ): string {
    return String(user._id);
  }
}
