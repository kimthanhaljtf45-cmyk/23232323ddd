import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubMembershipDocument = HydratedDocument<ClubMembership>;

export type ClubRole = 'OWNER' | 'ADMIN' | 'COACH' | 'PARENT' | 'STUDENT' | 'MANAGER';

@Schema({ timestamps: true, collection: 'clubmemberships' })
export class ClubMembership {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: String, enum: ['OWNER', 'ADMIN', 'COACH', 'PARENT', 'STUDENT', 'MANAGER'], required: true })
  role: ClubRole;

  @Prop({ type: String, enum: ['ACTIVE', 'INVITED', 'DISABLED'], default: 'ACTIVE' })
  status: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ type: [String], default: [] })
  branchIds: string[];
}

export const ClubMembershipSchema = SchemaFactory.createForClass(ClubMembership);

ClubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });
ClubMembershipSchema.index({ userId: 1 });
ClubMembershipSchema.index({ clubId: 1, role: 1 });
