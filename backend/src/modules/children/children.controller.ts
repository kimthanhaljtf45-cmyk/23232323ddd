import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('children')
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get()
  getMyChildren(@CurrentUser() user: any) {
    return this.childrenService.getChildrenForParent(user.id);
  }

  @Get(':id')
  getChild(@Param('id') id: string) {
    return this.childrenService.getChildById(id);
  }
}
