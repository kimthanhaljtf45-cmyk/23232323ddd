/**
 * Seed script for АТАКА Mini App database
 * Run: npx ts-node src/seed.ts
 */
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test_database';

async function seed() {
  console.log('Connecting to MongoDB...');
  const connection = await mongoose.createConnection(MONGO_URI).asPromise();
  const db = connection.db;
  
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  console.log('Seeding database...');

  // Clear existing data
  const collections = [
    'users', 'children', 'parentchildren', 'groups', 'locations',
    'schedules', 'attendances', 'payments', 'contentposts', 'notifications',
    'achievements', 'devicetokens'
  ];

  for (const col of collections) {
    try {
      await db.collection(col).deleteMany({});
    } catch (e) {}
  }

  const now = new Date();

  // ============ LOCATIONS ============
  const locPoznyaky = await db.collection('locations').insertOne({
    name: 'Позняки',
    address: 'вул. Анни Ахматової, 13В',
    city: 'Київ',
    district: 'Дарницький',
    lat: 50.3987,
    lng: 30.6282,
    description: 'Зал на Позняках біля метро',
    createdAt: now,
    updatedAt: now,
  });

  const locVidradnyi = await db.collection('locations').insertOne({
    name: 'Відрадний',
    address: 'вул. Новопольова, 106',
    city: 'Київ',
    district: "Солом'янський",
    createdAt: now,
    updatedAt: now,
  });

  const locShalimova = await db.collection('locations').insertOne({
    name: 'Академіка Шалімова',
    address: 'вул. Академіка Шалімова, 43',
    city: 'Київ',
    createdAt: now,
    updatedAt: now,
  });

  const locSolomianka = await db.collection('locations').insertOne({
    name: "Солом'янка",
    address: 'вул. Авіаконструктора Антонова, 4',
    city: 'Київ',
    createdAt: now,
    updatedAt: now,
  });

  // ============ USERS ============
  const admin = await db.collection('users').insertOne({
    telegramId: '100000001',
    firstName: 'Адміністратор',
    lastName: 'Школи',
    username: 'school_admin',
    phone: '+380501234567',
    role: 'ADMIN',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  const coach1 = await db.collection('users').insertOne({
    telegramId: '100000002',
    firstName: 'Олександр',
    lastName: 'Петренко',
    username: 'coach_alex',
    phone: '+380501234568',
    role: 'COACH',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  const coach2 = await db.collection('users').insertOne({
    telegramId: '100000003',
    firstName: 'Марія',
    lastName: 'Іваненко',
    username: 'coach_maria',
    phone: '+380991001003',
    role: 'COACH',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  const parent1 = await db.collection('users').insertOne({
    telegramId: '100000004',
    firstName: 'Ірина',
    lastName: 'Коваленко',
    username: 'parent_iryna',
    phone: '+380501234569',
    role: 'PARENT',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  const parent2 = await db.collection('users').insertOne({
    telegramId: '100000005',
    firstName: 'Віктор',
    lastName: 'Сидоренко',
    username: 'parent_victor',
    phone: '+380991001005',
    role: 'PARENT',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  const student1 = await db.collection('users').insertOne({
    telegramId: '100000010',
    firstName: 'Артем',
    lastName: 'Коваленко',
    username: 'student_artem',
    phone: '+380991001010',
    role: 'STUDENT',
    status: 'ACTIVE',
    isOnboarded: true,
    createdAt: now,
    updatedAt: now,
  });

  // ============ GROUPS (P0.3 FIX: all required fields) ============
  const groupPoznyaky1 = await db.collection('groups').insertOne({
    name: 'Позняки 18:30',
    clubId: locPoznyaky.insertedId.toString(),
    ageRange: '6-12',
    level: 'Початковий',
    capacity: 15,
    description: 'Пн Ср Пт 18:30-19:30',
    coachId: coach1.insertedId.toString(),
    locationId: locPoznyaky.insertedId.toString(),
    programType: 'KIDS',
    monthlyPrice: 2000,
    isActive: true,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  });

  const groupShalimova1 = await db.collection('groups').insertOne({
    name: 'Шалімова 17:00',
    clubId: locShalimova.insertedId.toString(),
    ageRange: '6-14',
    level: 'Початковий/Середній',
    capacity: 20,
    description: 'Вт Чт 17:00-18:30',
    coachId: coach1.insertedId.toString(),
    locationId: locShalimova.insertedId.toString(),
    programType: 'KIDS',
    monthlyPrice: 2000,
    isActive: true,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  });

  const groupSolomianka1 = await db.collection('groups').insertOne({
    name: "Солом'янка 18:30",
    clubId: locSolomianka.insertedId.toString(),
    ageRange: '6-12',
    level: 'Початковий',
    capacity: 15,
    description: 'Вт Чт 18:30-19:30',
    coachId: coach2.insertedId.toString(),
    locationId: locSolomianka.insertedId.toString(),
    programType: 'KIDS',
    monthlyPrice: 2000,
    isActive: true,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  });

  // ============ SCHEDULES ============
  // dayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  const schedules = [
    // Позняки - Mon Wed Fri
    { groupId: groupPoznyaky1.insertedId.toString(), dayOfWeek: 1, startTime: '18:30', endTime: '19:30', isActive: true },
    { groupId: groupPoznyaky1.insertedId.toString(), dayOfWeek: 3, startTime: '18:30', endTime: '19:30', isActive: true },
    { groupId: groupPoznyaky1.insertedId.toString(), dayOfWeek: 5, startTime: '18:30', endTime: '19:30', isActive: true },
    // Шалімова - Tue Thu
    { groupId: groupShalimova1.insertedId.toString(), dayOfWeek: 2, startTime: '17:00', endTime: '18:30', isActive: true },
    { groupId: groupShalimova1.insertedId.toString(), dayOfWeek: 4, startTime: '17:00', endTime: '18:30', isActive: true },
    // Солом'янка - Tue Thu
    { groupId: groupSolomianka1.insertedId.toString(), dayOfWeek: 2, startTime: '18:30', endTime: '19:30', isActive: true },
    { groupId: groupSolomianka1.insertedId.toString(), dayOfWeek: 4, startTime: '18:30', endTime: '19:30', isActive: true },
  ];

  for (const s of schedules) {
    await db.collection('schedules').insertOne({
      ...s,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ============ CHILDREN (P0.3 FIX: all required fields) ============
  const child1 = await db.collection('children').insertOne({
    firstName: 'Артем',
    lastName: 'Коваленко',
    birthDate: '2017-05-15',
    status: 'ACTIVE',
    note: 'Активний, любить спарінги',
    clubId: locPoznyaky.insertedId.toString(),
    groupId: groupPoznyaky1.insertedId.toString(),
    coachId: coach1.insertedId.toString(),
    roleOwnerId: parent1.insertedId.toString(),
    parentId: parent1.insertedId.toString(),
    userId: student1.insertedId.toString(),
    telegramId: '100000010',
    programType: 'KIDS',
    belt: 'WHITE',
    monthlyGoalTarget: 12,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const child2 = await db.collection('children').insertOne({
    firstName: 'Софія',
    lastName: 'Коваленко',
    birthDate: '2014-09-22',
    status: 'ACTIVE',
    note: 'Готується до чемпіонату',
    clubId: locShalimova.insertedId.toString(),
    groupId: groupShalimova1.insertedId.toString(),
    coachId: coach1.insertedId.toString(),
    roleOwnerId: parent1.insertedId.toString(),
    parentId: parent1.insertedId.toString(),
    programType: 'KIDS',
    belt: 'YELLOW',
    monthlyGoalTarget: 12,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const child3 = await db.collection('children').insertOne({
    firstName: 'Максим',
    lastName: 'Сидоренко',
    birthDate: '2010-03-10',
    status: 'ACTIVE',
    note: 'Переможець регіональних змагань',
    clubId: locSolomianka.insertedId.toString(),
    groupId: groupSolomianka1.insertedId.toString(),
    coachId: coach2.insertedId.toString(),
    roleOwnerId: parent2.insertedId.toString(),
    parentId: parent2.insertedId.toString(),
    programType: 'KIDS',
    belt: 'GREEN',
    monthlyGoalTarget: 12,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Link parents to children
  await db.collection('parentchildren').insertMany([
    { parentId: parent1.insertedId.toString(), childId: child1.insertedId.toString(), relation: 'mother', createdAt: now },
    { parentId: parent1.insertedId.toString(), childId: child2.insertedId.toString(), relation: 'mother', createdAt: now },
    { parentId: parent2.insertedId.toString(), childId: child3.insertedId.toString(), relation: 'father', createdAt: now },
  ]);

  // ============ PAYMENTS ============
  await db.collection('payments').insertMany([
    {
      childId: child1.insertedId.toString(),
      amount: 2500,
      currency: 'UAH',
      description: 'Абонемент квітень 2026',
      status: 'PENDING',
      dueDate: '2026-04-10',
      createdAt: now,
      updatedAt: now,
    },
    {
      childId: child2.insertedId.toString(),
      amount: 3000,
      currency: 'UAH',
      description: 'Абонемент квітень 2026',
      status: 'PAID',
      paidAt: '2026-04-05T10:00:00Z',
      approvedById: admin.insertedId.toString(),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // ============ CONTENT POSTS ============
  await db.collection('contentposts').insertMany([
    {
      authorId: admin.insertedId.toString(),
      title: 'Вітаємо у новому місяці!',
      body: 'Раді повідомити про початок занять у квітні 2026 року. Бажаємо всім успіхів та нових досягнень!',
      type: 'ANNOUNCEMENT',
      visibility: 'GLOBAL',
      isPinned: true,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      authorId: coach1.insertedId.toString(),
      title: 'Результати тренування',
      body: 'Чудове тренування сьогодні! Діти показали відмінну техніку.',
      type: 'NEWS',
      visibility: 'GROUP',
      groupId: groupPoznyaky1.insertedId.toString(),
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // ============ ATTENDANCE ============
  await db.collection('attendances').insertMany([
    { childId: child1.insertedId.toString(), scheduleId: 's1', date: '2026-04-01', status: 'PRESENT', createdAt: now },
    { childId: child1.insertedId.toString(), scheduleId: 's1', date: '2026-04-03', status: 'PRESENT', createdAt: now },
    { childId: child1.insertedId.toString(), scheduleId: 's1', date: '2026-04-05', status: 'WARNED', reason: 'Хвороба', createdAt: now },
    { childId: child2.insertedId.toString(), scheduleId: 's2', date: '2026-04-02', status: 'PRESENT', createdAt: now },
    { childId: child2.insertedId.toString(), scheduleId: 's2', date: '2026-04-04', status: 'PRESENT', createdAt: now },
  ]);

  // ============ ACHIEVEMENTS ============
  await db.collection('achievements').insertMany([
    {
      childId: child1.insertedId.toString(),
      type: 'FIRST_MONTH',
      title: 'Перший місяць',
      description: 'Успішно завершив перший місяць тренувань',
      awardedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      childId: child1.insertedId.toString(),
      type: 'ATTENDANCE_STREAK',
      title: 'Відмінник',
      description: '5 тренувань поспіль без пропусків',
      awardedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
  ]);

  // ============ PRODUCTS (SHOP) ============
  await db.collection('products').insertMany([
    // === UNIFORM (Форма) ===
    {
      name: 'Кімоно для карате (біле)',
      description: 'Якісне кімоно для тренувань та змагань. 100% бавовна, щільність 240г/м²',
      price: 1500,
      oldPrice: 1800,
      category: 'UNIFORM',
      sportType: 'KARATE',
      usageType: 'BOTH',
      sizes: ['110', '120', '130', '140', '150', '160', '170', '180'],
      sizeChart: { ageMin: 5, ageMax: 18, heightMin: 110, heightMax: 185 },
      colors: ['Білий'],
      images: [],
      stock: 50,
      isActive: true,
      isFeatured: true,
      isNewArrival: false,
      rating: 4.8,
      reviewsCount: 124,
      tags: ['кімоно', 'карате', 'форма', 'GI'],
      brand: 'АТАКА',
      sku: 'KIM-KAR-W-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Добок для тхеквондо WTF',
      description: 'Офіційний добок для змагань WTF. Легкий та зручний',
      price: 1800,
      category: 'UNIFORM',
      sportType: 'TAEKWONDO',
      usageType: 'COMPETITION',
      sizes: ['120', '130', '140', '150', '160', '170', '180'],
      sizeChart: { ageMin: 6, ageMax: 18, heightMin: 120, heightMax: 185 },
      colors: ['Білий з чорним коміром'],
      images: [],
      stock: 30,
      isActive: true,
      isFeatured: true,
      isNewArrival: true,
      rating: 4.9,
      reviewsCount: 89,
      tags: ['добок', 'тхеквондо', 'WTF'],
      brand: 'MOOTO',
      sku: 'DOB-TKD-001',
      createdAt: now,
      updatedAt: now,
    },
    // === PROTECTION (Захист) ===
    {
      name: 'Шолом для карате WKF',
      description: 'Сертифікований шолом WKF для змагань. Максимальний захист',
      price: 2500,
      category: 'PROTECTION',
      sportType: 'KARATE',
      usageType: 'COMPETITION',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      sizeChart: { ageMin: 6, ageMax: 18 },
      colors: ['Синій', 'Червоний'],
      images: [],
      stock: 25,
      isActive: true,
      isFeatured: true,
      rating: 4.7,
      reviewsCount: 56,
      tags: ['шолом', 'карате', 'WKF', 'захист'],
      brand: 'TOKAIDO',
      sku: 'HLM-KAR-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Рукавички для карате (накладки)',
      description: 'Захисні накладки на руки. Сертифіковані WKF',
      price: 800,
      oldPrice: 950,
      category: 'PROTECTION',
      sportType: 'KARATE',
      usageType: 'BOTH',
      sizes: ['XS', 'S', 'M', 'L'],
      sizeChart: { ageMin: 5, ageMax: 18 },
      colors: ['Білий', 'Синій', 'Червоний'],
      images: [],
      stock: 100,
      isActive: true,
      isFeatured: false,
      rating: 4.6,
      reviewsCount: 203,
      tags: ['накладки', 'рукавички', 'карате', 'захист'],
      brand: 'ARAWAZA',
      sku: 'GLV-KAR-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Захист гомілки та стопи',
      description: 'Комплексний захист для ніг. Ідеально для тхеквондо та карате',
      price: 1200,
      category: 'PROTECTION',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      sizeChart: { ageMin: 5, ageMax: 18 },
      colors: ['Білий', 'Чорний'],
      images: [],
      stock: 60,
      isActive: true,
      rating: 4.5,
      reviewsCount: 87,
      tags: ['захист', 'гомілка', 'стопа', 'ноги'],
      brand: 'АТАКА',
      sku: 'SHN-UNI-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Паховий захист (раковина)',
      description: 'Захист паху для хлопчиків та чоловіків',
      price: 450,
      category: 'PROTECTION',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['XS', 'S', 'M', 'L'],
      sizeChart: { ageMin: 5, ageMax: 18 },
      colors: ['Білий'],
      images: [],
      stock: 80,
      isActive: true,
      rating: 4.4,
      reviewsCount: 67,
      tags: ['захист', 'пах', 'раковина'],
      brand: 'АТАКА',
      sku: 'GRP-UNI-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Капа (захист зубів)',
      description: 'Термопластична капа з кейсом для зберігання',
      price: 250,
      category: 'PROTECTION',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['Junior', 'Adult'],
      sizeChart: { ageMin: 5, ageMax: 18 },
      colors: ['Прозорий', 'Чорний', 'Синій'],
      images: [],
      stock: 150,
      isActive: true,
      rating: 4.3,
      reviewsCount: 312,
      tags: ['капа', 'захист', 'зуби'],
      brand: 'SHOCK DOCTOR',
      sku: 'MGD-UNI-001',
      createdAt: now,
      updatedAt: now,
    },
    // === EQUIPMENT (Екіпіровка) ===
    {
      name: 'Пояс для карате (білий)',
      description: 'Початковий пояс для карате. Бавовна',
      price: 150,
      category: 'EQUIPMENT',
      sportType: 'KARATE',
      usageType: 'BOTH',
      sizes: ['200', '220', '240', '260', '280', '300'],
      colors: ['Білий'],
      images: [],
      stock: 200,
      isActive: true,
      rating: 4.8,
      reviewsCount: 445,
      tags: ['пояс', 'карате', 'білий'],
      brand: 'АТАКА',
      sku: 'BLT-KAR-W-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Сумка спортивна АТАКА',
      description: 'Велика спортивна сумка з відділенням для взуття',
      price: 950,
      category: 'ACCESSORIES',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['One Size'],
      colors: ['Чорний', 'Синій', 'Червоний'],
      images: [],
      stock: 40,
      isActive: true,
      isFeatured: true,
      isNewArrival: true,
      rating: 4.7,
      reviewsCount: 78,
      tags: ['сумка', 'спортивна', 'АТАКА'],
      brand: 'АТАКА',
      sku: 'BAG-UNI-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Набір для початківця карате',
      description: 'Кімоно + пояс + накладки + капа. Все необхідне для старту!',
      price: 2800,
      oldPrice: 3300,
      category: 'EQUIPMENT',
      sportType: 'KARATE',
      usageType: 'TRAINING',
      sizes: ['110-120', '120-130', '130-140', '140-150', '150-160'],
      sizeChart: { ageMin: 5, ageMax: 14, heightMin: 110, heightMax: 160 },
      colors: ['Білий'],
      images: [],
      stock: 20,
      isActive: true,
      isFeatured: true,
      isNewArrival: false,
      rating: 4.9,
      reviewsCount: 156,
      tags: ['набір', 'початківець', 'карате', 'комплект'],
      brand: 'АТАКА',
      sku: 'SET-KAR-BEG-001',
      createdAt: now,
      updatedAt: now,
    },
    // === NUTRITION ===
    {
      name: 'Енергетичний батончик (набір 12шт)',
      description: 'Натуральні батончики для швидкого відновлення енергії',
      price: 480,
      category: 'NUTRITION',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['One Size'],
      colors: [],
      images: [],
      stock: 100,
      isActive: true,
      rating: 4.5,
      reviewsCount: 89,
      tags: ['батончик', 'енергія', 'харчування'],
      brand: 'PowerBar',
      sku: 'NUT-BAR-001',
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Пляшка для води АТАКА 750мл',
      description: 'Спортивна пляшка з логотипом клубу',
      price: 350,
      category: 'ACCESSORIES',
      sportType: 'UNIVERSAL',
      usageType: 'BOTH',
      sizes: ['750ml'],
      colors: ['Чорний', 'Білий', 'Червоний'],
      images: [],
      stock: 75,
      isActive: true,
      rating: 4.6,
      reviewsCount: 134,
      tags: ['пляшка', 'вода', 'спорт'],
      brand: 'АТАКА',
      sku: 'BTL-UNI-001',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // ============ PLANS (SUBSCRIPTION TARIFFS) ============
  await db.collection('plans').deleteMany({});
  await db.collection('plans').insertMany([
    {
      name: 'Місяць',
      type: 'MONTH',
      durationMonths: 1,
      basePrice: 2000,
      discountPercent: 0,
      finalPrice: 2000,
      freezeDaysAllowed: 3,
      personalSessionsIncluded: 0,
      competitionBenefits: false,
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      name: '6 місяців',
      type: 'HALF_YEAR',
      durationMonths: 6,
      basePrice: 12000,
      discountPercent: 10,
      finalPrice: 10800,
      freezeDaysAllowed: 14,
      personalSessionsIncluded: 2,
      competitionBenefits: true,
      isActive: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'Рік',
      type: 'YEAR',
      durationMonths: 12,
      basePrice: 24000,
      discountPercent: 20,
      finalPrice: 19200,
      freezeDaysAllowed: 30,
      personalSessionsIncluded: 6,
      competitionBenefits: true,
      isActive: true,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log('Seed completed!');
  console.log('');
  console.log('=== LOCATIONS ===');
  console.log('1. Позняки - вул. Анни Ахматової, 13В');
  console.log('2. Відрадний - вул. Новопольова, 106');
  console.log("3. Академіка Шалімова - вул. Академіка Шалімова, 43");
  console.log("4. Солом'янка - вул. Авіаконструктора Антонова, 4");
  console.log('');
  console.log('=== SUBSCRIPTION PLANS ===');
  console.log('- Місяць: 2000 грн (0% знижка, 3 дні заморозки)');
  console.log('- 6 місяців: 10800 грн (-10%, 14 днів заморозки)');
  console.log('- Рік: 19200 грн (-20%, 30 днів заморозки)');
  console.log('');
  console.log('=== TEST ACCOUNTS (Phone + OTP: 0000) ===');
  console.log('- Admin:   phone=+380501234567  role=ADMIN');
  console.log('- Coach:   phone=+380501234568  role=COACH (Олександр)');
  console.log('- Parent:  phone=+380501234569  role=PARENT (Ірина)');
  console.log('');
  console.log('=== SHOP PRODUCTS ===');
  console.log('- 12 products seeded across categories');
  console.log('');
  console.log('To login: Enter phone number, then use OTP code "0000"');

  await connection.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
