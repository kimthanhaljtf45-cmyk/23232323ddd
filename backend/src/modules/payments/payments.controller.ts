import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  getPayments(@CurrentUser() user: any) {
    return this.paymentsService.getPaymentsForParent(user.id);
  }

  @Get(':id')
  getPayment(@Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  @Post(':id/confirm')
  confirmPayment(
    @Param('id') id: string,
    @Body() body: { proofUrl?: string },
  ) {
    return this.paymentsService.confirmPayment(id, body.proofUrl);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  approvePayment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.approvePayment(id, user.id);
  }
}
