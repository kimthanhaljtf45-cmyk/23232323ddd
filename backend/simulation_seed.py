"""
ATAKA — Mass Simulation Seed
10K students, 20 coaches, 4 owners, 1000 parents, 500 purchases per level
+ A/B test data + Monte Carlo simulation
"""
import random
import math
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from bson import ObjectId

random.seed(42)
client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]
now = datetime.now(timezone.utc)

# ═══════════════════════════════════════
# 1. OWNERS (4 clubs)
# ═══════════════════════════════════════
CLUBS_CFG = [
    {"name": "ATAKA Позняки", "city": "Київ", "address": "вул. Авіаконструктора Антонова, 4"},
    {"name": "ATAKA Шалімова", "city": "Київ", "address": "вул. Академіка Шалімова, 12"},
    {"name": "ATAKA Солом'янка", "city": "Київ", "address": "вул. Солом'янська, 5"},
    {"name": "ATAKA Оболонь", "city": "Київ", "address": "пр. Оболонський, 22"},
]
OWNER_NAMES = [
    ("Дмитро", "Шевченко"), ("Олена", "Грищенко"), ("Андрій", "Мельник"), ("Ірина", "Ковальчук"),
]

print("=== Seeding 4 Owners + Clubs + Locations ===")
owners = []
clubs = []
locations = []

for i, cfg in enumerate(CLUBS_CFG):
    # Location
    loc_id = ObjectId()
    db["locations"].update_one({"_id": loc_id}, {"$set": {
        "name": cfg["name"].split("ATAKA ")[-1], "address": cfg["address"], "city": cfg["city"],
    }}, upsert=True)
    locations.append(loc_id)

    # Club
    club_id = ObjectId()
    clubs.append(club_id)

    # Owner user
    fn, ln = OWNER_NAMES[i]
    owner_id = ObjectId()
    try:
        db["users"].insert_one({
            "_id": owner_id,
            "phone": f"+38050000200{i}", "firstName": fn, "lastName": ln,
            "role": "OWNER", "status": "ACTIVE", "isOnboarded": True, "createdAt": now,
        })
    except Exception:
        existing = db["users"].find_one({"role": "OWNER", "firstName": fn})
        owner_id = existing["_id"] if existing else owner_id
    owners.append(owner_id)

    db["clubs"].update_one({"_id": club_id}, {"$set": {
        "name": cfg["name"], "city": cfg["city"], "ownerUserId": str(owner_id),
        "locationId": str(loc_id), "plan": "PRO", "status": "ACTIVE", "createdAt": now,
    }}, upsert=True)

print(f"  {len(owners)} owners, {len(clubs)} clubs, {len(locations)} locations")

# ═══════════════════════════════════════
# 2. COACHES (20 = 5 per club)
# ═══════════════════════════════════════
COACH_FIRST = ["Олександр", "Марія", "Дмитро", "Анна", "Віктор", "Катерина", "Артем", "Юлія", "Максим", "Наталія",
               "Сергій", "Оксана", "Іван", "Тетяна", "Богдан", "Людмила", "Роман", "Валентина", "Микола", "Світлана"]
COACH_LAST = ["Петренко", "Іваненко", "Коваль", "Сидоренко", "Ткаченко", "Бондаренко", "Кравченко", "Мороз", "Шевчук", "Полтавець",
              "Козак", "Григоренко", "Луценко", "Масленко", "Тарасенко", "Довженко", "Литвин", "Савченко", "Яременко", "Зайченко"]

print("=== Seeding 20 Coaches ===")
coaches = []
groups = []

for ci in range(20):
    club_idx = ci // 5  # 5 coaches per club
    coach_id = ObjectId()
    db["users"].update_one({"_id": coach_id}, {"$set": {
        "phone": f"+38099200{ci:04d}", "firstName": COACH_FIRST[ci], "lastName": COACH_LAST[ci],
        "role": "COACH", "status": "ACTIVE", "isOnboarded": True, "createdAt": now,
    }}, upsert=True)
    coaches.append({"id": coach_id, "club_idx": club_idx, "name": f"{COACH_FIRST[ci]} {COACH_LAST[ci]}"})

    # Each coach has 2 groups (different times)
    for gi, (time_s, time_e, dow_list) in enumerate([
        ("18:00", "19:00", [1, 3, 5]),
        ("17:00", "18:00", [2, 4]),
    ]):
        group_id = ObjectId()
        loc_name = CLUBS_CFG[club_idx]["name"].split("ATAKA ")[-1]
        db["groups"].update_one({"_id": group_id}, {"$set": {
            "name": f"{loc_name} {time_s}", "coachId": str(coach_id),
            "locationId": str(locations[club_idx]), "clubId": str(clubs[club_idx]),
            "maxStudents": 25, "isActive": True, "createdAt": now,
        }}, upsert=True)
        groups.append({"id": group_id, "coach_idx": ci, "club_idx": club_idx, "time_s": time_s, "time_e": time_e, "dow_list": dow_list})

        # Schedules
        for dow in dow_list:
            db["schedules"].insert_one({
                "groupId": str(group_id), "dayOfWeek": dow,
                "startTime": time_s, "endTime": time_e,
                "isActive": True, "maxStudents": 25,
            })

print(f"  {len(coaches)} coaches, {len(groups)} groups")

# ═══════════════════════════════════════
# 3. PARENTS (1000) + CHILDREN (10000)
# ═══════════════════════════════════════
FIRST_NAMES_M = ["Артем", "Максим", "Олександр", "Дмитро", "Андрій", "Іван", "Богдан", "Микола", "Сергій", "Віктор", "Роман", "Олег", "Тарас", "Данило", "Євген"]
FIRST_NAMES_F = ["Софія", "Анна", "Марія", "Вікторія", "Дарина", "Катерина", "Аліна", "Юлія", "Ольга", "Тетяна", "Наталія", "Оксана", "Валерія", "Діана", "Поліна"]
LAST_NAMES = ["Коваленко", "Сидоренко", "Бондаренко", "Ткаченко", "Кравченко", "Мельник", "Шевченко", "Петренко", "Іванов", "Козак",
              "Мороз", "Григоренко", "Полтавець", "Луценко", "Савченко", "Тарасенко", "Довженко", "Литвин", "Яременко", "Зайченко"]
PARENT_FIRST_M = ["Олексій", "Віталій", "Юрій", "Павло", "Володимир", "Сергій", "Андрій", "Олег", "Ігор", "Михайло"]
PARENT_FIRST_F = ["Ірина", "Олена", "Наталія", "Тетяна", "Людмила", "Оксана", "Світлана", "Валентина", "Марина", "Ганна"]

print("=== Seeding 1000 Parents + 10000 Students ===")
parents = []
children_ids = []

# A/B test groups
AB_GROUPS = ["A_with_pressure", "B_without_pressure"]

for pi in range(1000):
    parent_id = ObjectId()
    is_female = pi % 2 == 1
    pfn = random.choice(PARENT_FIRST_F if is_female else PARENT_FIRST_M)
    pln = random.choice(LAST_NAMES)
    db["users"].update_one({"_id": parent_id}, {"$set": {
        "phone": f"+38097{pi:07d}", "firstName": pfn, "lastName": pln,
        "role": "PARENT", "status": "ACTIVE", "isOnboarded": True, "createdAt": now - timedelta(days=random.randint(30, 365)),
    }}, upsert=True)
    parents.append(parent_id)

    # Each parent has 1-3 children (avg ~10 children per parent for 10K total)
    num_kids = random.choices([1, 2, 3], weights=[20, 50, 30])[0]
    for ki in range(num_kids):
        if len(children_ids) >= 10000:
            break
        child_id = ObjectId()
        is_adult = random.random() < 0.15  # 15% adults
        is_male = random.random() < 0.6
        cfn = random.choice(FIRST_NAMES_M if is_male else FIRST_NAMES_F)
        cln = pln

        group = random.choice(groups)
        belt_options = ["WHITE", "YELLOW", "ORANGE", "GREEN", "BLUE", "BROWN", "BLACK"]
        belt_weights = [30, 25, 20, 12, 8, 4, 1]
        belt = random.choices(belt_options, weights=belt_weights)[0] if not is_adult else "WHITE"
        xp = random.randint(0, 500) if not is_adult else random.randint(0, 300)
        discipline = random.randint(40, 100) if not is_adult else 0

        ab_group = random.choice(AB_GROUPS)
        created_days_ago = random.randint(7, 300)

        db["children"].insert_one({
            "firstName": cfn, "lastName": cln, "status": "ACTIVE",
            "clubId": str(clubs[group["club_idx"]]), "groupId": str(group["id"]),
            "userId": str(child_id), "parentId": parent_id,
            "studentType": "ADULT" if is_adult else "JUNIOR",
            "programType": "SELF_DEFENSE" if is_adult else random.choice(["KIDS", "SPORT"]),
            "belt": belt, "xp": xp, "discipline": discipline,
            "abGroup": ab_group,
            "createdAt": now - timedelta(days=created_days_ago),
        })

        # Also create user for child (student)
        db["users"].insert_one({
            "_id": child_id,
            "phone": f"+38066{len(children_ids):07d}", "firstName": cfn, "lastName": cln,
            "role": "STUDENT", "status": "ACTIVE", "isOnboarded": True,
            "programType": "SELF_DEFENSE" if is_adult else "KIDS",
            "createdAt": now - timedelta(days=created_days_ago),
        })

        children_ids.append(child_id)

    if len(children_ids) >= 10000:
        break

print(f"  {len(parents)} parents, {len(children_ids)} students")

# ═══════════════════════════════════════
# 4. ATTENDANCE SIMULATION (90 days)
# ═══════════════════════════════════════
print("=== Simulating attendance (90 days) ===")
all_children = list(db["children"].find({"status": "ACTIVE"}))
att_batch = []

for child in all_children:
    child_id = child["_id"]
    group_id = child.get("groupId", "")
    ab = child.get("abGroup", "A_with_pressure")
    created = child.get("createdAt", now - timedelta(days=60))
    if hasattr(created, 'tzinfo') and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    # Base attendance probability
    base_prob = 0.72 if ab == "A_with_pressure" else 0.63

    # Simulate 90 days
    for day_offset in range(90, 0, -1):
        day = now - timedelta(days=day_offset)
        if day < created:
            continue
        dow = day.isoweekday()

        # Check if training day (simplified: MWF or TT)
        has_training = dow in [1, 2, 3, 4, 5]
        if not has_training:
            continue

        # Attendance with decay pattern
        prob = base_prob + random.gauss(0, 0.1)
        if day_offset < 14:
            prob += 0.05  # Recent boost
        prob = max(0.2, min(0.95, prob))

        status = "PRESENT" if random.random() < prob else "ABSENT"
        reason = None
        if status == "ABSENT":
            reason = random.choice(["Хворію", "Не встигаю", "Сімейні обставини", None, None])

        att_batch.append({
            "childId": child_id, "date": day.strftime("%Y-%m-%d"),
            "status": status, "reason": reason,
            "createdAt": day,
        })

    if len(att_batch) >= 50000:
        db["attendances"].insert_many(att_batch)
        att_batch = []

if att_batch:
    db["attendances"].insert_many(att_batch)
    att_batch = []

total_att = db["attendances"].count_documents({})
print(f"  {total_att} attendance records")

# ═══════════════════════════════════════
# 5. MARKETPLACE PURCHASES (500 per level × levels)
# ═══════════════════════════════════════
PRODUCTS = list(db["products"].find())
if not PRODUCTS:
    PRODUCTS = [{"name": f"Product {i}", "price": random.randint(200, 2000)} for i in range(10)]

print("=== Simulating 2500+ purchases ===")
orders_batch = []
payments_batch = []

# 500 purchases per belt level (5 main levels)
belt_levels = ["WHITE", "YELLOW", "ORANGE", "GREEN", "BLUE"]
for belt in belt_levels:
    belt_students = [c for c in all_children if c.get("belt") == belt]
    if not belt_students:
        belt_students = all_children[:100]

    for _ in range(500):
        buyer = random.choice(belt_students)
        product = random.choice(PRODUCTS)
        price = product.get("price", random.randint(200, 2000))
        xp_discount = 0.05 if (buyer.get("xp", 0) >= 50) else 0
        final_price = round(price * (1 - xp_discount))

        order_id = ObjectId()
        order_date = now - timedelta(days=random.randint(0, 90))

        orders_batch.append({
            "_id": order_id,
            "childId": str(buyer["_id"]),
            "productName": product.get("name", "Товар"),
            "price": final_price,
            "originalPrice": price,
            "xpDiscount": xp_discount > 0,
            "status": random.choices(["PAID", "PENDING", "CANCELLED"], weights=[70, 20, 10])[0],
            "belt": belt,
            "abGroup": buyer.get("abGroup", "A"),
            "createdAt": order_date,
        })

        if orders_batch[-1]["status"] == "PAID":
            payments_batch.append({
                "orderId": str(order_id),
                "amount": final_price,
                "status": "PAID",
                "method": random.choice(["card", "cash", "transfer"]),
                "createdAt": order_date,
            })

db["orders"].insert_many(orders_batch)
if payments_batch:
    db["payments"].insert_many(payments_batch)

print(f"  {len(orders_batch)} orders, {len(payments_batch)} payments")

# ═══════════════════════════════════════
# 6. COACH ACTIONS SIMULATION
# ═══════════════════════════════════════
print("=== Simulating coach actions ===")
actions_batch = []
messages_batch = []

for coach in coaches:
    coach_id = coach["id"]
    # Each coach contacts 10-30 students
    num_contacts = random.randint(10, 30)
    coach_students = [c for c in all_children if c.get("groupId") in [str(g["id"]) for g in groups if g["coach_idx"] == coaches.index(coach)]]
    if not coach_students:
        coach_students = random.sample(all_children, min(num_contacts, len(all_children)))

    for _ in range(num_contacts):
        student = random.choice(coach_students)
        action_type = random.choice(["message", "call", "praise", "upsell"])
        action_date = now - timedelta(days=random.randint(0, 30))

        actions_batch.append({
            "coachId": str(coach_id), "studentId": str(student["_id"]),
            "studentName": f"{student.get('firstName', '')} {student.get('lastName', '')}".strip(),
            "type": action_type,
            "result": random.choices(["returned", "no_response", "declined"], weights=[55, 30, 15])[0],
            "createdAt": action_date,
        })

        messages_batch.append({
            "type": "COACH_TO_STUDENT", "fromUserId": str(coach_id),
            "fromName": coach["name"], "toUserId": str(student.get("userId", student["_id"])),
            "text": {
                "message": "Чекаємо на тренуванні!",
                "praise": "Молодець! Тримай темп 💪",
                "upsell": "Бачу прогрес. Є пропозиція — індивідуальне тренування?",
                "call": "Зателефонував учню",
            }.get(action_type, "Повідомлення"),
            "createdAt": action_date,
        })

db["coach_actions"].insert_many(actions_batch)
db["messages"].insert_many(messages_batch)
print(f"  {len(actions_batch)} coach actions, {len(messages_batch)} messages")

# ═══════════════════════════════════════
# 7. A/B TEST RESULTS
# ═══════════════════════════════════════
print("\n" + "="*60)
print("  A/B TEST RESULTS")
print("="*60)

group_a = [c for c in all_children if c.get("abGroup") == "A_with_pressure"]
group_b = [c for c in all_children if c.get("abGroup") == "B_without_pressure"]

def calc_metrics(students):
    total = len(students)
    if total == 0:
        return {}
    att_rates = []
    streaks = []
    purchases = 0
    revenue = 0
    for s in students:
        att = list(db["attendances"].find({"childId": s["_id"]}).sort("date", -1).limit(20))
        present = len([a for a in att if a.get("status") == "PRESENT"])
        total_a = len(att)
        att_rates.append(present / max(total_a, 1) * 100)

        streak = 0
        for a in att:
            if a.get("status") == "PRESENT":
                streak += 1
            else:
                break
        streaks.append(streak)

        orders = list(db["orders"].find({"childId": str(s["_id"]), "status": "PAID"}))
        purchases += len(orders)
        revenue += sum(o.get("price", 0) for o in orders)

    return {
        "students": total,
        "avg_attendance": round(sum(att_rates) / len(att_rates), 1),
        "avg_streak": round(sum(streaks) / len(streaks), 1),
        "total_purchases": purchases,
        "total_revenue": revenue,
        "avg_revenue_per_student": round(revenue / total),
        "retention_rate": round(len([r for r in att_rates if r > 50]) / total * 100, 1),
    }

# Sample 500 from each group for speed
sample_a = random.sample(group_a, min(500, len(group_a)))
sample_b = random.sample(group_b, min(500, len(group_b)))

metrics_a = calc_metrics(sample_a)
metrics_b = calc_metrics(sample_b)

print(f"\n  GROUP A (з тиском/pressure): {metrics_a}")
print(f"  GROUP B (без тиску/no pressure): {metrics_b}")

diff_att = metrics_a["avg_attendance"] - metrics_b["avg_attendance"]
diff_rev = metrics_a["avg_revenue_per_student"] - metrics_b["avg_revenue_per_student"]
diff_ret = metrics_a["retention_rate"] - metrics_b["retention_rate"]

print(f"\n  РІЗНИЦЯ:")
print(f"    Відвідуваність: +{diff_att:.1f}% (A краще)")
print(f"    Revenue/student: +{diff_rev:.0f} ₴")
print(f"    Retention: +{diff_ret:.1f}%")

# ═══════════════════════════════════════
# 8. MONTE CARLO SIMULATION (1000 runs)
# ═══════════════════════════════════════
print("\n" + "="*60)
print("  MONTE CARLO SIMULATION (1000 runs × 12 months)")
print("="*60)

SUBSCRIPTION_PRICE = 3000
CHURN_BASE = 0.05  # 5% monthly churn
GROWTH_BASE = 0.03  # 3% monthly growth

mc_results = []
for run in range(1000):
    students = 10000
    monthly_revenue = []
    total_rev = 0

    for month in range(12):
        # Revenue
        active = students
        rev = active * SUBSCRIPTION_PRICE
        market_rev = active * random.gauss(150, 50)  # avg market spend per student
        total_month = rev + market_rev

        # Churn (with pressure system = lower churn)
        churn_rate = CHURN_BASE * random.gauss(1.0, 0.2)
        churn_rate = max(0.01, min(0.15, churn_rate))
        lost = int(students * churn_rate)

        # Growth
        growth_rate = GROWTH_BASE * random.gauss(1.0, 0.3)
        growth_rate = max(0.0, min(0.08, growth_rate))
        gained = int(students * growth_rate)

        students = students - lost + gained
        students = max(100, students)
        total_rev += total_month
        monthly_revenue.append(total_month)

    mc_results.append({
        "final_students": students,
        "total_revenue": total_rev,
        "avg_monthly": total_rev / 12,
    })

revenues = [r["total_revenue"] for r in mc_results]
students_final = [r["final_students"] for r in mc_results]

p5 = sorted(revenues)[50]
p50 = sorted(revenues)[500]
p95 = sorted(revenues)[950]

print(f"\n  Результати (10K students, 12 місяців):")
print(f"    P5  (песимістичний): {p5/1e6:.1f}M ₴")
print(f"    P50 (медіана):      {p50/1e6:.1f}M ₴")
print(f"    P95 (оптимістичний):{p95/1e6:.1f}M ₴")
print(f"    Середній:           {sum(revenues)/len(revenues)/1e6:.1f}M ₴")
print(f"    Учнів (медіана):    {sorted(students_final)[500]}")
print(f"    Учнів (P95):        {sorted(students_final)[950]}")

# Save results to DB for Owner dashboard
db["simulation_results"].drop()
db["simulation_results"].insert_one({
    "type": "ab_test",
    "groupA": metrics_a,
    "groupB": metrics_b,
    "diff": {"attendance": diff_att, "revenue": diff_rev, "retention": diff_ret},
    "createdAt": now,
})
db["simulation_results"].insert_one({
    "type": "monte_carlo",
    "runs": 1000,
    "months": 12,
    "p5_revenue": p5,
    "p50_revenue": p50,
    "p95_revenue": p95,
    "avg_revenue": sum(revenues) / len(revenues),
    "p50_students": sorted(students_final)[500],
    "p95_students": sorted(students_final)[950],
    "createdAt": now,
})

# ═══════════════════════════════════════
# 9. COACH ROI SIMULATION
# ═══════════════════════════════════════
print("\n" + "="*60)
print("  COACH ROI RESULTS")
print("="*60)

for coach in coaches:
    ca = [a for a in actions_batch if a["coachId"] == str(coach["id"])]
    contacted = len(ca)
    returned = len([a for a in ca if a["result"] == "returned"])
    conv = round(returned / max(contacted, 1) * 100)
    rev = returned * SUBSCRIPTION_PRICE
    print(f"  {coach['name']:25s} | contacted={contacted:3d} returned={returned:2d} conv={conv:3d}% revenue=+{rev:,d}₴")

print("\n" + "="*60)
print("  SEED COMPLETE")
print("="*60)
print(f"  Users: {db['users'].count_documents({})}")
print(f"  Children: {db['children'].count_documents({})}")
print(f"  Parents: {len(parents)}")
print(f"  Coaches: {len(coaches)}")
print(f"  Owners: {len(owners)}")
print(f"  Groups: {len(groups)}")
print(f"  Attendance: {db['attendances'].count_documents({})}")
print(f"  Orders: {db['orders'].count_documents({})}")
print(f"  Payments: {db['payments'].count_documents({})}")
print(f"  Coach Actions: {db['coach_actions'].count_documents({})}")
print(f"  Messages: {db['messages'].count_documents({})}")
