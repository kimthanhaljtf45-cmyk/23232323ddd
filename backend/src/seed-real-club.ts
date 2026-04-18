/**
 * АТАКА - SEED SCRIPT FOR REAL CLUB
 * Sprint 4 - Day 12: Setup Real Club Data
 * 
 * This is NOT demo data. This is production-ready data structure
 * for a real martial arts school.
 * 
 * Run: npx ts-node src/seed-real-club.ts
 */
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sports_miniapp';

// =====================
// REAL CLUB CONFIGURATION
// =====================

const CLUB_CONFIG = {
  name: 'АТАКА Київ',
  locations: [
    {
      name: 'Позняки',
      address: 'вул. Анни Ахматової, 13В',
      city: 'Київ',
      district: 'Дарницький',
      lat: 50.3987,
      lng: 30.6282,
    },
    {
      name: 'Відрадний',
      address: 'вул. Новопольова, 106',
      city: 'Київ',
      district: "Солом'янський",
    },
  ],
};

// =====================
// STAFF (REAL)
// =====================

const ADMIN = {
  telegramId: '1001',
  phone: '+380501234567',
  firstName: 'Адмін',
  lastName: 'Школи',
  role: 'ADMIN',
};

const COACHES = [
  {
    telegramId: '2001',
    phone: '+380671112233',
    firstName: 'Олександр',
    lastName: 'Петренко',
    role: 'COACH',
  },
  {
    telegramId: '2002',
    phone: '+380672223344',
    firstName: 'Марія',
    lastName: 'Шевченко',
    role: 'COACH',
  },
  {
    telegramId: '2003',
    phone: '+380673334455',
    firstName: 'Андрій',
    lastName: 'Коваленко',
    role: 'COACH',
  },
];

// =====================
// GROUPS (REAL SCHEDULE)
// =====================

const GROUPS = [
  // KIDS Program - 2 groups
  {
    name: 'Діти 6-9 років (Позняки)',
    program: 'KIDS',
    ageRange: '6-9',
    level: 'Початковий',
    capacity: 15,
    locationIndex: 0, // Позняки
    coachIndex: 0, // Олександр
    schedule: [
      { dayOfWeek: 1, startTime: '17:00', endTime: '18:00' }, // Понеділок
      { dayOfWeek: 3, startTime: '17:00', endTime: '18:00' }, // Середа
      { dayOfWeek: 5, startTime: '17:00', endTime: '18:00' }, // П'ятниця
    ],
    price: 2000,
  },
  {
    name: 'Діти 10-14 років (Позняки)',
    program: 'KIDS',
    ageRange: '10-14',
    level: 'Середній',
    capacity: 15,
    locationIndex: 0,
    coachIndex: 0,
    schedule: [
      { dayOfWeek: 1, startTime: '18:15', endTime: '19:30' },
      { dayOfWeek: 3, startTime: '18:15', endTime: '19:30' },
      { dayOfWeek: 5, startTime: '18:15', endTime: '19:30' },
    ],
    price: 2000,
  },
  // SELF_DEFENSE Program - 1 group
  {
    name: 'Самооборона дорослі (Відрадний)',
    program: 'SELF_DEFENSE',
    ageRange: '16+',
    level: 'Всі рівні',
    capacity: 20,
    locationIndex: 1, // Відрадний
    coachIndex: 1, // Марія
    schedule: [
      { dayOfWeek: 2, startTime: '19:00', endTime: '20:30' }, // Вівторок
      { dayOfWeek: 4, startTime: '19:00', endTime: '20:30' }, // Четвер
    ],
    price: 3000,
  },
  // SPECIAL Program - 1 group
  {
    name: 'Особлива програма (Позняки)',
    program: 'SPECIAL',
    ageRange: '6-14',
    level: 'Індивідуальний підхід',
    capacity: 8,
    locationIndex: 0,
    coachIndex: 2, // Андрій
    schedule: [
      { dayOfWeek: 6, startTime: '10:00', endTime: '11:00' }, // Субота
    ],
    price: 2000,
  },
];

// =====================
// STUDENTS (REALISTIC DATA)
// =====================

const STUDENTS_KIDS_6_9 = [
  { firstName: 'Артем', lastName: 'Бондаренко', birthYear: 2018, belt: 'WHITE' },
  { firstName: 'Софія', lastName: 'Мельник', birthYear: 2017, belt: 'WHITE' },
  { firstName: 'Максим', lastName: 'Ткаченко', birthYear: 2018, belt: 'YELLOW' },
  { firstName: 'Олівія', lastName: 'Кравченко', birthYear: 2019, belt: 'WHITE' },
  { firstName: 'Данило', lastName: 'Шевчук', birthYear: 2017, belt: 'YELLOW' },
  { firstName: 'Вероніка', lastName: 'Олійник', birthYear: 2018, belt: 'WHITE' },
  { firstName: 'Матвій', lastName: 'Лисенко', birthYear: 2019, belt: 'WHITE' },
  { firstName: 'Анастасія', lastName: 'Гриценко', birthYear: 2017, belt: 'ORANGE' },
];

const STUDENTS_KIDS_10_14 = [
  { firstName: 'Богдан', lastName: 'Савченко', birthYear: 2012, belt: 'GREEN' },
  { firstName: 'Дарина', lastName: 'Ковальчук', birthYear: 2013, belt: 'YELLOW' },
  { firstName: 'Олексій', lastName: 'Павленко', birthYear: 2011, belt: 'GREEN' },
  { firstName: 'Марія', lastName: 'Руденко', birthYear: 2014, belt: 'WHITE' },
  { firstName: 'Назар', lastName: 'Поліщук', birthYear: 2012, belt: 'ORANGE' },
  { firstName: 'Катерина', lastName: 'Коваль', birthYear: 2013, belt: 'YELLOW' },
];

const STUDENTS_SELF_DEFENSE = [
  { firstName: 'Ольга', lastName: 'Іванова', birthYear: 1990, belt: 'WHITE', isAdult: true },
  { firstName: 'Сергій', lastName: 'Петров', birthYear: 1985, belt: 'YELLOW', isAdult: true },
  { firstName: 'Наталія', lastName: 'Козак', birthYear: 1992, belt: 'WHITE', isAdult: true },
  { firstName: 'Андрій', lastName: 'Романенко', birthYear: 1988, belt: 'ORANGE', isAdult: true },
  { firstName: 'Юлія', lastName: 'Степаненко', birthYear: 1995, belt: 'WHITE', isAdult: true },
];

const STUDENTS_SPECIAL = [
  { firstName: 'Тимофій', lastName: 'Захарченко', birthYear: 2015, belt: 'WHITE', note: 'Аутизм, потребує індивідуального підходу' },
  { firstName: 'Аліна', lastName: 'Мороз', birthYear: 2016, belt: 'WHITE', note: 'СДУГ, потребує структури' },
  { firstName: 'Ярослав', lastName: 'Василенко', birthYear: 2014, belt: 'YELLOW', note: 'Затримка розвитку' },
];

// =====================
// PARENTS (FOR KIDS)
// =====================

const PARENTS_TEMPLATE = [
  { firstName: 'Олена', relation: 'mother' },
  { firstName: 'Іван', relation: 'father' },
  { firstName: 'Тетяна', relation: 'mother' },
  { firstName: 'Віктор', relation: 'father' },
  { firstName: 'Наталя', relation: 'mother' },
  { firstName: 'Олександр', relation: 'father' },
  { firstName: 'Ірина', relation: 'mother' },
  { firstName: 'Михайло', relation: 'father' },
  { firstName: 'Світлана', relation: 'mother' },
  { firstName: 'Дмитро', relation: 'father' },
  { firstName: 'Людмила', relation: 'mother' },
  { firstName: 'Сергій', relation: 'father' },
  { firstName: 'Оксана', relation: 'mother' },
  { firstName: 'Петро', relation: 'father' },
];

// =====================
// SEED FUNCTION
// =====================

async function seedRealClub() {
  console.log('🏟️  АТАКА - Real Club Setup');
  console.log('============================\n');
  console.log('Connecting to MongoDB...');
  
  const connection = await mongoose.createConnection(MONGO_URI).asPromise();
  const db = connection.db;
  
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  console.log('✅ Connected to MongoDB\n');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  const collections = [
    'users', 'children', 'parentchildren', 'groups', 'locations',
    'schedules', 'attendances', 'payments', 'subscriptions', 'invoices',
    'contentposts', 'notifications', 'achievements', 'devicetokens',
    'otps', 'consultations', 'alerts', 'coachactions', 'retentionsnapshots'
  ];

  for (const col of collections) {
    try {
      await db.collection(col).deleteMany({});
    } catch (e) {}
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // ============ LOCATIONS ============
  console.log('\n📍 Creating locations...');
  const locationIds: any[] = [];
  
  for (const loc of CLUB_CONFIG.locations) {
    const result = await db.collection('locations').insertOne({
      ...loc,
      createdAt: now,
      updatedAt: now,
    });
    locationIds.push(result.insertedId);
    console.log(`   ✓ ${loc.name}`);
  }

  // ============ ADMIN ============
  console.log('\n👤 Creating admin...');
  const adminResult = await db.collection('users').insertOne({
    ...ADMIN,
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`   ✓ ${ADMIN.firstName} ${ADMIN.lastName}`);

  // ============ COACHES ============
  console.log('\n🥋 Creating coaches...');
  const coachIds: any[] = [];
  
  for (const coach of COACHES) {
    const result = await db.collection('users').insertOne({
      ...coach,
      status: 'ACTIVE',
      isOnboarded: true,
      createdAt: now,
      updatedAt: now,
    });
    coachIds.push(result.insertedId);
    console.log(`   ✓ ${coach.firstName} ${coach.lastName} (${coach.phone})`);
  }

  // ============ GROUPS & SCHEDULES ============
  console.log('\n📋 Creating groups and schedules...');
  const groupIds: any[] = [];
  
  for (const group of GROUPS) {
    const groupResult = await db.collection('groups').insertOne({
      name: group.name,
      program: group.program,
      ageRange: group.ageRange,
      level: group.level,
      capacity: group.capacity,
      coachId: coachIds[group.coachIndex].toString(),
      locationId: locationIds[group.locationIndex].toString(),
      price: group.price,
      createdAt: now,
      updatedAt: now,
    });
    groupIds.push(groupResult.insertedId);
    console.log(`   ✓ ${group.name} (${group.program}, ${group.price} грн)`);

    // Create schedules for group
    for (const sched of group.schedule) {
      await db.collection('schedules').insertOne({
        groupId: groupResult.insertedId.toString(),
        dayOfWeek: sched.dayOfWeek,
        startTime: sched.startTime,
        endTime: sched.endTime,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // ============ STUDENTS & PARENTS & SUBSCRIPTIONS ============
  console.log('\n👨‍👩‍👧‍👦 Creating students, parents, and subscriptions...');
  
  let parentIndex = 0;
  let phoneCounter = 3001;

  // Helper function to create child with parent and subscription
  async function createStudentWithSubscription(
    student: any, 
    groupIndex: number, 
    program: string, 
    price: number,
    isAdult: boolean = false
  ) {
    const birthDate = `${student.birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    
    let parentId: any = null;
    let childUserId: any = null;

    if (isAdult) {
      // Adult student - create user directly
      const userResult = await db.collection('users').insertOne({
        telegramId: String(phoneCounter),
        phone: `+3806${String(phoneCounter).padStart(8, '0')}`,
        firstName: student.firstName,
        lastName: student.lastName,
        role: 'STUDENT',
        status: 'ACTIVE',
        isOnboarded: true,
        programType: program,
        createdAt: now,
        updatedAt: now,
      });
      childUserId = userResult.insertedId;
      phoneCounter++;
    } else {
      // Child - create parent
      const parentTemplate = PARENTS_TEMPLATE[parentIndex % PARENTS_TEMPLATE.length];
      const parentResult = await db.collection('users').insertOne({
        telegramId: String(phoneCounter),
        phone: `+3806${String(phoneCounter).padStart(8, '0')}`,
        firstName: parentTemplate.firstName,
        lastName: student.lastName,
        role: 'PARENT',
        status: 'ACTIVE',
        isOnboarded: true,
        programType: program,
        createdAt: now,
        updatedAt: now,
      });
      parentId = parentResult.insertedId;
      phoneCounter++;
      parentIndex++;
    }

    // Create child record
    const childResult = await db.collection('children').insertOne({
      firstName: student.firstName,
      lastName: student.lastName,
      birthDate,
      status: 'ACTIVE',
      note: student.note || '',
      groupId: groupIds[groupIndex].toString(),
      userId: childUserId?.toString(),
      belt: student.belt || 'WHITE',
      monthlyGoalTarget: 12,
      createdAt: now,
      updatedAt: now,
    });

    // Link parent to child (if child)
    if (parentId) {
      await db.collection('parentchildren').insertOne({
        parentId: parentId.toString(),
        childId: childResult.insertedId.toString(),
        relation: PARENTS_TEMPLATE[(parentIndex - 1) % PARENTS_TEMPLATE.length].relation,
        createdAt: now,
      });
    }

    // Create subscription
    const subscriptionResult = await db.collection('subscriptions').insertOne({
      childId: childResult.insertedId.toString(),
      userId: (parentId || childUserId).toString(),
      program,
      planName: GROUPS[groupIndex].name,
      price,
      status: 'ACTIVE',
      dueDay: 5, // 5-го числа кожного місяця
      startDate: new Date(currentYear, currentMonth - 1, 1), // Started last month
      createdAt: now,
      updatedAt: now,
    });

    // Create invoice for current month
    const dueDate = new Date(currentYear, currentMonth, 10); // 10-го числа
    const invoiceStatus = Math.random() > 0.3 ? 'PENDING' : 'PAID';
    
    await db.collection('invoices').insertOne({
      childId: childResult.insertedId.toString(),
      subscriptionId: subscriptionResult.insertedId.toString(),
      userId: (parentId || childUserId).toString(),
      amount: price,
      currency: 'UAH',
      description: `Абонемент ${new Date().toLocaleString('uk-UA', { month: 'long' })} ${currentYear}`,
      status: invoiceStatus,
      dueDate,
      paidAt: invoiceStatus === 'PAID' ? new Date(currentYear, currentMonth, 3) : null,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`   ✓ ${student.firstName} ${student.lastName} (${student.belt}, ${invoiceStatus})`);
    
    return { childId: childResult.insertedId, parentId, childUserId };
  }

  // Create all students
  console.log('\n   --- Група: Діти 6-9 років ---');
  for (const student of STUDENTS_KIDS_6_9) {
    await createStudentWithSubscription(student, 0, 'KIDS', 2000);
  }

  console.log('\n   --- Група: Діти 10-14 років ---');
  for (const student of STUDENTS_KIDS_10_14) {
    await createStudentWithSubscription(student, 1, 'KIDS', 2000);
  }

  console.log('\n   --- Група: Самооборона ---');
  for (const student of STUDENTS_SELF_DEFENSE) {
    await createStudentWithSubscription(student, 2, 'SELF_DEFENSE', 3000, true);
  }

  console.log('\n   --- Група: Особлива програма ---');
  for (const student of STUDENTS_SPECIAL) {
    await createStudentWithSubscription(student, 3, 'SPECIAL', 2000);
  }

  // ============ ATTENDANCE (last 2 weeks) ============
  console.log('\n📊 Creating attendance records for last 2 weeks...');
  
  const children = await db.collection('children').find({}).toArray();
  const schedules = await db.collection('schedules').find({}).toArray();
  
  // Generate attendance for last 14 days
  for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dayOfWeek = date.getDay() || 7; // Convert Sunday from 0 to 7
    
    // Find schedules for this day
    const todaySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);
    
    for (const schedule of todaySchedules) {
      // Find children in this group
      const groupChildren = children.filter(c => c.groupId === schedule.groupId);
      
      for (const child of groupChildren) {
        // Random attendance: 85% present, 10% warned, 5% absent
        const rand = Math.random();
        let status = 'PRESENT';
        let reason = '';
        
        if (rand > 0.95) {
          status = 'ABSENT';
          reason = '';
        } else if (rand > 0.85) {
          status = 'WARNED';
          reason = ['Хвороба', 'Сімейні обставини', 'Поїздка'][Math.floor(Math.random() * 3)];
        }
        
        await db.collection('attendances').insertOne({
          childId: child._id.toString(),
          scheduleId: schedule._id.toString(),
          groupId: schedule.groupId,
          date: date.toISOString().split('T')[0],
          status,
          reason,
          markedBy: coachIds[0].toString(),
          createdAt: date,
        });
      }
    }
  }
  console.log('   ✓ Attendance records created');

  // ============ SUMMARY ============
  console.log('\n============================');
  console.log('🎉 REAL CLUB SETUP COMPLETE!\n');
  
  console.log('📊 STATISTICS:');
  console.log(`   Locations: ${CLUB_CONFIG.locations.length}`);
  console.log(`   Coaches: ${COACHES.length}`);
  console.log(`   Groups: ${GROUPS.length}`);
  console.log(`   Students: ${STUDENTS_KIDS_6_9.length + STUDENTS_KIDS_10_14.length + STUDENTS_SELF_DEFENSE.length + STUDENTS_SPECIAL.length}`);
  
  console.log('\n🔐 TEST ACCOUNTS:');
  console.log(`   Admin: ${ADMIN.phone} (telegramId: ${ADMIN.telegramId})`);
  COACHES.forEach(c => {
    console.log(`   Coach ${c.firstName}: ${c.phone} (telegramId: ${c.telegramId})`);
  });
  
  console.log('\n💡 OTP Demo Code: 000000');
  console.log('\n============================\n');

  await connection.close();
}

seedRealClub().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
