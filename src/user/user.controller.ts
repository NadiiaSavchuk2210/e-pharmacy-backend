import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { AuthGuard } from './guards/auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request.type';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  register(@Body() registerUserDto: RegisterUserDto) {
    return this.userService.register(registerUserDto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() loginUserDto: LoginUserDto) {
    return this.userService.login(loginUserDto);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.userService.getProfile(request.user);
  }

  @Get('user-info')
  @UseGuards(AuthGuard)
  getUserInfo(@Req() request: AuthenticatedRequest) {
    return this.userService.getProfile(request.user);
  }

  @Get('logout')
  @UseGuards(AuthGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.userService.logout(request.token);
  }
}
