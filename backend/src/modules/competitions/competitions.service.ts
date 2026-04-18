import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Competition,
  CompetitionDocument,
} from '../../schemas/competition.schema';
import {
  CompetitionParticipant,
  CompetitionParticipantDocument,
} from '../../schemas/competition-participant.schema';
import {
  CompetitionResult,
  CompetitionResultDocument,
} from '../../schemas/competition-result.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Alert, AlertDocument } from '../../schemas/alert.schema';
import { FeedPost, FeedPostDocument } from '../../schemas/feed-post.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';

import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { JoinCompetitionDto } from './dto/join-competition.dto';
import { UpdateParticipantStatusDto } from './dto/update-participant-status.dto';
import { CreateResultDto } from './dto/create-result.dto';

// Points for medals
const MEDAL_POINTS = {
  GOLD: 20,
  SILVER: 10,
  BRONZE: 5,
  PARTICIPATION: 1,
};

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectModel(Competition.name)
    private readonly competitionModel: Model<CompetitionDocument>,

    @InjectModel(CompetitionParticipant.name)
    private readonly participantModel: Model<CompetitionParticipantDocument>,

    @InjectModel(CompetitionResult.name)
    private readonly resultModel: Model<CompetitionResultDocument>,

    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,

    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,

    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,

    @InjectModel(FeedPost.name)
    private readonly feedPostModel: Model<FeedPostDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
  ) {}

  // ===== COACH COMPETITIONS TODAY =====
  async getTodayCompetitionsForCoach(coachId: string) {
    const today = new Date().toISOString().slice(0, 10);

    // Get coach's groups
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());

    // Get children in coach's groups
    const children = await this.childModel.find({
      groupId: { $in: groupIds },
    });
    const childIds = children.map(c => c._id.toString());

    // Get today's competitions (OPEN or CLOSED status)
    const competitions = await this.competitionModel.find({
      date: today,
      status: { $in: ['OPEN', 'CLOSED'] },
    });

    const compIds = competitions.map(c => c._id.toString());

    // Get participants from coach's students
    const participants = await this.participantModel.find({
      competitionId: { $in: compIds },
      childId: { $in: childIds },
    });

    // Get results if any
    const results = await this.resultModel.find({
      competitionId: { $in: compIds },
      childId: { $in: childIds },
    });

    return {
      date: today,
      participants: participants.map(p => {
        const child = children.find(c => c._id.toString() === p.childId);
        const competition = competitions.find(c => c._id.toString() === p.competitionId);
        const result = results.find(r => 
          r.competitionId === p.competitionId && r.childId === p.childId
        );

        return {
          participantId: p._id.toString(),
          childId: p.childId,
          childName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
          childBelt: child?.belt || 'WHITE',
          competitionId: p.competitionId,
          competitionTitle: competition?.title || 'Змагання',
          status: p.status,
          paid: p.paid,
          category: p.category,
          hasFee: competition?.hasFee || false,
          feeAmount: competition?.feeAmount || 0,
          result: result ? {
            medal: result.medal,
            place: result.place,
            awardType: result.awardType,
          } : null,
        };
      }),
      summary: {
        total: participants.length,
        confirmed: participants.filter(p => p.status === 'CONFIRMED').length,
        pending: participants.filter(p => p.status === 'PENDING').length,
        paid: participants.filter(p => p.paid).length,
        unpaid: participants.filter(p => !p.paid).length,
      },
    };
  }

  async create(dto: CreateCompetitionDto) {
    return this.competitionModel.create({
      ...dto,
      status: 'DRAFT',
      isActive: true,
    });
  }

  async findAll(status?: string, programType?: string) {
    const query: any = { isActive: true };
    if (status) query.status = status;
    if (programType) query.programType = programType;

    return this.competitionModel.find(query).sort({ date: 1 });
  }

  async findById(id: string): Promise<any> {
    const competition = await this.competitionModel.findById(id).lean();
    if (!competition) throw new NotFoundException('Змагання не знайдено');

    const participants = await this.participantModel
      .find({ competitionId: id })
      .lean();

    // Get child info for participants
    const childIds = participants.map((p) => p.childId);
    const children = await this.childModel
      .find({ _id: { $in: childIds } })
      .lean();

    const results = await this.resultModel.find({ competitionId: id }).lean();

    const participantsWithChildren = participants.map((p) => ({
      ...p,
      child: children.find((c) => c._id.toString() === p.childId),
    }));

    return {
      ...competition,
      participants: participantsWithChildren,
      results,
      stats: {
        totalParticipants: participants.length,
        confirmed: participants.filter((p) => p.status === 'CONFIRMED').length,
        pending: participants.filter((p) => p.status === 'PENDING').length,
        paid: participants.filter((p) => p.paid).length,
      },
    };
  }

  async update(id: string, dto: UpdateCompetitionDto) {
    const competition = await this.competitionModel.findById(id);
    if (!competition) throw new NotFoundException('Змагання не знайдено');

    const oldStatus = competition.status;
    Object.assign(competition, dto);
    await competition.save();

    // Send alerts on status change
    if (dto.status && dto.status !== oldStatus) {
      await this.handleStatusChange(competition, oldStatus, dto.status);
    }

    return competition;
  }

  // Helper: Handle competition status changes
  private async handleStatusChange(competition: any, oldStatus: string, newStatus: string) {
    if (newStatus === 'OPEN') {
      // Notify all parents about new competition
      const parents = await this.userModel.find({ role: 'PARENT' });
      for (const parent of parents) {
        await this.alertModel.create({
          userId: parent._id.toString(),
          type: 'COMPETITION_OPEN',
          severity: 'info',
          title: '🏆 Нові змагання!',
          message: `Відкрито реєстрацію на "${competition.title}"`,
          meta: { competitionId: competition._id.toString() },
        });
      }
    } else if (newStatus === 'FINISHED') {
      // Create feed post with results
      const results = await this.resultModel.find({ competitionId: competition._id.toString() });
      if (results.length > 0) {
        const childIds = results.map(r => r.childId);
        const children = await this.childModel.find({ _id: { $in: childIds } });
        
        const championsText = results
          .filter(r => r.medal !== 'PARTICIPATION')
          .sort((a, b) => a.place - b.place)
          .slice(0, 5)
          .map(r => {
            const child = children.find(c => c._id.toString() === r.childId);
            const medalEmoji = r.medal === 'GOLD' ? '🥇' : r.medal === 'SILVER' ? '🥈' : '🥉';
            return `${medalEmoji} ${child?.firstName || 'Учасник'} - ${r.place} місце`;
          })
          .join('\n');

        await this.feedPostModel.create({
          type: 'TOURNAMENT_RESULT',
          title: `🏆 ${competition.title} - Результати`,
          content: `Наші чемпіони:\n\n${championsText}`,
          authorId: 'SYSTEM',
          authorType: 'SYSTEM',
          isPublished: true,
          publishedAt: new Date(),
          tags: ['змагання', 'результати'],
        });
      }
    }
  }

  async joinCompetition(
    competitionId: string,
    dto: JoinCompetitionDto,
    currentUserId: string,
  ) {
    const competition = await this.competitionModel.findById(competitionId);
    if (!competition) throw new NotFoundException('Змагання не знайдено');

    if (competition.status !== 'OPEN') {
      throw new BadRequestException('Реєстрація на змагання закрита');
    }

    const today = new Date().toISOString().slice(0, 10);
    if (today > competition.registrationDeadline) {
      throw new BadRequestException('Термін реєстрації минув');
    }

    const child = await this.childModel.findById(dto.childId);
    if (!child) throw new NotFoundException('Учня не знайдено');

    // Check access - parent or student themselves
    if (child.roleOwnerId !== currentUserId && child.parentId !== currentUserId) {
      throw new BadRequestException('Немає доступу до цього учня');
    }

    const existing = await this.participantModel.findOne({
      competitionId,
      childId: dto.childId,
    });

    if (existing) {
      throw new BadRequestException('Учень вже зареєстрований на ці змагання');
    }

    let invoiceId: string | undefined;

    // Create invoice if fee required
    if (competition.hasFee && competition.feeAmount && competition.feeAmount > 0) {
      const invoice = await this.invoiceModel.create({
        childId: dto.childId,
        parentId: currentUserId,
        subscriptionId: `competition-${competitionId}`,
        amount: competition.feeAmount,
        currency: 'UAH',
        description: `Внесок за участь: ${competition.title}`,
        status: 'PENDING',
        dueDate: new Date(competition.registrationDeadline),
      });

      invoiceId = invoice._id.toString();
    }

    const participant = await this.participantModel.create({
      competitionId,
      childId: dto.childId,
      status: 'PENDING',
      paid: !competition.hasFee, // Якщо без оплати - відразу оплачено
      category: dto.category,
      invoiceId,
      parentId: currentUserId,
    });

    // Send alert to parent about registration
    await this.alertModel.create({
      userId: currentUserId,
      childId: dto.childId,
      type: 'COMPETITION_JOINED',
      severity: 'info',
      title: '✅ Реєстрація на змагання',
      message: `${child.firstName} зареєстровано на "${competition.title}"`,
      meta: { 
        competitionId, 
        participantId: participant._id.toString(),
        hasFee: competition.hasFee,
        feeAmount: competition.feeAmount,
      },
    });

    // If has fee, send payment reminder
    if (competition.hasFee && competition.feeAmount) {
      await this.alertModel.create({
        userId: currentUserId,
        childId: dto.childId,
        type: 'COMPETITION_PAYMENT_PENDING',
        severity: 'warning',
        title: '💳 Оплата внеску',
        message: `Оплатіть ${competition.feeAmount} грн за участь у "${competition.title}"`,
        meta: { competitionId, invoiceId },
      });
    }

    return participant;
  }

  async getMyCompetitions(userId: string) {
    // Find all children where user is parent or owner
    const children = await this.childModel.find({
      $or: [{ roleOwnerId: userId }, { parentId: userId }],
    });

    const childIds = children.map((c) => c._id.toString());

    const participants = await this.participantModel
      .find({ childId: { $in: childIds } })
      .lean();

    const competitionIds = participants.map((p) => p.competitionId);
    const competitions = await this.competitionModel
      .find({ _id: { $in: competitionIds } })
      .lean();

    // Get results for participated competitions
    const results = await this.resultModel
      .find({
        competitionId: { $in: competitionIds },
        childId: { $in: childIds },
      })
      .lean();

    return participants.map((participant) => {
      const competition = competitions.find(
        (c) => c._id.toString() === participant.competitionId,
      );
      const child = children.find((c) => c._id.toString() === participant.childId);
      const result = results.find(
        (r) =>
          r.competitionId === participant.competitionId &&
          r.childId === participant.childId,
      );

      return {
        participant,
        competition,
        child,
        result,
      };
    });
  }

  async updateParticipantStatus(
    competitionId: string,
    dto: UpdateParticipantStatusDto,
  ) {
    const participant = await this.participantModel.findById(dto.participantId);
    if (!participant) throw new NotFoundException('Учасника не знайдено');

    if (participant.competitionId !== competitionId) {
      throw new BadRequestException('Невірний competitionId');
    }

    participant.status = dto.status;
    if (dto.note) participant.note = dto.note;

    await participant.save();

    return participant;
  }

  async markPaid(participantId: string) {
    const participant = await this.participantModel.findById(participantId);
    if (!participant) throw new NotFoundException('Учасника не знайдено');

    participant.paid = true;
    await participant.save();

    // Update invoice if exists
    if (participant.invoiceId) {
      await this.invoiceModel.findByIdAndUpdate(participant.invoiceId, {
        status: 'PAID',
        paidAt: new Date(),
      });
    }

    return participant;
  }

  async addResult(competitionId: string, dto: CreateResultDto) {
    const competition = await this.competitionModel.findById(competitionId);
    if (!competition) throw new NotFoundException('Змагання не знайдено');

    const child = await this.childModel.findById(dto.childId);
    if (!child) throw new NotFoundException('Учня не знайдено');

    // Check if participant exists
    const participant = await this.participantModel.findOne({
      competitionId,
      childId: dto.childId,
    });

    if (!participant) {
      throw new BadRequestException('Учень не зареєстрований на ці змагання');
    }

    // Update or create result
    const existing = await this.resultModel.findOne({
      competitionId,
      childId: dto.childId,
    });

    let result;
    if (existing) {
      // Revert previous points
      const oldPoints = MEDAL_POINTS[existing.medal as keyof typeof MEDAL_POINTS] || 0;
      await this.childModel.findByIdAndUpdate(dto.childId, {
        $inc: { tournamentPoints: -oldPoints },
      });

      existing.medal = dto.medal;
      existing.place = dto.place;
      existing.awardType = dto.awardType;
      existing.note = dto.note;
      await existing.save();
      result = existing;
    } else {
      result = await this.resultModel.create({
        competitionId,
        childId: dto.childId,
        medal: dto.medal,
        place: dto.place,
        awardType: dto.awardType,
        note: dto.note,
      });
    }

    // === RATING INTEGRATION ===
    const points = MEDAL_POINTS[dto.medal as keyof typeof MEDAL_POINTS] || 0;
    
    // Update child tournament points and medal counts
    const medalUpdate: any = { $inc: { tournamentPoints: points } };
    if (dto.medal === 'GOLD') medalUpdate.$inc.goldMedals = 1;
    if (dto.medal === 'SILVER') medalUpdate.$inc.silverMedals = 1;
    if (dto.medal === 'BRONZE') medalUpdate.$inc.bronzeMedals = 1;
    
    await this.childModel.findByIdAndUpdate(dto.childId, medalUpdate);

    // === ALERTS INTEGRATION ===
    const parentId = child.parentId || child.roleOwnerId;
    const medalEmoji = dto.medal === 'GOLD' ? '🥇' : dto.medal === 'SILVER' ? '🥈' : dto.medal === 'BRONZE' ? '🥉' : '🏅';
    const medalLabel = dto.medal === 'GOLD' ? 'золото' : dto.medal === 'SILVER' ? 'срібло' : dto.medal === 'BRONZE' ? 'бронза' : 'участь';

    await this.alertModel.create({
      userId: parentId,
      childId: dto.childId,
      type: 'COMPETITION_RESULT',
      severity: dto.medal === 'GOLD' ? 'info' : 'info',
      title: `${medalEmoji} Результат змагань!`,
      message: `${child.firstName} зайняв ${dto.place} місце (${medalLabel}) на "${competition.title}"`,
      meta: {
        competitionId,
        medal: dto.medal,
        place: dto.place,
        points,
        awardType: dto.awardType,
      },
    });

    return result;
  }

  async getChampions(limit = 20) {
    const results = await this.resultModel
      .find({ medal: { $in: ['GOLD', 'SILVER', 'BRONZE'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const childIds = results.map((r) => r.childId);
    const competitionIds = results.map((r) => r.competitionId);

    const children = await this.childModel
      .find({ _id: { $in: childIds } })
      .lean();
    const competitions = await this.competitionModel
      .find({ _id: { $in: competitionIds } })
      .lean();

    return results.map((result) => ({
      result,
      child: children.find((c) => c._id.toString() === result.childId),
      competition: competitions.find(
        (c) => c._id.toString() === result.competitionId,
      ),
    }));
  }

  async getUpcoming(limit = 5) {
    const today = new Date().toISOString().slice(0, 10);
    return this.competitionModel
      .find({
        isActive: true,
        status: 'OPEN',
        date: { $gte: today },
      })
      .sort({ date: 1 })
      .limit(limit);
  }

  async getStats() {
    const total = await this.competitionModel.countDocuments({ isActive: true });
    const open = await this.competitionModel.countDocuments({
      isActive: true,
      status: 'OPEN',
    });
    const finished = await this.competitionModel.countDocuments({
      isActive: true,
      status: 'FINISHED',
    });
    const totalParticipants = await this.participantModel.countDocuments();
    const goldMedals = await this.resultModel.countDocuments({ medal: 'GOLD' });
    const silverMedals = await this.resultModel.countDocuments({ medal: 'SILVER' });
    const bronzeMedals = await this.resultModel.countDocuments({ medal: 'BRONZE' });

    return {
      total,
      open,
      finished,
      totalParticipants,
      medals: {
        gold: goldMedals,
        silver: silverMedals,
        bronze: bronzeMedals,
      },
    };
  }

  // ===== ADMIN KPI: DETAILED COMPETITION STATS =====
  async getCompetitionDetailedStats(competitionId: string) {
    const competition = await this.competitionModel.findById(competitionId);
    if (!competition) throw new NotFoundException('Змагання не знайдено');

    const participants = await this.participantModel.find({ competitionId });
    const results = await this.resultModel.find({ competitionId });

    const total = participants.length;
    const confirmed = participants.filter(p => p.status === 'CONFIRMED').length;
    const pending = participants.filter(p => p.status === 'PENDING').length;
    const rejected = participants.filter(p => p.status === 'REJECTED').length;
    const paid = participants.filter(p => p.paid).length;
    const unpaid = participants.filter(p => !p.paid).length;

    // Calculate revenue
    const feeAmount = competition.feeAmount || 0;
    const revenue = paid * feeAmount;
    const potentialRevenue = total * feeAmount;
    const missedRevenue = unpaid * feeAmount;

    // Results breakdown
    const goldCount = results.filter(r => r.medal === 'GOLD').length;
    const silverCount = results.filter(r => r.medal === 'SILVER').length;
    const bronzeCount = results.filter(r => r.medal === 'BRONZE').length;
    const participationCount = results.filter(r => r.medal === 'PARTICIPATION').length;

    // Conversion rates
    const confirmationRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    const paymentRate = total > 0 ? Math.round((paid / total) * 100) : 0;

    return {
      competitionId,
      competitionTitle: competition.title,
      date: competition.date,
      status: competition.status,
      hasFee: competition.hasFee,
      feeAmount,
      participants: {
        total,
        confirmed,
        pending,
        rejected,
        paid,
        unpaid,
      },
      revenue: {
        collected: revenue,
        potential: potentialRevenue,
        missed: missedRevenue,
        currency: 'UAH',
      },
      conversion: {
        confirmationRate,
        paymentRate,
      },
      results: {
        total: results.length,
        gold: goldCount,
        silver: silverCount,
        bronze: bronzeCount,
        participation: participationCount,
      },
    };
  }
}
