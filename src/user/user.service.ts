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
import { TokenBlacklistService } from 'src/token-blacklist/token-blacklist.service';
import {
  AuthenticatedUser,
  AuthResponse,
} from './types/authenticated-request.type';

const scrypt = promisify(scryptCallback);

const JWT_HEADER = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
).toString('base64url');

const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(registerUserDto: RegisterUserDto): Promise<AuthResponse> {
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

  async login(loginUserDto: LoginUserDto): Promise<AuthResponse> {
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

  logout(
    token: string,
    authenticatedUser: AuthenticatedUser,
  ): { message: string } {
    this.tokenBlacklistService.add(token, authenticatedUser.exp);
    return { message: 'Successfully logged out' };
  }

  refreshAccessToken(refreshToken: string): {
    token: string;
    tokenType: 'Bearer';
    expiresIn: number;
  } {
    const payload = this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const accessTtlSeconds = this.getAccessTtlSeconds();
    const newAccessToken = this.createToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      phone: payload.phone,
      role: payload.role,
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + accessTtlSeconds,
    });

    return {
      token: newAccessToken,
      tokenType: 'Bearer',
      expiresIn: accessTtlSeconds,
    };
  }

  verifyToken(token: string): AuthenticatedUser {
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const [, payloadPart, signaturePart] = parts;
    const signingInput = `${parts[0]}.${parts[1]}`;

    const expectedSig = Buffer.from(this.sign(signingInput), 'base64url');
    const receivedSig = Buffer.from(signaturePart, 'base64url');

    if (
      expectedSig.length !== receivedSig.length ||
      !timingSafeEqual(expectedSig, receivedSig)
    ) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const parsedPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    ) as AuthenticatedUser;

    if (parsedPayload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Authentication token has expired');
    }

    if (this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Authentication token has been revoked');
    }

    return parsedPayload;
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

  private buildAuthResponse(user: UserDocument | (User & { _id: unknown })) {
    const accessTtlSeconds = this.getAccessTtlSeconds();
    const refreshTtlSeconds = this.getRefreshTtlSeconds();
    const userId = this.extractUserId(user);
    const basePayload = {
      sub: userId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.createToken({
      ...basePayload,
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + accessTtlSeconds,
    });

    const refreshToken = this.createToken({
      ...basePayload,
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + refreshTtlSeconds,
    });

    return {
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: accessTtlSeconds,
    };
  }

  private createToken(payload: AuthenticatedUser): string {
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signingInput = `${JWT_HEADER}.${payloadPart}`;
    const signature = this.sign(signingInput);

    return `${signingInput}.${signature}`;
  }

  private sign(input: string): string {
    return createHmac('sha256', this.getTokenSecret())
      .update(input)
      .digest('base64url');
  }

  private getTokenSecret(): string {
    return this.configService.getOrThrow<string>('AUTH_TOKEN_SECRET');
  }

  private getAccessTtlSeconds(): number {
    return this.parseTtl(
      this.configService.get<string>('AUTH_TOKEN_TTL'),
      DEFAULT_ACCESS_TTL_SECONDS,
    );
  }

  private getRefreshTtlSeconds(): number {
    return this.parseTtl(
      this.configService.get<string>('AUTH_REFRESH_TOKEN_TTL'),
      DEFAULT_REFRESH_TTL_SECONDS,
    );
  }

  private parseTtl(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
  }

  private extractUserId(
    user: UserDocument | (User & { _id: unknown }),
  ): string {
    return String(user._id);
  }
}
