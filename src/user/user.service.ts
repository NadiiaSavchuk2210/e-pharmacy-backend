import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
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
import { AuthenticatedUser } from './types/authenticated-request.type';

const scrypt = promisify(scryptCallback);

type SafeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
};

type AuthResponse = {
  user: SafeUser;
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

@Injectable()
export class UserService {
  private readonly revokedTokenExpirations = new Map<string, number>();

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
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

  logout(token: string) {
    const authenticatedUser = this.verifyToken(token);
    this.revokedTokenExpirations.set(
      this.hashToken(token),
      authenticatedUser.exp,
    );
    this.removeExpiredRevokedTokens();

    return {
      expiresAt: new Date(authenticatedUser.exp * 1000).toISOString(),
      message: 'Logout successful. Remove the token on the client.',
    };
  }

  verifyToken(token: string): AuthenticatedUser {
    if (this.isTokenRevoked(token)) {
      throw new UnauthorizedException('Authentication token has been revoked');
    }

    const [payloadPart, signaturePart] = token.split('.');

    if (!payloadPart || !signaturePart) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const expectedSignature = this.sign(payloadPart);
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
    const tokenTtlSeconds = this.getTokenTtlSeconds();
    const authToken = this.createToken({
      sub: this.extractUserId(user),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
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
      tokenType: 'Bearer' as const,
      expiresIn: tokenTtlSeconds,
    };
  }

  private createToken(payload: AuthenticatedUser): string {
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.sign(payloadPart);

    return `${payloadPart}.${signature}`;
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
      return 60 * 60 * 24;
    }

    const parsedTokenTtl = Number.parseInt(tokenTtl, 10);

    return Number.isNaN(parsedTokenTtl) || parsedTokenTtl <= 0
      ? 60 * 60 * 24
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isTokenRevoked(token: string): boolean {
    this.removeExpiredRevokedTokens();

    return this.revokedTokenExpirations.has(this.hashToken(token));
  }

  private removeExpiredRevokedTokens(): void {
    const now = Math.floor(Date.now() / 1000);

    for (const [tokenHash, expiresAt] of this.revokedTokenExpirations) {
      if (expiresAt <= now) {
        this.revokedTokenExpirations.delete(tokenHash);
      }
    }
  }
}
