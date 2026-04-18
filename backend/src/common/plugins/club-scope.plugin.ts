/**
 * CLUB SCOPE MONGOOSE PLUGIN
 * 
 * Auto-injects clubId into queries when provided via setOptions({ clubId }).
 * 
 * Apply to club-scoped schemas:
 *   GroupSchema.plugin(clubScopePlugin);
 * 
 * Then queries can use:
 *   this.groupModel.find().setOptions({ clubId: req.clubId });
 * 
 * IMPORTANT: Does NOT apply to:
 *   - User schema
 *   - Club schema  
 *   - ClubMembership schema
 *   - OTP schema
 *   - Platform-level configs
 */

import { Schema } from 'mongoose';

export function clubScopePlugin(schema: Schema) {
  // Pre-hook for find operations (Mongoose 9.x uses async, no next callback)
  const findOps = ['find', 'findOne', 'countDocuments', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'] as const;

  for (const op of findOps) {
    schema.pre(op, function () {
      const options: any = this.getOptions ? this.getOptions() : {};
      const clubId = options?.clubId;
      const bypass = options?.bypassClubScope;

      // If bypass flag is set, skip scoping
      if (bypass) return;

      // If clubId provided and not already in query, add it
      if (clubId && !this.getQuery().clubId) {
        this.where({ clubId });
      }
    });
  }

  // Pre-hook for aggregate operations
  schema.pre('aggregate', function () {
    const options: any = (this as any).options || {};
    const clubId = options?.clubId;
    const bypass = options?.bypassClubScope;

    if (bypass) return;

    if (clubId) {
      const pipeline = this.pipeline();
      const first: any = pipeline[0];

      // Only add if not already scoped
      if (!first || !first.$match || (first.$match as any).clubId === undefined) {
        pipeline.unshift({ $match: { clubId } });
      }
    }
  });
}
