import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { CoachProfile, CoachProfileDocument } from '../../schemas/coach-profile.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { CreateProgramDto, UpdateProgramDto } from './programs.dto';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(CoachProfile.name) private coachModel: Model<CoachProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateProgramDto): Promise<Program> {
    const program = new this.programModel(dto);
    return program.save();
  }

  async findAll(clubId?: string): Promise<Program[]> {
    const query: any = { isActive: true };
    if (clubId) query.clubId = clubId;
    return this.programModel.find(query).exec();
  }

  async findByType(type: string, clubId?: string): Promise<Program[]> {
    const query: any = { type, isActive: true };
    if (clubId) query.clubId = clubId;
    return this.programModel.find(query).exec();
  }

  async findOne(id: string): Promise<ProgramDocument> {
    const program = await this.programModel.findById(id).exec();
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async findOneWithCoaches(id: string): Promise<any> {
    const program = await this.findOne(id);
    const coaches = await this.getCoachesForProgram(program);
    return {
      ...(program.toObject ? program.toObject() : program),
      coaches,
    };
  }

  async getCoachesForProgram(program: Program): Promise<any[]> {
    if (!program.coachIds || program.coachIds.length === 0) {
      return [];
    }

    const coaches = [];
    for (const coachId of program.coachIds) {
      const profile = await this.coachModel.findOne({ userId: coachId }).exec();
      const user = await this.userModel.findById(coachId).exec();
      if (user) {
        coaches.push({
          _id: coachId,
          name: user.firstName,
          phone: user.phone,
          bio: profile?.bio,
        });
      }
    }
    return coaches;
  }

  async update(id: string, dto: UpdateProgramDto): Promise<Program> {
    const program = await this.programModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async remove(id: string): Promise<void> {
    await this.programModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  async assignCoach(programId: string, coachId: string): Promise<Program> {
    const program = await this.findOne(programId);
    if (!program.coachIds.includes(coachId)) {
      program.coachIds.push(coachId);
      await this.programModel.findByIdAndUpdate(programId, { coachIds: program.coachIds }).exec();
    }
    return this.findOne(programId);
  }

  async removeCoach(programId: string, coachId: string): Promise<Program> {
    const program = await this.findOne(programId);
    program.coachIds = program.coachIds.filter(id => id !== coachId);
    await this.programModel.findByIdAndUpdate(programId, { coachIds: program.coachIds }).exec();
    return this.findOne(programId);
  }

  // Для onboarding - отримати програми для вибору з інформацією
  async getProgramsForOnboarding(forChild: boolean, clubId?: string): Promise<any[]> {
    let types: string[];
    if (forChild) {
      types = ['KIDS', 'SPECIAL'];
    } else {
      types = ['SELF_DEFENSE', 'MENTORSHIP'];
    }

    const query: any = { type: { $in: types }, isActive: true };
    if (clubId) query.clubId = clubId;

    const programs = await this.programModel.find(query).exec();
    
    return Promise.all(programs.map(async (p) => {
      const coaches = await this.getCoachesForProgram(p);
      return {
        _id: p._id,
        name: p.name,
        type: p.type,
        description: p.description,
        price: p.price,
        trainingsPerWeek: p.trainingsPerWeek,
        duration: p.duration,
        level: p.level,
        ageFrom: p.ageFrom,
        ageTo: p.ageTo,
        coaches: coaches.slice(0, 2), // макс 2 тренери для прев'ю
      };
    }));
  }
}
