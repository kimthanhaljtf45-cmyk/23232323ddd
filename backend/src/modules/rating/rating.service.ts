import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  /**
   * Calculate rating for a single child
   * Formula: score = (attendance * 0.4) + (progress * 0.3) + (tournament * 0.3)
   */
  async calculateChildRating(childId: string) {
    const child = await this.childModel.findById(childId);
    if (!child) return null;

    // 1. Attendance Score (40%)
    const attendances = await this.attendanceModel.find({ childId });
    const totalAttendance = attendances.length;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const attendancePercent = totalAttendance > 0 ? (present / totalAttendance) * 100 : 50;

    // 2. Progress Score (30%) - based on belt
    const beltScores = {
      'WHITE': 10,
      'YELLOW': 30,
      'ORANGE': 50,
      'GREEN': 70,
      'BLUE': 85,
      'BROWN': 95,
      'BLACK': 100,
    };
    const progressPercent = beltScores[child.belt as keyof typeof beltScores] || 10;

    // 3. Tournament Score (30%) - based on tournament points and medals
    const maxTournamentPoints = 100; // Normalized max
    const tournamentPoints = child.tournamentPoints || 0;
    const tournamentPercent = Math.min((tournamentPoints / maxTournamentPoints) * 100, 100);

    // Calculate final score
    const score = 
      attendancePercent * 0.4 +
      progressPercent * 0.3 +
      tournamentPercent * 0.3;

    return {
      childId,
      name: `${child.firstName || ''} ${child.lastName || ''}`.trim(),
      score: Math.round(score * 10) / 10,
      attendanceScore: Math.round(attendancePercent * 10) / 10,
      progressScore: Math.round(progressPercent * 10) / 10,
      tournamentScore: Math.round(tournamentPercent * 10) / 10,
      tournamentPoints: tournamentPoints,
      medals: {
        gold: child.goldMedals || 0,
        silver: child.silverMedals || 0,
        bronze: child.bronzeMedals || 0,
      },
      belt: child.belt || 'WHITE',
      groupId: child.groupId,
    };
  }

  /**
   * Get rating for a specific child with ranks
   */
  async getChildRating(childId: string) {
    const rating = await this.calculateChildRating(childId);
    if (!rating) return null;

    // Calculate rank in group
    if (rating.groupId) {
      const groupChildren = await this.childModel.find({ groupId: rating.groupId });
      const groupRatings = [];
      
      for (const c of groupChildren) {
        const r = await this.calculateChildRating(c._id.toString());
        if (r) groupRatings.push(r);
      }

      groupRatings.sort((a, b) => b.score - a.score);
      const groupIndex = groupRatings.findIndex(r => r.childId === childId);
      rating['rankInGroup'] = groupIndex + 1;
      rating['totalInGroup'] = groupRatings.length;
    }

    // Calculate rank in club
    const allChildren = await this.childModel.find();
    const allRatings = [];
    
    for (const c of allChildren) {
      const r = await this.calculateChildRating(c._id.toString());
      if (r) allRatings.push(r);
    }

    allRatings.sort((a, b) => b.score - a.score);
    const clubIndex = allRatings.findIndex(r => r.childId === childId);
    rating['rankInClub'] = clubIndex + 1;
    rating['totalInClub'] = allRatings.length;
    rating['movement'] = 0; // Would need historical data

    return rating;
  }

  /**
   * Get rating for all children in a group
   */
  async getGroupRating(groupId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) return null;

    const children = await this.childModel.find({ groupId });
    const ratings = [];

    for (const child of children) {
      const rating = await this.calculateChildRating(child._id.toString());
      if (rating) ratings.push(rating);
    }

    // Sort by score
    ratings.sort((a, b) => b.score - a.score);

    // Add ranks
    const items = ratings.map((rating, index) => ({
      childId: rating.childId,
      name: rating.name,
      score: rating.score,
      rank: index + 1,
      belt: rating.belt,
      attendance: rating.attendanceScore,
      progress: rating.progressScore,
    }));

    return {
      groupId,
      name: group.name || '',
      items,
    };
  }

  /**
   * Get club-wide rating (top 50)
   */
  async getClubRating() {
    const children = await this.childModel.find();
    const ratings = [];

    for (const child of children) {
      const rating = await this.calculateChildRating(child._id.toString());
      if (rating) ratings.push(rating);
    }

    // Sort by score
    ratings.sort((a, b) => b.score - a.score);

    // Add ranks and limit to top 50
    const items = ratings.slice(0, 50).map((rating, index) => ({
      childId: rating.childId,
      name: rating.name,
      score: rating.score,
      rank: index + 1,
      belt: rating.belt,
      attendance: rating.attendanceScore,
      progress: rating.progressScore,
    }));

    return {
      name: 'Клуб АТАКА',
      items,
      totalCount: ratings.length,
    };
  }
}
