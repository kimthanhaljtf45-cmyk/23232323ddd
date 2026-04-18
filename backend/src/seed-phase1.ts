/**
 * АТАКА - SEED SCRIPT FOR PHASE 1
 * Programs + Tiers + Booking Availability
 * 
 * Run: npx ts-node src/seed-phase1.ts
 */
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sports_miniapp';

// =====================
// PROGRAMS CONFIGURATION
// =====================

const PROGRAMS = [
  {
    name: 'Дитяча група (4-7 років)',
    type: 'KIDS',
    description: 'Розвиток координації, дисципліни та базових навичок єдиноборств для наймолодших',
    price: 2000,
    trainingsPerWeek: 3,
    duration: 45, // хвилини
    maxStudents: 10,
    level: 'beginner',
    ageFrom: 4,
    ageTo: 7,
  },
  {
    name: 'Дитяча група (8-12 років)',
    type: 'KIDS',
    description: 'Техніка, тактика та підготовка до змагань для дітей середнього шкільного віку',
    price: 2200,
    trainingsPerWeek: 3,
    duration: 60,
    maxStudents: 12,
    level: 'beginner',
    ageFrom: 8,
    ageTo: 12,
  },
  {
    name: 'Підліткова група (13-17 років)',
    type: 'KIDS',
    description: 'Інтенсивна підготовка, змагальний досвід, формування характеру',
    price: 2500,
    trainingsPerWeek: 4,
    duration: 75,
    maxStudents: 15,
    level: 'intermediate',
    ageFrom: 13,
    ageTo: 17,
  },
  {
    name: 'Особлива програма',
    type: 'SPECIAL',
    description: 'Індивідуальний підхід для дітей з особливими потребами',
    price: 3000,
    trainingsPerWeek: 2,
    duration: 45,
    maxStudents: 5,
    level: 'beginner',
    ageFrom: 5,
    ageTo: 14,
  },
  {
    name: 'Самооборона (дорослі)',
    type: 'SELF_DEFENSE',
    description: 'Практичні навички самозахисту, фізична підготовка, впевненість у собі',
    price: 2500,
    trainingsPerWeek: 3,
    duration: 60,
    maxStudents: 20,
    level: 'beginner',
  },
  {
    name: 'Самооборона PRO',
    type: 'SELF_DEFENSE',
    description: 'Поглиблена техніка, спаринги, підготовка до реальних ситуацій',
    price: 3000,
    trainingsPerWeek: 4,
    duration: 75,
    maxStudents: 15,
    level: 'intermediate',
  },
  {
    name: 'Персональний менторинг',
    type: 'MENTORSHIP',
    description: 'Індивідуальна робота з тренером 1:1, максимальний результат',
    price: 5000,
    trainingsPerWeek: 2,
    duration: 60,
    maxStudents: 1,
    level: 'advanced',
  },
];

// =====================
// MEMBERSHIP TIERS
// =====================

const TIERS = [
  {
    name: 'BASE',
    price: 2000,
    trainingsPerWeek: 2,
    includesPersonal: false,
    freePersonalSessions: 0,
    includesCompetitions: false,
    prioritySupport: false,
    personalDiscount: 0,
    description: 'Базовий абонемент',
    benefits: [
      '2 тренування на тиждень',
      'Групові заняття',
      'Базова підтримка',
    ],
  },
  {
    name: 'PRO',
    price: 3500,
    trainingsPerWeek: 4,
    includesPersonal: false,
    freePersonalSessions: 0,
    includesCompetitions: true,
    prioritySupport: false,
    personalDiscount: 20,
    description: 'Розширений абонемент',
    benefits: [
      '4 тренування на тиждень',
      'Доступ до змагань',
      '-20% на персональні тренування',
      'Рейтинг та досягнення',
    ],
  },
  {
    name: 'VIP',
    price: 6000,
    trainingsPerWeek: 7,
    includesPersonal: true,
    freePersonalSessions: 2,
    includesCompetitions: true,
    prioritySupport: true,
    personalDiscount: 50,
    description: 'VIP абонемент',
    benefits: [
      'Безлімітні групові заняття',
      '2 персональні тренування в місяць',
      '-50% на додаткові персоналки',
      'Пріоритетна підтримка',
      'VIP чат з тренером',
    ],
  },
];

// =====================
// SEED FUNCTION
// =====================

async function seedPhase1() {
  console.log('🏟️  АТАКА - Phase 1 Seed');
  console.log('Programs + Tiers + Booking');
  console.log('============================\n');
  
  console.log('Connecting to MongoDB...');
  const connection = await mongoose.createConnection(MONGO_URI).asPromise();
  const db = connection.db;
  
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  console.log('✅ Connected to MongoDB\n');

  // Get first location as clubId
  const location = await db.collection('locations').findOne({});
  if (!location) {
    console.log('⚠️  No locations found. Please run seed-real-club.ts first.');
    await connection.close();
    return;
  }
  
  const clubId = location._id.toString();
  console.log(`📍 Using club: ${location.name} (${clubId})\n`);

  // Get coaches for programs
  const coaches = await db.collection('users').find({ role: 'COACH' }).toArray();
  const coachIds = coaches.map(c => c._id.toString());
  console.log(`👤 Found ${coaches.length} coaches\n`);

  const now = new Date();

  // ============ CLEAR OLD DATA ============
  console.log('🧹 Clearing Phase 1 data...');
  await db.collection('programs').deleteMany({});
  await db.collection('membershiptiers').deleteMany({});
  await db.collection('coachavailabilities').deleteMany({});
  await db.collection('bookingslots').deleteMany({});
  await db.collection('bookings').deleteMany({});

  // ============ PROGRAMS ============
  console.log('\n📚 Creating programs...');
  const programIds: string[] = [];
  
  for (const prog of PROGRAMS) {
    const result = await db.collection('programs').insertOne({
      ...prog,
      clubId,
      coachIds: coachIds.slice(0, 2), // Assign first 2 coaches
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    programIds.push(result.insertedId.toString());
    console.log(`   ✓ ${prog.name} - ${prog.price} грн`);
  }

  // ============ TIERS ============
  console.log('\n💎 Creating membership tiers...');
  
  for (const tier of TIERS) {
    await db.collection('membershiptiers').insertOne({
      ...tier,
      clubId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`   ✓ ${tier.name} - ${tier.price} грн`);
  }

  // ============ COACH AVAILABILITY ============
  console.log('\n📅 Creating coach availability...');
  
  for (const coach of coaches) {
    // Monday to Friday, 10:00 - 19:00
    for (let day = 1; day <= 5; day++) {
      await db.collection('coachavailabilities').insertOne({
        clubId,
        coachId: coach._id.toString(),
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '19:00',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Saturday 10:00 - 15:00
    await db.collection('coachavailabilities').insertOne({
      clubId,
      coachId: coach._id.toString(),
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '15:00',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`   ✓ ${coach.firstName}: Mon-Fri 10-19, Sat 10-15`);
  }

  // ============ GENERATE BOOKING SLOTS ============
  console.log('\n🎫 Generating booking slots for next 14 days...');
  
  const slotDuration = 60; // minutes
  const slotsCreated = { total: 0 };
  
  for (const coach of coaches) {
    const availability = await db.collection('coachavailabilities')
      .find({ coachId: coach._id.toString(), isActive: true })
      .toArray();
    
    // Generate slots for next 14 days
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // 1-7
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAvail = availability.find(a => a.dayOfWeek === dayOfWeek);
      if (!dayAvail) continue;
      
      const [startH, startM] = dayAvail.startTime.split(':').map(Number);
      const [endH, endM] = dayAvail.endTime.split(':').map(Number);
      
      let currentTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;
      
      while (currentTime + slotDuration <= endTime) {
        const slotStart = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
        const slotEnd = `${Math.floor((currentTime + slotDuration) / 60).toString().padStart(2, '0')}:${((currentTime + slotDuration) % 60).toString().padStart(2, '0')}`;
        
        await db.collection('bookingslots').insertOne({
          clubId,
          coachId: coach._id.toString(),
          date: dateStr,
          startTime: slotStart,
          endTime: slotEnd,
          duration: slotDuration,
          status: 'AVAILABLE',
          type: 'PERSONAL',
          createdAt: now,
          updatedAt: now,
        });
        
        slotsCreated.total++;
        currentTime += slotDuration;
      }
    }
  }
  console.log(`   ✓ Created ${slotsCreated.total} booking slots`);

  // ============ SUMMARY ============
  console.log('\n============================');
  console.log('🎉 PHASE 1 SETUP COMPLETE!\n');
  
  console.log('📊 STATISTICS:');
  console.log(`   Programs: ${PROGRAMS.length}`);
  console.log(`   Tiers: ${TIERS.length}`);
  console.log(`   Coach Availabilities: ${coaches.length * 6}`);
  console.log(`   Booking Slots: ${slotsCreated.total}`);
  
  console.log('\n💡 API Endpoints:');
  console.log('   GET /api/programs');
  console.log('   GET /api/programs/onboarding?forChild=true');
  console.log('   GET /api/tiers');
  console.log('   GET /api/booking/coaches?type=PERSONAL');
  console.log('   GET /api/booking/slots?coachId=...&date=...');
  console.log('\n============================\n');

  await connection.close();
}

seedPhase1().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
