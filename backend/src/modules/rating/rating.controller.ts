import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RatingService } from './rating.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('rating')
@UseGuards(JwtAuthGuard)
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('club')
  getClubRating() {
    return this.ratingService.getClubRating();
  }

  @Get('group/:groupId')
  getGroupRating(@Param('groupId') groupId: string) {
    return this.ratingService.getGroupRating(groupId);
  }

  @Get('child/:childId')
  getChildRating(@Param('childId') childId: string) {
    return this.ratingService.getChildRating(childId);
  }
}
