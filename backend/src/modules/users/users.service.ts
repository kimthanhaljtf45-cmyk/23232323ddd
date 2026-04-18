import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private serialize(user: UserDocument) {
    const obj = user.toObject();
    return {
      id: obj._id.toString(),
      firstName: obj.firstName,
      lastName: obj.lastName,
      username: obj.username,
      phone: obj.phone,
      email: obj.email,
      telegramId: obj.telegramId,
      role: obj.role,
      status: obj.status,
      avatarUrl: obj.avatarUrl || null,
      bio: obj.description || null,
      description: obj.description || null, // Keep for backwards compatibility
      createdAt: (obj as any).createdAt,
    };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    return user ? this.serialize(user) : null;
  }

  async findByTelegramId(telegramId: string) {
    const user = await this.userModel.findOne({ telegramId });
    return user ? this.serialize(user) : null;
  }

  async getMe(userId: string) {
    return this.findById(userId);
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      description?: string;
    }
  ) {
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.description !== undefined) updateData.description = data.description;

    const user = await this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId),
      { $set: updateData },
      { new: true }
    );

    return user ? this.serialize(user) : null;
  }
}
