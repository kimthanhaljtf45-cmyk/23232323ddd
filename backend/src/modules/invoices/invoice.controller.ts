import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async listInvoices(
    @Query('status') status?: string,
    @Query('parentId') parentId?: string,
    @Query('childId') childId?: string,
  ) {
    return this.invoiceService.listInvoices({ status, parentId, childId });
  }

  @Get(':id')
  async getInvoice(@Param('id') id: string) {
    return this.invoiceService.getById(id);
  }

  @Put(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async confirmPayment(
    @Param('id') id: string,
    @Body() body: { adminNote?: string },
  ) {
    return this.invoiceService.confirmPayment(id, body.adminNote);
  }

  @Put(':id/overdue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async markOverdue(@Param('id') id: string) {
    return this.invoiceService.markOverdue(id);
  }
}
