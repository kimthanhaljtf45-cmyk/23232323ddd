import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel('Location') private locationModel: Model<any>,
    @InjectModel('Program') private programModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Group') private groupModel: Model<any>,
    @InjectModel('CoachProfile') private coachProfileModel: Model<any>,
  ) {}

  async getLocations(district?: string) {
    const filter: any = { isActive: { $ne: false } };
    if (district && district !== 'Всі райони') {
      filter.$or = [
        { district: district },
        { city: district },
      ];
    }
    return this.locationModel.find(filter).lean();
  }

  async getLocationById(id: string) {
    return this.locationModel.findById(id).lean();
  }

  async getPrograms(type?: string) {
    const filter: any = { isActive: { $ne: false } };
    if (type) {
      filter.type = type;
    }
    return this.programModel.find(filter).lean();
  }

  async getProgramById(id: string) {
    return this.programModel.findById(id).lean();
  }

  async getCoaches(locationId?: string) {
    const filter: any = { role: 'COACH', status: { $ne: 'INACTIVE' } };
    
    const coaches = await this.userModel.find(filter)
      .select('firstName lastName phone avatarUrl')
      .lean();

    // Get coach profiles with additional info
    const enrichedCoaches = await Promise.all(
      coaches.map(async (coach: any) => {
        const profile: any = await this.coachProfileModel.findOne({ userId: coach._id.toString() }).lean();
        return {
          ...coach,
          specialization: profile?.specialization || 'Бойові мистецтва',
          experience: profile?.experience || 5,
          rating: profile?.rating || 4.5,
          isActive: true,
        };
      })
    );

    return enrichedCoaches;
  }

  async getCoachById(id: string) {
    const coach = await this.userModel.findById(id)
      .select('firstName lastName phone avatarUrl')
      .lean();
      
    if (!coach) return null;
    
    const profile: any = await this.coachProfileModel.findOne({ userId: id }).lean();
    
    // Get coach's groups
    const groups = await this.groupModel.find({ coachId: id }).lean();
    
    return {
      ...coach,
      specialization: profile?.specialization || 'Бойові мистецтва',
      experience: profile?.experience || 5,
      rating: profile?.rating || 4.5,
      groups,
    };
  }

  async getGroups(locationId?: string, programId?: string) {
    const filter: any = {};
    if (locationId) {
      filter.locationId = locationId;
    }
    if (programId) {
      filter.programId = programId;
    }
    return this.groupModel.find(filter).lean();
  }

  async search(query: string) {
    if (!query || query.length < 2) {
      return { locations: [], programs: [], coaches: [] };
    }

    const regex = new RegExp(query, 'i');

    const [locations, programs, coaches] = await Promise.all([
      this.locationModel.find({
        $or: [
          { name: regex },
          { address: regex },
          { district: regex },
        ],
      }).limit(5).lean(),
      this.programModel.find({
        $or: [
          { name: regex },
          { description: regex },
        ],
      }).limit(5).lean(),
      this.userModel.find({
        role: 'COACH',
        $or: [
          { firstName: regex },
          { lastName: regex },
        ],
      }).select('firstName lastName').limit(5).lean(),
    ]);

    return { locations, programs, coaches };
  }
}
