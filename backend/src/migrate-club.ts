/**
 * Migration script: Link all existing data to default club
 * 
 * Run: MONGO_URL=mongodb://localhost:27017 DB_NAME=test_database node dist/migrate-club.js
 */
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'test_database';

async function migrate() {
  console.log('Connecting to MongoDB...');
  const conn = await mongoose.createConnection(`${MONGO_URI}/${DB_NAME}`).asPromise();
  const db = conn.db;
  if (!db) throw new Error('No DB');

  // Step 1: Get or create default club
  let club = await db.collection('clubs').findOne({ slug: 'атака-київ' });
  if (!club) {
    club = await db.collection('clubs').findOne({});
  }
  if (!club) {
    const result = await db.collection('clubs').insertOne({
      name: 'АТАКА Київ',
      slug: 'атака-київ',
      status: 'ACTIVE',
      plan: 'PRO',
      city: 'Київ',
      currency: 'UAH',
      primaryColor: '#DC2626',
      secondaryColor: '#0F0F10',
      maxBranches: 5,
      maxCoaches: 10,
      maxStudents: 200,
      maxAdmins: 3,
      features: ['dashboard', 'attendance', 'payments', 'messages', 'competitions', 'booking', 'discounts', 'referrals', 'retention', 'marketplace'],
      priceMonthly: 2490,
      saasStatus: 'ACTIVE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    club = await db.collection('clubs').findOne({ _id: result.insertedId });
  }
  const clubId = club!._id.toString();
  console.log(`Using club: ${club!.name} (${clubId})`);

  // Step 2: Link users and create memberships
  const users = await db.collection('users').find({}).toArray();
  let membershipsCreated = 0;

  for (const user of users) {
    const userId = user._id.toString();

    // Set activeClubId on user
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { activeClubId: clubId } }
    );

    // Create membership if not exists
    const existing = await db.collection('clubmemberships').findOne({ clubId, userId });
    if (!existing) {
      let role = 'PARENT';
      if (user.role === 'ADMIN') role = 'OWNER';
      else if (user.role === 'COACH') role = 'COACH';
      else if (user.role === 'STUDENT') role = 'STUDENT';
      else role = 'PARENT';

      await db.collection('clubmemberships').insertOne({
        clubId,
        userId,
        role,
        status: 'ACTIVE',
        permissions: [],
        branchIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      membershipsCreated++;
    }
  }
  console.log(`Memberships created: ${membershipsCreated}`);

  // Step 3: Link entities with clubId
  const collections = [
    'groups', 'children', 'parentchildren', 'schedules',
    'attendances', 'subscriptions', 'invoices', 'payments',
    'products', 'competitions', 'threads', 'communicationmessages',
    'offers', 'discountrules', 'referrals', 'notifications',
  ];

  for (const col of collections) {
    try {
      const result = await db.collection(col).updateMany(
        { $or: [{ clubId: { $exists: false } }, { clubId: null }, { clubId: '' }] },
        { $set: { clubId } }
      );
      if (result.modifiedCount > 0) {
        console.log(`  ${col}: ${result.modifiedCount} records linked`);
      }
    } catch (e) {
      // Collection may not exist
    }
  }

  // Step 4: Update club stats
  const studentCount = await db.collection('children').countDocuments({ clubId, status: 'ACTIVE' });
  const coachCount = await db.collection('clubmemberships').countDocuments({ clubId, role: 'COACH', status: 'ACTIVE' });
  const groupCount = await db.collection('groups').countDocuments({ clubId });

  await db.collection('clubs').updateOne(
    { _id: club!._id },
    { $set: { studentCount, coachCount, groupCount } }
  );
  console.log(`Club stats updated: ${studentCount} students, ${coachCount} coaches, ${groupCount} groups`);

  // Step 5: Orphan audit
  console.log('\n=== ORPHAN AUDIT ===');
  for (const col of ['groups', 'children', 'subscriptions', 'invoices']) {
    try {
      const orphans = await db.collection(col).countDocuments(
        { $or: [{ clubId: { $exists: false } }, { clubId: null }] }
      );
      console.log(`  ${col}: ${orphans === 0 ? '✅ no orphans' : `❌ ${orphans} orphans`}`);
    } catch { }
  }

  console.log('\nMigration complete!');
  await conn.close();
}

migrate().catch(console.error);
