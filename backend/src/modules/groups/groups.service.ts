import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { withClub } from '../../common/club-scope';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private readonly locationModel: Model<LocationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async findAll(clubId?: string) {
    const query = clubId ? withClub({}, clubId) : {};
    const groups = await this.groupModel.find(query);
    const result = [];

    for (const group of groups) {
      const groupData = this.serialize(group);
      if (group.coachId) {
        const coach = await this.userModel.findById(group.coachId);
        groupData.coach = this.serialize(coach);
      }
      if (group.locationId) {
        const location = await this.locationModel.findById(group.locationId);
        groupData.location = this.serialize(location);
      }
      result.push(groupData);
    }

    return result;
  }

  async findById(id: string, clubId?: string) {
    const group = clubId 
      ? await this.groupModel.findOne(withClub({ _id: id }, clubId))
      : await this.groupModel.findById(id);
    if (!group) return null;

    const groupData = this.serialize(group);
    if (group.coachId) {
      const coach = await this.userModel.findById(group.coachId);
      groupData.coach = this.serialize(coach);
    }
    if (group.locationId) {
      const location = await this.locationModel.findById(group.locationId);
      groupData.location = this.serialize(location);
    }

    return groupData;
  }
}
