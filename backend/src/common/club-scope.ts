/**
 * CLUB SCOPE UTILITIES
 * 
 * Provides helpers for enforcing club-scoped queries.
 * Every business query must include clubId to prevent data leaks between clubs.
 * 
 * Usage:
 *   this.groupModel.find(withClub({}, req.clubId))
 *   this.invoiceModel.find(withClub({ status: 'PAID' }, clubId))
 */

import { BadRequestException } from '@nestjs/common';

/**
 * Ensures clubId is present, throws if missing
 */
export function requireClubId(clubId?: string): string {
  if (!clubId) {
    throw new BadRequestException('clubId is required for this operation');
  }
  return clubId;
}

/**
 * Adds clubId to any query filter object.
 * Safe: does NOT overwrite existing clubId if already present.
 */
export function withClub<T extends Record<string, any>>(
  query: T = {} as T,
  clubId?: string,
): T & { clubId: string } {
  return {
    ...query,
    clubId: requireClubId(clubId),
  };
}

/**
 * Adds clubId $match stage at the beginning of an aggregation pipeline.
 * If the first stage is already a $match with clubId, it's a no-op.
 */
export function withClubPipeline(pipeline: any[], clubId?: string): any[] {
  const id = requireClubId(clubId);
  
  // Check if first stage already has clubId
  if (pipeline.length > 0 && pipeline[0].$match?.clubId) {
    return pipeline;
  }

  // If first stage is $match, merge clubId in
  if (pipeline.length > 0 && pipeline[0].$match) {
    pipeline[0].$match.clubId = id;
    return pipeline;
  }

  // Prepend $match stage
  return [{ $match: { clubId: id } }, ...pipeline];
}
