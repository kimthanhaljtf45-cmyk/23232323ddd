import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tournament, TournamentDocument, TournamentStatus } from '../../schemas/tournament.schema';
import { TournamentParticipant, TournamentParticipantDocument } from '../../schemas/tournament-participant.schema';
import { TournamentResult, TournamentResultDocument, MedalType } from '../../schemas/tournament-result.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { ProgressSnapshot, ProgressSnapshotDocument } from '../../schemas/progress-snapshot.schema';
import { Achievement, AchievementDocument } from '../../schemas/achievement.schema';
import { FeedPost, FeedPostDocument } from '../../schemas/feed-post.schema';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';

interface CreateTournamentDto {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  locationName: string;
  locationAddress?: string;
  organizer?: string;
  type?: string;
  ageGroups?: string[];
  belts?: string[];
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  imageUrl?: string;
}

interface AddResultDto {
  childId: string;
  place: number;
  medal?: MedalType;
  points: number;
  notes?: string;
}

@Injectable()
export class TournamentsService {
  constructor(
    @InjectModel(Tournament.name) private tournamentModel: Model<TournamentDocument>,
    @InjectModel(TournamentParticipant.name) private participantModel: Model<TournamentParticipantDocument>,
    @InjectModel(TournamentResult.name) private resultModel: Model<TournamentResultDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(ProgressSnapshot.name) private progressModel: Model<ProgressSnapshotDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(FeedPost.name) private feedPostModel: Model<FeedPostDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  // ====== ADMIN OPERATIONS ======

  async createTournament(dto: CreateTournamentDto, adminId: string): Promise<TournamentDocument> {
    return this.tournamentModel.create({
      ...dto,
      type: dto.type || 'INTERNAL',
      status: 'DRAFT',
      ageGroups: dto.ageGroups || [],
      belts: dto.belts || [],
      createdBy: adminId,
    });
  }

  async getAllTournaments(): Promise<TournamentDocument[]> {
    return this.tournamentModel.find().sort({ date: -1 });
  }

  async getTournamentById(id: string): Promise<TournamentDocument> {
    const tournament = await this.tournamentModel.findById(id);
    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }
    return tournament;
  }

  async updateTournamentStatus(id: string, status: TournamentStatus): Promise<TournamentDocument> {
    const tournament = await this.tournamentModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }

    // Create notification for status change
    if (status === 'REGISTRATION_OPEN') {
      await this.createTournamentNotification(tournament, 'Реєстрацію відкрито');
    }

    return tournament;
  }

  async addResult(tournamentId: string, dto: AddResultDto, actorId: string) {
    const tournament = await this.getTournamentById(tournamentId);

    // Upsert result
    const result = await this.resultModel.findOneAndUpdate(
      { tournamentId, childId: dto.childId },
      {
        tournamentId,
        childId: dto.childId,
        place: dto.place,
        medal: dto.medal,
        points: dto.points,
        notes: dto.notes,
        enteredBy: actorId,
      },
      { upsert: true, new: true },
    );

    // Update progress
    await this.applyTournamentResult(dto.childId, dto);

    // Create feed post
    await this.createTournamentResultPost(tournament, dto.childId, dto);

    // Notify parent
    await this.notifyParentAboutResult(dto.childId, tournament, dto);

    return result;
  }

  async getTournamentParticipants(tournamentId: string) {
    const participants = await this.participantModel.find({ tournamentId });
    const childIds = participants.map(p => p.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    return participants.map(p => {
      const child = children.find(c => c._id.toString() === p.childId);
      return {
        ...p.toObject(),
        childName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
        childBelt: child?.belt,
        childAge: child?.age,
      };
    });
  }

  async getTournamentResults(tournamentId: string) {
    const results = await this.resultModel.find({ tournamentId }).sort({ place: 1 });
    const childIds = results.map(r => r.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    return results.map(r => {
      const child = children.find(c => c._id.toString() === r.childId);
      return {
        ...r.toObject(),
        childName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
      };
    });
  }

  // ====== COACH OPERATIONS ======

  async getCoachTournaments(coachId: string) {
    // For now, return all active/upcoming tournaments
    return this.tournamentModel.find({
      status: { $in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ACTIVE'] },
    }).sort({ date: 1 });
  }

  async registerByCoach(tournamentId: string, childId: string, coachId: string, note?: string) {
    const child = await this.childModel.findById(childId);
    if (!child) {
      throw new NotFoundException('Дитину не знайдено');
    }

    // Find parent
    const parentChild = await this.parentChildModel.findOne({ childId });

    return this.registerParticipant(tournamentId, childId, {
      userId: coachId,
      role: 'COACH',
    }, {
      parentId: parentChild?.parentId || '',
      coachId,
      groupId: child.groupId,
      note,
    });
  }

  async getCoachParticipants(tournamentId: string, coachId: string) {
    // Get participants registered by this coach or in coach's groups
    const participants = await this.participantModel.find({
      tournamentId,
      $or: [
        { coachId },
        { registeredByUserId: coachId },
      ],
    });

    const childIds = participants.map(p => p.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    return participants.map(p => {
      const child = children.find(c => c._id.toString() === p.childId);
      return {
        ...p.toObject(),
        childName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
        childBelt: child?.belt,
      };
    });
  }

  // ====== PARENT OPERATIONS ======

  async getParentTournaments(parentId: string) {
    // Get tournaments that are open for registration or active
    const tournaments = await this.tournamentModel.find({
      status: { $in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ACTIVE', 'FINISHED'] },
    }).sort({ date: -1 });

    // Get parent's children
    const parentChildren = await this.parentChildModel.find({ parentId });
    const childIds = parentChildren.map(pc => pc.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    // Get registrations for these children
    const registrations = await this.participantModel.find({
      childId: { $in: childIds },
    });

    return tournaments.map(t => {
      const tournamentId = t._id.toString();
      const registeredChildren = registrations
        .filter(r => r.tournamentId === tournamentId)
        .map(r => {
          const child = children.find(c => c._id.toString() === r.childId);
          return {
            childId: r.childId,
            name: child?.firstName || 'Невідомо',
            status: r.status,
          };
        });

      return {
        ...t.toObject(),
        isRegistered: registeredChildren.length > 0,
        registeredChildren,
      };
    });
  }

  async getParentTournamentDetails(tournamentId: string, parentId: string) {
    const tournament = await this.getTournamentById(tournamentId);

    // Get parent's children
    const parentChildren = await this.parentChildModel.find({ parentId });
    const childIds = parentChildren.map(pc => pc.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    // Get registrations
    const registrations = await this.participantModel.find({
      tournamentId,
      childId: { $in: childIds },
    });

    // Get results
    const results = await this.resultModel.find({
      tournamentId,
      childId: { $in: childIds },
    });

    // Get participants count
    const participantsCount = await this.participantModel.countDocuments({ tournamentId });

    const myChildren = children.map(child => {
      const reg = registrations.find(r => r.childId === child._id.toString());
      const result = results.find(r => r.childId === child._id.toString());
      return {
        childId: child._id.toString(),
        name: child.firstName,
        belt: child.belt,
        registered: !!reg,
        status: reg?.status,
        result: result ? {
          place: result.place,
          medal: result.medal,
          points: result.points,
        } : null,
      };
    });

    return {
      ...tournament.toObject(),
      participantsCount,
      myChildren,
    };
  }

  async registerByParent(tournamentId: string, childId: string, parentId: string) {
    // Verify parent owns this child
    const parentChild = await this.parentChildModel.findOne({ parentId, childId });
    if (!parentChild) {
      throw new BadRequestException('Це не ваша дитина');
    }

    const child = await this.childModel.findById(childId);
    if (!child) {
      throw new NotFoundException('Дитину не знайдено');
    }

    return this.registerParticipant(tournamentId, childId, {
      userId: parentId,
      role: 'PARENT',
    }, {
      parentId,
      coachId: child.coachId,
      groupId: child.groupId,
    });
  }

  async getMyChildrenTournaments(parentId: string) {
    // Get children
    const parentChildren = await this.parentChildModel.find({ parentId });
    const childIds = parentChildren.map(pc => pc.childId);

    // Get all registrations for these children
    const registrations = await this.participantModel.find({
      childId: { $in: childIds },
    });

    const tournamentIds = [...new Set(registrations.map(r => r.tournamentId))];
    const tournaments = await this.tournamentModel.find({ _id: { $in: tournamentIds } });
    const children = await this.childModel.find({ _id: { $in: childIds } });

    // Get results
    const results = await this.resultModel.find({
      childId: { $in: childIds },
    });

    return registrations.map(reg => {
      const tournament = tournaments.find(t => t._id.toString() === reg.tournamentId);
      const child = children.find(c => c._id.toString() === reg.childId);
      const result = results.find(r => 
        r.tournamentId === reg.tournamentId && r.childId === reg.childId
      );

      return {
        tournamentId: reg.tournamentId,
        tournamentTitle: tournament?.title || 'Невідомо',
        tournamentDate: tournament?.date,
        tournamentStatus: tournament?.status,
        childId: reg.childId,
        childName: child?.firstName || 'Невідомо',
        registrationStatus: reg.status,
        result: result ? {
          place: result.place,
          medal: result.medal,
          points: result.points,
        } : null,
      };
    });
  }

  // ====== STUDENT OPERATIONS ======

  async getStudentTournaments(childId: string) {
    const registrations = await this.participantModel.find({ childId });
    const tournamentIds = registrations.map(r => r.tournamentId);
    const tournaments = await this.tournamentModel.find({ _id: { $in: tournamentIds } });

    return tournaments.map(t => {
      const reg = registrations.find(r => r.tournamentId === t._id.toString());
      return {
        ...t.toObject(),
        registrationStatus: reg?.status,
      };
    });
  }

  async getStudentResults(childId: string) {
    const results = await this.resultModel.find({ childId }).sort({ createdAt: -1 });
    const tournamentIds = results.map(r => r.tournamentId);
    const tournaments = await this.tournamentModel.find({ _id: { $in: tournamentIds } });

    return results.map(r => {
      const tournament = tournaments.find(t => t._id.toString() === r.tournamentId);
      return {
        ...r.toObject(),
        tournamentTitle: tournament?.title || 'Невідомо',
        tournamentDate: tournament?.date,
      };
    });
  }

  // ====== SHARED OPERATIONS ======

  private async registerParticipant(
    tournamentId: string,
    childId: string,
    actor: { userId: string; role: 'PARENT' | 'COACH' | 'ADMIN' },
    meta: { parentId: string; coachId?: string; groupId?: string; note?: string },
  ) {
    // Check if tournament accepts registrations
    const tournament = await this.getTournamentById(tournamentId);
    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new BadRequestException('Реєстрація на турнір закрита');
    }

    // Check if already registered
    const exists = await this.participantModel.findOne({ tournamentId, childId });
    if (exists) {
      return exists;
    }

    const participant = await this.participantModel.create({
      tournamentId,
      childId,
      parentId: meta.parentId,
      coachId: meta.coachId,
      groupId: meta.groupId,
      note: meta.note,
      status: 'REGISTERED',
      registeredByRole: actor.role,
      registeredByUserId: actor.userId,
    });

    // Notify parent if registered by coach/admin
    if (actor.role !== 'PARENT' && meta.parentId) {
      await this.notificationModel.create({
        userId: meta.parentId,
        type: 'TOURNAMENT_REGISTRATION',
        title: 'Реєстрація на турнір',
        message: `Вашу дитину зареєстровано на ${tournament.title}`,
        isRead: false,
      });
    }

    return participant;
  }

  private async applyTournamentResult(childId: string, result: AddResultDto) {
    const boost =
      result.medal === 'GOLD' ? 12 :
      result.medal === 'SILVER' ? 8 :
      result.medal === 'BRONZE' ? 5 : 3;

    const snapshot = await this.progressModel.findOne({ childId });
    if (snapshot) {
      const nextProgress = Math.min(100, (snapshot.progressPercent || 0) + boost);
      await this.progressModel.updateOne(
        { childId },
        { progressPercent: nextProgress },
      );
    }

    // Create achievement
    await this.achievementModel.create({
      childId,
      type: 'tournament_result',
      title: result.medal
        ? `Турнірна медаль: ${this.getMedalName(result.medal)}`
        : 'Участь у турнірі',
      awardedAt: new Date(),
    });
  }

  private async createTournamentResultPost(
    tournament: TournamentDocument,
    childId: string,
    result: AddResultDto,
  ) {
    const child = await this.childModel.findById(childId);
    const medalEmoji = result.medal === 'GOLD' ? '🥇' :
                       result.medal === 'SILVER' ? '🥈' :
                       result.medal === 'BRONZE' ? '🥉' : '🏅';

    await this.feedPostModel.create({
      type: 'TOURNAMENT_RESULT',
      title: `${child?.firstName || 'Учень'} виборов ${result.place} місце! ${medalEmoji}`,
      content: `Турнір: ${tournament.title}`,
      authorId: 'system',
      authorType: 'SYSTEM',
      isPublished: true,
      publishedAt: new Date(),
    });
  }

  private async notifyParentAboutResult(
    childId: string,
    tournament: TournamentDocument,
    result: AddResultDto,
  ) {
    const parentChild = await this.parentChildModel.findOne({ childId });
    if (!parentChild) return;

    const child = await this.childModel.findById(childId);
    const medalEmoji = result.medal === 'GOLD' ? '🥇' :
                       result.medal === 'SILVER' ? '🥈' :
                       result.medal === 'BRONZE' ? '🥉' : '🏅';

    await this.notificationModel.create({
      userId: parentChild.parentId,
      type: 'TOURNAMENT_RESULT',
      title: `${child?.firstName || 'Ваша дитина'} виборов ${result.place} місце! ${medalEmoji}`,
      message: `Турнір: ${tournament.title}`,
      isRead: false,
    });
  }

  private async createTournamentNotification(tournament: TournamentDocument, action: string) {
    // In a real app, this would send to all relevant users
    // For now, just log
    console.log(`Tournament notification: ${tournament.title} - ${action}`);
  }

  private getMedalName(medal: MedalType): string {
    switch (medal) {
      case 'GOLD': return 'Золото';
      case 'SILVER': return 'Срібло';
      case 'BRONZE': return 'Бронза';
      default: return '';
    }
  }
}
