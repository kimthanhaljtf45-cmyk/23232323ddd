import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  async listSubscriptions(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('childId') childId?: string,
  ) {
    // Parents can only see their own subscriptions
    if (user.role === 'PARENT') {
      return this.subscriptionService.listSubscriptions({
        status,
        childId,
        parentId: user.id,
      });
    }
    
    // Admins and coaches can see all
    return this.subscriptionService.listSubscriptions({ status, childId });
  }

  @Get(':id')
  async getSubscription(@Param('id') id: string) {
    return this.subscriptionService.getById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PARENT')
  async createSubscription(
    @CurrentUser() user: any,
    @Body() body: {
      childId: string;
      planId: string;
      groupId?: string;
      coachId?: string;
      autoRenew?: boolean;
    },
  ) {
    return this.subscriptionService.createSubscription({
      ...body,
      parentId: user.role === 'PARENT' ? user.id : body.childId, // Admin can specify
    });
  }

  @Put(':id/pause')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PARENT')
  async pauseSubscription(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptionService.pauseSubscription(id, body.reason);
  }

  @Put(':id/resume')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PARENT')
  async resumeSubscription(@Param('id') id: string) {
    return this.subscriptionService.resumeSubscription(id);
  }

  @Put(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PARENT')
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptionService.cancelSubscription(id, body.reason);
  }
}
