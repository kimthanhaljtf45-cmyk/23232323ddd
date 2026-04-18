import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.getMe(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      description?: string;
    }
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Patch('me')
  async patchMe(
    @CurrentUser() user: any,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      bio?: string;
    }
  ) {
    // Map bio to description field in database
    const updateData: any = {};
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
    if (body.bio !== undefined) updateData.description = body.bio;
    
    return this.usersService.updateProfile(user.id, updateData);
  }
}
