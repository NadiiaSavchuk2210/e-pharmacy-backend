import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { AuthGuard } from './guards/auth.guard';
import type {
  AuthenticatedRequest,
  AuthResponse,
  AuthSession,
} from './types/authenticated-request.type';
import { UserService } from './user.service';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
};

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(
    @Body() registerUserDto: RegisterUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.userService.register(registerUserDto);
    return this.setRefreshCookieAndBuildResponse(response, session);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.userService.login(loginUserDto);
    return this.setRefreshCookieAndBuildResponse(response, session);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() request: AuthenticatedRequest) {
    const refreshToken = this.getRefreshTokenFromCookies(request);
    return this.userService.refreshAccessToken(refreshToken);
  }

  @Get('logout')
  logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    const token = this.getBearerToken(request);

    if (!token) {
      return {
        message: 'Successfully logged out',
      };
    }

    try {
      return this.userService.logout(token, request.user);
    } catch {
      return {
        message: 'Successfully logged out',
      };
    }
  }

  @Get('user-info')
  @UseGuards(AuthGuard)
  getUserInfo(@Req() request: AuthenticatedRequest) {
    return this.userService.getUserInfo(request.user);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.userService.getProfile(request.user);
  }

  private setRefreshCookieAndBuildResponse(
    response: Response,
    session: AuthSession,
  ): AuthResponse {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, session.refreshToken, {
      ...REFRESH_TOKEN_COOKIE_OPTIONS,
      maxAge: session.refreshTokenExpiresIn * 1000,
    });

    return {
      user: session.user,
      token: session.token,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
    };
  }

  private getRefreshTokenFromCookies(request: AuthenticatedRequest): string {
    const parsedCookie = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (typeof parsedCookie === 'string') {
      return parsedCookie;
    }

    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return '';
    }

    const rawCookieHeader = Array.isArray(cookieHeader)
      ? cookieHeader.join('; ')
      : cookieHeader;

    for (const cookiePair of rawCookieHeader.split(';')) {
      const [rawName, ...rawValueParts] = cookiePair.trim().split('=');

      if (rawName === REFRESH_TOKEN_COOKIE_NAME) {
        return decodeURIComponent(rawValueParts.join('='));
      }
    }

    return '';
  }

  private getBearerToken(request: AuthenticatedRequest): string | undefined {
    const authHeader = request.headers.authorization;
    const [scheme, token] = authHeader?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
