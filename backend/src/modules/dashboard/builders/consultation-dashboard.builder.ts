import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../../../schemas/group.schema';
import { Location, LocationDocument } from '../../../schemas/location.schema';
import { ContentPost, ContentPostDocument } from '../../../schemas/content-post.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Consultation Dashboard Builder
 * For guests and users in CONSULTATION mode (lead mode)
 * Shows: welcome CTA, programs overview, locations, contact actions
 */
@Injectable()
export class ConsultationDashboardBuilder {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(ContentPost.name) private contentModel: Model<ContentPostDocument>,
  ) {}

  async build(user: any) {
    // Get locations
    const locations = await this.locationModel.find().limit(10);

    // Get groups (for programs overview)
    const groups = await this.groupModel.find().populate('locationId').limit(10);

    // Get feed preview
    const feedPosts = await this.contentModel
      .find({ visibility: 'GLOBAL' })
      .sort({ publishedAt: -1, isPinned: -1 })
      .limit(3);

    // Build program categories
    const programs = [
      {
        id: 'KIDS',
        title: 'Дитяча програма 4+',
        description: 'Фізичний розвиток, дисципліна, самооборона',
        ageRange: 'від 4 років',
        icon: 'people-outline',
      },
      {
        id: 'SPECIAL',
        title: 'Особлива програма',
        description: 'Адаптивний підхід для дітей з особливими потребами',
        ageRange: 'індивідуально',
        icon: 'heart-outline',
      },
      {
        id: 'ADULT_SELF_DEFENSE',
        title: 'Самооборона для дорослих',
        description: 'Практичні навички самооборони',
        ageRange: 'від 18 років',
        icon: 'shield-outline',
      },
      {
        id: 'ADULT_PRIVATE',
        title: 'Персональні тренування',
        description: 'Індивідуальні заняття з тренером',
        ageRange: 'будь-який вік',
        icon: 'person-outline',
      },
    ];

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Welcome CTA Block
    blocks.push({
      type: 'WELCOME_CTA',
      priority: 1,
      items: [{
        title: 'Ласкаво просимо до АТАКА!',
        subtitle: 'Школа бойових мистецтв для дітей та дорослих',
        primaryAction: {
          title: 'Записатись на пробне заняття',
          screen: '/(auth)/onboarding-form',
        },
        secondaryAction: {
          title: 'Дізнатись більше',
          screen: '/(tabs)/feed',
        },
      }],
    });

    // 2. Programs Overview Block
    blocks.push({
      type: 'PROGRAMS_OVERVIEW',
      priority: 2,
      items: programs,
    });

    // 3. Locations Block
    blocks.push({
      type: 'LOCATIONS',
      priority: 3,
      items: locations.map(l => ({
        id: l._id.toString(),
        name: l.name,
        address: l.address,
        city: l.city,
        district: l.district,
        description: l.description,
      })),
    });

    // 4. Contact Actions Block
    blocks.push({
      type: 'CONTACT_ACTIONS',
      priority: 4,
      items: [
        {
          type: 'phone',
          title: 'Зателефонувати',
          value: '+380 XX XXX XX XX',
          icon: 'call-outline',
        },
        {
          type: 'telegram',
          title: 'Telegram',
          value: '@ataka_school',
          icon: 'paper-plane-outline',
        },
        {
          type: 'instagram',
          title: 'Instagram',
          value: '@ataka_school',
          icon: 'logo-instagram',
        },
      ],
    });

    // 5. Feed Preview Block
    if (feedPosts.length > 0) {
      blocks.push({
        type: 'FEED_PREVIEW',
        priority: 5,
        items: feedPosts.map(p => ({
          id: p._id.toString(),
          title: p.title,
          body: p.body?.substring(0, 100) + '...',
          type: p.type,
          isPinned: p.isPinned,
          publishedAt: p.publishedAt,
        })),
      });
    }

    return {
      role: 'GUEST',
      programType: 'CONSULTATION',
      header: {
        title: 'АТАКА',
        subtitle: 'Виховуємо силу. Дисципліну. Характер.',
      },
      state: {
        isGuest: !user,
        locationsCount: locations.length,
        programsCount: programs.length,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }
}
