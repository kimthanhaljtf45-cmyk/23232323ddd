import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { ClubMembership, ClubMembershipDocument } from '../../schemas/club-membership.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import * as jwt from 'jsonwebtoken';

/**
 * Club Context Middleware
 * 
 * Attaches clubId, clubRole, clubMembership to every authenticated request.
 * Sources of clubId (priority order):
 * 1. x-club-id header
 * 2. user.activeClubId from DB
 * 3. First available membership
 */
@Injectable()
export class ClubContextMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(ClubMembership.name)
    private membershipModel: Model<ClubMembershipDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async use(req: any, res: Response, next: NextFunction) {
    // Skip for public/health endpoints
    const path = req.path || req.url || '';
    if (path.includes('/health') || path.includes('/auth/') || path.includes('/consultations')) {
      return next();
    }

    // Try to get userId from authorization header
    let userId: string | null = null;
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access_secret');
        userId = decoded.sub;
      } catch {
        // Token invalid - let auth guard handle
        return next();
      }
    }

    if (!userId) {
      return next();
    }

    // Get clubId from header or user profile
    let clubId = req.headers['x-club-id'] as string;

    if (!clubId) {
      const user = await this.userModel.findById(userId).lean();
      clubId = (user as any)?.activeClubId;
    }

    if (!clubId) {
      // Find first available membership
      const firstMembership = await this.membershipModel.findOne({
        userId,
        status: 'ACTIVE',
      }).lean();
      if (firstMembership) {
        clubId = firstMembership.clubId;
        // Save as activeClubId
        await this.userModel.updateOne({ _id: userId }, { $set: { activeClubId: clubId } });
      }
    }

    if (!clubId) {
      // No club context available - proceed without it
      return next();
    }

    // Verify membership
    const membership = await this.membershipModel.findOne({
      userId,
      clubId,
      status: 'ACTIVE',
    }).lean();

    // Attach context (even without membership for admins)
    req.clubId = clubId;
    if (membership) {
      req.clubMembership = membership;
      req.clubRole = membership.role;
    }

    next();
  }
}
