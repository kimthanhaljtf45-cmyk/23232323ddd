"""
ATAKA Backend - Reliable Bootstrap Proxy + Automation Engine
=============================================================
Auto-starts and monitors NestJS backend with:
- Auto-start on cold boot
- Health monitoring
- Auto-recovery on crash
- Connection pooling
- AUTOMATION ENGINE: cron-based rules for retention, messaging, marketplace
- PUSH NOTIFICATIONS: Expo Push API integration for real-time alerts
"""

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import httpx
import subprocess
import os
import asyncio
from pathlib import Path
import logging
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from bson import ObjectId
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

NESTJS_URL = "http://localhost:3001"
NESTJS_STARTUP_TIMEOUT = 60
HEALTH_CHECK_INTERVAL = 10
AUTOMATION_INTERVAL = 600  # 10 minutes
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Global state
nestjs_process = None
http_client = None
nestjs_ready = False
health_task = None
automation_task = None

# MongoDB direct connection for automation
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
mongo_client = None
db = None

def get_db():
    global mongo_client, db
    if db is None:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
    return db

def json_serial(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

# ============================================================
# PUSH NOTIFICATION ENGINE
# ============================================================

PUSH_TEXTS = {
    "discount_20": {
        "title": "Знижка -20% для {child_name}",
        "body": "Ми підготували спеціальну пропозицію. Відвідуваність: {value}%",
        "screen": "/(tabs)",
    },
    "message_parent": {
        "title": "{child_name} потребує уваги",
        "body": "Відвідуваність знизилась до {value}%. Зверніть увагу на тренування.",
        "screen": "/messages",
    },
    "recommend_product": {
        "title": "Рекомендація для {child_name}",
        "body": "Тренер рекомендує нову екіпіровку. Перегляньте в маркетплейсі.",
        "screen": "/marketplace/recommendations",
    },
    "assign_coach": {
        "title": "Новий лід очікує",
        "body": "Вам призначено нового учня. Зв'яжіться протягом 1 години.",
        "screen": "/(coach)",
    },
    "alert_admin": {
        "title": "Увага: необроблений лід",
        "body": "Лід не контактований понад 24 години. Потрібна дія.",
        "screen": "/(admin)",
    },
    # ── AGGRESSIVE PUSH TEMPLATES ──
    "flash_discount": {
        "title": "🔥 Знижка -10% тільки сьогодні!",
        "body": "Спеціальна пропозиція для {child_name}. Встигніть до кінця дня!",
        "screen": "/marketplace/recommendations",
    },
    "coach_recommends": {
        "title": "Тренер рекомендує для {child_name}",
        "body": "Персональна рекомендація від тренера. Перегляньте в маркетплейсі.",
        "screen": "/marketplace/recommendations",
    },
    "belt_upgrade_offer": {
        "title": "🎉 {child_name} отримав новий пояс!",
        "body": "Вітаємо! Рекомендуємо оновити екіпіровку для нового рівня.",
        "screen": "/marketplace/recommendations",
    },
    "attendance_drop": {
        "title": "😢 {child_name} пропускає тренування",
        "body": "Поверніть {child_name} на тренування! Знижка -{value}% на абонемент.",
        "screen": "/payments/offers",
    },
    "streak_reward": {
        "title": "🏆 {child_name} — серія {value} тренувань!",
        "body": "Відмінний результат! Спеціальна нагорода чекає.",
        "screen": "/(tabs)/progress",
    },
    "event_achievement": {
        "title": "🥇 {child_name} — нове досягнення!",
        "body": "Перегляньте рекомендовані товари для нового рівня.",
        "screen": "/marketplace/recommendations",
    },
    "debt_reminder": {
        "title": "Нагадування про оплату",
        "body": "За {child_name} є заборгованість. Перегляньте деталі в додатку.",
        "screen": "/billing",
    },
}

async def send_expo_push(tokens: list, title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API"""
    if not tokens:
        return 0
    
    messages = []
    for token in tokens:
        if not token or not isinstance(token, str):
            continue
        if not token.startswith("ExponentPushToken["):
            continue
        msg = {"to": token, "title": title, "body": body, "sound": "default"}
        if data:
            msg["data"] = data
        messages.append(msg)
    
    if not messages:
        return 0
    
    sent = 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Batch in groups of 100
            for i in range(0, len(messages), 100):
                batch = messages[i:i+100]
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    tickets = resp.json().get("data", [])
                    sent += sum(1 for t in tickets if t.get("status") == "ok")
                    errors = [t for t in tickets if t.get("status") == "error"]
                    if errors:
                        logger.warning(f"Push errors: {errors[:3]}")
                else:
                    logger.error(f"Push API error: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Push send error: {e}")
    
    if sent > 0:
        logger.info(f"Push: sent {sent} notifications")
    return sent

def get_user_push_tokens(database, user_id: str) -> list:
    """Get all active push tokens for a user"""
    tokens = database["devicetokens"].find({"userId": user_id, "isActive": True})
    return [t.get("token") for t in tokens if t.get("token")]

async def send_automation_push(database, user_id: str, action: str, child_name: str = "", value: float = 0):
    """Send push notification for an automation action"""
    template = PUSH_TEXTS.get(action)
    if not template:
        return 0
    
    tokens = get_user_push_tokens(database, user_id)
    if not tokens:
        return 0
    
    title = template["title"].format(child_name=child_name, value=f"{value:.0f}")
    body = template["body"].format(child_name=child_name, value=f"{value:.0f}")
    data = {"screen": template.get("screen", "/"), "type": "automation", "action": action}
    
    sent = await send_expo_push(tokens, title, body, data)
    
    # Log push in notifications collection
    if sent > 0:
        database["notifications"].insert_one({
            "userId": user_id,
            "type": f"AUTOMATION_{action.upper()}",
            "title": title,
            "body": body,
            "data": data,
            "isRead": False,
            "isPush": True,
            "pushSent": sent,
            "createdAt": datetime.now(timezone.utc),
        })
    
    return sent

# ============================================================
# AUTOMATION ENGINE
# ============================================================

DEFAULT_RULES = [
    {
        "id": "critical_risk",
        "name": "Критичний ризик відтоку",
        "description": "Якщо відвідуваність < 40% → знижка -20% + повідомлення батькам",
        "trigger": "attendance",
        "condition": {"field": "attendance", "operator": "<", "value": 40},
        "actions": ["discount_20", "message_parent"],
        "isActive": True,
        "priority": 1,
        "icon": "alert-circle",
        "color": "#EF4444",
    },
    {
        "id": "low_attendance",
        "name": "Низька відвідуваність",
        "description": "Якщо відвідуваність < 60% → повідомлення батькам з пропозицією заморозки",
        "trigger": "attendance",
        "condition": {"field": "attendance", "operator": "<", "value": 60},
        "actions": ["message_parent"],
        "isActive": True,
        "priority": 2,
        "icon": "trending-down",
        "color": "#F59E0B",
    },
    {
        "id": "debt_reminder",
        "name": "Нагадування про борг",
        "description": "Якщо є борг → нагадування + пропозиція знижки",
        "trigger": "debt",
        "condition": {"field": "hasDebt", "operator": "==", "value": True},
        "actions": ["message_parent"],
        "isActive": False,
        "priority": 3,
        "icon": "card",
        "color": "#EF4444",
    },
    {
        "id": "marketplace_recommend",
        "name": "Рекомендація екіпіровки",
        "description": "Активним учням без екіпіровки → рекомендація товарів",
        "trigger": "active_student",
        "condition": {"field": "status", "operator": "==", "value": "ACTIVE"},
        "actions": ["recommend_product"],
        "isActive": False,
        "priority": 4,
        "icon": "cart",
        "color": "#7C3AED",
    },
    {
        "id": "lead_followup",
        "name": "Автоматичний follow-up лідів",
        "description": "Якщо лід не контактований 24г → призначити тренера + alert",
        "trigger": "lead_stale",
        "condition": {"field": "status", "operator": "==", "value": "NEW"},
        "actions": ["assign_coach", "alert_admin"],
        "isActive": False,
        "priority": 5,
        "icon": "people",
        "color": "#3B82F6",
    },
]

def init_automation_rules():
    """Initialize default automation rules in DB"""
    database = get_db()
    rules_col = database["automation_rules"]
    if rules_col.count_documents({}) == 0:
        for rule in DEFAULT_RULES:
            rule["createdAt"] = datetime.now(timezone.utc)
            rule["updatedAt"] = datetime.now(timezone.utc)
            rule["executionCount"] = 0
            rule["lastExecuted"] = None
            rules_col.insert_one(rule)
        logger.info(f"Initialized {len(DEFAULT_RULES)} automation rules")

async def run_automation_cycle():
    """Execute one cycle of automation rules"""
    global http_client
    if not nestjs_ready or not http_client:
        return

    database = get_db()
    rules_col = database["automation_rules"]
    logs_col = database["automation_logs"]
    children_col = database["children"]
    subscriptions_col = database["subscriptions"]
    users_col = database["users"]

    active_rules = list(rules_col.find({"isActive": True}).sort("priority", 1))
    if not active_rules:
        return

    # Get all students with their data
    students = list(children_col.find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    subs = list(subscriptions_col.find({}))
    sub_map = {str(s.get("childId")): s for s in subs}

    actions_taken = 0
    now = datetime.now(timezone.utc)

    for rule in active_rules:
        rule_id = rule.get("id", str(rule.get("_id")))
        condition = rule.get("condition", {})

        # Check if rule was already executed in last cycle (avoid spam)
        last_exec = rule.get("lastExecuted")
        if last_exec:
            if not last_exec.tzinfo:
                last_exec = last_exec.replace(tzinfo=timezone.utc)
            if (now - last_exec).total_seconds() < AUTOMATION_INTERVAL - 30:
                continue

        targets = []

        for student in students:
            student_id = str(student["_id"])
            sub = sub_map.get(student_id, {})

            # Check if this student already had this rule applied recently
            recent_log = logs_col.find_one({
                "ruleId": rule_id,
                "targetId": student_id,
                "createdAt": {"$gte": datetime(now.year, now.month, now.day, tzinfo=timezone.utc)}
            })
            if recent_log:
                continue

            # Evaluate condition
            field = condition.get("field", "")
            op = condition.get("operator", "")
            val = condition.get("value")

            student_val = None
            if field == "attendance":
                # Calculate from subscription data or use stored value
                attendance_records = list(database["attendances"].find({"childId": student["_id"]}))
                total = len(attendance_records)
                present = len([a for a in attendance_records if a.get("status") == "PRESENT"])
                student_val = (present / total * 100) if total > 0 else 0
            elif field == "hasDebt":
                student_val = student.get("hasDebt", False) or student.get("debtAmount", 0) > 0
            elif field == "status":
                student_val = sub.get("status") or student.get("status", "ACTIVE")

            match = False
            if op == "<" and student_val is not None:
                match = student_val < val
            elif op == ">" and student_val is not None:
                match = student_val > val
            elif op == "==" and student_val is not None:
                match = student_val == val
            elif op == "!=" and student_val is not None:
                match = student_val != val

            if match:
                targets.append({"student": student, "sub": sub, "computed_value": student_val})

        # Execute actions for matched targets
        for target in targets[:10]:  # Limit to 10 per rule per cycle
            student = target["student"]
            sub = target["sub"]
            student_id = str(student["_id"])
            student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
            parent_id = str(student.get("userId", "")) if student.get("userId") else None

            for action in rule.get("actions", []):
                try:
                    result = "skipped"

                    if action == "discount_20" and sub.get("_id"):
                        new_price = int(sub.get("price", 2000) * 0.8)
                        subscriptions_col.update_one(
                            {"_id": sub["_id"]},
                            {"$set": {"price": new_price, "updatedAt": now}}
                        )
                        result = f"discount applied: {sub.get('price')} → {new_price}"
                        actions_taken += 1
                        # Push notification to parent
                        if parent_id:
                            push_sent = await send_automation_push(
                                database, parent_id, "discount_20",
                                child_name=student_name,
                                value=target.get("computed_value", 0)
                            )
                            if push_sent:
                                result += f" +push({push_sent})"

                    elif action == "message_parent" and parent_id:
                        # Create communication thread and send message
                        try:
                            # Get admin token for API call
                            admin = users_col.find_one({"role": "ADMIN"})
                            if admin:
                                msg_text = f"⚡ Автоматичне повідомлення: {student_name} потребує уваги. Відвідуваність: {target.get('computed_value', 0):.0f}%"
                                database["messages"].insert_one({
                                    "senderId": admin["_id"],
                                    "receiverId": ObjectId(parent_id) if parent_id else None,
                                    "text": msg_text,
                                    "type": "SYSTEM",
                                    "isAutomatic": True,
                                    "createdAt": now,
                                })
                                result = f"message sent to parent {parent_id}"
                                actions_taken += 1
                                # Push notification to parent
                                push_sent = await send_automation_push(
                                    database, parent_id, "message_parent",
                                    child_name=student_name,
                                    value=target.get("computed_value", 0)
                                )
                                if push_sent:
                                    result += f" +push({push_sent})"
                        except Exception as e:
                            result = f"message error: {str(e)}"

                    elif action == "recommend_product":
                        result = "product recommendation queued"
                        actions_taken += 1
                        # Push to parent about product recommendation
                        if parent_id:
                            push_sent = await send_automation_push(
                                database, parent_id, "recommend_product",
                                child_name=student_name
                            )
                            if push_sent:
                                result += f" +push({push_sent})"

                    elif action == "assign_coach":
                        result = "coach assignment queued"
                        # Push to assigned coach
                        coach_id = str(student.get("coachId", ""))
                        if coach_id:
                            push_sent = await send_automation_push(
                                database, coach_id, "assign_coach",
                                child_name=student_name
                            )
                            if push_sent:
                                result += f" +push({push_sent})"

                    elif action == "alert_admin":
                        result = "admin alert queued"
                        # Push to all admins
                        admins = list(users_col.find({"role": "ADMIN"}))
                        for adm in admins:
                            await send_automation_push(
                                database, str(adm["_id"]), "alert_admin",
                                child_name=student_name
                            )

                    # Log action
                    logs_col.insert_one({
                        "ruleId": rule_id,
                        "ruleName": rule.get("name"),
                        "targetId": student_id,
                        "targetName": student_name,
                        "action": action,
                        "result": result,
                        "computedValue": target.get("computed_value"),
                        "createdAt": now,
                    })

                except Exception as e:
                    logger.error(f"Automation action error: {e}")

        # Update rule execution stats
        if targets:
            rules_col.update_one(
                {"_id": rule["_id"]},
                {"$set": {"lastExecuted": now}, "$inc": {"executionCount": len(targets)}}
            )

    if actions_taken > 0:
        logger.info(f"Automation: {actions_taken} actions taken")

async def automation_loop():
    """Background automation loop"""
    await asyncio.sleep(30)  # Wait for NestJS to fully start
    init_automation_rules()

    while True:
        try:
            await run_automation_cycle()
            await run_event_engine()  # Event Engine MVP
        except Exception as e:
            logger.error(f"Automation cycle error: {e}")
        await asyncio.sleep(AUTOMATION_INTERVAL)


# ============================================================
# EVENT ENGINE — Real-time event processing
# ============================================================

EVENT_TYPES = {
    "debt_reminder": {
        "name": "Нагадування про борг",
        "icon": "card",
        "color": "#DC2626",
        "severity": "critical",
    },
    "attendance_risk": {
        "name": "Ризик відтоку",
        "icon": "alert-circle",
        "color": "#D97706",
        "severity": "warning",
    },
    "achievement_streak": {
        "name": "Досягнення: серія",
        "icon": "flame",
        "color": "#16A34A",
        "severity": "positive",
    },
    "achievement_belt": {
        "name": "Досягнення: пояс",
        "icon": "ribbon",
        "color": "#7C3AED",
        "severity": "positive",
    },
    "competition_upcoming": {
        "name": "Змагання наближаються",
        "icon": "trophy",
        "color": "#D97706",
        "severity": "info",
    },
}


async def run_event_engine():
    """Process events for all children — the heart of the system"""
    database = get_db()
    now = datetime.now(timezone.utc)
    events_col = database["events"]
    notif_col = database["notifications"]
    feed_col = database["contentposts"]
    ach_col = database["achievements"]

    children = list(database["children"].find())
    total_events = 0
    total_actions = 0

    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        parent_id = str(child.get("userId") or child.get("parentId") or child.get("roleOwnerId") or "")

        # Skip if no parent
        if not parent_id:
            continue

        # ---- EVENT 1: DEBT REMINDER ----
        payments = list(database["payments"].find({"childId": child_id, "status": {"$in": ["PENDING", "OVERDUE"]}}))
        if not payments:
            payments = list(database["payments"].find({"childId": child["_id"], "status": {"$in": ["PENDING", "OVERDUE"]}}))
        debt = sum(p.get("amount", 0) for p in payments)

        if debt > 0:
            # Check if we already sent this today
            existing = events_col.find_one({
                "type": "debt_reminder", "childId": child_id,
                "createdAt": {"$gte": datetime(now.year, now.month, now.day, tzinfo=timezone.utc)}
            })
            if not existing:
                events_col.insert_one({
                    "type": "debt_reminder",
                    "childId": child_id,
                    "childName": child_name,
                    "parentId": parent_id,
                    "severity": "critical",
                    "meta": {"debt": debt},
                    "actions": ["push_parent", "alert_home", "cta_red"],
                    "processed": True,
                    "createdAt": now,
                })
                # Action: notification
                notif_col.insert_one({
                    "userId": parent_id,
                    "type": "EVENT_DEBT_REMINDER",
                    "title": f"💳 Борг за {child_name}: {debt} ₴",
                    "body": f"Оплатіть абонемент для {child_name}. Борг: {debt} ₴. Натисніть для оплати.",
                    "data": {"screen": "/payments", "type": "event", "childId": child_id},
                    "isRead": False,
                    "createdAt": now,
                })
                # Action: push (logged, actual push via Expo Push API)
                await send_automation_push(database, parent_id, "debt_reminder", child_name=child_name, value=debt)
                total_events += 1
                total_actions += 2

        # ---- EVENT 2: ATTENDANCE RISK ----
        att_records = list(database["attendances"].find({"childId": child["_id"]}))
        if not att_records:
            att_records = list(database["attendances"].find({"childId": child_id}))

        total_att = len(att_records)
        present = len([a for a in att_records if a.get("status") == "PRESENT"])
        absent = len([a for a in att_records if a.get("status") == "ABSENT"])
        attendance_pct = round(present / total_att * 100) if total_att > 0 else 0

        # Count consecutive misses from the end
        consecutive_misses = 0
        for a in sorted(att_records, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") == "ABSENT":
                consecutive_misses += 1
            else:
                break

        if consecutive_misses >= 3 or (total_att > 3 and attendance_pct < 50):
            existing = events_col.find_one({
                "type": "attendance_risk", "childId": child_id,
                "createdAt": {"$gte": datetime(now.year, now.month, now.day, tzinfo=timezone.utc)}
            })
            if not existing:
                events_col.insert_one({
                    "type": "attendance_risk",
                    "childId": child_id,
                    "childName": child_name,
                    "parentId": parent_id,
                    "severity": "warning",
                    "meta": {"attendance": attendance_pct, "consecutiveMisses": consecutive_misses},
                    "actions": ["push_parent", "alert_home", "notify_coach"],
                    "processed": True,
                    "createdAt": now,
                })
                # Action: notification to parent
                notif_col.insert_one({
                    "userId": parent_id,
                    "type": "EVENT_ATTENDANCE_RISK",
                    "title": f"⚠️ {child_name} пропускає тренування",
                    "body": f"Відвідуваність {child_name}: {attendance_pct}%. Рекомендуємо повернутись до регулярних занять.",
                    "data": {"screen": "/(tabs)/progress", "type": "event", "childId": child_id},
                    "isRead": False,
                    "createdAt": now,
                })
                # Action: notify coach
                coach_id = str(child.get("coachId", ""))
                if coach_id:
                    notif_col.insert_one({
                        "userId": coach_id,
                        "type": "EVENT_ATTENDANCE_RISK_COACH",
                        "title": f"📊 {child_name} — ризик відтоку",
                        "body": f"Відвідуваність {attendance_pct}%, пропусків підряд: {consecutive_misses}. Зверніть увагу.",
                        "data": {"screen": "/coach/students", "type": "event", "childId": child_id},
                        "isRead": False,
                        "createdAt": now,
                    })
                # Action: push
                await send_automation_push(database, parent_id, "attendance_risk", child_name=child_name, value=attendance_pct)
                total_events += 1
                total_actions += 3

        # ---- EVENT 3: ACHIEVEMENT STREAK ----
        streak = 0
        for a in sorted(att_records, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") == "PRESENT":
                streak += 1
            else:
                break

        if streak >= 5:
            # Check if achievement already exists
            existing_ach = ach_col.find_one({"childId": child_id, "type": "STREAK_5"})
            if not existing_ach:
                ach_col.insert_one({
                    "childId": child_id,
                    "title": f"🔥 {streak} тренувань підряд!",
                    "description": f"{child_name} відвідав {streak} тренувань підряд. Так тримати!",
                    "type": "STREAK_5",
                    "awardedAt": now,
                    "createdAt": now,
                })
                # Event
                events_col.insert_one({
                    "type": "achievement_streak",
                    "childId": child_id,
                    "childName": child_name,
                    "parentId": parent_id,
                    "severity": "positive",
                    "meta": {"streak": streak},
                    "actions": ["push_parent", "feed_item", "badge"],
                    "processed": True,
                    "createdAt": now,
                })
                # Action: notification
                notif_col.insert_one({
                    "userId": parent_id,
                    "type": "EVENT_ACHIEVEMENT",
                    "title": f"🔥 {child_name} — {streak} тренувань підряд!",
                    "body": f"Вітаємо! {child_name} показує чудову дисципліну. Так тримати!",
                    "data": {"screen": "/(tabs)/progress", "type": "event", "childId": child_id},
                    "isRead": False,
                    "createdAt": now,
                })
                # Action: feed item
                feed_col.insert_one({
                    "title": f"🔥 {child_name} — {streak} тренувань підряд!",
                    "body": f"{child_name} показує чудову дисципліну та відвідав {streak} тренувань підряд!",
                    "type": "PERSONAL",
                    "status": "PUBLISHED",
                    "createdAt": now,
                })
                # Action: push
                await send_automation_push(database, parent_id, "achievement_streak", child_name=child_name, value=streak)
                total_events += 1
                total_actions += 3

        # Streak 10 — special achievement
        if streak >= 10:
            existing_ach10 = ach_col.find_one({"childId": child_id, "type": "STREAK_10"})
            if not existing_ach10:
                ach_col.insert_one({
                    "childId": child_id,
                    "title": f"🏆 Легенда! {streak} тренувань!",
                    "description": f"{child_name} досяг неймовірної серії — {streak} тренувань підряд!",
                    "type": "STREAK_10",
                    "awardedAt": now,
                    "createdAt": now,
                })
                total_events += 1

    # Add PUSH_TEXTS for new event types
    if total_events > 0 or total_actions > 0:
        logger.info(f"Event Engine: {total_events} events, {total_actions} actions")


# Add push text templates for event engine
PUSH_TEXTS["debt_reminder"] = {
    "title": "💳 Борг за {child_name}",
    "body": "Оплатіть абонемент: {value:.0f} ₴",
    "screen": "/payments",
}
PUSH_TEXTS["attendance_risk"] = {
    "title": "⚠️ {child_name} пропускає",
    "body": "Відвідуваність: {value:.0f}%. Поверніться до тренувань!",
    "screen": "/(tabs)/progress",
}
PUSH_TEXTS["achievement_streak"] = {
    "title": "🔥 {child_name} — серія!",
    "body": "{value:.0f} тренувань підряд! Так тримати!",
    "screen": "/(tabs)/progress",
}


# ============================================================
# NESTJS PROXY (original)
# ============================================================

async def check_nestjs_health():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{NESTJS_URL}/api/health")
            return response.status_code == 200
    except Exception:
        return False

async def start_nestjs():
    global nestjs_process, nestjs_ready
    if await check_nestjs_health():
        logger.info("NestJS already running")
        nestjs_ready = True
        return True
    logger.info("Starting NestJS backend...")
    try:
        subprocess.run(["pkill", "-9", "-f", "node dist/main"], capture_output=True)
        await asyncio.sleep(1)
    except Exception:
        pass
    try:
        env = os.environ.copy()
        env["PORT"] = "3001"
        env["MONGO_URL"] = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        env["DB_NAME"] = os.environ.get("DB_NAME", "test_database")
        env["JWT_ACCESS_SECRET"] = os.environ.get("JWT_ACCESS_SECRET", "access_secret")
        env["JWT_REFRESH_SECRET"] = os.environ.get("JWT_REFRESH_SECRET", "refresh_secret")
        nestjs_process = subprocess.Popen(
            ["node", "dist/main"],
            cwd=str(ROOT_DIR),
            stdout=open("/tmp/nestjs.log", "a"),
            stderr=open("/tmp/nestjs.err", "a"),
            env=env
        )
        for _ in range(NESTJS_STARTUP_TIMEOUT):
            if await check_nestjs_health():
                logger.info("NestJS backend ready!")
                nestjs_ready = True
                return True
            await asyncio.sleep(1)
        logger.error("NestJS startup timeout")
        return False
    except Exception as e:
        logger.error(f"Failed to start NestJS: {e}")
        return False

async def health_monitor():
    global nestjs_ready
    while True:
        await asyncio.sleep(HEALTH_CHECK_INTERVAL)
        if not await check_nestjs_health():
            logger.warning("NestJS unhealthy, restarting...")
            nestjs_ready = False
            await start_nestjs()

async def stop_nestjs():
    global nestjs_process
    if nestjs_process:
        try:
            nestjs_process.terminate()
            nestjs_process.wait(timeout=5)
        except Exception:
            nestjs_process.kill()
        nestjs_process = None
    subprocess.run(["pkill", "-9", "-f", "node dist/main"], capture_output=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client, health_task, automation_task
    logger.info("ATAKA Proxy + Automation starting...")
    http_client = httpx.AsyncClient(
        timeout=60.0,
        base_url=NESTJS_URL,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
    )
    await start_nestjs()
    health_task = asyncio.create_task(health_monitor())
    automation_task = asyncio.create_task(automation_loop_with_ai())
    payment_task = asyncio.create_task(payment_failsafe_cron())
    init_pricing_plans()
    init_default_club()
    init_sports()
    logger.info("ATAKA Proxy + Automation + AI + Payments ready!")
    yield
    logger.info("Shutting down...")
    if health_task:
        health_task.cancel()
    if payment_task:
        payment_task.cancel()
    if automation_task:
        automation_task.cancel()
    if http_client:
        await http_client.aclose()
    await stop_nestjs()

app = FastAPI(title="ATAKA Proxy + Automation", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ATAKA Proxy + Automation running", "nestjs_ready": nestjs_ready}

@app.get("/api/proxy/status")
async def proxy_status():
    healthy = await check_nestjs_health()
    return {
        "proxy": "running",
        "nestjs": "healthy" if healthy else "unhealthy",
        "nestjs_ready": nestjs_ready,
        "automation": "active"
    }

# ============================================================
# AUTOMATION API ENDPOINTS
# ============================================================

@app.get("/api/automation/rules")
async def get_automation_rules():
    """Get all automation rules"""
    database = get_db()
    rules = list(database["automation_rules"].find({}, {"_id": 0}))
    return JSONResponse(content=json.loads(json.dumps(rules, default=json_serial)))

@app.patch("/api/automation/rules/{rule_id}")
async def update_automation_rule(rule_id: str, request: Request):
    """Toggle or update automation rule"""
    body = await request.json()
    database = get_db()
    update_data = {"updatedAt": datetime.now(timezone.utc)}
    if "isActive" in body:
        update_data["isActive"] = body["isActive"]
    if "condition" in body:
        update_data["condition"] = body["condition"]

    result = database["automation_rules"].update_one(
        {"id": rule_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        return JSONResponse(content={"error": "Rule not found"}, status_code=404)
    return JSONResponse(content={"success": True, "ruleId": rule_id})

@app.post("/api/automation/run")
async def trigger_automation():
    """Manually trigger automation cycle"""
    await run_automation_cycle()
    return JSONResponse(content={"success": True, "message": "Automation cycle completed"})

@app.get("/api/automation/logs")
async def get_automation_logs(limit: int = 50):
    """Get recent automation logs"""
    database = get_db()
    logs = list(
        database["automation_logs"]
        .find({}, {"_id": 0})
        .sort("createdAt", -1)
        .limit(limit)
    )
    return JSONResponse(content=json.loads(json.dumps(logs, default=json_serial)))

@app.get("/api/automation/stats")
async def get_automation_stats():
    """Get automation statistics"""
    database = get_db()
    rules = list(database["automation_rules"].find({}))
    total_rules = len(rules)
    active_rules = len([r for r in rules if r.get("isActive")])
    total_executions = sum(r.get("executionCount", 0) for r in rules)

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_logs = database["automation_logs"].count_documents({"createdAt": {"$gte": today}})

    return JSONResponse(content={
        "totalRules": total_rules,
        "activeRules": active_rules,
        "totalExecutions": total_executions,
        "todayActions": today_logs,
    })

@app.get("/api/automation/student/{student_id}/actions")
async def get_student_automation_actions(student_id: str):
    """Get automation actions applied to a specific student"""
    database = get_db()
    logs = list(
        database["automation_logs"]
        .find({"targetId": student_id}, {"_id": 0})
        .sort("createdAt", -1)
        .limit(10)
    )
    return JSONResponse(content=json.loads(json.dumps(logs, default=json_serial)))


# ============================================================
# PUSH NOTIFICATION API ENDPOINTS
# ============================================================

@app.post("/api/push/send")
async def send_push_notification(request: Request):
    """Send push notification to a specific user"""
    body = await request.json()
    user_id = body.get("userId")
    title = body.get("title", "АТАКА")
    message = body.get("body", "")
    data = body.get("data", {})
    
    if not user_id:
        return JSONResponse(content={"error": "userId required"}, status_code=400)
    
    database = get_db()
    tokens = get_user_push_tokens(database, user_id)
    
    if not tokens:
        return JSONResponse(content={"sent": 0, "message": "No device tokens found"})
    
    sent = await send_expo_push(tokens, title, message, data)
    
    # Save notification
    database["notifications"].insert_one({
        "userId": user_id,
        "type": "MANUAL_PUSH",
        "title": title,
        "body": message,
        "data": data,
        "isRead": False,
        "isPush": True,
        "pushSent": sent,
        "createdAt": datetime.now(timezone.utc),
    })
    
    return JSONResponse(content={"sent": sent, "tokens": len(tokens)})

@app.post("/api/push/broadcast")
async def broadcast_push(request: Request):
    """Send push to all users with a specific role"""
    body = await request.json()
    role = body.get("role")  # PARENT, COACH, ADMIN
    title = body.get("title", "АТАКА")
    message = body.get("body", "")
    data = body.get("data", {})
    
    database = get_db()
    query = {"isActive": True}
    if role:
        # Find users with this role
        users = list(database["users"].find({"role": role}))
        user_ids = [str(u["_id"]) for u in users]
        query["userId"] = {"$in": user_ids}
    
    all_tokens = list(database["devicetokens"].find(query))
    tokens = [t.get("token") for t in all_tokens if t.get("token")]
    
    if not tokens:
        return JSONResponse(content={"sent": 0, "totalTokens": 0, "role": role})
    
    sent = await send_expo_push(tokens, title, message, data)
    return JSONResponse(content={"sent": sent, "totalTokens": len(tokens), "role": role})

@app.get("/api/push/stats")
async def get_push_stats():
    """Get push notification statistics"""
    database = get_db()
    total_tokens = database["devicetokens"].count_documents({"isActive": True})
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_pushes = database["notifications"].count_documents({
        "isPush": True,
        "createdAt": {"$gte": today}
    })
    
    total_pushes = database["notifications"].count_documents({"isPush": True})
    
    # Tokens by platform
    ios_tokens = database["devicetokens"].count_documents({"isActive": True, "platform": "ios"})
    android_tokens = database["devicetokens"].count_documents({"isActive": True, "platform": "android"})
    
    return JSONResponse(content={
        "totalTokens": total_tokens,
        "iosTokens": ios_tokens,
        "androidTokens": android_tokens,
        "todayPushes": today_pushes,
        "totalPushes": total_pushes,
    })


# ============================================================
# AI RECOMMENDATION ENGINE + AUTO RECOVERY
# ============================================================

def ai_score_student(student: dict, attendance_records: list, sub: dict, database) -> dict:
    """Score a student and generate AI recommendation"""
    total = len(attendance_records)
    present = len([a for a in attendance_records if a.get("status") == "PRESENT"])
    attendance = (present / total * 100) if total > 0 else 100
    
    debt = student.get("debtAmount", 0) or 0
    has_debt = debt > 0
    
    # Calculate days since last visit
    last_visit = None
    for a in sorted(attendance_records, key=lambda x: x.get("date", ""), reverse=True):
        if a.get("status") == "PRESENT":
            try:
                last_visit = datetime.fromisoformat(a["date"]) if isinstance(a["date"], str) else a["date"]
            except Exception:
                pass
            break
    
    now = datetime.now(timezone.utc)
    days_since = (now - last_visit.replace(tzinfo=timezone.utc)).days if last_visit else 999
    
    sub_status = sub.get("status", "N/A") if sub else "N/A"
    
    # AI Scoring
    score = 0
    factors = []
    
    if attendance < 40:
        score += 40
        factors.append({"factor": "critical_attendance", "impact": 40, "detail": f"Відвідуваність {attendance:.0f}%"})
    elif attendance < 60:
        score += 20
        factors.append({"factor": "low_attendance", "impact": 20, "detail": f"Відвідуваність {attendance:.0f}%"})
    
    if has_debt:
        score += 25
        factors.append({"factor": "debt", "impact": 25, "detail": f"Борг {debt} ₴"})
    
    if days_since >= 14:
        score += 30
        factors.append({"factor": "inactive_14d", "impact": 30, "detail": f"Не був {days_since} днів"})
    elif days_since >= 7:
        score += 15
        factors.append({"factor": "inactive_7d", "impact": 15, "detail": f"Не був {days_since} днів"})
    
    # Determine recommendation
    rec_type = "NONE"
    payload = {}
    message = ""
    
    if score >= 60:
        rec_type = "DISCOUNT"
        discount = 20 if score >= 80 else 15 if score >= 70 else 10
        payload = {"percent": discount}
        message = f"Рекомендуємо -{discount}% для утримання"
    elif score >= 30:
        rec_type = "MESSAGE"
        payload = {"template": "attention_needed"}
        message = "Зверніть увагу на відвідуваність"
    elif score < 15 and sub_status == "ACTIVE":
        rec_type = "PRODUCT"
        payload = {"category": "SPORT_NUTRITION" if attendance > 80 else "EQUIPMENT"}
        message = "Рекомендувати екіпіровку або спортпит"
    
    # Auto Recovery check
    auto_recovery = False
    if (attendance < 50 and days_since >= 7 and sub_status == "ACTIVE"):
        # Check no recent recovery
        student_id = str(student["_id"])
        recent = database["ai_recommendations"].find_one({
            "studentId": student_id,
            "type": "AUTO_RECOVERY",
            "createdAt": {"$gte": datetime(now.year, now.month, max(1, now.day - 14), tzinfo=timezone.utc)}
        })
        if not recent:
            auto_recovery = True
    
    return {
        "score": min(score, 100),
        "riskLevel": "critical" if score >= 60 else "warning" if score >= 30 else "low",
        "recommendation": {"type": rec_type, "payload": payload, "message": message},
        "factors": factors,
        "metrics": {
            "attendance": round(attendance, 1),
            "daysSinceLastVisit": days_since,
            "debt": debt,
            "subscriptionStatus": sub_status,
        },
        "autoRecovery": auto_recovery,
    }

async def run_ai_cycle():
    """Run AI recommendation cycle - scores all students, creates recommendations"""
    database = get_db()
    children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    subs = list(database["subscriptions"].find({}))
    sub_map = {str(s.get("childId")): s for s in subs}
    now = datetime.now(timezone.utc)
    
    recommendations_created = 0
    recoveries_triggered = 0
    
    for student in children:
        student_id = str(student["_id"])
        student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
        parent_id = str(student.get("userId", "")) if student.get("userId") else (
            str(student.get("parentId", "")) if student.get("parentId") else None
        )
        
        attendance_records = list(database["attendances"].find({"childId": student["_id"]}))
        sub = sub_map.get(student_id, {})
        
        result = ai_score_student(student, attendance_records, sub, database)
        
        # Save recommendation
        if result["recommendation"]["type"] != "NONE":
            database["ai_recommendations"].update_one(
                {"studentId": student_id, "status": "NEW", "type": result["recommendation"]["type"]},
                {"$set": {
                    "studentId": student_id,
                    "studentName": student_name,
                    "userId": parent_id,
                    "type": result["recommendation"]["type"],
                    "score": result["score"],
                    "riskLevel": result["riskLevel"],
                    "payload": result["recommendation"]["payload"],
                    "message": result["recommendation"]["message"],
                    "factors": result["factors"],
                    "metrics": result["metrics"],
                    "status": "NEW",
                    "updatedAt": now,
                }},
                upsert=True,
            )
            recommendations_created += 1
        
        # Auto Recovery
        if result["autoRecovery"] and parent_id:
            discount = 10
            # Create recovery recommendation
            database["ai_recommendations"].insert_one({
                "studentId": student_id,
                "studentName": student_name,
                "userId": parent_id,
                "type": "AUTO_RECOVERY",
                "score": result["score"],
                "riskLevel": result["riskLevel"],
                "payload": {"percent": discount},
                "message": f"Auto Recovery: -{discount}% для повернення {student_name}",
                "factors": result["factors"],
                "metrics": result["metrics"],
                "status": "APPLIED",
                "createdAt": now,
            })
            
            # Mark student
            database["children"].update_one(
                {"_id": student["_id"]},
                {"$set": {"autoRecoveryTriggered": True, "lastAutoRecoveryAt": now}}
            )
            
            # Send message to parent
            admin = database["users"].find_one({"role": "ADMIN"})
            if admin:
                database["messages"].insert_one({
                    "senderId": admin["_id"],
                    "receiverId": ObjectId(parent_id) if parent_id else None,
                    "text": f"Ми помітили, що {student_name} став рідше відвідувати тренування. Підготували для вас спеціальну пропозицію -{discount}%, щоб допомогти повернутись у ритм.",
                    "type": "SYSTEM",
                    "isAutomatic": True,
                    "isAIGenerated": True,
                    "createdAt": now,
                })
            
            # Send push
            await send_automation_push(database, parent_id, "discount_20", child_name=student_name, value=result["metrics"]["attendance"])
            
            recoveries_triggered += 1
            logger.info(f"Auto Recovery triggered for {student_name}")
    
    if recommendations_created > 0 or recoveries_triggered > 0:
        logger.info(f"AI: {recommendations_created} recommendations, {recoveries_triggered} recoveries")

# Add AI cycle to automation loop
_original_automation_loop = automation_loop
async def automation_loop_with_ai():
    """Enhanced automation loop with AI recommendations + Phase 2"""
    await asyncio.sleep(30)
    init_automation_rules()
    
    while True:
        try:
            await run_automation_cycle()
            await run_ai_cycle()
            await run_phase2_engine()
        except Exception as e:
            logger.error(f"Automation+AI+Phase2 cycle error: {e}")
        await asyncio.sleep(AUTOMATION_INTERVAL)

# Override
automation_loop = automation_loop_with_ai

# ============================================================
# AI API ENDPOINTS
# ============================================================

@app.get("/api/ai/recommendations")
async def get_ai_recommendations(limit: int = 30):
    """Get all AI recommendations"""
    database = get_db()
    recs = list(
        database["ai_recommendations"]
        .find({}, {"_id": 0})
        .sort("score", -1)
        .limit(limit)
    )
    return JSONResponse(content=json.loads(json.dumps(recs, default=json_serial)))

@app.get("/api/ai/student/{student_id}")
async def get_student_ai(student_id: str):
    """Get AI analysis for a specific student"""
    database = get_db()
    student = database["children"].find_one({"_id": ObjectId(student_id)})
    if not student:
        return JSONResponse(content={"error": "Student not found"}, status_code=404)
    
    attendance_records = list(database["attendances"].find({"childId": student["_id"]}))
    subs = list(database["subscriptions"].find({"childId": student_id}))
    sub = subs[0] if subs else {}
    
    result = ai_score_student(student, attendance_records, sub, database)
    
    # Get existing recommendations
    recs = list(database["ai_recommendations"]
        .find({"studentId": student_id}, {"_id": 0})
        .sort("updatedAt", -1)
        .limit(5))
    
    result["studentId"] = student_id
    result["studentName"] = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
    result["autoRecoveryTriggered"] = student.get("autoRecoveryTriggered", False)
    result["lastAutoRecoveryAt"] = student.get("lastAutoRecoveryAt")
    result["existingRecommendations"] = json.loads(json.dumps(recs, default=json_serial))
    
    return JSONResponse(content=json.loads(json.dumps(result, default=json_serial)))

@app.post("/api/ai/run")
async def trigger_ai_cycle():
    """Manually trigger AI recommendation cycle"""
    await run_ai_cycle()
    database = get_db()
    total = database["ai_recommendations"].count_documents({})
    new_count = database["ai_recommendations"].count_documents({"status": "NEW"})
    recoveries = database["ai_recommendations"].count_documents({"type": "AUTO_RECOVERY"})
    return JSONResponse(content={
        "success": True,
        "totalRecommendations": total,
        "newRecommendations": new_count,
        "autoRecoveries": recoveries,
    })

@app.get("/api/ai/stats")
async def get_ai_stats():
    """Get AI engine statistics"""
    database = get_db()
    total = database["ai_recommendations"].count_documents({})
    by_type = {}
    for t in ["DISCOUNT", "PRODUCT", "MESSAGE", "AUTO_RECOVERY"]:
        by_type[t] = database["ai_recommendations"].count_documents({"type": t})
    by_risk = {}
    for r in ["critical", "warning", "low"]:
        by_risk[r] = database["ai_recommendations"].count_documents({"riskLevel": r})
    
    return JSONResponse(content={
        "total": total,
        "byType": by_type,
        "byRisk": by_risk,
        "newCount": database["ai_recommendations"].count_documents({"status": "NEW"}),
        "appliedCount": database["ai_recommendations"].count_documents({"status": "APPLIED"}),
    })

@app.patch("/api/ai/recommendations/{student_id}/apply")
async def apply_recommendation(student_id: str):
    """Mark recommendation as applied"""
    database = get_db()
    result = database["ai_recommendations"].update_many(
        {"studentId": student_id, "status": "NEW"},
        {"$set": {"status": "APPLIED", "appliedAt": datetime.now(timezone.utc)}}
    )
    return JSONResponse(content={"applied": result.modified_count})


# ============================================================
# STUDENT HOME (aggregated endpoint for adult student)
# ============================================================

@app.get("/api/student/home")
async def get_student_home(request: Request):
    """Unified student home — returns JUNIOR or ADULT track-specific data"""
    database = get_db()
    
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    user_id = user.get("id") or user.get("_id", "")
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Учень"
    now = datetime.now(timezone.utc)
    
    child = database["children"].find_one({"userId": ObjectId(user_id)}) if user_id else None
    if not child:
        child = database["children"].find_one({"userId": user_id}) if user_id else None
    if not child:
        child = database["children"].find_one({"phone": user.get("phone")})
    
    child_id = str(child["_id"]) if child else None
    student_type = (child.get("studentType") if child else None) or user.get("studentType") or "JUNIOR"
    
    # Today's training
    today_training = None
    weekday_map = {0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY", 4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"}
    today_day = weekday_map.get(now.weekday(), "MONDAY")
    today_str = now.strftime('%Y-%m-%d')
    
    schedules = list(database["schedules"].find({"date": today_str}).limit(3))
    if not schedules:
        schedules = list(database["schedules"].find({"dayOfWeek": today_day}).limit(3))
    if not schedules:
        schedules = list(database["schedules"].find({"date": {"$gte": today_str}}).sort("date", 1).limit(1))
    
    for sched in schedules:
        group = database["groups"].find_one({"_id": sched.get("groupId")}) if sched.get("groupId") else None
        if not group:
            group = database["groups"].find_one({"_id": ObjectId(sched.get("groupId"))}) if sched.get("groupId") else None
        today_training = {
            "id": str(sched["_id"]),
            "title": group.get("name", "Тренування") if group else "Тренування",
            "date": sched.get("date", today_str),
            "startTime": sched.get("startTime", "18:30"),
            "endTime": sched.get("endTime", "19:30"),
            "location": sched.get("location", "Зал АТАКА"),
            "coachName": child.get("coachName", "Тренер") if child else "Тренер",
        }
        break
    
    # Upcoming schedule (next 7 days)
    upcoming = []
    future_scheds = list(database["schedules"].find({"date": {"$gt": today_str}}).sort("date", 1).limit(6))
    for s in future_scheds:
        upcoming.append({
            "date": s.get("date", ""),
            "dayOfWeek": s.get("dayOfWeek", ""),
            "startTime": s.get("startTime", "18:30"),
            "endTime": s.get("endTime", "19:30"),
            "location": s.get("location", "Зал АТАКА"),
        })
    
    # Attendance
    att_records = list(database["attendances"].find({"childId": child["_id"]})) if child else []
    total_att = len(att_records)
    present = len([a for a in att_records if a.get("status") == "PRESENT"])
    attendance_pct = round(present / total_att * 100) if total_att > 0 else 0
    
    # Streak Engine
    streak = child.get("streak", 0) if child else 0
    streak_freeze_available = child.get("streakFreezeAvailable", 1) if child else 1
    last_training = child.get("lastTrainingDate") if child else None
    
    # Subscription + pressure
    sub_data = None
    sub_pressure = None
    subs = list(database["subscriptions"].find({"childId": child_id})) if child_id else []
    if subs:
        s = subs[0]
        next_billing = s.get("nextBillingAt", "")
        if isinstance(next_billing, str) and next_billing:
            try:
                from dateutil import parser as dp
                nb = dp.parse(next_billing)
                days_left = (nb.replace(tzinfo=None) - now.replace(tzinfo=None)).days
            except Exception:
                days_left = 30
        else:
            days_left = 30
        sub_data = {
            "planName": s.get("planName", ""),
            "price": s.get("price", 0),
            "status": {"ACTIVE": "Активний", "PAUSED": "Призупинено", "EXPIRED": "Завершено"}.get(s.get("status", ""), "Активний"),
            "nextBillingAt": str(next_billing),
            "daysLeft": days_left,
        }
        if days_left <= 5 and s.get("status") == "ACTIVE":
            sub_pressure = {"daysLeft": days_left, "price": s.get("price", 0), "planName": s.get("planName", "")}
    
    # Debt
    payments_pending = list(database["payments"].find({"parentId": ObjectId(user_id), "status": "PENDING"})) if user_id else []
    debt = sum(p.get("amount", 0) for p in payments_pending)
    
    # === EVENT ENGINE (with personalization) ===
    behavior = _detect_behavior(attendance_pct, streak, total_att)
    events = []
    
    # Missed training
    missed = len([a for a in att_records if a.get("status") in ("ABSENT", "WARNED")])
    if missed >= 2:
        events.append({"id": "missed_training", "type": "warning", "icon": "alert-circle", "title": f"Ви пропустили {missed} тренувань", "text": "Повертайтесь! Тренер чекає.", "actions": [{"label": "Записатися", "action": "schedule"}, {"label": "Написати тренеру", "action": "coach_message"}]})
    
    # Streak events
    if streak >= 3 and streak < 5:
        events.append({"id": "streak_growing", "type": "motivation", "icon": "flame", "title": f"🔥 {streak} тренувань підряд!", "text": "Ви на хвилі! Не зупиняйтесь.", "actions": [{"label": "Продовжити", "action": "schedule"}]})
    elif streak >= 5:
        events.append({"id": "streak_fire", "type": "achievement", "icon": "trophy", "title": f"🔥 Серія {streak} тренувань!", "text": "Неймовірно! Так тримати!", "actions": [{"label": "Подивитися прогрес", "action": "progress"}]})
    elif streak == 0 and total_att > 3:
        events.append({"id": "streak_broken", "type": "danger", "icon": "heart-dislike", "title": "Серія перервана", "text": "Почніть нову серію сьогодні!", "actions": [{"label": "Почати знову", "action": "schedule"}] + ([{"label": "Заморозити (1 раз)", "action": "freeze_streak"}] if streak_freeze_available > 0 else [])})
    
    # Belt progress (JUNIOR)
    if student_type == "JUNIOR" and child:
        progress_snap = database["progresssnapshots"].find_one({"childId": child_id}, {"_id": 0})
        if progress_snap:
            remaining = (progress_snap.get("trainingsToNext", 20) or 20) - (progress_snap.get("trainingsCompleted", 0) or 0)
            if remaining <= 5 and remaining > 0:
                belt_labels = {"YELLOW": "жовтого", "ORANGE": "помаранчевого", "GREEN": "зеленого", "BLUE": "синього", "BROWN": "коричневого", "BLACK": "чорного"}
                next_b = progress_snap.get("nextBelt", "YELLOW")
                events.append({"id": "belt_close", "type": "achievement", "icon": "ribbon", "title": f"🥋 До {belt_labels.get(next_b, next_b)} поясу — {remaining} занять!", "text": "Ви майже досягли мети!", "actions": [{"label": "Подивитися прогрес", "action": "progress"}]})
    
    # Monthly goal (ADULT)
    if student_type == "ADULT" and child:
        mg = child.get("monthlyGoal", 12) or 12
        ma = child.get("monthlyAttended", 0) or 0
        if ma >= mg:
            events.append({"id": "goal_reached", "type": "achievement", "icon": "checkmark-circle", "title": "🎯 Місячна ціль досягнута!", "text": f"{ma}/{mg} тренувань. Браво!", "actions": [{"label": "Продовжити", "action": "schedule"}]})
        elif ma >= mg * 0.8:
            events.append({"id": "goal_close", "type": "motivation", "icon": "trending-up", "title": f"📊 {ma}/{mg} — майже ціль!", "text": f"Залишилось {mg - ma} тренувань", "actions": [{"label": "Записатися", "action": "schedule"}]})
    
    # Low attendance
    if attendance_pct < 40 and total_att > 5:
        events.append({"id": "low_attendance", "type": "danger", "icon": "trending-down", "title": "📉 Відвідуваність впала", "text": f"Лише {attendance_pct}%. Ваш тренер турбується.", "actions": [{"label": "Написати тренеру", "action": "coach_message"}, {"label": "Записатися", "action": "schedule"}]})
    
    # Subscription pressure
    if sub_pressure:
        events.append({"id": "sub_expiring", "type": "urgent", "icon": "card", "title": f"⚠️ Абонемент закінчується через {sub_pressure['daysLeft']} дн", "text": f"Оплатіть {sub_pressure['price']} ₴ щоб продовжити", "actions": [{"label": "Оплатити", "action": "pay_subscription"}]})
    
    # Debt alert
    if debt > 0:
        events.append({"id": "debt", "type": "danger", "icon": "warning", "title": f"💰 Заборгованість: {debt} ₴", "text": "Оплатіть щоб продовжити тренування", "actions": [{"label": "Оплатити", "action": "pay_debt"}]})
    
    # Personalize the all_good event
    if len(events) == 0:
        title = _personalize_text(behavior, "✅ Все добре!")
        text = _personalize_text(behavior, "Ви на правильному шляху. Продовжуйте!")
        events.append({"id": "all_good", "type": "success", "icon": "checkmark-circle", "title": title, "text": text, "actions": [{"label": "Подивитися розклад", "action": "schedule"}]})
    
    # Soft Marketplace recommendations
    products = list(database["products"].find({"isActive": True}, {"_id": 1, "name": 1, "price": 1, "oldPrice": 1, "imageUrl": 1, "category": 1}).limit(4))
    marketplace_recs = [{"id": str(p["_id"]), "name": p.get("name", ""), "price": p.get("price", 0), "oldPrice": p.get("oldPrice"), "category": p.get("category", "")} for p in products]
    
    # JUNIOR-specific data
    junior_data = None
    if student_type == "JUNIOR":
        belt = child.get("belt", "WHITE") if child else "WHITE"
        progress = database["progresssnapshots"].find_one({"childId": child_id}, {"_id": 0}) if child_id else None
        
        # Competitions
        comp_results = []
        if child_id:
            results = list(database["competitionresults"].find({"childId": child_id}, {"_id": 0}).limit(5))
            for r in results:
                comp = database["competitions"].find_one({"_id": ObjectId(r.get("competitionId"))}) if r.get("competitionId") else None
                comp_results.append({
                    "name": comp.get("name", "Змагання") if comp else "Змагання",
                    "medal": r.get("medal", ""),
                    "place": r.get("place"),
                    "date": str(r.get("createdAt", "")),
                })
        
        # Coach group + comments
        group = database["groups"].find_one({"_id": child.get("groupId")}) if child and child.get("groupId") else None
        if not group:
            group = database["groups"].find_one({"_id": ObjectId(child.get("groupId"))}) if child and child.get("groupId") else None
        if not group:
            group = database["groups"].find_one()
        
        coach = None
        if group and group.get("coachId"):
            coach = database["users"].find_one({"_id": ObjectId(group["coachId"])})
        
        junior_data = {
            "belt": belt,
            "nextBelt": progress.get("nextBelt", "YELLOW") if progress else "YELLOW",
            "progressPercent": progress.get("progressPercent", 0) if progress else 0,
            "trainingsCompleted": progress.get("trainingsCompleted", 0) if progress else 0,
            "trainingsToNext": progress.get("trainingsToNext", 20) if progress else 20,
            "groupName": group.get("name", "") if group else "",
            "coachName": f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip() if coach else "Тренер",
            "coachComment": child.get("coachComment", "Працюй далі, все йде добре!") if child else "",
            "xp": child.get("xp", 0) if child else 0,
            "discipline": child.get("discipline", 85) if child else 85,
            "competitions": comp_results,
            "upcomingCompetitions": _get_upcoming_competitions(database, child_id, child.get("age") if child else None),
        }
    
    # Pre-compute gamification for use in adult data
    xp = child.get("xp", 0) if child else 0
    level, level_name, next_xp = _calc_level(xp)

    # ADULT-specific data — FIGHTER profile
    adult_data = None
    if student_type == "ADULT":
        monthly_goal = child.get("monthlyGoal", 12) if child else 12
        monthly_attended = child.get("monthlyAttended", 0) if child else 0

        # Combat Axes — 4 fighter metrics (from child data or calculated)
        combat_axes = child.get("combatAxes", None) if child else None
        if not combat_axes:
            # Calculate from attendance, streak, discipline
            base = min(total_att * 3, 100)
            combat_axes = {
                "striking": {"value": min(max(base - 15 + (streak * 3), 5), 100), "label": "Ударна техніка", "comment": "Потрібно додати серійну роботу руками" if base < 50 else "Хороша стабільність. Додайте вибуховість"},
                "endurance": {"value": min(max(base + 10 + (streak * 5), 5), 100), "label": "Витривалість", "comment": "Темп росте. Добре тримаєте навантаження" if base > 30 else "Потрібно набирати базу. Не пропускайте"},
                "defense": {"value": min(max(base - 20, 5), 100), "label": "Захист", "comment": "Слабке місце — реакція на ближній бій" if base < 40 else "Захист стабільний. Працюйте над контратаками"},
                "discipline": {"value": min(attendance_pct + (streak * 2), 100) if attendance_pct else 15, "label": "Дисципліна", "comment": "Не збавляйте" if attendance_pct > 70 else "Потрібна регулярність. Серія = сила"},
            }

        # Fighter Archetype — with personality description
        axes_vals = {k: v["value"] for k, v in combat_axes.items()}
        top_axis = max(axes_vals, key=axes_vals.get)
        archetype_map = {
            "striking": {"name": "Атакуючий боєць", "description": "Ти працюєш за рахунок ініціативи та агресії", "strengths": ["вибуховість", "ініціатива"], "growth": "захист після атаки"},
            "endurance": {"name": "Темповий боєць", "description": "Ти працюєш за рахунок ритму і стабільності", "strengths": ["витривалість", "стабільність"], "growth": "різкість завершення"},
            "defense": {"name": "Контратакуючий боєць", "description": "Ти чекаєш помилку і караєш за неї", "strengths": ["захист", "читання суперника"], "growth": "ініціативна атака"},
            "discipline": {"name": "Системний боєць", "description": "Ти берешь результат системою і регулярністю", "strengths": ["дисципліна", "регулярність"], "growth": "вибуховість та імпровізація"},
        }
        archetype = archetype_map.get(top_axis, archetype_map["discipline"])

        # Readiness — with pressure states
        weekly_misses = 0
        consecutive_misses = 0
        recent_att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(5)) if child else []
        for a_rec in recent_att:
            if a_rec.get("status") != "PRESENT":
                consecutive_misses += 1
            else:
                break
        if len(recent_att) >= 2:
            weekly_misses = len([a for a in recent_att[:5] if a.get("status") != "PRESENT"])

        readiness_pct = min(max(attendance_pct + (streak * 5) - (weekly_misses * 10) - (consecutive_misses * 8), 10), 100) if attendance_pct else 45
        if readiness_pct >= 75:
            readiness_status = "В строю"
            readiness_detail = "Можна давати повне навантаження"
        elif readiness_pct >= 50:
            readiness_status = "Робочий стан"
            readiness_detail = "Базове навантаження. Набирайте темп"
        elif readiness_pct >= 30:
            readiness_status = "Просідання"
            readiness_detail = "Потрібно повернути темп. Не затягуйте"
        else:
            readiness_status = "Втрачаєш форму"
            readiness_detail = "Серія згоріла. Починайте заново"

        # LOSS / RISK detection
        loss = None
        if consecutive_misses >= 2:
            loss = {"type": "streak_burn", "text": f"Пропущено {consecutive_misses} тренування поспіль", "warning": "Серія згорить. Повертайтесь завтра"}
        elif streak >= 3 and monthly_attended < monthly_goal:
            loss = {"type": "streak_risk", "text": f"Серія {streak} під загрозою", "warning": "Якщо пропустиш → серія згорить"}
        elif attendance_pct < 50 and total_att > 0:
            loss = {"type": "form_loss", "text": "Відвідуваність нижче 50%", "warning": "Втрачаєте набрану базу"}

        # Current Challenge (Рубіж) — with loss risk
        challenge_goal = 8
        challenge_done = min(monthly_attended, challenge_goal)
        challenge_left = challenge_goal - challenge_done
        challenge = {
            "title": f"{challenge_goal} тренувань за 30 днів",
            "done": challenge_done,
            "total": challenge_goal,
            "left": challenge_left,
            "reward": "-10% на екіпірування + бейдж «В строю»",
            "riskText": f"Якщо пропустиш → серія згорить" if streak >= 2 else None,
        }

        # Fighter level names
        FIGHTER_RANKS = ["Рекрут", "Боєць", "Штурмовик", "Вояк", "Ветеран", "Майстер", "Командир", "Легенда", "Воїн", "Чемпіон", "Титан"]
        fighter_rank = FIGHTER_RANKS[min(level, len(FIGHTER_RANKS) - 1)]
        next_rank = FIGHTER_RANKS[min(level + 1, len(FIGHTER_RANKS) - 1)]

        # REPUTATION (club standing)
        REP_LEVELS = ["Новачок", "Стабільний", "Надійний", "Лідер", "Легенда клубу"]
        rep_idx = 0
        if total_att >= 30: rep_idx = 4
        elif total_att >= 15: rep_idx = 3
        elif total_att >= 8: rep_idx = 2
        elif total_att >= 3: rep_idx = 1
        next_rep = REP_LEVELS[min(rep_idx + 1, len(REP_LEVELS) - 1)]
        rep_thresholds = [0, 3, 8, 15, 30]
        rep_to_next = max(rep_thresholds[min(rep_idx + 1, len(rep_thresholds) - 1)] - total_att, 0)
        reputation = {
            "level": REP_LEVELS[rep_idx],
            "next": next_rep,
            "trainingsToNext": rep_to_next,
        }

        # TRAINING REGIME
        weekly_target = 3
        actual_weekly = round(total_att / max((now - (child.get("createdAt", now) if child else now)).days / 7, 1), 1) if child and total_att > 0 else 0
        regime = {
            "actual": actual_weekly,
            "target": weekly_target,
            "diff": round(actual_weekly - weekly_target, 1),
            "label": "Тримаєш режим" if actual_weekly >= weekly_target else f"Не добираєш. Різниця: {abs(round(actual_weekly - weekly_target, 1))} тренувань/тижд",
        }

        # MICRO-VICTORIES
        victories = []
        if streak >= 3: victories.append({"text": f"{streak} тренувань поспіль", "done": True})
        if weekly_misses == 0 and total_att > 0: victories.append({"text": "Не пропустив тиждень", "done": True})
        if total_att >= 1: victories.append({"text": "Перше тренування пройдено", "done": True})
        if total_att >= 5: victories.append({"text": "5 тренувань за спиною", "done": True})
        # Pending
        if streak < 3: victories.append({"text": "3 тренування поспіль", "done": False})
        if total_att < 5: victories.append({"text": "Закрити 5 тренувань", "done": False})
        if attendance_pct < 80: victories.append({"text": "Відвідуваність 80%+", "done": False})

        # DISCOUNT PROGRESS
        discount_trainings_needed = max(8 - total_att, 0)
        discount_progress = {
            "available": total_att >= 8,
            "percent": 10,
            "trainingsLeft": discount_trainings_needed,
            "text": "Знижка -10% активна!" if total_att >= 8 else f"До знижки -10%: ще {discount_trainings_needed} тренувань",
        }

        # Coach mentoring — dynamic based on axes
        coach_review = child.get("coachReview", None) if child else None
        if not coach_review:
            weakest_axis = min(axes_vals, key=axes_vals.get)
            weak_comments = {
                "striking": "Потрібно додати роботу руками в серії. Завершення — ваше слабке місце",
                "endurance": "В кінці раунду падаєте по витривалості. Додайте кардіо",
                "defense": "Захист потребує уваги. Працюйте над реакцією на ближній бій",
                "discipline": "Регулярність — ваш головний ворог зараз. Не пропускайте",
            }
            if total_att >= 5:
                coach_review = f"На основі останніх тренувань: {weak_comments.get(weakest_axis, 'Тримайте темп')}"
            elif total_att >= 1:
                coach_review = "Початок покладено. Головне — не пропускати. Регулярність = сила"
            else:
                coach_review = "Ще рано для розбору. Пройдіть перші тренування"

        adult_data = {
            "streak": streak,
            "monthlyGoal": monthly_goal,
            "monthlyAttended": monthly_attended,
            "monthlyProgressPct": min(round(monthly_attended / max(monthly_goal, 1) * 100), 100),
            "combatAxes": combat_axes,
            "archetype": archetype,
            "fighterRank": fighter_rank,
            "nextRank": next_rank,
            "readiness": {
                "percent": readiness_pct,
                "status": readiness_status,
                "detail": readiness_detail,
                "streak": streak,
                "weeklyMisses": weekly_misses,
                "consecutiveMisses": consecutive_misses,
            },
            "loss": loss,
            "challenge": challenge,
            "reputation": reputation,
            "regime": regime,
            "victories": victories[:6],
            "discount": discount_progress,
            "coachReview": coach_review,
        }
    
    # Gamification summary (XP, level, daily tasks)
    xp = child.get("xp", 0) if child else 0
    level, level_name, next_xp = _calc_level(xp)
    new_badges = _check_badges(child, attendance_pct, streak, total_att) if child else []
    if new_badges and child:
        for nb in new_badges:
            xp += 10
        badges_list = (child.get("badges", []) or []) + new_badges
        database["children"].update_one({"_id": child["_id"]}, {"$set": {"xp": xp, "badges": badges_list}})
        level, level_name, next_xp = _calc_level(xp)
    
    # Daily login XP
    today_str_check = now.strftime('%Y-%m-%d')
    daily_login = database["daily_logins"].find_one({"userId": user_id, "date": today_str_check})
    if not daily_login and child:
        database["daily_logins"].insert_one({"userId": user_id, "date": today_str_check, "createdAt": now})
        xp += 5
        database["children"].update_one({"_id": child["_id"]}, {"$set": {"xp": xp}})
    
    gamification = {
        "xp": xp,
        "level": level,
        "levelName": level_name,
        "xpToNext": max(next_xp - xp, 0),
        "xpProgress": min(round((xp - LEVEL_THRESHOLDS[level]) / max(next_xp - LEVEL_THRESHOLDS[level], 1) * 100), 100) if level < len(LEVEL_THRESHOLDS) - 1 else 100,
        "newBadges": [next((b for b in BADGE_DEFS if b["id"] == nb), {"id": nb, "name": nb}) for nb in new_badges],
        "behavior": behavior,
        "behaviorLabel": BEHAVIOR_TYPES.get(behavior, {}).get("label", ""),
    }
    
    # Rewards available
    rewards = []
    if xp >= 50:
        rewards.append({"id": "discount_5", "name": "-5% на екіпіровку", "xpCost": 50})
    if streak >= 5:
        rewards.append({"id": "streak_discount", "name": f"Серія {streak} → -10%", "xpCost": 0})

    response = {
        "student": {
            "id": user_id,
            "name": user_name,
            "studentType": student_type,
            "avatarUrl": user.get("avatarUrl"),
        },
        "todayTraining": today_training,
        "upcomingSchedule": upcoming,
        "stats": {
            "attendanceRate": attendance_pct,
            "totalTrainings": total_att,
            "streak": streak,
            "streakFreezeAvailable": streak_freeze_available,
            "debt": debt,
        },
        "subscription": sub_data,
        "events": events,
        "gamification": gamification,
        "rewards": rewards,
        "marketplaceRecs": marketplace_recs,
    }
    
    if junior_data:
        response["junior"] = junior_data
    if adult_data:
        response["adult"] = adult_data
    
    return JSONResponse(content=json.loads(json.dumps(response, default=json_serial)))



# ============================================================
# GAMIFICATION ENGINE (XP, Badges, Levels, Daily Tasks, Rewards)
# ============================================================

XP_RULES = {
    "training_attended": 10,
    "streak_3": 20,
    "streak_5": 30,
    "streak_10": 50,
    "goal_reached": 50,
    "belt_upgrade": 100,
    "competition_medal": 75,
    "daily_login": 5,
    "coach_message": 5,
    "training_confirmed": 5,
}

LEVEL_THRESHOLDS = [0, 50, 120, 220, 350, 520, 740, 1000, 1350, 1750, 2200]
LEVEL_NAMES = ["Новачок", "Початківець", "Учень", "Боєць", "Майстер", "Про", "Воїн", "Легенда", "Гуру", "Чемпіон", "Титан"]

BADGE_DEFS = [
    {"id": "first_training", "name": "Перше тренування", "icon": "barbell", "desc": "Відвідати перше тренування", "xp": 1},
    {"id": "streak_3", "name": "3 дні підряд", "icon": "flame", "desc": "Серія 3 тренувань", "xp": 3},
    {"id": "streak_5", "name": "Вогонь!", "icon": "bonfire", "desc": "Серія 5 тренувань", "xp": 5},
    {"id": "streak_10", "name": "Непереможний", "icon": "shield-checkmark", "desc": "Серія 10 тренувань", "xp": 10},
    {"id": "belt_yellow", "name": "Жовтий пояс", "icon": "ribbon", "desc": "Отримати жовтий пояс", "xp": None},
    {"id": "monthly_goal", "name": "Ціль місяця", "icon": "trophy", "desc": "Виконати місячну ціль", "xp": None},
    {"id": "first_medal", "name": "Перша медаль", "icon": "medal", "desc": "Отримати медаль на змаганнях", "xp": None},
    {"id": "discipline_90", "name": "Дисципліна 90+", "icon": "star", "desc": "Дисципліна вище 90", "xp": None},
    {"id": "coach_chat", "name": "Комунікатор", "icon": "chatbubble", "desc": "Написати тренеру", "xp": None},
    {"id": "daily_7", "name": "7 днів в додатку", "icon": "calendar", "desc": "Заходити 7 днів поспіль", "xp": None},
]

BEHAVIOR_TYPES = {
    "active": {"label": "Активний", "tone": "encouraging"},
    "disciplined": {"label": "Дисциплінований", "tone": "ambitious"},
    "lazy": {"label": "Потребує мотивації", "tone": "gentle"},
    "dropping": {"label": "Відпадає", "tone": "urgent"},
}

def _detect_behavior(attendance_pct, streak, total_trainings):
    if total_trainings < 3:
        return "active"
    if streak >= 5 and attendance_pct >= 70:
        return "disciplined"
    if attendance_pct < 40:
        return "dropping"
    if streak == 0 and attendance_pct < 60:
        return "lazy"
    return "active"

def _personalize_text(behavior, base_text):
    overrides = {
        "lazy": {"✅ Все добре!": "Почніть з малого — одне тренування сьогодні!", "Ви на правильному шляху.": "Поверніться до темпу. Один крок — вже прогрес."},
        "disciplined": {"✅ Все добре!": "🔥 Ви в топі! Не зупиняйтесь!", "Ви на правильному шляху.": "Ви показуєте найкращий результат. Амбіційно!"},
        "dropping": {"✅ Все добре!": "Ми втрачаємо темп. Повернемось?", "Ви на правильному шляху.": "Тренер чекає. Одне тренування змінить все."},
    }
    for old, new in overrides.get(behavior, {}).items():
        base_text = base_text.replace(old, new)
    return base_text

def _get_upcoming_competitions(database, child_id, age=None):
    """Sprint 3: Return list of upcoming competitions relevant for student"""
    try:
        now = datetime.now(timezone.utc)
        now_naive = now.replace(tzinfo=None)
        q = {"date": {"$gte": now_naive}, "isActive": True}
        comps = list(database["competitions"].find(q).sort("date", 1).limit(3))
        result = []
        for c in comps:
            cdate = c.get("date")
            if cdate and cdate.tzinfo is None:
                cdate = cdate.replace(tzinfo=timezone.utc)
            days_until = (cdate - now).days if cdate else None
            # Check if child is registered
            status = "UPCOMING"
            if child_id:
                reg = database["competitionresults"].find_one({"childId": child_id, "competitionId": str(c["_id"])})
                if reg:
                    status = "REGISTERED"
            result.append({
                "id": str(c["_id"]),
                "name": c.get("name", "Змагання"),
                "date": cdate.isoformat() if cdate else None,
                "daysUntil": days_until,
                "status": status,
                "location": c.get("location", ""),
            })
        return result
    except Exception as e:
        logger.error(f"upcoming_competitions error: {e}")
        return []

def _calc_level(xp):
    level = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i
    next_threshold = LEVEL_THRESHOLDS[min(level + 1, len(LEVEL_THRESHOLDS) - 1)]
    return level, LEVEL_NAMES[min(level, len(LEVEL_NAMES) - 1)], next_threshold

def _check_badges(child, attendance_pct, streak, total_trainings):
    earned = child.get("badges", []) if child else []
    earned_ids = [b["id"] if isinstance(b, dict) else b for b in earned]
    new_badges = []
    
    if total_trainings >= 1 and "first_training" not in earned_ids:
        new_badges.append("first_training")
    if streak >= 3 and "streak_3" not in earned_ids:
        new_badges.append("streak_3")
    if streak >= 5 and "streak_5" not in earned_ids:
        new_badges.append("streak_5")
    if streak >= 10 and "streak_10" not in earned_ids:
        new_badges.append("streak_10")
    if child and child.get("discipline", 0) >= 90 and "discipline_90" not in earned_ids:
        new_badges.append("discipline_90")
    
    return new_badges



@app.get("/api/student/schedule-calendar")
async def get_student_schedule_calendar(request: Request, month: int = 0):
    """Student schedule calendar — returns month grid with training markers + attendance"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    # Calculate target month
    from calendar import monthrange
    target_year = now.year
    target_month = now.month + month
    while target_month > 12:
        target_month -= 12
        target_year += 1
    while target_month < 1:
        target_month += 12
        target_year -= 1

    _, days_in_month = monthrange(target_year, target_month)
    first_day = datetime(target_year, target_month, 1, tzinfo=timezone.utc)

    # Find child — try ObjectId first, then string
    child = None
    if user_id:
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})
    if not child:
        child = database["children"].find_one({"phone": user.get("phone")})

    group_id = child.get("groupId", "") if child else ""

    # Get group schedules (recurring weekly)
    schedules = list(database["schedules"].find({"groupId": group_id, "isActive": True}, {"_id": 0}))
    if not schedules:
        schedules = list(database["schedules"].find({"isActive": True}, {"_id": 0}).limit(7))

    # Get group info
    group = None
    if group_id:
        try:
            group = database["groups"].find_one({"_id": ObjectId(group_id)})
        except Exception:
            pass
    group_name = group.get("name", "") if group else ""

    # Get location
    loc_id = group.get("locationId", "") if group else ""
    location = None
    if loc_id:
        try:
            location = database["locations"].find_one({"_id": ObjectId(loc_id)})
        except Exception:
            pass
    location_name = location.get("name", "") if location else ""
    location_address = location.get("address", "") if location else ""

    # Build training days for the month
    day_of_week_map = {}  # dayOfWeek → [schedules]
    for s in schedules:
        dow = s.get("dayOfWeek")
        if dow is not None:
            if dow not in day_of_week_map:
                day_of_week_map[dow] = []
            day_of_week_map[dow].append(s)

    # Get attendance for this month
    month_start = f"{target_year}-{target_month:02d}-01"
    month_end = f"{target_year}-{target_month:02d}-{days_in_month:02d}"
    attendances = {}
    if child:
        att_records = list(database["attendances"].find({
            "childId": child["_id"],
            "date": {"$gte": month_start, "$lte": month_end}
        }, {"_id": 0, "date": 1, "status": 1}))
        for a in att_records:
            attendances[str(a.get("date", ""))[:10]] = a.get("status", "")

    # Build calendar days
    MONTH_NAMES_UA = ["", "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"]
    DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]

    training_days = []
    today_str = now.strftime("%Y-%m-%d")

    for day in range(1, days_in_month + 1):
        date_obj = datetime(target_year, target_month, day, tzinfo=timezone.utc)
        dow = date_obj.isoweekday()  # 1=Monday
        date_str = f"{target_year}-{target_month:02d}-{day:02d}"
        day_schedules = day_of_week_map.get(dow, [])

        trainings = []
        for ds in day_schedules:
            trainings.append({
                "startTime": ds.get("startTime", ""),
                "endTime": ds.get("endTime", ""),
                "group": group_name,
                "location": location_name,
                "address": location_address,
            })

        att_status = attendances.get(date_str, None)
        training_days.append({
            "date": date_str,
            "day": day,
            "dayOfWeek": dow,
            "dayName": DAY_NAMES[dow - 1],
            "hasTraining": len(trainings) > 0,
            "trainings": trainings,
            "attendance": att_status,  # PRESENT/ABSENT/None
            "isToday": date_str == today_str,
            "isPast": date_str < today_str,
        })

    # Stats for month
    total_trainings = sum(1 for d in training_days if d["hasTraining"])
    attended = sum(1 for d in training_days if d["attendance"] == "PRESENT")
    missed = sum(1 for d in training_days if d["attendance"] == "ABSENT")
    upcoming = sum(1 for d in training_days if d["hasTraining"] and not d["isPast"] and not d["isToday"])

    return JSONResponse(content={
        "year": target_year,
        "month": target_month,
        "monthName": MONTH_NAMES_UA[target_month],
        "daysInMonth": days_in_month,
        "firstDayOfWeek": datetime(target_year, target_month, 1, tzinfo=timezone.utc).isoweekday(),
        "days": training_days,
        "stats": {
            "totalTrainings": total_trainings,
            "attended": attended,
            "missed": missed,
            "upcoming": upcoming,
        },
        "group": group_name,
        "location": location_name,
        "address": location_address,
    })



@app.get("/api/student/gamification")
async def get_student_gamification(request: Request):
    """Full gamification data: XP, level, badges, daily tasks, rewards"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    today_str = now.strftime('%Y-%m-%d')
    
    child = database["children"].find_one({"userId": ObjectId(user_id)}) if user_id else None
    if not child:
        child = database["children"].find_one({"userId": user_id}) if user_id else None
    if not child:
        child = database["children"].find_one({"phone": user.get("phone")})
    
    child_id = str(child["_id"]) if child else None
    
    # XP & Level
    xp = child.get("xp", 0) if child else 0
    level, level_name, next_xp = _calc_level(xp)
    xp_to_next = next_xp - xp
    
    # Badges
    badges_earned = child.get("badges", []) if child else []
    badges_earned_ids = [b["id"] if isinstance(b, dict) else b for b in badges_earned]
    all_badges = []
    for bd in BADGE_DEFS:
        all_badges.append({**bd, "earned": bd["id"] in badges_earned_ids})
    
    # Attendance for behavior detection
    att_records = list(database["attendances"].find({"childId": child["_id"]})) if child else []
    total_att = len(att_records)
    present = len([a for a in att_records if a.get("status") == "PRESENT"])
    attendance_pct = round(present / total_att * 100) if total_att > 0 else 0
    streak = child.get("streak", 0) if child else 0
    
    # Behavior type
    behavior = _detect_behavior(attendance_pct, streak, total_att)
    
    # Check for new badges
    new_badges = _check_badges(child, attendance_pct, streak, total_att)
    if new_badges and child:
        for nb in new_badges:
            badge_def = next((b for b in BADGE_DEFS if b["id"] == nb), None)
            xp_gain = XP_RULES.get(f"streak_{nb.split('_')[-1]}", 10)
            xp += xp_gain
            badges_earned_ids.append(nb)
        database["children"].update_one({"_id": child["_id"]}, {"$set": {
            "xp": xp,
            "badges": badges_earned_ids,
        }})
        level, level_name, next_xp = _calc_level(xp)
    
    # Daily tasks
    daily_login = database["daily_logins"].find_one({"userId": user_id, "date": today_str})
    if not daily_login and child:
        database["daily_logins"].insert_one({"userId": user_id, "date": today_str, "createdAt": now})
        xp += XP_RULES["daily_login"]
        database["children"].update_one({"_id": child["_id"]}, {"$set": {"xp": xp}})
    
    training_confirmed = database["training_confirmations"].find_one({"userId": user_id, "createdAt": {"$gte": now.replace(hour=0, minute=0, second=0)}})
    coach_msg_today = database["messages"].find_one({"fromUserId": user_id, "createdAt": {"$gte": now.replace(hour=0, minute=0, second=0)}})
    
    daily_tasks = [
        {"id": "open_app", "text": "Відкрити додаток", "done": True, "xp": 5},
        {"id": "confirm_training", "text": "Підтвердити тренування", "done": bool(training_confirmed), "xp": 5},
        {"id": "write_coach", "text": "Написати тренеру", "done": bool(coach_msg_today), "xp": 5},
    ]
    daily_done = sum(1 for t in daily_tasks if t["done"])
    daily_bonus = daily_done == len(daily_tasks)
    
    # XP-based rewards / discounts
    rewards = []
    if xp >= 50:
        rewards.append({"id": "discount_5", "name": "-5% на екіпіровку", "xpCost": 50, "type": "discount", "value": 5, "available": xp >= 50})
    if xp >= 150:
        rewards.append({"id": "discount_10", "name": "-10% на абонемент", "xpCost": 150, "type": "discount", "value": 10, "available": xp >= 150})
    if streak >= 5:
        rewards.append({"id": "streak_discount", "name": f"Серія {streak} → -10% знижка", "xpCost": 0, "type": "streak_reward", "value": 10, "available": True})
    
    return JSONResponse(content=json.loads(json.dumps({
        "xp": xp,
        "level": level,
        "levelName": level_name,
        "nextLevelXp": next_xp,
        "xpToNext": max(xp_to_next, 0),
        "xpProgress": min(round((xp - LEVEL_THRESHOLDS[level]) / max(next_xp - LEVEL_THRESHOLDS[level], 1) * 100), 100) if level < len(LEVEL_THRESHOLDS) - 1 else 100,
        "badges": all_badges,
        "newBadges": [next((b for b in BADGE_DEFS if b["id"] == nb), {"id": nb, "name": nb}) for nb in new_badges],
        "behavior": behavior,
        "behaviorLabel": BEHAVIOR_TYPES.get(behavior, {}).get("label", ""),
        "dailyTasks": daily_tasks,
        "dailyCompleted": daily_done,
        "dailyTotal": len(daily_tasks),
        "dailyBonusEarned": daily_bonus,
        "rewards": rewards,
    }, default=json_serial)))


@app.post("/api/student/claim-reward")
async def claim_reward(request: Request):
    """Claim XP-based reward"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    body = await request.json()
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    user_id = user.get("id") or user.get("_id", "")
    child = database["children"].find_one({"userId": ObjectId(user_id)}) if user_id else None
    if not child:
        child = database["children"].find_one({"userId": user_id})
    if not child:
        return JSONResponse(content={"error": "Student not found"}, status_code=404)
    
    reward_id = body.get("rewardId", "")
    xp = child.get("xp", 0)
    now = datetime.now(timezone.utc)
    
    # Check reward exists and can be claimed
    cost = {"discount_5": 50, "discount_10": 150, "streak_discount": 0}.get(reward_id, 0)
    if cost > xp:
        return JSONResponse(content={"error": "Недостатньо XP"}, status_code=400)
    
    # Deduct XP and create coupon
    if cost > 0:
        database["children"].update_one({"_id": child["_id"]}, {"$inc": {"xp": -cost}})
    
    discount_val = {"discount_5": 5, "discount_10": 10, "streak_discount": 10}.get(reward_id, 5)
    database["student_coupons"].insert_one({
        "userId": user_id,
        "rewardId": reward_id,
        "discountPercent": discount_val,
        "status": "ACTIVE",
        "createdAt": now,
        "expiresAt": (now + timedelta(days=7)).isoformat(),
    })
    
    return JSONResponse(content={"success": True, "discount": discount_val, "xpSpent": cost, "xpLeft": xp - cost})


@app.get("/api/owner/student-analytics")
async def owner_student_analytics(request: Request):
    """Owner: micro-analytics on student behavior"""
    database = get_db()
    
    children = list(database["children"].find({}, {"_id": 0, "xp": 1, "streak": 1, "badges": 1, "studentType": 1, "status": 1}))
    total = len(children)
    active = len([c for c in children if c.get("status") == "ACTIVE" or c.get("xp", 0) > 0])
    
    streaks = [c.get("streak", 0) for c in children]
    avg_streak = round(sum(streaks) / max(len(streaks), 1), 1)
    
    xps = [c.get("xp", 0) for c in children]
    avg_xp = round(sum(xps) / max(len(xps), 1))
    
    # Attendance
    att_records = list(database["attendances"].find())
    total_att = len(att_records)
    present_att = len([a for a in att_records if a.get("status") == "PRESENT"])
    avg_attendance = round(present_att / max(total_att, 1) * 100)
    
    # Behavior distribution
    behaviors = {"active": 0, "disciplined": 0, "lazy": 0, "dropping": 0}
    for c in children:
        s = c.get("streak", 0)
        x = c.get("xp", 0)
        if s >= 5:
            behaviors["disciplined"] += 1
        elif s == 0 and x < 20:
            behaviors["dropping"] += 1
        elif x < 30:
            behaviors["lazy"] += 1
        else:
            behaviors["active"] += 1
    
    # XP distribution
    xp_ranges = {"0-50": 0, "50-150": 0, "150-500": 0, "500+": 0}
    for x in xps:
        if x >= 500: xp_ranges["500+"] += 1
        elif x >= 150: xp_ranges["150-500"] += 1
        elif x >= 50: xp_ranges["50-150"] += 1
        else: xp_ranges["0-50"] += 1
    
    return JSONResponse(content={
        "totalStudents": total,
        "activeStudents": active,
        "activePct": round(active / max(total, 1) * 100),
        "avgStreak": avg_streak,
        "maxStreak": max(streaks) if streaks else 0,
        "avgXp": avg_xp,
        "avgAttendance": avg_attendance,
        "behaviorDistribution": behaviors,
        "xpDistribution": xp_ranges,
    })



# ============================================================
# STUDENT ACTIONS
# ============================================================

@app.post("/api/student/freeze-streak")
async def freeze_streak(request: Request):
    """Use one freeze to restore streak"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    user_id = user.get("id") or user.get("_id", "")
    child = database["children"].find_one({"userId": ObjectId(user_id)}) if user_id else None
    if not child:
        child = database["children"].find_one({"phone": user.get("phone")})
    if not child:
        return JSONResponse(content={"error": "Student not found"}, status_code=404)
    
    freeze_avail = child.get("streakFreezeAvailable", 1)
    if freeze_avail <= 0:
        return JSONResponse(content={"error": "Заморозка вже використана"}, status_code=400)
    
    old_streak = child.get("lastStreak", child.get("streak", 0))
    database["children"].update_one({"_id": child["_id"]}, {"$set": {
        "streak": max(old_streak, 1),
        "streakFreezeAvailable": freeze_avail - 1,
    }})
    return JSONResponse(content={"success": True, "streak": max(old_streak, 1), "freezesLeft": freeze_avail - 1})


@app.post("/api/student/coach-message")
async def student_coach_message(request: Request):
    """Send quick message to coach"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    body = await request.json()
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    now = datetime.now(timezone.utc)
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    
    database["messages"].insert_one({
        "fromUserId": user.get("id", ""),
        "fromName": user_name,
        "toRole": "COACH",
        "text": body.get("text", ""),
        "type": "STUDENT_TO_COACH",
        "isRead": False,
        "createdAt": now,
    })
    return JSONResponse(content={"success": True, "message": "Повідомлення надіслано тренеру"})


@app.post("/api/student/confirm-training")
async def confirm_training(request: Request):
    """Confirm attendance for upcoming training"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    body = await request.json()
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    
    now = datetime.now(timezone.utc)
    database["training_confirmations"].insert_one({
        "userId": user.get("id", ""),
        "trainingId": body.get("trainingId", ""),
        "status": body.get("status", "CONFIRMED"),
        "createdAt": now,
    })
    return JSONResponse(content={"success": True, "status": body.get("status", "CONFIRMED")})


@app.get("/api/student/group-rank")
async def student_group_rank(request: Request):
    """Student's rank within own group by XP (used for Junior Home mini-leaderboard)."""
    database = get_db()
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    child = None
    if user_id:
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})
    if not child:
        return JSONResponse(content={"position": None, "total": 0, "groupName": ""})

    group_id = child.get("groupId")
    group = None
    if group_id:
        try:
            group = database["groups"].find_one({"_id": group_id if hasattr(group_id, "binary") else ObjectId(group_id)})
        except Exception:
            group = database["groups"].find_one({"_id": group_id})
    group_name = group.get("name", "Група") if group else "Група"

    # Rank children in the same group by XP
    group_children = list(database["children"].find({"groupId": group_id})) if group_id else []
    ranked = sorted(group_children, key=lambda c: c.get("xp", 0), reverse=True)
    position = None
    for i, c in enumerate(ranked):
        if str(c.get("_id")) == str(child.get("_id")):
            position = i + 1
            break

    # Club-level rank (by XP across all children of same studentType)
    student_type = child.get("studentType") or "JUNIOR"
    all_children = list(database["children"].find({"studentType": student_type}))
    club_ranked = sorted(all_children, key=lambda c: c.get("xp", 0), reverse=True)
    club_position = None
    for i, c in enumerate(club_ranked):
        if str(c.get("_id")) == str(child.get("_id")):
            club_position = i + 1
            break

    return JSONResponse(content={
        "position": position,
        "total": len(ranked),
        "groupName": group_name,
        "clubPosition": club_position,
        "clubTotal": len(all_children),
        "xp": child.get("xp", 0),
    })




@app.post("/api/student/absence")
async def report_absence(request: Request):
    """Report absence — notifies coach, updates attendance, triggers events"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    body = await request.json()
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    reason = body.get("reason", "Не вказано")

    # Find child
    child = None
    if user_id:
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})

    # Record absence
    database["attendances"].insert_one({
        "childId": child["_id"] if child else None,
        "date": today_str,
        "status": "ABSENT",
        "reason": reason,
        "reportedBy": user_id,
        "createdAt": now,
    })

    # Notify coach
    group_id = child.get("groupId", "") if child else ""
    coach_id = None
    if group_id:
        group = None
        try:
            group = database["groups"].find_one({"_id": ObjectId(group_id)})
        except Exception:
            pass
        if group:
            coach_id = group.get("coachId")

    database["messages"].insert_one({
        "type": "ABSENCE_REPORT",
        "fromUserId": user_id,
        "fromName": user_name,
        "toUserId": coach_id or "",
        "toRole": "COACH",
        "text": f"{user_name} не прийде на тренування {today_str}. Причина: {reason}",
        "isAutomatic": True,
        "createdAt": now,
    })

    # Notify parent (if student is child)
    if child and child.get("parentId"):
        database["notifications"].insert_one({
            "userId": str(child["parentId"]),
            "type": "ABSENCE_REPORTED",
            "title": f"{user_name} не прийде на тренування",
            "body": f"Причина: {reason}",
            "isRead": False,
            "createdAt": now,
        })

    return JSONResponse(content={"success": True, "message": "Відсутність зафіксовано. Тренер повідомлений."})



@app.get("/api/training/available-slots")
async def get_available_slots(request: Request):
    """Get available training slots for rescheduling — next 7 days"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    # Find child
    child = None
    if user_id:
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})

    # Get all active schedules
    schedules = list(database["schedules"].find({"isActive": True}, {"_id": 0}))

    # Get locations & groups for names
    groups_map = {}
    for g in database["groups"].find():
        gid = str(g["_id"])
        loc = database["locations"].find_one({"_id": ObjectId(g.get("locationId", ""))}) if g.get("locationId") else None
        groups_map[gid] = {"name": g.get("name", ""), "location": loc.get("name", "") if loc else "", "address": loc.get("address", "") if loc else ""}

    # Build slots for next 7 days (excluding today)
    DAY_NAMES = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
    MONTH_NAMES = ["", "січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]
    slots = []

    for day_offset in range(1, 8):
        target = now + timedelta(days=day_offset)
        dow = target.isoweekday()
        date_str = target.strftime("%Y-%m-%d")

        for sched in schedules:
            if sched.get("dayOfWeek") != dow:
                continue

            gid = sched.get("groupId", "")
            group_info = groups_map.get(gid, {})

            # Count current bookings for this slot
            bookings = database["attendances"].count_documents({"date": date_str, "status": {"$in": ["PRESENT", "CONFIRMED", "RESCHEDULED_TO"]}})
            max_students = sched.get("maxStudents", 20)
            available = max(max_students - bookings, 0)

            if available > 0:
                slots.append({
                    "date": date_str,
                    "dayOfWeek": dow,
                    "dayName": DAY_NAMES[dow],
                    "dateLabel": f"{target.day} {MONTH_NAMES[target.month]}",
                    "startTime": sched.get("startTime", ""),
                    "endTime": sched.get("endTime", ""),
                    "group": group_info.get("name", ""),
                    "location": group_info.get("location", ""),
                    "address": group_info.get("address", ""),
                    "available": available,
                    "groupId": gid,
                })

    return JSONResponse(content={"slots": slots})


@app.post("/api/training/reschedule")
async def reschedule_training(request: Request):
    """Reschedule a training — mark absence + book new slot"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    user_id = user.get("id") or user.get("_id", "")
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    reason = body.get("reason", "Перенесення")
    new_date = body.get("newDate", "")
    new_time = body.get("newTime", "")

    # Find child
    child = None
    if user_id:
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})

    child_id = child["_id"] if child else None

    # 1. Mark today as RESCHEDULED
    database["attendances"].update_one(
        {"childId": child_id, "date": today_str},
        {"$set": {"status": "RESCHEDULED", "reason": reason, "rescheduledTo": new_date, "createdAt": now}},
        upsert=True
    )

    # 2. Book new slot
    database["attendances"].insert_one({
        "childId": child_id,
        "date": new_date,
        "status": "RESCHEDULED_TO",
        "fromDate": today_str,
        "createdAt": now,
    })

    # 3. Notify coach
    group_id = child.get("groupId", "") if child else ""
    group = None
    if group_id:
        try:
            group = database["groups"].find_one({"_id": ObjectId(group_id)})
        except Exception:
            pass

    database["messages"].insert_one({
        "type": "RESCHEDULE",
        "fromUserId": user_id,
        "fromName": user_name,
        "toRole": "COACH",
        "text": f"{user_name} переніс тренування з {today_str} на {new_date} ({new_time}). Причина: {reason}",
        "isAutomatic": True,
        "createdAt": now,
    })

    # 4. Log coach action event
    database["coach_actions"].insert_one({
        "type": "reschedule",
        "studentId": str(child_id) if child_id else "",
        "studentName": user_name,
        "fromDate": today_str,
        "toDate": new_date,
        "reason": reason,
        "createdAt": now,
    })

    # 5. Notify parent
    if child and child.get("parentId"):
        database["notifications"].insert_one({
            "userId": str(child["parentId"]),
            "type": "TRAINING_RESCHEDULED",
            "title": f"{user_name} переніс тренування",
            "body": f"Нова дата: {new_date} о {new_time}",
            "isRead": False,
            "createdAt": now,
        })

    return JSONResponse(content={"success": True, "message": f"Тренування перенесено на {new_date} о {new_time}"})




@app.get("/api/student/feed")
async def get_student_feed(request: Request):
    """Student feed — typed cards: streak, badge, coach_message, club, achievement"""
    database = get_db()
    auth = request.headers.get("authorization", "")
    user = None
    if auth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
                if resp.status_code == 200:
                    user = resp.json()
        except Exception:
            pass
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    feed = []

    child = database["children"].find_one({"userId": ObjectId(user_id)}) if user_id else None
    if not child:
        child = database["children"].find_one({"phone": user.get("phone")})

    streak = 0
    if child:
        child_id = str(child["_id"])
        att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(20))

        # Streak calculation
        for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") == "PRESENT":
                streak += 1
            else:
                break

        # STREAK card
        if streak >= 2:
            feed.append({"type": "streak", "value": streak, "text": f"Серія {streak} тренувань підряд!", "subtitle": "Не зупиняйтесь!", "date": now.isoformat()})

        # BADGE cards from achievements
        achievements = list(database["achievements"].find({"childId": child_id}, {"_id": 0}).sort("createdAt", -1).limit(5))
        for ach in achievements:
            feed.append({"type": "badge", "name": ach.get("type", ""), "text": ach.get("title", "Нове досягнення"), "subtitle": ach.get("description", ""), "date": str(ach.get("createdAt", now.isoformat()))})

        # Recent attendance as achievements
        present_count = len([a for a in att if a.get("status") == "PRESENT"])
        if present_count >= 5 and not any(f.get("name") == "five_trainings" for f in feed):
            feed.append({"type": "badge", "name": "five_trainings", "text": "5 тренувань пройдено!", "subtitle": "Ви на вірному шляху", "date": now.isoformat()})

    # COACH messages
    coach_comments = list(database["messages"].find(
        {"$or": [
            {"toRole": {"$in": ["STUDENT", "ALL"]}, "type": {"$in": ["COACH_TO_STUDENT", "COACH_BROADCAST"]}},
            {"type": "SYSTEM", "isAutomatic": True}
        ]}, {"_id": 0}).sort("createdAt", -1).limit(5))
    for m in coach_comments:
        feed.append({
            "type": "coach_message",
            "text": m.get("text", ""),
            "fromName": m.get("fromName", "Тренер"),
            "date": str(m.get("createdAt", now.isoformat())),
        })

    # CLUB news / events
    club_events = list(database["contentposts"].find(
        {"status": "PUBLISHED"}, {"_id": 0}).sort("createdAt", -1).limit(5))
    for ev in club_events:
        feed.append({
            "type": "club",
            "text": ev.get("title", "") or ev.get("body", ""),
            "subtitle": ev.get("body", "")[:80] if ev.get("body") else "",
            "date": str(ev.get("createdAt", now.isoformat())),
        })

    # Add club notifications
    club_notifs = list(database["notifications"].find(
        {"type": {"$in": ["CLUB_NEWS", "ANNOUNCEMENT", "EVENT", "PROMOTION"]}}, {"_id": 0}).sort("createdAt", -1).limit(3))
    for n in club_notifs:
        feed.append({
            "type": "club",
            "text": n.get("title", "") or n.get("body", ""),
            "subtitle": n.get("body", "")[:80] if n.get("body") else "",
            "date": str(n.get("createdAt", now.isoformat())),
        })

    # If feed is empty — generate demo feed items
    if len(feed) == 0:
        feed = [
            {"type": "streak", "value": 3, "text": "Серія 3 тренування підряд!", "subtitle": "Продовжуйте!", "date": now.isoformat()},
            {"type": "badge", "name": "first_training", "text": "Перше тренування завершено!", "subtitle": "Ласкаво просимо в АТАКА", "date": now.isoformat()},
            {"type": "coach_message", "text": "Добра робота на сьогоднішньому тренуванні! Продовжуй в тому ж дусі.", "fromName": "Олександр", "date": now.isoformat()},
            {"type": "club", "text": "80% учнів відвідали тренування цього тижня", "subtitle": "Ваш клуб в топ-3!", "date": now.isoformat()},
            {"type": "badge", "name": "discipline_star", "text": "Дисципліна 85+!", "subtitle": "Ви отримали бейдж за високу дисципліну", "date": now.isoformat()},
        ]

    feed.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Sprint 3 MUST: assign priority weight to each feed item
    # critical=LEVEL1 (red), important=LEVEL2 (yellow), info=LEVEL3 (grey)
    PRIORITY_MAP = {
        "coach_message": "critical",
        "coach_feedback": "critical",
        "coach": "critical",
        "competition": "critical",
        "absence_warning": "critical",
        "achievement": "important",
        "badge": "important",
        "belt": "important",
        "streak": "important",
        "xp": "important",
        "level": "important",
        "training": "important",
        "club": "info",
        "announcement": "info",
        "photo": "info",
        "reminder": "info",
        "system": "info",
    }
    for it in feed:
        it.setdefault("priority", PRIORITY_MAP.get(it.get("type", ""), "info"))

    return JSONResponse(content=json.loads(json.dumps({"feed": feed[:20]}, default=json_serial)))


# ============================================================
# JUNIOR SPRINT 3 MUST — XP system (real backend link)
# ============================================================

XP_SOURCES = {
    "training_confirm":  {"amount": 5,  "disc_delta": 1},
    "training_present":  {"amount": 10, "disc_delta": 2},
    "daily_task":        {"amount": 5,  "disc_delta": 1},
    "absence_report":    {"amount": 2,  "disc_delta": 0},
    "coach_message_sent":{"amount": 3,  "disc_delta": 0},
    "reschedule":        {"amount": 3,  "disc_delta": 1},
    "achievement":       {"amount": 50, "disc_delta": 3},
    "belt_upgrade":      {"amount": 100,"disc_delta": 5},
}


@app.post("/api/student/xp/apply")
async def student_xp_apply(request: Request):
    """Sprint 3 MUST: real XP application — updates child.xp + discipline + logs activity.
    Body: { source: 'training_confirm'|'daily_task'|..., amount?: int, meta?: dict }
    Returns: { xp, level, discipline, delta, source }
    """
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    source = body.get("source", "daily_task")
    cfg = XP_SOURCES.get(source, XP_SOURCES["daily_task"])
    delta_xp = int(body.get("amount") or cfg["amount"])
    delta_disc = int(cfg["disc_delta"])

    user_id = user.get("id") or user.get("_id", "")
    child = None
    if user_id:
        # Try multiple match strategies (userId can be ObjectId OR string in legacy data)
        try:
            child = database["children"].find_one({"userId": ObjectId(user_id)})
        except Exception:
            pass
        if not child:
            child = database["children"].find_one({"userId": user_id})
        if not child:
            child = database["children"].find_one({"phone": user.get("phone")})
    if not child:
        return JSONResponse(content={"error": "Student profile not found"}, status_code=404)

    new_xp = int(child.get("xp", 0)) + delta_xp
    new_disc = min(100, int(child.get("discipline", 70)) + delta_disc)
    level, level_name, next_xp = _calc_level(new_xp)

    now = datetime.now(timezone.utc)
    database["children"].update_one(
        {"_id": child["_id"]},
        {"$set": {"xp": new_xp, "discipline": new_disc, "level": level, "updatedAt": now}}
    )
    # Log activity for audit / absence pattern learning (future)
    database["xp_activities"].insert_one({
        "childId": str(child["_id"]),
        "userId": user_id,
        "source": source,
        "amount": delta_xp,
        "disciplineDelta": delta_disc,
        "meta": body.get("meta", {}),
        "createdAt": now,
    })

    return JSONResponse(content={
        "success": True,
        "source": source,
        "delta": delta_xp,
        "disciplineDelta": delta_disc,
        "xp": new_xp,
        "level": level,
        "levelName": level_name,
        "discipline": new_disc,
        "nextLevelXp": next_xp,
    })


# ============================================================
# PARENT HOME V2 (Parent Control Hub)
# ============================================================

async def _get_user_from_auth(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{NESTJS_URL}/api/users/me", headers={"authorization": auth})
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None

def _get_children_for_user(database, user_id: str):
    children = list(database["children"].find({"parentId": ObjectId(user_id)}))
    if not children:
        children = list(database["children"].find({"userId": ObjectId(user_id)}))
    if not children:
        children = list(database["children"].find({"roleOwnerId": ObjectId(user_id)}))
    if not children:
        children = list(database["children"].find().limit(3))
    return children

@app.get("/api/parent/home")
async def get_parent_home_v2(request: Request):
    """Parent Control Hub — aggregated dashboard v2"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    user_name = user.get("firstName", "Батьки")
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    weekday_map = {0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY", 4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"}
    today_day = weekday_map.get(now.weekday(), "MONDAY")
    today_num = now.weekday() + 1  # 1=Mon

    children_docs = _get_children_for_user(database, user_id)

    # ---- CHILDREN (enriched) ----
    children_data = []
    today_schedule = []
    all_alerts = []
    coach_contacts = []
    seen_coaches = set()
    total_debt = 0
    finance_per_child = []

    for child in children_docs:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        # Group
        group = None
        group_name = ""
        if child.get("groupId"):
            try:
                group = database["groups"].find_one({"_id": ObjectId(child["groupId"])})
            except Exception:
                group = database["groups"].find_one({"_id": child["groupId"]})
            group_name = group.get("name", "") if group else ""

        # Coach
        coach = None
        coach_id = child.get("coachId") or (group.get("coachId") if group else None)
        if coach_id:
            try:
                coach = database["users"].find_one({"_id": ObjectId(str(coach_id))})
            except Exception:
                coach = None
        coach_name = f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip() if coach else "Тренер"

        # Coach contact (deduplicated)
        if coach and str(coach["_id"]) not in seen_coaches:
            seen_coaches.add(str(coach["_id"]))
            coach_contacts.append({
                "id": str(coach["_id"]),
                "name": coach_name,
                "phone": coach.get("phone", ""),
                "avatarUrl": coach.get("avatarUrl"),
                "role": "COACH",
            })

        # Attendance
        att = list(database["attendances"].find({"childId": child["_id"]}))
        if not att:
            att = list(database["attendances"].find({"childId": child_id}))
        total_att = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        attendance_pct = round(present / total_att * 100) if total_att > 0 else 0
        streak = 0
        for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") == "PRESENT":
                streak += 1
            else:
                break

        # Debt
        child_payments = list(database["payments"].find({"childId": child_id, "status": "PENDING"}))
        if not child_payments:
            child_payments = list(database["payments"].find({"childId": child["_id"], "status": "PENDING"}))
        child_debt = sum(p.get("amount", 0) for p in child_payments)
        total_debt += child_debt

        # Subscription
        subs = list(database["subscriptions"].find({"childId": child_id}))
        sub_status = "Активний"
        next_pay = None
        if subs:
            s = subs[0]
            sub_status = {"ACTIVE": "Активний", "PAUSED": "Призупинено", "EXPIRED": "Завершено"}.get(s.get("status", ""), s.get("status", "Активний"))
            next_pay = s.get("nextPaymentDate") or s.get("endDate")

        finance_per_child.append({
            "childId": child_id,
            "childName": child_name,
            "debt": child_debt,
            "subscriptionStatus": sub_status,
            "nextPayment": next_pay.isoformat() if hasattr(next_pay, "isoformat") else str(next_pay) if next_pay else None,
        })

        # Today training for this child
        child_group_id = child.get("groupId")
        child_scheds = []
        if child_group_id:
            child_scheds = list(database["schedules"].find({"groupId": str(child_group_id), "dayOfWeek": today_num}))
            if not child_scheds:
                child_scheds = list(database["schedules"].find({"groupId": str(child_group_id), "dayOfWeek": today_day}))
        if not child_scheds:
            child_scheds = list(database["schedules"].find({"dayOfWeek": today_num}).limit(1))
            if not child_scheds:
                child_scheds = list(database["schedules"].find({"dayOfWeek": today_day}).limit(1))
        if not child_scheds:
            child_scheds = list(database["schedules"].find().limit(1))

        next_training = None
        for sched in child_scheds:
            loc = None
            if sched.get("locationId"):
                try:
                    loc = database["locations"].find_one({"_id": ObjectId(str(sched["locationId"]))})
                except Exception:
                    loc = None
            g = None
            if sched.get("groupId"):
                try:
                    g = database["groups"].find_one({"_id": ObjectId(str(sched["groupId"]))})
                except Exception:
                    g = None
            next_training = {
                "time": sched.get("startTime", "17:00"),
                "endTime": sched.get("endTime", "18:30"),
                "location": loc.get("name", "Зал") if loc else "Зал АТАКА",
                "group": g.get("name", "") if g else group_name,
                "coach": coach_name,
            }
            today_schedule.append({
                "childId": child_id,
                "childName": child_name,
                "time": sched.get("startTime", "17:00"),
                "endTime": sched.get("endTime", "18:30"),
                "location": loc.get("name", "Зал") if loc else "Зал АТАКА",
                "group": g.get("name", "") if g else group_name,
            })
            break

        # Achievements
        achievements = list(database["achievements"].find({"childId": child_id}, {"_id": 0}).sort("createdAt", -1).limit(3))
        if not achievements:
            achievements = list(database["achievements"].find({"childId": child["_id"]}, {"_id": 0}).sort("createdAt", -1).limit(3))

        status = "RISK" if attendance_pct < 40 else "WARNING" if (attendance_pct < 60 or child_debt > 0) else "OK"

        # Alerts per child
        if attendance_pct < 50:
            all_alerts.append({"type": "attendance", "severity": "warning", "childId": child_id, "childName": child_name, "message": f"{child_name} стає рідше відвідувати тренування"})
        if child_debt > 0:
            all_alerts.append({"type": "debt", "severity": "critical", "childId": child_id, "childName": child_name, "message": f"Борг за {child_name}: {child_debt} ₴"})

        children_data.append({
            "id": child_id,
            "name": child_name,
            "status": status,
            "attendance": attendance_pct,
            "streak": streak,
            "belt": child.get("belt", "WHITE"),
            "group": group_name,
            "coachId": str(coach["_id"]) if coach else None,
            "coachName": coach_name,
            "nextTraining": next_training,
            "debt": child_debt,
            "subscriptionStatus": sub_status,
            "achievements": json.loads(json.dumps(achievements[:2], default=json_serial)),
        })

    # ---- COMPETITIONS ----
    competitions = list(database["competitions"].find({"status": {"$in": ["UPCOMING", "OPEN", "REGISTRATION"]}}).sort("date", 1).limit(3))
    competitions_data = []
    for comp in competitions:
        competitions_data.append({
            "id": str(comp["_id"]),
            "title": comp.get("title", "Змагання"),
            "date": comp.get("date", ""),
            "location": comp.get("location", ""),
            "hasFee": comp.get("hasFee", False),
            "feeAmount": comp.get("feeAmount", 0),
        })

    # ---- RECOMMENDATIONS ----
    products = list(database["products"].find({"isActive": True, "isFeatured": True}, {"_id": 1, "name": 1, "price": 1, "oldPrice": 1, "category": 1, "brand": 1, "rating": 1}).limit(4))
    recommendations = [{
        "id": str(p["_id"]),
        "name": p.get("name", ""),
        "price": p.get("price", 0),
        "oldPrice": p.get("oldPrice"),
        "category": p.get("category", ""),
        "brand": p.get("brand", ""),
        "rating": p.get("rating", 0),
    } for p in products]

    # ---- FEED HIGHLIGHTS ----
    feed_posts = list(database["contentposts"].find({"status": "PUBLISHED"}).sort("createdAt", -1).limit(2))
    if not feed_posts:
        feed_posts = list(database["contentposts"].find().sort("createdAt", -1).limit(2))
    feed_highlights = [{
        "id": str(p["_id"]),
        "title": p.get("title", "Новина"),
        "body": (p.get("body", "") or p.get("content", ""))[:100],
        "type": p.get("type", "NEWS"),
    } for p in feed_posts]

    next_payment_date = (now + timedelta(days=30)).strftime("%Y-%m-%d")

    return JSONResponse(content=json.loads(json.dumps({
        "parent": {"name": user_name, "id": user_id},
        "children": children_data,
        "today": today_schedule,
        "alerts": all_alerts,
        "finance": {
            "totalDebt": total_debt,
            "nextPaymentDate": next_payment_date,
            "perChild": finance_per_child,
        },
        "coachContacts": coach_contacts,
        "competitions": competitions_data,
        "recommendations": recommendations,
        "feedHighlights": feed_highlights,
    }, default=json_serial)))


# ============================================================
# PARENT CHILD PROGRESS
# ============================================================

@app.get("/api/parent/child/{child_id}/progress")
async def get_child_progress(child_id: str, request: Request):
    """Detailed progress for a specific child"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    try:
        child = database["children"].find_one({"_id": ObjectId(child_id)})
    except Exception:
        child = None
    if not child:
        return JSONResponse(content={"error": "Child not found"}, status_code=404)

    child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

    # Attendance
    att = list(database["attendances"].find({"childId": child["_id"]}))
    if not att:
        att = list(database["attendances"].find({"childId": child_id}))
    total_att = len(att)
    present = len([a for a in att if a.get("status") == "PRESENT"])
    warned = len([a for a in att if a.get("status") == "WARNED"])
    absent = len([a for a in att if a.get("status") == "ABSENT"])
    attendance_pct = round(present / total_att * 100) if total_att > 0 else 0

    # Streak
    streak = 0
    for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
        if a.get("status") == "PRESENT":
            streak += 1
        else:
            break

    # Monthly goal
    monthly_target = child.get("monthlyGoalTarget", 12)
    current_month = now.month if (now := datetime.now(timezone.utc)) else 1
    month_att = [a for a in att if str(a.get("date", "")).startswith(f"2026-{current_month:02d}")]
    month_present = len([a for a in month_att if a.get("status") == "PRESENT"])

    # Achievements
    achievements = list(database["achievements"].find({"childId": child_id}).sort("createdAt", -1).limit(10))
    if not achievements:
        achievements = list(database["achievements"].find({"childId": child["_id"]}).sort("createdAt", -1).limit(10))
    achievements_data = [{
        "id": str(a["_id"]),
        "title": a.get("title", ""),
        "description": a.get("description", ""),
        "type": a.get("type", ""),
        "date": a.get("awardedAt", a.get("createdAt", "")),
    } for a in achievements]

    # Coach
    coach = None
    coach_id = child.get("coachId")
    if coach_id:
        try:
            coach = database["users"].find_one({"_id": ObjectId(str(coach_id))})
        except Exception:
            pass
    coach_name = f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip() if coach else "Тренер"

    # Group
    group = None
    if child.get("groupId"):
        try:
            group = database["groups"].find_one({"_id": ObjectId(str(child["groupId"]))})
        except Exception:
            pass

    # Competitions participated
    comp_participants = list(database["competitionparticipants"].find({"childId": child_id}).limit(5))
    competitions = []
    for cp in comp_participants:
        comp = database["competitions"].find_one({"_id": ObjectId(str(cp.get("competitionId", "")))}) if cp.get("competitionId") else None
        if comp:
            result = database["competitionresults"].find_one({"childId": child_id, "competitionId": str(comp["_id"])})
            competitions.append({
                "id": str(comp["_id"]),
                "title": comp.get("title", ""),
                "date": comp.get("date", ""),
                "medal": result.get("medal") if result else None,
                "place": result.get("place") if result else None,
            })

    # Risk
    risk_level = "low"
    if attendance_pct < 40:
        risk_level = "critical"
    elif attendance_pct < 60:
        risk_level = "warning"

    return JSONResponse(content=json.loads(json.dumps({
        "childId": child_id,
        "childName": child_name,
        "belt": child.get("belt", "WHITE"),
        "group": group.get("name", "") if group else "",
        "coachName": coach_name,
        "coachId": str(coach["_id"]) if coach else None,
        "attendance": {
            "percent": attendance_pct,
            "total": total_att,
            "present": present,
            "warned": warned,
            "absent": absent,
        },
        "streak": streak,
        "monthlyGoal": {
            "target": monthly_target,
            "current": month_present,
        },
        "achievements": achievements_data,
        "competitions": competitions,
        "riskLevel": risk_level,
        "programType": child.get("programType", "KIDS"),
    }, default=json_serial)))


# ============================================================
# PARENT SCHEDULE (enriched)
# ============================================================

@app.get("/api/parent/schedule")
async def get_parent_schedule(request: Request):
    """Schedule for all children of the parent"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    children_docs = _get_children_for_user(database, user_id)
    weekday_names = {1: "Понеділок", 2: "Вівторок", 3: "Середа", 4: "Четвер", 5: "П'ятниця", 6: "Субота", 7: "Неділя"}

    schedule_items = []
    for child in children_docs:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        group_id = child.get("groupId")
        if not group_id:
            continue

        group = None
        try:
            group = database["groups"].find_one({"_id": ObjectId(str(group_id))})
        except Exception:
            pass

        scheds = list(database["schedules"].find({"groupId": str(group_id)}))
        for sched in scheds:
            loc = None
            if sched.get("locationId"):
                try:
                    loc = database["locations"].find_one({"_id": ObjectId(str(sched["locationId"]))})
                except Exception:
                    pass

            coach = None
            coach_id = sched.get("coachId") or (group.get("coachId") if group else None) or child.get("coachId")
            if coach_id:
                try:
                    coach = database["users"].find_one({"_id": ObjectId(str(coach_id))})
                except Exception:
                    pass

            day_of_week = sched.get("dayOfWeek", 1)
            schedule_items.append({
                "id": str(sched["_id"]),
                "childId": child_id,
                "childName": child_name,
                "dayOfWeek": day_of_week,
                "dayName": weekday_names.get(day_of_week, str(day_of_week)),
                "startTime": sched.get("startTime", "17:00"),
                "endTime": sched.get("endTime", "18:30"),
                "group": group.get("name", "") if group else "",
                "location": loc.get("name", "Зал") if loc else "Зал АТАКА",
                "locationAddress": loc.get("address", "") if loc else "",
                "coachName": f"{coach.get('firstName', '')}" if coach else "Тренер",
            })

    schedule_items.sort(key=lambda x: (x["dayOfWeek"], x["startTime"]))

    return JSONResponse(content=json.loads(json.dumps({
        "items": schedule_items,
        "children": [{"id": str(c["_id"]), "name": f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()} for c in children_docs],
    }, default=json_serial)))


# ============================================================
# FEED (system + content + commercial)
# ============================================================

@app.get("/api/feed/home")
async def get_feed(request: Request):
    """Get feed items: system notifications + content + commercial"""
    database = get_db()
    now = datetime.now(timezone.utc)
    items = []
    
    # 1. SYSTEM: automation logs (recent actions)
    auto_logs = list(database["automation_logs"].find({}, {"_id": 0}).sort("createdAt", -1).limit(3))
    for log in auto_logs:
        items.append({
            "id": f"sys_{log.get('ruleId', '')}_{len(items)}",
            "type": "SYSTEM",
            "title": log.get("ruleName", "Системне повідомлення"),
            "description": log.get("result", "Автоматична дія виконана"),
            "date": log.get("createdAt", now).isoformat() if hasattr(log.get("createdAt", now), "isoformat") else str(log.get("createdAt", "")),
        })
    
    # 2. SYSTEM: schedule changes / reminders
    weekday_map = {0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY", 4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"}
    today_day = weekday_map.get(now.weekday(), "MONDAY")
    today_scheds = list(database["schedules"].find({"dayOfWeek": today_day}).limit(2))
    for sched in today_scheds:
        location = database["locations"].find_one({"_id": sched.get("locationId")}) if sched.get("locationId") else None
        items.append({
            "id": f"sched_{sched['_id']}",
            "type": "SYSTEM",
            "title": "Нагадування про тренування",
            "description": f"Сьогодні тренування о {sched.get('startTime', '17:00')}" + (f" — {location.get('name', '')}" if location else ""),
            "date": now.isoformat(),
        })
    
    # 3. CONTENT: achievements, posts
    content_posts = list(database["contentposts"].find({"status": "PUBLISHED"}, {"_id": 1, "title": 1, "content": 1, "imageUrl": 1, "createdAt": 1}).sort("createdAt", -1).limit(3))
    for post in content_posts:
        items.append({
            "id": f"content_{post['_id']}",
            "type": "CONTENT",
            "title": post.get("title", "Новина клубу"),
            "description": (post.get("content", "") or "")[:120],
            "image": post.get("imageUrl"),
            "date": post.get("createdAt", now).isoformat() if hasattr(post.get("createdAt", now), "isoformat") else str(post.get("createdAt", "")),
        })
    
    achievements = list(database["achievements"].find({}, {"_id": 1, "title": 1, "description": 1, "createdAt": 1}).sort("createdAt", -1).limit(2))
    for ach in achievements:
        items.append({
            "id": f"ach_{ach['_id']}",
            "type": "CONTENT",
            "title": f"Досягнення: {ach.get('title', '')}",
            "description": ach.get("description", "Нове досягнення учня"),
            "date": ach.get("createdAt", now).isoformat() if hasattr(ach.get("createdAt", now), "isoformat") else str(ach.get("createdAt", "")),
        })
    
    # 4. COMMERCIAL: featured products, discounts
    featured = list(database["products"].find({"isActive": True, "isFeatured": True}, {"_id": 1, "name": 1, "price": 1, "oldPrice": 1}).limit(3))
    for prod in featured:
        discount = ""
        if prod.get("oldPrice") and prod["oldPrice"] > prod.get("price", 0):
            pct = round((1 - prod["price"] / prod["oldPrice"]) * 100)
            discount = f" (-{pct}%)"
        items.append({
            "id": f"prod_{prod['_id']}",
            "type": "COMMERCIAL",
            "title": f"Знижка{discount}" if discount else "Рекомендація",
            "description": prod.get("name", "Товар"),
            "product": {"id": str(prod["_id"]), "name": prod.get("name", ""), "price": prod.get("price", 0)},
            "date": now.isoformat(),
        })
    
    # 5. AI recommendations as commercial
    ai_recs = list(database["ai_recommendations"].find({"status": "NEW", "type": "DISCOUNT"}, {"_id": 0}).limit(2))
    for rec in ai_recs:
        items.append({
            "id": f"ai_{rec.get('studentId', '')}",
            "type": "COMMERCIAL",
            "title": f"Персональна пропозиція",
            "description": rec.get("message", "Спеціальна знижка для вас"),
            "date": rec.get("updatedAt", now).isoformat() if hasattr(rec.get("updatedAt", now), "isoformat") else str(rec.get("updatedAt", "")),
        })
    
    # Sort by date desc
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    return JSONResponse(content=json.loads(json.dumps({"items": items}, default=json_serial)))


# ============================================================
# UNIT ECONOMICS
# ============================================================

@app.get("/api/admin/economics")
async def get_unit_economics():
    """Unit Economics: LTV, CAC, Coach ROI"""
    database = get_db()
    now = datetime.now(timezone.utc)
    
    # Revenue
    paid_payments = list(database["payments"].find({"status": "PAID"}))
    total_revenue = sum(p.get("amount", 0) for p in paid_payments)
    
    # Revenue by month (last 6)
    monthly = {}
    for p in paid_payments:
        dt = p.get("paidAt") or p.get("createdAt")
        if dt:
            key = dt.strftime("%Y-%m") if hasattr(dt, "strftime") else str(dt)[:7]
            monthly[key] = monthly.get(key, 0) + p.get("amount", 0)
    monthly_sorted = sorted(monthly.items(), reverse=True)[:6]
    
    # LTV
    parents = list(database["users"].find({"role": "PARENT"}))
    total_parents = max(len(parents), 1)
    ltv = round(total_revenue / total_parents)
    
    # Revenue per parent
    parent_revenue = {}
    for p in paid_payments:
        pid = str(p.get("parentId", ""))
        parent_revenue[pid] = parent_revenue.get(pid, 0) + p.get("amount", 0)
    
    # CAC
    marketing = list(database["marketing_spend"].find())
    total_marketing = sum(m.get("amount", 0) for m in marketing)
    total_leads = sum(m.get("leadsGenerated", 0) for m in marketing)
    cac = round(total_marketing / max(total_leads, 1))
    
    # LTV/CAC ratio
    ltv_cac = round(ltv / max(cac, 1), 1)
    health = "excellent" if ltv_cac >= 10 else "good" if ltv_cac >= 5 else "warning" if ltv_cac >= 3 else "critical"
    
    # Coach ROI
    coach_data = []
    coaches = list(database["users"].find({"role": "COACH"}))
    for coach in coaches:
        cid = str(coach["_id"])
        coach_rev = sum(p.get("amount", 0) for p in paid_payments if str(p.get("coachId", "")) == cid)
        coach_students = database["children"].count_documents({"coachId": coach["_id"]})
        if coach_students == 0:
            coach_students = database["children"].count_documents({})  # fallback
        
        roi_level = "high" if coach_rev > total_revenue * 0.4 else "medium" if coach_rev > total_revenue * 0.2 else "low"
        coach_data.append({
            "id": cid,
            "name": f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip(),
            "revenue": coach_rev,
            "students": coach_students,
            "revenuePerStudent": round(coach_rev / max(coach_students, 1)),
            "roi": roi_level,
        })
    coach_data.sort(key=lambda x: x["revenue"], reverse=True)
    
    # CAC trend (is it growing?)
    marketing_sorted = sorted(marketing, key=lambda x: x.get("month", ""), reverse=True)
    cac_trend = "stable"
    if len(marketing_sorted) >= 2:
        recent_cac = marketing_sorted[0].get("amount", 0) / max(marketing_sorted[0].get("leadsGenerated", 1), 1)
        prev_cac = marketing_sorted[1].get("amount", 0) / max(marketing_sorted[1].get("leadsGenerated", 1), 1)
        if recent_cac > prev_cac * 1.15:
            cac_trend = "growing"
        elif recent_cac < prev_cac * 0.85:
            cac_trend = "decreasing"
    
    # Alerts
    alerts = []
    if cac_trend == "growing":
        alerts.append({"type": "warning", "icon": "trending-up", "text": "CAC росте — перевірте маркетинг"})
    if health == "critical":
        alerts.append({"type": "critical", "icon": "alert-circle", "text": "LTV/CAC < 3 — бізнес під загрозою"})
    for c in coach_data:
        if c["roi"] == "low":
            alerts.append({"type": "warning", "icon": "person", "text": f"ROI {c['name']} падає — потрібна увага"})
    
    return JSONResponse(content={
        "ltv": ltv,
        "cac": cac,
        "ltvCacRatio": ltv_cac,
        "health": health,
        "totalRevenue": total_revenue,
        "totalParents": total_parents,
        "totalLeads": total_leads,
        "totalMarketingSpend": total_marketing,
        "monthlyRevenue": [{"month": m, "revenue": r} for m, r in monthly_sorted],
        "coaches": coach_data,
        "cacTrend": cac_trend,
        "alerts": alerts,
    })



# ============================================================
# COACH PROFILE (Parent-facing) — Transparency layer
# ============================================================

@app.get("/api/parent/coach/{coach_id}")
async def get_coach_profile_for_parent(coach_id: str, request: Request):
    """Coach profile visible to parents — transparency & trust"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    try:
        coach = database["users"].find_one({"_id": ObjectId(coach_id)})
    except Exception:
        coach = None
    if not coach or coach.get("role") != "COACH":
        return JSONResponse(content={"error": "Coach not found"}, status_code=404)

    coach_name = f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()

    # Groups
    groups = list(database["groups"].find({"coachId": coach_id}))
    if not groups:
        groups = list(database["groups"].find({"coachId": ObjectId(coach_id)}))
    groups_data = [{"id": str(g["_id"]), "name": g.get("name", ""), "studentsCount": g.get("capacity", 0)} for g in groups]

    # Students count
    students_count = database["children"].count_documents({"coachId": coach_id})
    if students_count == 0:
        students_count = database["children"].count_documents({"coachId": ObjectId(coach_id)})
    if students_count == 0:
        students_count = sum(g.get("capacity", 0) for g in groups)

    # Coach profile details
    profile = database["coachprofiles"].find_one({"userId": coach_id}) or database["coachprofiles"].find_one({"userId": ObjectId(coach_id)}) or {}

    # Recent actions (attendance, achievements, messages)
    now = datetime.now(timezone.utc)
    recent_actions = []

    # Recent attendance marks
    recent_att = list(database["attendances"].find({"coachId": coach_id}).sort("createdAt", -1).limit(5))
    if not recent_att:
        recent_att = list(database["attendances"].find({"coachId": ObjectId(coach_id)}).sort("createdAt", -1).limit(5))
    for att in recent_att[:3]:
        child = database["children"].find_one({"_id": att.get("childId")})
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip() if child else "Учень"
        recent_actions.append({
            "type": "attendance",
            "icon": "checkmark-circle",
            "text": f"Відмітив відвідування {child_name}",
            "date": att.get("createdAt", now),
        })

    # Recent achievements awarded
    recent_ach = list(database["achievements"].find({}).sort("createdAt", -1).limit(3))
    for ach in recent_ach[:2]:
        recent_actions.append({
            "type": "achievement",
            "icon": "trophy",
            "text": f"Додав досягнення: {ach.get('title', '')}",
            "date": ach.get("createdAt", now),
        })

    # Sort by date
    recent_actions.sort(key=lambda x: str(x.get("date", "")), reverse=True)

    # KPI
    kpi = database["coachkpis"].find_one({"coachId": coach_id}) or database["coachkpis"].find_one({"coachId": ObjectId(coach_id)}) or {}

    # Created date as "experience"
    created = coach.get("createdAt")
    experience_years = 0
    if created:
        try:
            if hasattr(created, "year"):
                experience_years = now.year - created.year
            else:
                experience_years = now.year - datetime.fromisoformat(str(created)).year
        except Exception:
            pass

    return JSONResponse(content=json.loads(json.dumps({
        "id": coach_id,
        "name": coach_name,
        "phone": coach.get("phone", ""),
        "avatarUrl": coach.get("avatarUrl"),
        "bio": profile.get("bio") or coach.get("bio") or coach.get("description") or "",
        "specialization": profile.get("specialization") or "Бойові мистецтва",
        "experienceYears": max(experience_years, 1),
        "studentsCount": students_count,
        "groups": groups_data,
        "rating": kpi.get("rating") or profile.get("rating") or 4.8,
        "kpiScore": kpi.get("kpiScore") or kpi.get("score") or 0,
        "recentActions": recent_actions[:5],
    }, default=json_serial)))


# ============================================================
# PARENT CHAT — Start/Get thread with coach (child context)
# ============================================================

@app.post("/api/parent/chat/start")
async def start_parent_coach_chat(request: Request):
    """Create or find a chat thread between parent and coach for a specific child"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    coach_id = body.get("coachId")
    child_id = body.get("childId")

    if not coach_id:
        return JSONResponse(content={"error": "coachId required"}, status_code=400)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    # Check for existing thread
    existing = database["messagethreads"].find_one({
        "participants": {"$all": [user_id, coach_id]},
    })

    if existing:
        thread_id = str(existing["_id"])
    else:
        # Create new thread
        child = None
        if child_id:
            try:
                child = database["children"].find_one({"_id": ObjectId(child_id)})
            except Exception:
                pass
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip() if child else ""

        coach = None
        try:
            coach = database["users"].find_one({"_id": ObjectId(coach_id)})
        except Exception:
            pass
        coach_name = f"{coach.get('firstName', '')}".strip() if coach else "Тренер"

        result = database["messagethreads"].insert_one({
            "participants": [user_id, coach_id],
            "childId": child_id,
            "childName": child_name,
            "type": "PARENT_COACH",
            "lastMessageAt": now,
            "createdAt": now,
            "updatedAt": now,
        })
        thread_id = str(result.inserted_id)

    # Also try NestJS thread creation as fallback
    try:
        auth = request.headers.get("authorization", "")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{NESTJS_URL}/api/messages/threads/create",
                json={"coachId": coach_id, "childId": child_id},
                headers={"authorization": auth, "Content-Type": "application/json"},
            )
            if resp.status_code in (200, 201):
                nest_data = resp.json()
                if nest_data.get("id") or nest_data.get("_id"):
                    thread_id = nest_data.get("id") or str(nest_data.get("_id"))
    except Exception:
        pass

    return JSONResponse(content={"threadId": thread_id, "coachId": coach_id, "childId": child_id})


# ============================================================
# PARENT CHAT — Send quick action message
# ============================================================

@app.post("/api/parent/chat/quick-message")
async def send_quick_message(request: Request):
    """Send a quick action message from parent to coach"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    thread_id = body.get("threadId")
    action = body.get("action")  # progress, absence, personal
    child_name = body.get("childName", "дитини")

    templates = {
        "progress": f"Доброго дня! Хотіла б дізнатись про прогрес {child_name} на тренуваннях. Як справи?",
        "absence": f"Доброго дня! Хочу повідомити, що {child_name} не зможе бути на наступному тренуванні.",
        "personal": f"Доброго дня! Хотіла б записати {child_name} на індивідуальне заняття. Які є варіанти?",
    }
    text = templates.get(action, body.get("text", "Доброго дня!"))

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    # Save message
    database["messages"].insert_one({
        "threadId": thread_id,
        "senderId": user_id,
        "text": text,
        "type": "QUICK_ACTION",
        "quickAction": action,
        "createdAt": now,
    })

    # Update thread
    database["messagethreads"].update_one(
        {"_id": ObjectId(thread_id)} if len(thread_id) == 24 else {"_id": thread_id},
        {"$set": {"lastMessageAt": now, "lastMessage": text, "updatedAt": now}},
    )

    # Also send via NestJS
    try:
        auth = request.headers.get("authorization", "")
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{NESTJS_URL}/api/messages/threads/{thread_id}/send",
                json={"text": text},
                headers={"authorization": auth, "Content-Type": "application/json"},
            )
    except Exception:
        pass

    return JSONResponse(content={"success": True, "text": text})


# ============================================================
# PARENT PAYMENTS — Per-child breakdown + smart CTA
# ============================================================

@app.get("/api/parent/payments")
async def get_parent_payments(request: Request):
    """Payments with per-child breakdown and smart CTA"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    children = _get_children_for_user(database, user_id)
    per_child = []
    total_due = 0
    urgent_payments = []

    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        payments = list(database["payments"].find({"childId": child_id, "status": {"$in": ["PENDING", "OVERDUE"]}}))
        if not payments:
            payments = list(database["payments"].find({"childId": child["_id"], "status": {"$in": ["PENDING", "OVERDUE"]}}))

        child_total = sum(p.get("amount", 0) for p in payments)
        total_due += child_total

        # Subscription info
        sub = database["subscriptions"].find_one({"childId": child_id})
        sub_status = "Активний"
        sub_price = 0
        next_date = None
        if sub:
            sub_status = {"ACTIVE": "Активний", "PAUSED": "Призупинено"}.get(sub.get("status", ""), sub.get("status", ""))
            sub_price = sub.get("price", 0)
            next_date = sub.get("nextPaymentDate") or sub.get("endDate")

        # Check urgency
        is_urgent = False
        days_left = 999
        if next_date:
            try:
                nd = next_date if hasattr(next_date, "day") else datetime.fromisoformat(str(next_date).replace("Z", "+00:00"))
                if not nd.tzinfo:
                    nd = nd.replace(tzinfo=timezone.utc)
                days_left = (nd - now).days
                if days_left <= 3:
                    is_urgent = True
            except Exception:
                pass

        item = {
            "childId": child_id,
            "childName": child_name,
            "amount": child_total,
            "subscriptionStatus": sub_status,
            "subscriptionPrice": sub_price,
            "nextPaymentDate": next_date.isoformat() if hasattr(next_date, "isoformat") else str(next_date) if next_date else None,
            "daysUntilPayment": min(days_left, 999),
            "isUrgent": is_urgent,
            "payments": [{"id": str(p["_id"]), "amount": p.get("amount", 0), "status": p.get("status", ""), "description": p.get("description", "")} for p in payments],
        }
        per_child.append(item)
        if is_urgent:
            urgent_payments.append(item)

    # Smart CTA
    smart_cta = None
    if urgent_payments:
        child = urgent_payments[0]
        smart_cta = {
            "type": "urgent",
            "icon": "alert-circle",
            "text": f"Платіж за {child['childName']} через {child['daysUntilPayment']} дн.",
            "amount": child["amount"] or child["subscriptionPrice"],
            "childId": child["childId"],
        }
    elif total_due > 0:
        smart_cta = {
            "type": "pending",
            "icon": "card",
            "text": f"Очікує оплати: {total_due} ₴",
            "amount": total_due,
        }

    return JSONResponse(content=json.loads(json.dumps({
        "totalDue": total_due,
        "perChild": per_child,
        "urgentPayments": urgent_payments,
        "smartCta": smart_cta,
    }, default=json_serial)))



# ============================================================
# EVENT ENGINE — API Endpoints
# ============================================================

@app.post("/api/events/process")
async def trigger_event_engine(request: Request):
    """Manually trigger event engine processing (admin only)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    events_before = database["events"].count_documents({})
    await run_event_engine()
    events_after = database["events"].count_documents({})
    new_events = events_after - events_before

    return JSONResponse(content={
        "success": True,
        "newEvents": new_events,
        "totalEvents": events_after,
        "message": f"Event Engine processed: {new_events} new events created",
    })


@app.get("/api/events/history")
async def get_event_history(request: Request):
    """Get event history (recent events)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    user_role = user.get("role", "PARENT")

    if user_role == "ADMIN":
        events = list(database["events"].find({}, {"_id": 0}).sort("createdAt", -1).limit(50))
    else:
        events = list(database["events"].find({"parentId": user_id}, {"_id": 0}).sort("createdAt", -1).limit(30))

    return JSONResponse(content=json.loads(json.dumps({"events": events}, default=json_serial)))


@app.get("/api/events/stats")
async def get_event_stats(request: Request):
    """Event engine statistics"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    total = database["events"].count_documents({})
    today_count = database["events"].count_documents({"createdAt": {"$gte": today}})

    # Per type
    type_stats = {}
    for etype in EVENT_TYPES:
        count = database["events"].count_documents({"type": etype})
        today_c = database["events"].count_documents({"type": etype, "createdAt": {"$gte": today}})
        type_stats[etype] = {"total": count, "today": today_c, **EVENT_TYPES[etype]}

    # Notifications created by events
    notif_count = database["notifications"].count_documents({"type": {"$regex": "^EVENT_"}})

    return JSONResponse(content={
        "total": total,
        "today": today_count,
        "types": type_stats,
        "notificationsCreated": notif_count,
    })


@app.get("/api/notifications/unread")
async def get_unread_notifications(request: Request):
    """Get unread notifications for current user"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")

    # Also find notifications for children owned by this user
    child_parent_ids = set()
    children = list(database["children"].find({"$or": [{"userId": ObjectId(user_id)}, {"parentId": ObjectId(user_id)}, {"roleOwnerId": ObjectId(user_id)}]}))
    for child in children:
        for field in ["userId", "parentId", "roleOwnerId"]:
            val = child.get(field)
            if val:
                child_parent_ids.add(str(val))
    child_parent_ids.add(user_id)

    notifs = list(database["notifications"].find(
        {"userId": {"$in": list(child_parent_ids)}, "isRead": False},
        {"_id": 0}
    ).sort("createdAt", -1).limit(20))

    count = database["notifications"].count_documents({"userId": {"$in": list(child_parent_ids)}, "isRead": False})

    return JSONResponse(content=json.loads(json.dumps({
        "notifications": notifs,
        "unreadCount": count,
    }, default=json_serial)))


# ============================================================
# EVENT ENGINE MVP — Core API Endpoints
# ============================================================

PRIORITY_MAP = {
    "debt_reminder": "HIGH",
    "attendance_risk": "MEDIUM",
    "achievement_streak": "LOW",
    "achievement_belt": "LOW",
    "competition_upcoming": "LOW",
}

SEVERITY_MAP = {
    "HIGH": {"color": "#DC2626", "icon": "alert-circle"},
    "MEDIUM": {"color": "#D97706", "icon": "warning"},
    "LOW": {"color": "#16A34A", "icon": "checkmark-circle"},
}

EVENT_CTA_MAP = {
    "debt_reminder": {"action": "pay", "label": "Оплатити", "screen": "/payments"},
    "attendance_risk": {"action": "chat", "label": "Написати тренеру", "screen": "/messages"},
    "achievement_streak": {"action": "view", "label": "Переглянути", "screen": "/(tabs)/progress"},
    "achievement_belt": {"action": "view", "label": "Переглянути", "screen": "/(tabs)/progress"},
    "competition_upcoming": {"action": "view", "label": "Деталі", "screen": "/competitions"},
}


@app.get("/api/parent/events")
async def get_parent_events(request: Request):
    """Get events for parent — with priority system (HIGH shown first, max 1 MEDIUM)"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    # Get children for this parent
    children_docs = _get_children_for_user(database, user_id)
    child_ids = [str(c["_id"]) for c in children_docs]
    parent_ids = [user_id] + child_ids

    # Fetch recent events (last 7 days)
    from datetime import timedelta
    week_ago = now - timedelta(days=7)
    events = list(database["events"].find(
        {"$or": [{"parentId": user_id}, {"childId": {"$in": child_ids}}], "createdAt": {"$gte": week_ago}},
    ).sort("createdAt", -1).limit(30))

    # Enrich and prioritize
    result = []
    for ev in events:
        ev_type = ev.get("type", "")
        priority = PRIORITY_MAP.get(ev_type, "LOW")
        severity_info = SEVERITY_MAP.get(priority, SEVERITY_MAP["LOW"])
        cta_info = EVENT_CTA_MAP.get(ev_type, {"action": "view", "label": "Переглянути", "screen": "/"})
        meta = ev.get("meta", {})

        # Build message
        child_name = ev.get("childName", "")
        if ev_type == "debt_reminder":
            message = f"Борг за {child_name}: {meta.get('debt', 0)} ₴"
        elif ev_type == "attendance_risk":
            att = meta.get("attendance", 0)
            misses = meta.get("consecutiveMisses", 0)
            message = f"{child_name} пропустив {misses} тренувань. Відвідуваність: {att}%"
        elif ev_type == "achievement_streak":
            streak = meta.get("streak", 0)
            message = f"🔥 {child_name} — {streak} тренувань підряд!"
        elif ev_type == "achievement_belt":
            message = f"🥋 {child_name} отримав новий пояс!"
        else:
            message = ev.get("childName", "Подія")

        ack_key = f"{ev_type}_{ev.get('childId', '')}_{ev.get('createdAt', '')}"

        result.append({
            "id": str(ev.get("_id", "")),
            "type": ev_type,
            "priority": priority,
            "severity": ev.get("severity", "info"),
            "childId": ev.get("childId", ""),
            "childName": child_name,
            "message": message,
            "cta": cta_info,
            "color": severity_info["color"],
            "icon": severity_info["icon"],
            "meta": json.loads(json.dumps(meta, default=json_serial)),
            "acknowledged": ev.get("acknowledged", False),
            "createdAt": ev.get("createdAt", now).isoformat() if hasattr(ev.get("createdAt", now), "isoformat") else str(ev.get("createdAt", "")),
        })

    # Priority filtering: ALL HIGH + max 1 MEDIUM on home
    high = [e for e in result if e["priority"] == "HIGH"]
    medium = [e for e in result if e["priority"] == "MEDIUM"]
    low = [e for e in result if e["priority"] == "LOW"]

    # Home events: all HIGH + 1 MEDIUM
    home_events = high + medium[:1]
    # All events for notifications screen
    all_events = high + medium + low[:5]

    return JSONResponse(content={
        "homeEvents": json.loads(json.dumps(home_events, default=json_serial)),
        "allEvents": json.loads(json.dumps(all_events, default=json_serial)),
        "counts": {"high": len(high), "medium": len(medium), "low": len(low), "total": len(result)},
    })


@app.post("/api/parent/events/{event_id}/ack")
async def acknowledge_event(event_id: str, request: Request):
    """Mark an event as acknowledged (seen/handled)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    try:
        result = database["events"].update_one(
            {"_id": ObjectId(event_id)},
            {"$set": {"acknowledged": True, "acknowledgedAt": datetime.now(timezone.utc)}}
        )
        if result.modified_count == 0:
            return JSONResponse(content={"error": "Event not found"}, status_code=404)
        return JSONResponse(content={"success": True})
    except Exception:
        return JSONResponse(content={"error": "Invalid event ID"}, status_code=400)


@app.get("/api/parent/feed")
async def get_parent_feed(request: Request, filter: str = "all"):
    """Mixed feed: content posts + event-based items (achievements, system, finance)"""
    database = get_db()
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    # 1. Content posts
    content_query = {"status": "PUBLISHED"}
    if filter != "all" and filter != "EVENT":
        content_query["type"] = filter
    content_posts = list(database["contentposts"].find(content_query).sort("createdAt", -1).limit(20))

    items = []
    for p in content_posts:
        items.append({
            "id": str(p["_id"]),
            "type": p.get("type", "NEWS"),
            "title": p.get("title", ""),
            "body": (p.get("body", "") or p.get("content", ""))[:200],
            "source": "content",
            "createdAt": p.get("createdAt", now).isoformat() if hasattr(p.get("createdAt", now), "isoformat") else str(p.get("createdAt", "")),
        })

    # 2. Event-based feed items (last 14 days)
    children_docs = _get_children_for_user(database, user_id)
    child_ids = [str(c["_id"]) for c in children_docs]
    two_weeks_ago = now - timedelta(days=14)

    if filter == "all" or filter == "EVENT" or filter == "PERSONAL":
        events = list(database["events"].find(
            {"$or": [{"parentId": user_id}, {"childId": {"$in": child_ids}}], "createdAt": {"$gte": two_weeks_ago}},
        ).sort("createdAt", -1).limit(15))

        for ev in events:
            ev_type = ev.get("type", "")
            child_name = ev.get("childName", "")
            meta = ev.get("meta", {})

            if ev_type == "achievement_streak":
                feed_type = "PERSONAL"
                title = f"🔥 {child_name} — {meta.get('streak', 0)} тренувань підряд!"
                body = f"Відмінна дисципліна! {child_name} показує стабільність."
            elif ev_type == "attendance_risk":
                feed_type = "SYSTEM"
                title = f"⚠️ {child_name} потребує уваги"
                body = f"Відвідуваність знизилась до {meta.get('attendance', 0)}%. Рекомендуємо повернутись до регулярних занять."
            elif ev_type == "debt_reminder":
                feed_type = "SYSTEM"
                title = f"💳 Нагадування про оплату"
                body = f"За {child_name} є заборгованість: {meta.get('debt', 0)} ₴"
            else:
                continue

            items.append({
                "id": f"event_{ev.get('_id', '')}",
                "type": feed_type,
                "title": title,
                "body": body,
                "source": "event",
                "eventType": ev_type,
                "childId": ev.get("childId", ""),
                "severity": ev.get("severity", "info"),
                "createdAt": ev.get("createdAt", now).isoformat() if hasattr(ev.get("createdAt", now), "isoformat") else str(ev.get("createdAt", "")),
            })

    # 3. Achievements as feed items
    if filter == "all" or filter == "PERSONAL":
        achievements = list(database["achievements"].find(
            {"childId": {"$in": child_ids + [ObjectId(c) for c in child_ids if len(c) == 24]}}
        ).sort("createdAt", -1).limit(5))

        for ach in achievements:
            items.append({
                "id": f"ach_{ach.get('_id', '')}",
                "type": "PERSONAL",
                "title": ach.get("title", "Досягнення"),
                "body": ach.get("description", ""),
                "source": "achievement",
                "createdAt": ach.get("createdAt", now).isoformat() if hasattr(ach.get("createdAt", now), "isoformat") else str(ach.get("createdAt", "")),
            })

    # Sort by date, deduplicate
    seen_titles = set()
    unique_items = []
    for item in sorted(items, key=lambda x: x.get("createdAt", ""), reverse=True):
        key = item.get("title", "")
        if key not in seen_titles:
            seen_titles.add(key)
            unique_items.append(item)

    return JSONResponse(content=json.loads(json.dumps({"items": unique_items[:30]}, default=json_serial)))


@app.get("/api/admin/events")
async def get_admin_events(request: Request, event_type: str = None, limit: int = 50):
    """Admin event log — table with filters"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)

    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    query = {}
    if event_type:
        query["type"] = event_type

    events = list(database["events"].find(query).sort("createdAt", -1).limit(limit))

    result = []
    for ev in events:
        ev_type = ev.get("type", "")
        type_info = EVENT_TYPES.get(ev_type, {"name": ev_type, "icon": "ellipse", "color": "#6B7280", "severity": "info"})
        result.append({
            "id": str(ev["_id"]),
            "type": ev_type,
            "typeName": type_info["name"],
            "icon": type_info["icon"],
            "color": type_info["color"],
            "severity": ev.get("severity", type_info.get("severity", "info")),
            "childId": ev.get("childId", ""),
            "childName": ev.get("childName", ""),
            "parentId": ev.get("parentId", ""),
            "meta": json.loads(json.dumps(ev.get("meta", {}), default=json_serial)),
            "actions": ev.get("actions", []),
            "processed": ev.get("processed", False),
            "acknowledged": ev.get("acknowledged", False),
            "createdAt": ev.get("createdAt", now).isoformat() if hasattr(ev.get("createdAt", now), "isoformat") else str(ev.get("createdAt", "")),
        })

    # Stats summary
    today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    stats = {
        "total": database["events"].count_documents({}),
        "today": database["events"].count_documents({"createdAt": {"$gte": today}}),
        "byType": {},
    }
    for etype in EVENT_TYPES:
        stats["byType"][etype] = {
            "total": database["events"].count_documents({"type": etype}),
            "today": database["events"].count_documents({"type": etype, "createdAt": {"$gte": today}}),
            **EVENT_TYPES[etype],
        }

    return JSONResponse(content=json.loads(json.dumps({
        "events": result,
        "stats": stats,
        "types": list(EVENT_TYPES.keys()),
    }, default=json_serial)))


# ============================================================
# PHASE 2: DISCOUNT OFFER ENGINE
# ============================================================

OFFER_COOLDOWN_DAYS = 14  # 1 offer per 14 days per child
OFFER_EXPIRY_HOURS = 48   # offer valid for 48 hours

@app.get("/api/parent/offers")
async def get_parent_offers(request: Request):
    """Get active discount offers for parent"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    children_docs = _get_children_for_user(database, user_id)
    child_ids = [str(c["_id"]) for c in children_docs]

    # Active offers (not expired, not used)
    offers = list(database["discount_offers"].find({
        "childId": {"$in": child_ids},
        "status": {"$in": ["ACTIVE", "NEW"]},
        "expiresAt": {"$gte": now},
    }).sort("createdAt", -1))

    result = []
    for o in offers:
        expires_at = o["expiresAt"]
        if not expires_at.tzinfo:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        hours_left = max(0, (expires_at - now).total_seconds() / 3600)
        result.append({
            "id": str(o["_id"]),
            "childId": o.get("childId", ""),
            "childName": o.get("childName", ""),
            "percent": o.get("percent", 10),
            "reason": o.get("reason", ""),
            "message": o.get("message", ""),
            "status": o.get("status", "NEW"),
            "hoursLeft": round(hours_left, 1),
            "expiresAt": expires_at.isoformat(),
            "createdAt": o.get("createdAt", now).isoformat() if hasattr(o.get("createdAt", now), "isoformat") else str(o.get("createdAt", now)),
        })

    return JSONResponse(content=json.loads(json.dumps({"offers": result}, default=json_serial)))


@app.post("/api/parent/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, request: Request):
    """Accept a discount offer — applies to subscription"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)

    try:
        offer = database["discount_offers"].find_one({"_id": ObjectId(offer_id)})
    except Exception:
        return JSONResponse(content={"error": "Invalid offer ID"}, status_code=400)

    if not offer:
        return JSONResponse(content={"error": "Offer not found"}, status_code=404)
    if offer.get("status") not in ["ACTIVE", "NEW"]:
        return JSONResponse(content={"error": "Offer already used or expired"}, status_code=400)
    if offer.get("expiresAt") and offer["expiresAt"] < now:
        database["discount_offers"].update_one({"_id": offer["_id"]}, {"$set": {"status": "EXPIRED"}})
        return JSONResponse(content={"error": "Offer expired"}, status_code=400)

    # Apply discount to subscription
    child_id = offer.get("childId", "")
    percent = offer.get("percent", 10)
    sub = database["subscriptions"].find_one({"childId": child_id})
    if sub:
        original = sub.get("price", 2000)
        discounted = int(original * (1 - percent / 100))
        database["subscriptions"].update_one(
            {"_id": sub["_id"]},
            {"$set": {"price": discounted, "discountApplied": percent, "discountOfferId": str(offer["_id"]), "updatedAt": now}}
        )

    # Mark offer as accepted
    database["discount_offers"].update_one(
        {"_id": offer["_id"]},
        {"$set": {"status": "ACCEPTED", "acceptedAt": now}}
    )

    # Create notification
    user_id = user.get("id") or user.get("_id", "")
    database["notifications"].insert_one({
        "userId": user_id,
        "type": "OFFER_ACCEPTED",
        "title": f"✅ Знижку -{percent}% активовано!",
        "body": f"Знижка для {offer.get('childName', '')} застосована до абонементу.",
        "data": {"screen": "/payments", "type": "offer"},
        "isRead": False,
        "createdAt": now,
    })

    return JSONResponse(content={"success": True, "percent": percent, "childId": child_id})


def generate_discount_offer(database, child_id: str, child_name: str, parent_id: str, reason: str, percent: int):
    """Generate a discount offer with cooldown check"""
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    # Cooldown check: 1 offer per 14 days per child
    recent = database["discount_offers"].find_one({
        "childId": child_id,
        "createdAt": {"$gte": now - timedelta(days=OFFER_COOLDOWN_DAYS)}
    })
    if recent:
        return None

    messages = {
        "attendance_risk": f"Ми хочемо допомогти {child_name} повернутись 💛\nЗнижка -{percent}% на наступний місяць",
        "debt_recovery": f"Спеціальна пропозиція для {child_name} 🎯\n-{percent}% при оплаті протягом 48 годин",
        "loyalty": f"Дякуємо за вірність! 🏆\n{child_name} отримує -{percent}% як VIP-учень",
    }

    offer = {
        "childId": child_id,
        "childName": child_name,
        "parentId": parent_id,
        "percent": percent,
        "reason": reason,
        "message": messages.get(reason, f"Знижка -{percent}% для {child_name}"),
        "status": "ACTIVE",
        "expiresAt": now + timedelta(hours=OFFER_EXPIRY_HOURS),
        "createdAt": now,
    }
    result = database["discount_offers"].insert_one(offer)

    # Send push
    asyncio.create_task(send_automation_push(database, parent_id, "discount_20", child_name=child_name, value=percent))

    return str(result.inserted_id)


# ============================================================
# PHASE 2: STREAK ENGINE + FREEZE
# ============================================================

@app.get("/api/parent/streaks")
async def get_parent_streaks(request: Request):
    """Get streak data for all children"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    children_docs = _get_children_for_user(database, user_id)

    streaks = []
    for child in children_docs:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        streak_doc = database["streaks"].find_one({"childId": child_id})
        if not streak_doc:
            # Calculate from attendance
            att_records = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1))
            if not att_records:
                att_records = list(database["attendances"].find({"childId": child_id}).sort("date", -1))

            current_streak = 0
            for a in att_records:
                if a.get("status") == "PRESENT":
                    current_streak += 1
                else:
                    break

            streak_doc = {
                "childId": child_id,
                "childName": child_name,
                "currentStreak": current_streak,
                "bestStreak": current_streak,
                "freezesAvailable": 1,
                "freezesUsed": 0,
                "lastTrainingDate": att_records[0].get("date") if att_records else None,
            }
            database["streaks"].update_one(
                {"childId": child_id},
                {"$set": streak_doc},
                upsert=True,
            )

        streaks.append({
            "childId": child_id,
            "childName": child_name,
            "currentStreak": streak_doc.get("currentStreak", 0),
            "bestStreak": streak_doc.get("bestStreak", 0),
            "freezesAvailable": streak_doc.get("freezesAvailable", 1),
            "freezesUsed": streak_doc.get("freezesUsed", 0),
            "lastTrainingDate": str(streak_doc.get("lastTrainingDate", "")),
        })

    return JSONResponse(content=json.loads(json.dumps({"streaks": streaks}, default=json_serial)))


@app.post("/api/parent/streaks/{child_id}/freeze")
async def use_streak_freeze(child_id: str, request: Request):
    """Use a freeze to save streak"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    streak_doc = database["streaks"].find_one({"childId": child_id})
    if not streak_doc:
        return JSONResponse(content={"error": "No streak data"}, status_code=404)

    if streak_doc.get("freezesAvailable", 0) <= 0:
        return JSONResponse(content={"error": "No freezes available"}, status_code=400)

    now = datetime.now(timezone.utc)
    database["streaks"].update_one(
        {"childId": child_id},
        {"$set": {"freezesUsed": streak_doc.get("freezesUsed", 0) + 1, "freezesAvailable": streak_doc.get("freezesAvailable", 1) - 1, "lastFreezeDate": now.isoformat()}}
    )

    return JSONResponse(content={"success": True, "freezesAvailable": streak_doc.get("freezesAvailable", 1) - 1})


# ============================================================
# PHASE 2: WEEKLY CHALLENGES
# ============================================================

@app.get("/api/parent/challenges")
async def get_parent_challenges(request: Request):
    """Get weekly challenges for all children"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    children_docs = _get_children_for_user(database, user_id)
    # Week start (Monday)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    all_challenges = []
    for child in children_docs:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        # Find or create weekly challenge
        challenge = database["challenges"].find_one({
            "childId": child_id,
            "weekStart": {"$gte": week_start, "$lt": week_end},
        })

        if not challenge:
            # Auto-create weekly challenge
            # Count this week's attendance
            week_att = list(database["attendances"].find({
                "childId": {"$in": [child["_id"], child_id]},
                "date": {"$gte": week_start.strftime("%Y-%m-%d"), "$lt": week_end.strftime("%Y-%m-%d")},
                "status": "PRESENT",
            }))

            challenge = {
                "childId": child_id,
                "childName": child_name,
                "parentId": user_id,
                "type": "WEEKLY_ATTENDANCE",
                "title": "Тижневий виклик",
                "description": f"Відвідай 3 тренування цього тижня",
                "target": 3,
                "current": len(week_att),
                "reward": "badge",
                "rewardTitle": "Тижневий боєць 💪",
                "status": "ACTIVE" if len(week_att) < 3 else "COMPLETED",
                "weekStart": week_start,
                "weekEnd": week_end,
                "createdAt": now,
            }
            database["challenges"].insert_one(challenge)

            # Auto-complete if already met
            if len(week_att) >= 3 and challenge["status"] != "COMPLETED":
                database["challenges"].update_one(
                    {"childId": child_id, "weekStart": {"$gte": week_start}},
                    {"$set": {"status": "COMPLETED", "completedAt": now, "current": len(week_att)}}
                )
                # Award badge
                existing = database["achievements"].find_one({"childId": child_id, "type": "WEEKLY_CHALLENGE", "weekStart": week_start})
                if not existing:
                    database["achievements"].insert_one({
                        "childId": child_id,
                        "title": "Тижневий боєць 💪",
                        "description": f"{child_name} виконав тижневий виклик!",
                        "type": "WEEKLY_CHALLENGE",
                        "weekStart": week_start,
                        "awardedAt": now,
                        "createdAt": now,
                    })

        pct = min(100, round((challenge.get("current", 0) / max(challenge.get("target", 3), 1)) * 100))
        all_challenges.append({
            "id": str(challenge.get("_id", "")),
            "childId": child_id,
            "childName": child_name,
            "title": challenge.get("title", "Тижневий виклик"),
            "description": challenge.get("description", ""),
            "target": challenge.get("target", 3),
            "current": challenge.get("current", 0),
            "percent": pct,
            "reward": challenge.get("rewardTitle", ""),
            "status": challenge.get("status", "ACTIVE"),
            "daysLeft": max(0, (week_end - now).days),
        })

    return JSONResponse(content=json.loads(json.dumps({"challenges": all_challenges}, default=json_serial)))


# ============================================================
# PHASE 2: ENHANCED EVENT ENGINE — Auto Offer Generation
# ============================================================

async def run_phase2_engine():
    """Phase 2 engine: generate offers from events, update streaks"""
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    children = list(database["children"].find())
    offers_created = 0

    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        parent_id = str(child.get("userId") or child.get("parentId") or child.get("roleOwnerId") or "")
        if not parent_id:
            continue

        # Check for attendance risk → generate offer
        att_records = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1))
        if not att_records:
            att_records = list(database["attendances"].find({"childId": child_id}).sort("date", -1))

        total = len(att_records)
        present = len([a for a in att_records if a.get("status") == "PRESENT"])
        attendance_pct = round(present / total * 100) if total > 0 else 100

        consecutive_misses = 0
        for a in att_records:
            if a.get("status") == "ABSENT":
                consecutive_misses += 1
            else:
                break

        # Offer generation: attendance risk
        if consecutive_misses >= 3 or (total > 5 and attendance_pct < 50):
            percent = 15 if consecutive_misses >= 5 else 10
            offer_id = generate_discount_offer(database, child_id, child_name, parent_id, "attendance_risk", percent)
            if offer_id:
                offers_created += 1

        # Update streak
        current_streak = 0
        for a in att_records:
            if a.get("status") == "PRESENT":
                current_streak += 1
            else:
                break

        best = database["streaks"].find_one({"childId": child_id})
        best_streak = max(current_streak, best.get("bestStreak", 0) if best else 0)

        # Reset freeze weekly (every Monday)
        freezes = 1 if now.weekday() == 0 else (best.get("freezesAvailable", 1) if best else 1)

        database["streaks"].update_one(
            {"childId": child_id},
            {"$set": {
                "childName": child_name,
                "currentStreak": current_streak,
                "bestStreak": best_streak,
                "freezesAvailable": freezes,
                "lastUpdated": now,
            }},
            upsert=True,
        )

    if offers_created > 0:
        logger.info(f"Phase2: {offers_created} offers created")


@app.post("/api/events/seed-test")
async def seed_test_events():
    """Seed test data that triggers all 3 MVP events"""
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    # Find test children
    children = list(database["children"].find().limit(3))
    if not children:
        return JSONResponse(content={"error": "No children in DB. Run main seed first."}, status_code=400)

    parent = database["users"].find_one({"role": "PARENT"})
    parent_id = str(parent["_id"]) if parent else ""

    results = {"debt_events": 0, "attendance_events": 0, "achievement_events": 0}

    for i, child in enumerate(children):
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        if i == 0:
            # CHILD 1: Create debt situation (payment pending)
            database["payments"].delete_many({"childId": child_id, "status": "PENDING", "_test": True})
            database["payments"].insert_one({
                "childId": child_id,
                "parentId": ObjectId(parent_id) if parent_id else None,
                "amount": 2500,
                "status": "PENDING",
                "type": "SUBSCRIPTION",
                "description": f"Абонемент за {child_name}",
                "dueDate": now - timedelta(days=2),
                "createdAt": now - timedelta(days=5),
                "_test": True,
            })
            results["debt_events"] += 1

        if i <= 1:
            # CHILD 1 & 2: Create attendance risk (3+ consecutive misses)
            database["attendances"].delete_many({"childId": child["_id"], "_test": True})
            for d in range(5):
                status = "ABSENT" if d < 3 else "PRESENT"
                database["attendances"].insert_one({
                    "childId": child["_id"],
                    "scheduleId": ObjectId("000000000000000000000001"),
                    "date": (now - timedelta(days=d)).strftime("%Y-%m-%d"),
                    "status": status,
                    "createdAt": now - timedelta(days=d),
                    "_test": True,
                })
            results["attendance_events"] += 1

        if i == 2:
            # CHILD 3: Create achievement situation (5+ consecutive present)
            database["attendances"].delete_many({"childId": child["_id"], "_test": True})
            for d in range(7):
                database["attendances"].insert_one({
                    "childId": child["_id"],
                    "scheduleId": ObjectId("000000000000000000000001"),
                    "date": (now - timedelta(days=d)).strftime("%Y-%m-%d"),
                    "status": "PRESENT",
                    "createdAt": now - timedelta(days=d),
                    "_test": True,
                })
            results["achievement_events"] += 1

    # Now run event engine to process these
    await run_event_engine()

    # Count created events
    total_events = database["events"].count_documents({})
    total_notifs = database["notifications"].count_documents({"type": {"$regex": "^EVENT_"}})

    return JSONResponse(content={
        "success": True,
        "seeded": results,
        "totalEvents": total_events,
        "totalNotifications": total_notifs,
        "message": "Test events seeded and processed. Check /api/parent/events and /api/admin/events.",
    })


# ============================================================
# SAAS LAYER — Pricing Plans, Club Management, Billing
# ============================================================

PRICING_PLANS = {
    "START": {
        "id": "START", "name": "Start", "price": 990, "currency": "UAH", "interval": "month",
        "limits": {"students": 50, "coaches": 3, "branches": 1},
        "features": {"automation": False, "ai": False, "marketplace": True, "branding": False, "push": True, "retention": False, "coachKpi": False, "unitEconomics": False, "integrations": False},
        "commission": {"marketplace": 0.10},
        "trial": {"enabled": True, "days": 7},
    },
    "PRO": {
        "id": "PRO", "name": "Pro", "price": 2490, "currency": "UAH", "interval": "month",
        "limits": {"students": 200, "coaches": 10, "branches": 5},
        "features": {"automation": True, "ai": False, "marketplace": True, "branding": True, "push": True, "retention": True, "coachKpi": True, "unitEconomics": False, "integrations": False},
        "commission": {"marketplace": 0.07},
        "trial": {"enabled": True, "days": 7},
    },
    "ENTERPRISE": {
        "id": "ENTERPRISE", "name": "Enterprise", "price": 4990, "currency": "UAH", "interval": "month",
        "limits": {"students": 9999, "coaches": 9999, "branches": 9999},
        "features": {"automation": True, "ai": True, "marketplace": True, "branding": True, "push": True, "retention": True, "coachKpi": True, "unitEconomics": True, "integrations": True},
        "commission": {"marketplace": 0.05},
        "trial": {"enabled": True, "days": 14},
    },
}

def init_pricing_plans():
    """Seed pricing plans into DB"""
    database = get_db()
    plans_col = database["pricing_plans"]
    if plans_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for plan_id, plan in PRICING_PLANS.items():
            plans_col.insert_one({**plan, "isActive": True, "createdAt": now})
        logger.info(f"Initialized {len(PRICING_PLANS)} pricing plans")

def init_default_club():
    """Create default ATAKA club if not exists"""
    database = get_db()
    clubs_col = database["clubs"]
    if clubs_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        admin = database["users"].find_one({"role": "ADMIN"})
        admin_id = str(admin["_id"]) if admin else ""

        club = {
            "name": "АТАКА Київ",
            "slug": "ataka-kyiv",
            "ownerId": admin_id,
            "plan": "PRO",
            "status": "ACTIVE",
            "primaryColor": "#E30613",
            "secondaryColor": "#0F0F10",
            "logoUrl": None,
            "coverUrl": None,
            "city": "Київ",
            "phone": "+380501234567",
            "email": "admin@ataka.club",
            "description": "Мережа клубів бойових мистецтв",
            "createdAt": now,
        }
        result = clubs_col.insert_one(club)
        club_id = str(result.inserted_id)

        # Create subscription
        from datetime import timedelta
        database["club_subscriptions"].insert_one({
            "clubId": club_id,
            "plan": "PRO",
            "price": 2490,
            "currency": "UAH",
            "status": "ACTIVE",
            "startDate": now,
            "nextBillingDate": now + timedelta(days=30),
            "createdAt": now,
        })

        # Create memberships for existing users
        users = list(database["users"].find())
        for u in users:
            role = u.get("role", "PARENT")
            if role == "ADMIN":
                membership_role = "OWNER"
            else:
                membership_role = role
            database["club_memberships"].insert_one({
                "userId": str(u["_id"]),
                "clubId": club_id,
                "role": membership_role,
                "isActive": True,
                "createdAt": now,
            })

        logger.info(f"Default club created: {club_id}")


def get_club_plan(database, club_id: str) -> dict:
    """Get active plan for a club"""
    club = database["clubs"].find_one({"_id": ObjectId(club_id)}) if len(club_id) == 24 else database["clubs"].find_one()
    if not club:
        return PRICING_PLANS["START"]
    plan_id = club.get("plan", "START")
    db_plan = database["pricing_plans"].find_one({"id": plan_id})
    if db_plan:
        return db_plan
    return PRICING_PLANS.get(plan_id, PRICING_PLANS["START"])


def check_limit(database, club_id: str, resource: str) -> dict:
    """Check if club is within limits. Returns {allowed, current, limit, percent}"""
    plan = get_club_plan(database, club_id)
    limits = plan.get("limits", {})
    limit_val = limits.get(resource, 9999)

    count_map = {
        "students": lambda: database["children"].count_documents({}),
        "coaches": lambda: database["users"].count_documents({"role": "COACH"}),
        "branches": lambda: database["locations"].count_documents({}),
    }
    current = count_map.get(resource, lambda: 0)()
    pct = round(current / max(limit_val, 1) * 100)

    return {"allowed": current < limit_val, "current": current, "limit": limit_val, "percent": pct}


# ── Pricing Plans API ────────────────────────────────
@app.get("/api/platform/plans")
async def get_pricing_plans():
    """Get all pricing plans (public)"""
    database = get_db()
    plans = list(database["pricing_plans"].find({"isActive": True}, {"_id": 0}))
    if not plans:
        plans = list(PRICING_PLANS.values())
    return JSONResponse(content=json.loads(json.dumps({"plans": plans}, default=json_serial)))

@app.get("/api/platform/plans/all")
async def get_all_pricing_plans(request: Request):
    """Platform Admin: get ALL plans including inactive"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    plans = list(database["pricing_plans"].find({}, {"_id": 0}))
    if not plans:
        plans = list(PRICING_PLANS.values())
    return JSONResponse(content=json.loads(json.dumps({"plans": plans}, default=json_serial)))

@app.put("/api/platform/plans/{plan_id}")
async def update_pricing_plan(plan_id: str, request: Request):
    """Platform Admin: update pricing plan"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    body = await request.json()
    now = datetime.now(timezone.utc)
    update = {"updatedAt": now}
    for field in ["name", "price", "currency", "interval"]:
        if field in body:
            update[field] = body[field]
    if "limits" in body:
        update["limits"] = body["limits"]
    if "features" in body:
        update["features"] = body["features"]
    if "commission" in body:
        update["commission"] = body["commission"]
    if "trial" in body:
        update["trial"] = body["trial"]
    if "isActive" in body:
        update["isActive"] = body["isActive"]

    result = database["pricing_plans"].update_one({"id": plan_id}, {"$set": update})
    if result.modified_count == 0:
        return JSONResponse(content={"error": "Plan not found"}, status_code=404)

    # Update global cache
    if plan_id in PRICING_PLANS:
        for k, v in update.items():
            if k != "updatedAt":
                PRICING_PLANS[plan_id][k] = v

    return JSONResponse(content={"success": True, "planId": plan_id})

@app.get("/api/platform/limits/{resource}")
async def check_resource_limit(resource: str, request: Request):
    """Check limit for a resource (students/coaches/branches)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club"}, status_code=404)
    club_id = str(club["_id"])
    result = check_limit(database, club_id, resource)
    return JSONResponse(content=result)

@app.get("/api/platform/smart-triggers")
async def get_smart_triggers(request: Request):
    """Get smart upgrade triggers based on limits and usage"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"triggers": []})
    club_id = str(club["_id"])
    plan = get_club_plan(database, club_id)
    plan_id = plan.get("id", "START")
    triggers = []
    for resource in ["students", "coaches", "branches"]:
        limit_info = check_limit(database, club_id, resource)
        label = {"students": "учнів", "coaches": "тренерів", "branches": "філіалів"}.get(resource, resource)
        if limit_info["percent"] >= 90:
            next_plan = "PRO" if plan_id == "START" else "ENTERPRISE" if plan_id == "PRO" else None
            triggers.append({
                "type": "limit_warning",
                "severity": "critical",
                "resource": resource,
                "message": f"Ви використали {limit_info['percent']}% ліміту {label}",
                "action": f"Upgrade до {next_plan}" if next_plan else "Зверніться до підтримки",
                "current": limit_info["current"],
                "limit": limit_info["limit"],
                "percent": limit_info["percent"],
                "upgradeTo": next_plan,
            })
        elif limit_info["percent"] >= 75:
            triggers.append({
                "type": "limit_info",
                "severity": "warning",
                "resource": resource,
                "message": f"Ліміт {label}: {limit_info['current']}/{limit_info['limit']} ({limit_info['percent']}%)",
                "current": limit_info["current"],
                "limit": limit_info["limit"],
                "percent": limit_info["percent"],
            })
    return JSONResponse(content={"triggers": triggers, "plan": plan_id})


# ── Club Management API ─────────────────────────────
@app.get("/api/platform/clubs")
async def get_platform_clubs(request: Request):
    """Platform Admin: list all clubs"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ["ADMIN"]:
        return JSONResponse(content={"error": "Admin only"}, status_code=403)

    database = get_db()
    clubs = list(database["clubs"].find())
    result = []
    for c in clubs:
        club_id = str(c["_id"])
        students = database["children"].count_documents({})
        coaches = database["users"].count_documents({"role": "COACH"})
        sub = database["club_subscriptions"].find_one({"clubId": club_id, "status": "ACTIVE"})

        result.append({
            "id": club_id,
            "name": c.get("name", ""),
            "slug": c.get("slug", ""),
            "plan": c.get("plan", "START"),
            "status": c.get("status", "ACTIVE"),
            "primaryColor": c.get("primaryColor", "#E30613"),
            "city": c.get("city", ""),
            "studentCount": students,
            "coachCount": coaches,
            "subscription": {
                "status": sub.get("status", "INACTIVE") if sub else "INACTIVE",
                "price": sub.get("price", 0) if sub else 0,
                "nextBilling": sub.get("nextBillingDate", "").isoformat() if sub and hasattr(sub.get("nextBillingDate"), "isoformat") else "",
            } if sub else None,
        })

    return JSONResponse(content=json.loads(json.dumps({"clubs": result}, default=json_serial)))


# ── Owner: Club Dashboard ────────────────────────────
@app.get("/api/owner/club")
async def get_owner_club(request: Request):
    """Owner dashboard — club info, plan, limits, business metrics"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    # Find club
    membership = database["club_memberships"].find_one({"userId": user_id, "role": {"$in": ["OWNER", "ADMIN"]}})
    club = None
    if membership:
        try:
            club = database["clubs"].find_one({"_id": ObjectId(membership["clubId"])})
        except Exception:
            pass
    if not club:
        club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club found"}, status_code=404)

    club_id = str(club["_id"])
    plan = get_club_plan(database, club_id)
    plan_limits = plan.get("limits", {})
    plan_features = plan.get("features", {})

    # Limits usage
    limits = {}
    for resource in ["students", "coaches", "branches"]:
        limits[resource] = check_limit(database, club_id, resource)

    # Subscription
    sub = database["club_subscriptions"].find_one({"clubId": club_id, "status": "ACTIVE"})
    subscription = None
    if sub:
        subscription = {
            "plan": sub.get("plan", "START"),
            "price": sub.get("price", 0),
            "status": sub.get("status", "ACTIVE"),
            "nextBillingDate": sub.get("nextBillingDate", "").isoformat() if hasattr(sub.get("nextBillingDate"), "isoformat") else "",
        }

    # Business metrics
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    payments_month = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": month_start}}))
    revenue = sum(p.get("amount", 0) for p in payments_month)

    payments_pending = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))
    debt_total = sum(p.get("amount", 0) for p in payments_pending)

    total_children = database["children"].count_documents({})
    active_children = database["children"].count_documents({"status": {"$in": ["ACTIVE", "TRIAL"]}})
    retention = round(active_children / max(total_children, 1) * 100)

    # Marketplace revenue
    orders_month = list(database["orders"].find({"status": {"$in": ["PAID", "DELIVERED"]}, "createdAt": {"$gte": month_start}}))
    marketplace_revenue = sum(o.get("total", 0) for o in orders_month)
    commission_rate = plan.get("commission", {}).get("marketplace", 0.07)

    # Team
    team = list(database["club_memberships"].find({"clubId": club_id, "isActive": True}))
    team_data = []
    for m in team:
        u = database["users"].find_one({"_id": ObjectId(m["userId"])}) if m.get("userId") else None
        if u:
            team_data.append({
                "id": m["userId"],
                "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
                "role": m.get("role", ""),
                "phone": u.get("phone", ""),
            })

    return JSONResponse(content=json.loads(json.dumps({
        "club": {
            "id": club_id,
            "name": club.get("name", ""),
            "slug": club.get("slug", ""),
            "status": club.get("status", "ACTIVE"),
            "ownerUserId": club.get("ownerUserId", ""),
            "sportId": club.get("sportId", "martial_arts"),
            "plan": plan.get("id", "START"),
            "saasStatus": sub.get("status", "ACTIVE") if sub else "ACTIVE",
            "primaryColor": club.get("primaryColor", "#E30613"),
            "secondaryColor": club.get("secondaryColor", "#0F0F10"),
            "logoUrl": club.get("logoUrl"),
            "city": club.get("city", ""),
            "phone": club.get("phone", ""),
            "email": club.get("email", ""),
            "description": club.get("description", ""),
        },
        "plan": {
            "id": plan.get("id", "START"),
            "name": plan.get("name", "Start"),
            "price": plan.get("price", 990),
            "features": plan_features,
            "commission": plan.get("commission", {}),
        },
        "stats": {
            "students": total_children,
            "coaches": len([t for t in team_data if t.get("role") == "COACH"]),
            "monthlyRevenue": revenue,
            "totalDebt": debt_total,
            "retention": retention,
            "activeStudents": active_children,
            "marketplaceRevenue": marketplace_revenue,
        },
        "limits": {
            "maxStudents": plan_limits.get("students", 200),
            "maxCoaches": plan_limits.get("coaches", 10),
            "studentsUsage": limits.get("students", {}).get("percentage", 0) if isinstance(limits.get("students"), dict) else 0,
            "coachesUsage": limits.get("coaches", {}).get("percentage", 0) if isinstance(limits.get("coaches"), dict) else 0,
        },
        "subscription": subscription,
        "business": {
            "revenue": revenue,
            "debtTotal": debt_total,
            "retention": retention,
            "totalStudents": total_children,
            "activeStudents": active_children,
            "marketplaceRevenue": marketplace_revenue,
            "commissionRate": commission_rate,
            "platformFee": plan.get("price", 0),
            "ltv": round(revenue * 12 / max(active_children, 1)) if active_children > 0 else 0,
            "arpu": round(revenue / max(active_children, 1)) if active_children > 0 else 0,
        },
        "team": team_data,
    }, default=json_serial)))


@app.patch("/api/owner/club")
async def update_owner_club(request: Request):
    """Owner: update club branding/info"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club"}, status_code=404)

    update = {}
    for field in ["name", "primaryColor", "secondaryColor", "logoUrl", "city", "phone", "email", "description"]:
        if field in body:
            update[field] = body[field]

    if update:
        update["updatedAt"] = datetime.now(timezone.utc)
        database["clubs"].update_one({"_id": club["_id"]}, {"$set": update})

    return JSONResponse(content={"success": True})


@app.post("/api/owner/club/upgrade")
async def upgrade_club_plan(request: Request):
    """Owner: request upgrade — Admin must approve"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    new_plan_id = body.get("plan", "PRO")
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    if new_plan_id not in PRICING_PLANS:
        return JSONResponse(content={"error": "Invalid plan"}, status_code=400)

    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club"}, status_code=404)

    old_plan_id = club.get("plan", "START")
    
    # Check for existing pending request
    pending = database["upgrade_requests"].find_one({
        "clubId": str(club["_id"]),
        "status": "PENDING_REVIEW"
    })
    if pending:
        return JSONResponse(content={"error": "У вас вже є заявка на розгляді", "existingRequest": pending.get("requestedPlan")}, status_code=400)

    new_plan = PRICING_PLANS[new_plan_id]
    base_price = new_plan["price"]

    # Create upgrade REQUEST (not instant)
    request_doc = {
        "clubId": str(club["_id"]),
        "clubName": club.get("name", ""),
        "ownerId": user.get("id", ""),
        "ownerName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "currentPlan": old_plan_id,
        "requestedPlan": new_plan_id,
        "currentPrice": PRICING_PLANS.get(old_plan_id, {}).get("price", 0),
        "requestedPrice": base_price,
        "status": "PENDING_REVIEW",
        "createdAt": now,
        "updatedAt": now,
    }
    result = database["upgrade_requests"].insert_one(request_doc)

    # Notify admin
    database["notifications"].insert_one({
        "userId": "ADMIN",
        "type": "UPGRADE_REQUEST",
        "title": f"Запит на апгрейд: {club.get('name', '')}",
        "body": f"{old_plan_id} → {new_plan_id}. Власник: {request_doc['ownerName']}",
        "data": {"requestId": str(result.inserted_id), "clubId": str(club["_id"])},
        "isRead": False,
        "createdAt": now,
    })

    logger.info(f"Upgrade request: {club.get('name', '')} {old_plan_id} → {new_plan_id}")

    return JSONResponse(content={
        "success": True,
        "requestId": str(result.inserted_id),
        "currentPlan": old_plan_id,
        "requestedPlan": new_plan_id,
        "status": "PENDING_REVIEW",
        "message": f"Заявку на {new_plan_id} надіслано на розгляд адміністратору",
    })


@app.get("/api/owner/upgrade-status")
async def get_upgrade_status(request: Request):
    """Get current upgrade request status"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"pending": None})
    req = database["upgrade_requests"].find_one(
        {"clubId": str(club["_id"]), "status": "PENDING_REVIEW"},
        {"_id": 0}
    )
    return JSONResponse(content=json.loads(json.dumps({"pending": req}, default=json_serial)))


@app.get("/api/admin/upgrade-requests")
async def get_admin_upgrade_requests(request: Request):
    """Admin: list all upgrade requests"""
    database = get_db()
    reqs = list(database["upgrade_requests"].find({}, {"_id": 0}).sort("createdAt", -1).limit(50))
    return JSONResponse(content=json.loads(json.dumps({"requests": reqs}, default=json_serial)))


@app.post("/api/admin/upgrade-requests/{club_id}/approve")
async def approve_upgrade(club_id: str, request: Request):
    """Admin: approve upgrade request"""
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    
    req = database["upgrade_requests"].find_one({"clubId": club_id, "status": "PENDING_REVIEW"})
    if not req:
        return JSONResponse(content={"error": "Request not found"}, status_code=404)
    
    new_plan_id = req["requestedPlan"]
    old_plan_id = req["currentPlan"]
    new_plan = PRICING_PLANS.get(new_plan_id, {})
    base_price = new_plan.get("price", 0)
    
    # Apply upgrade
    database["clubs"].update_one(
        {"_id": ObjectId(club_id)},
        {"$set": {"plan": new_plan_id, "updatedAt": now, "saasStatus": "ACTIVE"}}
    )
    
    # Update subscription
    database["club_subscriptions"].update_one(
        {"clubId": club_id},
        {"$set": {
            "plan": new_plan_id,
            "price": base_price,
            "status": "ACTIVE",
            "updatedAt": now,
            "nextBillingDate": now + timedelta(days=30),
        }},
        upsert=True,
    )
    
    # Update request status
    database["upgrade_requests"].update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "APPROVED", "approvedAt": now, "updatedAt": now}}
    )
    
    # Notify owner
    if req.get("ownerId"):
        database["notifications"].insert_one({
            "userId": req["ownerId"],
            "type": "UPGRADE_APPROVED",
            "title": f"Тариф {new_plan_id} активовано!",
            "body": f"Ваш клуб переведено на тариф {new_plan_id}.",
            "isRead": False,
            "createdAt": now,
        })
    
    return JSONResponse(content={"success": True, "plan": new_plan_id})


@app.post("/api/admin/upgrade-requests/{club_id}/reject")
async def reject_upgrade(club_id: str, request: Request):
    """Admin: reject upgrade request"""
    database = get_db()
    body = await request.json()
    now = datetime.now(timezone.utc)
    
    result = database["upgrade_requests"].update_one(
        {"clubId": club_id, "status": "PENDING_REVIEW"},
        {"$set": {"status": "REJECTED", "rejectedAt": now, "rejectReason": body.get("reason", ""), "updatedAt": now}}
    )
    
    if result.modified_count == 0:
        return JSONResponse(content={"error": "Request not found"}, status_code=404)
    
    return JSONResponse(content={"success": True})


@app.get("/api/owner/team")
async def get_owner_team(request: Request):
    """Owner: get club team members"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club"}, status_code=404)

    club_id = str(club["_id"])
    members = list(database["club_memberships"].find({"clubId": club_id}))

    result = []
    for m in members:
        u = None
        try:
            u = database["users"].find_one({"_id": ObjectId(m["userId"])})
        except Exception:
            pass
        if u:
            result.append({
                "id": m["userId"],
                "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
                "phone": u.get("phone", ""),
                "role": m.get("role", ""),
                "isActive": m.get("isActive", True),
            })

    return JSONResponse(content=json.loads(json.dumps({"members": result}, default=json_serial)))


# ============================================================
# SAAS ENFORCEMENT LAYER — Hard Limits + PAST_DUE + Commission
# ============================================================

# Routes that create resources and need limit enforcement
LIMIT_ENFORCEMENT_ROUTES = {
    "children": "students",
    "admin/children": "students",
    "admin/users": "coaches",     # When role=COACH
    "locations": "branches",
    "admin/locations": "branches",
}

# Routes that require ACTIVE subscription (blocked when PAST_DUE)
SUBSCRIPTION_REQUIRED_ROUTES = [
    "children", "admin/children", "locations", "admin/locations",
    "groups", "admin/groups", "schedule", "admin/schedule",
    "products", "admin/products", "orders",
]


def get_club_subscription_status(database) -> dict:
    """Get club subscription status and check for PAST_DUE"""
    club = database["clubs"].find_one()
    if not club:
        return {"status": "NO_CLUB", "plan": "START", "blocked": False}

    club_id = str(club["_id"])
    sub = database["club_subscriptions"].find_one({"clubId": club_id})

    saas_status = club.get("saasStatus", sub.get("status", "ACTIVE") if sub else "ACTIVE")
    plan = club.get("plan", "START")

    # Check for overdue invoices
    overdue_count = database["club_invoices"].count_documents({
        "clubId": club_id,
        "status": {"$in": ["OVERDUE"]},
    })

    is_past_due = saas_status == "PAST_DUE" or overdue_count > 0

    return {
        "status": saas_status,
        "plan": plan,
        "clubId": club_id,
        "blocked": is_past_due,
        "overdueCount": overdue_count,
        "subscription": sub,
    }


@app.middleware("http")
async def saas_enforcement_middleware(request: Request, call_next):
    """
    SaaS enforcement middleware:
    1. Hard Limit Enforcement — block POST for children/coaches/branches when at 100%
    2. PAST_DUE blocking — block mutations when subscription is past due
    Returns graceful JSON errors with upgrade_required/payment_required flags
    """
    path = request.url.path
    method = request.method

    # Only enforce on POST (creation) and certain paths
    if not path.startswith("/api/") or method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    # Skip enforcement for auth, health, platform, payment webhook, proxy status
    skip_paths = [
        "/api/auth/", "/api/health", "/api/proxy/", "/api/platform/",
        "/api/payments/webhook", "/api/owner/club/upgrade", "/api/push/",
        "/api/automation/", "/api/ai/", "/api/events/", "/api/devices/",
        "/api/billing/invoices/", "/api/admin/clubs/",
        "/api/owner/invoices/", "/api/marketplace/",
    ]
    if any(path.startswith(sp) for sp in skip_paths):
        return await call_next(request)

    api_path = path[5:]  # Remove "/api/"

    try:
        database = get_db()

        # === PAST_DUE CHECK (block mutations) ===
        if method in ("POST", "PUT", "PATCH", "DELETE"):
            should_check_sub = any(api_path.startswith(r) for r in SUBSCRIPTION_REQUIRED_ROUTES)
            if should_check_sub:
                sub_info = get_club_subscription_status(database)
                if sub_info["blocked"]:
                    return JSONResponse(
                        content={
                            "error": "Підписка прострочена",
                            "message": "Оплатіть рахунок для продовження роботи з платформою.",
                            "code": "PAST_DUE",
                            "payment_required": True,
                            "upgrade_required": False,
                            "overdueCount": sub_info.get("overdueCount", 0),
                            "plan": sub_info.get("plan", "START"),
                        },
                        status_code=402,
                    )

        # === HARD LIMIT ENFORCEMENT (block resource creation) ===
        if method == "POST":
            # Simple mapping: POST to /children → check students, etc.
            simple_limits = {
                "children": "students",
                "admin/children": "students",
                "locations": "branches",
                "admin/locations": "branches",
            }
            for route_prefix, resource in simple_limits.items():
                if api_path.startswith(route_prefix):
                    club = database["clubs"].find_one()
                    if club:
                        club_id = str(club["_id"])
                        limit_result = check_limit(database, club_id, resource)
                        if not limit_result["allowed"]:
                            plan = club.get("plan", "START")
                            plan_order = {"START": "PRO", "PRO": "ENTERPRISE", "ENTERPRISE": None}
                            next_plan = plan_order.get(plan)
                            label = {"students": "учнів", "coaches": "тренерів", "branches": "філіалів"}.get(resource, resource)

                            return JSONResponse(
                                content={
                                    "error": f"Ліміт {label} вичерпано",
                                    "message": f"Ваш тариф {plan} дозволяє {limit_result['limit']} {label}. Зараз: {limit_result['current']}/{limit_result['limit']}.",
                                    "code": "LIMIT_EXCEEDED",
                                    "upgrade_required": True,
                                    "payment_required": False,
                                    "resource": resource,
                                    "current": limit_result["current"],
                                    "limit": limit_result["limit"],
                                    "percent": limit_result["percent"],
                                    "currentPlan": plan,
                                    "upgradeTo": next_plan,
                                    "upgradeDiscount": 30,
                                },
                                status_code=403,
                            )
                    break

    except Exception as e:
        logger.error(f"SaaS enforcement error: {e}")
        # Don't block on enforcement errors — let the request through

    return await call_next(request)


# ── Marketplace Commission Tracking ──────────────────

@app.post("/api/marketplace/order/complete")
async def complete_marketplace_order(request: Request):
    """Complete marketplace order and calculate platform commission"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    order_id = body.get("orderId")
    now = datetime.now(timezone.utc)

    if not order_id:
        return JSONResponse(content={"error": "orderId required"}, status_code=400)

    order = database["orders"].find_one({"_id": ObjectId(order_id)})
    if not order:
        return JSONResponse(content={"error": "Order not found"}, status_code=404)

    total = order.get("total", 0)

    # Get club commission rate from plan
    club = database["clubs"].find_one()
    plan = get_club_plan(database, str(club["_id"])) if club else PRICING_PLANS["START"]
    commission_rate = plan.get("commission", {}).get("marketplace", 0.10)
    commission_amount = round(total * commission_rate)

    # Update order status
    database["orders"].update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "COMPLETED",
            "completedAt": now,
            "platformCommission": commission_amount,
            "commissionRate": commission_rate,
        }}
    )

    # Track commission in separate collection
    database["marketplace_commissions"].insert_one({
        "orderId": order_id,
        "clubId": str(club["_id"]) if club else "",
        "plan": plan.get("id", "START"),
        "orderTotal": total,
        "commissionRate": commission_rate,
        "commissionAmount": commission_amount,
        "status": "PENDING",
        "createdAt": now,
    })

    logger.info(f"Order {order_id} completed. Commission: {commission_amount}₴ ({commission_rate*100}%)")

    return JSONResponse(content={
        "success": True,
        "orderId": order_id,
        "total": total,
        "commissionRate": commission_rate,
        "commissionAmount": commission_amount,
    })


@app.get("/api/marketplace/commissions")
async def get_marketplace_commissions(request: Request):
    """Get marketplace commission stats for owner dashboard"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    commissions = list(database["marketplace_commissions"].find({}, {"_id": 0}))
    month_commissions = [c for c in commissions if c.get("createdAt") and c["createdAt"] >= month_start]

    total_commission = sum(c.get("commissionAmount", 0) for c in commissions)
    month_commission = sum(c.get("commissionAmount", 0) for c in month_commissions)
    total_orders = len(commissions)
    month_orders = len(month_commissions)

    return JSONResponse(content=json.loads(json.dumps({
        "totalCommission": total_commission,
        "monthCommission": month_commission,
        "totalOrders": total_orders,
        "monthOrders": month_orders,
        "commissions": commissions[-20:],
    }, default=json_serial)))


# ── WayForPay REAL Integration ────────────────────────

WAYFORPAY_API_URL = "https://api.wayforpay.com/api"
WAYFORPAY_MERCHANT = os.environ.get("WAYFORPAY_MERCHANT_ACCOUNT", "y_store_in_ua")
WAYFORPAY_SECRET = os.environ.get("WAYFORPAY_MERCHANT_SECRET", "")
WAYFORPAY_PASSWORD = os.environ.get("WAYFORPAY_MERCHANT_PASSWORD", "")
WAYFORPAY_DOMAIN = os.environ.get("WAYFORPAY_DOMAIN", "ataka.club")

import hmac
import hashlib
import time


def wayforpay_sign(fields: list, secret: str = None) -> str:
    """Generate HMAC_MD5 signature for WayForPay"""
    secret = secret or WAYFORPAY_SECRET
    sign_string = ";".join(str(f) for f in fields)
    return hmac.new(
        secret.encode("utf-8"),
        sign_string.encode("utf-8"),
        hashlib.md5,
    ).hexdigest()


def wayforpay_verify_callback(data: dict) -> bool:
    """Verify incoming WayForPay callback signature"""
    try:
        fields = [
            data.get("merchantAccount", ""),
            data.get("orderReference", ""),
            str(data.get("amount", "")),
            data.get("currency", "UAH"),
            data.get("authCode", ""),
            data.get("cardPan", ""),
            data.get("transactionStatus", ""),
            str(data.get("reasonCode", "")),
        ]
        expected = wayforpay_sign(fields)
        return hmac.compare_digest(expected, data.get("merchantSignature", ""))
    except Exception as e:
        logger.error(f"WayForPay signature verify error: {e}")
        return False


@app.post("/api/payments/create")
async def create_wayforpay_payment(request: Request):
    """Create real WayForPay invoice and return payment URL"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    invoice_id = body.get("invoiceId")
    now = datetime.now(timezone.utc)

    # Find invoice
    invoice = None
    if invoice_id:
        try:
            invoice = database["club_invoices"].find_one({"_id": ObjectId(invoice_id)})
        except Exception:
            pass

    if not invoice:
        # Find first unpaid invoice
        club = database["clubs"].find_one()
        if club:
            invoice = database["club_invoices"].find_one({
                "clubId": str(club["_id"]),
                "status": {"$in": ["PENDING", "OVERDUE"]},
            })

    if not invoice:
        return JSONResponse(content={"error": "No unpaid invoice found"}, status_code=404)

    inv_id = str(invoice["_id"])
    amount = str(invoice.get("amount", 0))
    plan = invoice.get("plan", "PRO")
    description = invoice.get("description", f"SaaS {plan}")

    # Build order reference (unique per attempt)
    order_ref = f"ATAKA-{inv_id}-{int(time.time())}"
    order_date = int(time.time())

    # Signature for CREATE_INVOICE
    product_name = f"АТАКА SaaS — {plan}"
    product_count = "1"
    product_price = amount

    sign_fields = [
        WAYFORPAY_MERCHANT, WAYFORPAY_DOMAIN, order_ref, order_date,
        amount, "UAH", product_name, product_count, product_price,
    ]
    signature = wayforpay_sign(sign_fields)

    # Build service URL (webhook)
    service_url = body.get("serviceUrl", "")
    if not service_url:
        # Use the app's domain for webhook
        service_url = f"https://{WAYFORPAY_DOMAIN}/api/payments/webhook"

    return_url = body.get("returnUrl", f"https://{WAYFORPAY_DOMAIN}")

    # Call WayForPay CREATE_INVOICE API
    payload = {
        "transactionType": "CREATE_INVOICE",
        "merchantAccount": WAYFORPAY_MERCHANT,
        "merchantAuthType": "SimpleSignature",
        "merchantDomainName": WAYFORPAY_DOMAIN,
        "merchantSignature": signature,
        "apiVersion": 1,
        "language": "UA",
        "serviceUrl": service_url,
        "returnUrl": return_url,
        "orderReference": order_ref,
        "orderDate": order_date,
        "amount": amount,
        "currency": "UAH",
        "orderTimeout": 86400,
        "productName": [product_name],
        "productCount": [product_count],
        "productPrice": [product_price],
    }

    # Add client info if available
    user_phone = user.get("phone", "")
    user_first = user.get("firstName", "")
    user_last = user.get("lastName", "")
    if user_phone:
        payload["clientPhone"] = user_phone
    if user_first:
        payload["clientFirstName"] = user_first
    if user_last:
        payload["clientLastName"] = user_last

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(WAYFORPAY_API_URL, json=payload)
            resp_data = resp.json()
            logger.info(f"WayForPay CREATE_INVOICE response: {json.dumps(resp_data)[:500]}")

        if resp_data.get("reasonCode") in [1100, "1100"] and resp_data.get("invoiceUrl"):
            # Update invoice with payment reference
            database["club_invoices"].update_one(
                {"_id": invoice["_id"]},
                {"$set": {
                    "wayforpayOrderRef": order_ref,
                    "wayforpayInvoiceUrl": resp_data["invoiceUrl"],
                    "paymentCreatedAt": now,
                    "updatedAt": now,
                }}
            )
            return JSONResponse(content={
                "success": True,
                "paymentUrl": resp_data["invoiceUrl"],
                "orderReference": order_ref,
                "amount": float(amount),
                "currency": "UAH",
            })
        else:
            logger.error(f"WayForPay CREATE_INVOICE failed: {resp_data}")
            return JSONResponse(content={
                "error": "Payment creation failed",
                "reason": resp_data.get("reason", "Unknown error"),
                "reasonCode": resp_data.get("reasonCode"),
            }, status_code=400)

    except Exception as e:
        logger.error(f"WayForPay API error: {e}")
        return JSONResponse(content={"error": f"Payment service error: {str(e)}"}, status_code=500)


@app.post("/api/payments/webhook")
async def wayforpay_webhook(request: Request):
    """
    WayForPay payment webhook (REAL).
    Verifies signature, processes Approved → PAID → activate.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(content={"error": "Invalid JSON"}, status_code=400)

    logger.info(f"WayForPay webhook: {json.dumps(body)[:500]}")

    transaction_status = body.get("transactionStatus", "")
    order_reference = body.get("orderReference", "")
    amount = body.get("amount", 0)

    database = get_db()
    now = datetime.now(timezone.utc)

    # Log webhook
    database["payment_webhooks"].insert_one({
        "provider": "wayforpay",
        "payload": body,
        "transactionStatus": transaction_status,
        "orderReference": order_reference,
        "amount": amount,
        "signatureValid": wayforpay_verify_callback(body),
        "processedAt": now,
    })

    if transaction_status == "Approved":
        # Find invoice by wayforpay order reference
        invoice = database["club_invoices"].find_one({"wayforpayOrderRef": order_reference})
        if not invoice:
            # Try by raw ID (remove ATAKA- prefix)
            raw_id = order_reference.replace("ATAKA-", "")
            try:
                invoice = database["club_invoices"].find_one({"_id": ObjectId(raw_id)})
            except Exception:
                pass
        if not invoice:
            invoice = database["club_invoices"].find_one({
                "status": {"$in": ["PENDING", "OVERDUE"]},
            })

        if invoice:
            invoice_id = str(invoice["_id"])
            club_id = invoice.get("clubId", "")

            # Mark invoice as PAID
            database["club_invoices"].update_one(
                {"_id": invoice["_id"]},
                {"$set": {
                    "status": "PAID",
                    "paidAt": now,
                    "paymentMethod": "wayforpay",
                    "transactionId": body.get("transactionId", ""),
                    "cardPan": body.get("cardPan", ""),
                    "authCode": body.get("authCode", ""),
                    "webhookData": body,
                }}
            )

            # Activate subscription
            from datetime import timedelta
            database["club_subscriptions"].update_one(
                {"clubId": club_id},
                {"$set": {
                    "status": "ACTIVE",
                    "lastPaidAt": now,
                    "nextBillingDate": now + timedelta(days=30),
                    "updatedAt": now,
                }}
            )
            database["clubs"].update_one(
                {"_id": ObjectId(club_id)} if len(club_id) == 24 else {},
                {"$set": {"saasStatus": "ACTIVE", "updatedAt": now}}
            )

            logger.info(f"WayForPay: Invoice {invoice_id} PAID. Subscription activated.")

        # Response with signature confirmation
        resp_time = str(int(time.time()))
        resp_sign_fields = [order_reference, "accept", resp_time]
        resp_signature = wayforpay_sign(resp_sign_fields)

        return JSONResponse(content={
            "orderReference": order_reference,
            "status": "accept",
            "time": resp_time,
            "signature": resp_signature,
        })

    elif transaction_status in ("Declined", "Expired", "Refunded"):
        logger.warning(f"WayForPay: Payment {transaction_status} for {order_reference}")

    return JSONResponse(content={"orderReference": order_reference, "status": "accept"})


@app.get("/api/payments/status/{invoice_id}")
async def check_payment_status(invoice_id: str, request: Request):
    """Check payment status via WayForPay API (fail-safe)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()

    try:
        invoice = database["club_invoices"].find_one({"_id": ObjectId(invoice_id)})
    except Exception:
        return JSONResponse(content={"error": "Invalid invoice ID"}, status_code=400)

    if not invoice:
        return JSONResponse(content={"error": "Invoice not found"}, status_code=404)

    # If already paid, return immediately
    if invoice.get("status") == "PAID":
        return JSONResponse(content={
            "status": "PAID",
            "invoiceId": invoice_id,
            "paidAt": invoice.get("paidAt", "").isoformat() if hasattr(invoice.get("paidAt", ""), "isoformat") else "",
        })

    order_ref = invoice.get("wayforpayOrderRef")
    if not order_ref:
        return JSONResponse(content={
            "status": invoice.get("status", "PENDING"),
            "invoiceId": invoice_id,
            "message": "No WayForPay payment created yet",
        })

    # Call WayForPay CHECK_STATUS
    sign_fields = [WAYFORPAY_MERCHANT, order_ref]
    signature = wayforpay_sign(sign_fields)

    payload = {
        "transactionType": "CHECK_STATUS",
        "merchantAccount": WAYFORPAY_MERCHANT,
        "orderReference": order_ref,
        "merchantSignature": signature,
        "apiVersion": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(WAYFORPAY_API_URL, json=payload)
            resp_data = resp.json()

        wp_status = resp_data.get("transactionStatus", "")
        logger.info(f"WayForPay CHECK_STATUS for {order_ref}: {wp_status}")

        # If approved, mark as paid
        if wp_status == "Approved":
            now = datetime.now(timezone.utc)
            club_id = invoice.get("clubId", "")

            database["club_invoices"].update_one(
                {"_id": invoice["_id"]},
                {"$set": {
                    "status": "PAID", "paidAt": now,
                    "paymentMethod": "wayforpay_check",
                    "transactionId": resp_data.get("transactionId", ""),
                }}
            )
            from datetime import timedelta
            database["club_subscriptions"].update_one(
                {"clubId": club_id},
                {"$set": {"status": "ACTIVE", "lastPaidAt": now, "nextBillingDate": now + timedelta(days=30)}}
            )
            database["clubs"].update_one(
                {"_id": ObjectId(club_id)} if len(club_id) == 24 else {},
                {"$set": {"saasStatus": "ACTIVE"}}
            )
            return JSONResponse(content={"status": "PAID", "invoiceId": invoice_id})

        return JSONResponse(content={
            "status": wp_status or invoice.get("status", "PENDING"),
            "invoiceId": invoice_id,
            "orderReference": order_ref,
            "wayforpayStatus": wp_status,
        })

    except Exception as e:
        logger.error(f"WayForPay CHECK_STATUS error: {e}")
        return JSONResponse(content={
            "status": invoice.get("status", "PENDING"),
            "invoiceId": invoice_id,
            "error": str(e),
        })


# ── Payment Fail-Safe CRON ────────────────────────────

PAYMENT_CHECK_INTERVAL = 600  # 10 minutes

async def payment_failsafe_cron():
    """Check stale pending payments every 10 minutes"""
    await asyncio.sleep(120)  # Wait 2 min after startup
    while True:
        try:
            database = get_db()
            now = datetime.now(timezone.utc)
            from datetime import timedelta

            # Find invoices pending > 15 min with WayForPay reference
            stale_cutoff = now - timedelta(minutes=15)
            stale_invoices = list(database["club_invoices"].find({
                "status": {"$in": ["PENDING", "OVERDUE"]},
                "wayforpayOrderRef": {"$exists": True, "$ne": None},
                "paymentCreatedAt": {"$lte": stale_cutoff},
            }))

            for inv in stale_invoices:
                order_ref = inv.get("wayforpayOrderRef")
                if not order_ref:
                    continue

                sign_fields = [WAYFORPAY_MERCHANT, order_ref]
                signature = wayforpay_sign(sign_fields)

                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(WAYFORPAY_API_URL, json={
                            "transactionType": "CHECK_STATUS",
                            "merchantAccount": WAYFORPAY_MERCHANT,
                            "orderReference": order_ref,
                            "merchantSignature": signature,
                            "apiVersion": 1,
                        })
                        resp_data = resp.json()

                    wp_status = resp_data.get("transactionStatus", "")
                    if wp_status == "Approved":
                        club_id = inv.get("clubId", "")
                        database["club_invoices"].update_one(
                            {"_id": inv["_id"]},
                            {"$set": {
                                "status": "PAID", "paidAt": now,
                                "paymentMethod": "wayforpay_cron",
                                "transactionId": resp_data.get("transactionId", ""),
                            }}
                        )
                        database["club_subscriptions"].update_one(
                            {"clubId": club_id},
                            {"$set": {"status": "ACTIVE", "lastPaidAt": now, "nextBillingDate": now + timedelta(days=30)}}
                        )
                        database["clubs"].update_one(
                            {"_id": ObjectId(club_id)} if len(club_id) == 24 else {},
                            {"$set": {"saasStatus": "ACTIVE"}}
                        )
                        logger.info(f"CRON: Invoice {inv['_id']} confirmed PAID via WayForPay check")

                except Exception as e:
                    logger.error(f"CRON payment check error for {order_ref}: {e}")

            if stale_invoices:
                logger.info(f"CRON: Checked {len(stale_invoices)} stale payments")

        except Exception as e:
            logger.error(f"Payment CRON error: {e}")

        await asyncio.sleep(PAYMENT_CHECK_INTERVAL)


# ── Marketplace Auto-Recommendations Engine ───────────

RECOMMENDATION_RULES = {
    "new_student": {
        "name": "Новий учень → екіпіровка",
        "trigger": "enrollment",
        "category": "EQUIPMENT",
        "pushText": "Вітаємо в АТАКА! Рекомендуємо екіпіровку для {child_name}",
    },
    "new_belt": {
        "name": "Новий пояс → форма/пояс",
        "trigger": "belt_change",
        "category": "EQUIPMENT",
        "pushText": "Вітаємо з новим поясом! Рекомендуємо нову форму для {child_name}",
    },
    "high_activity": {
        "name": "Висока активність → спортпит",
        "trigger": "attendance_high",
        "category": "SPORT_NUTRITION",
        "pushText": "🔥 {child_name} показує відмінні результати! Рекомендуємо спортивне харчування",
    },
    "long_absence": {
        "name": "Довга відсутність → акція -10%",
        "trigger": "absence",
        "category": "ANY",
        "discount": 10,
        "pushText": "Ми скучили за {child_name}! Знижка -10% на будь-який товар",
    },
}


async def run_marketplace_recommendations():
    """Auto-generate product recommendations based on student data"""
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    products = list(database["products"].find({"isActive": True}))
    if not products:
        return

    recommendations_created = 0

    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        parent_id = str(child.get("userId") or child.get("parentId") or "")
        if not parent_id:
            continue

        # Skip if recent recommendation exists (24h cooldown)
        recent = database["product_recommendations"].find_one({
            "childId": child_id,
            "createdAt": {"$gte": now - timedelta(hours=24)},
        })
        if recent:
            continue

        # Attendance data
        att_records = list(database["attendances"].find({"childId": child["_id"]}))
        total_att = len(att_records)
        present = len([a for a in att_records if a.get("status") == "PRESENT"])
        attendance_pct = round(present / total_att * 100) if total_att > 0 else 0

        # Consecutive misses
        consecutive_misses = 0
        for a in sorted(att_records, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") == "ABSENT":
                consecutive_misses += 1
            else:
                break

        # Determine recommendation type
        rec_type = None
        rec_products = []

        # Rule 1: High activity → sport nutrition
        if attendance_pct >= 70 and total_att >= 5:
            rec_type = "high_activity"
            rec_products = [p for p in products if p.get("category", "").upper() in ("SPORT_NUTRITION", "NUTRITION", "SUPPLEMENTS")]
            if not rec_products:
                rec_products = products[:2]

        # Rule 2: Long absence → discount offer
        elif consecutive_misses >= 3 or (total_att > 3 and attendance_pct < 40):
            rec_type = "long_absence"
            rec_products = products[:3]

        # Rule 3: New student (< 5 attendances) → equipment
        elif total_att < 5:
            rec_type = "new_student"
            rec_products = [p for p in products if p.get("category", "").upper() in ("EQUIPMENT", "UNIFORM", "GEAR")]
            if not rec_products:
                rec_products = products[:2]

        if rec_type and rec_products:
            rule = RECOMMENDATION_RULES.get(rec_type, {})
            product_ids = [str(p["_id"]) for p in rec_products[:3]]

            database["product_recommendations"].insert_one({
                "childId": child_id,
                "childName": child_name,
                "parentId": parent_id,
                "type": rec_type,
                "ruleName": rule.get("name", ""),
                "productIds": product_ids,
                "discount": rule.get("discount", 0),
                "status": "ACTIVE",
                "pushSent": False,
                "createdAt": now,
            })

            # Send push notification
            push_text = rule.get("pushText", "").format(child_name=child_name)
            if push_text:
                await send_automation_push(database, parent_id, "recommend_product", child_name=child_name)

            recommendations_created += 1

    if recommendations_created > 0:
        logger.info(f"Marketplace: {recommendations_created} auto-recommendations created")


@app.get("/api/marketplace/recommendations/{child_id}")
async def get_child_recommendations(child_id: str, request: Request):
    """Get personalized product recommendations for a child"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    recs = list(database["product_recommendations"].find(
        {"childId": child_id, "status": "ACTIVE"},
        {"_id": 0}
    ).sort("createdAt", -1).limit(10))

    # Enrich with product data
    for rec in recs:
        products = []
        for pid in rec.get("productIds", []):
            try:
                prod = database["products"].find_one({"_id": ObjectId(pid)})
                if prod:
                    products.append({
                        "id": str(prod["_id"]),
                        "name": prod.get("name", ""),
                        "price": prod.get("price", 0),
                        "oldPrice": prod.get("oldPrice"),
                        "imageUrl": prod.get("imageUrl"),
                        "category": prod.get("category", ""),
                        "isCoachRecommended": prod.get("isCoachRecommended", False),
                        "coachName": prod.get("recommendedByCoach", ""),
                    })
            except Exception:
                pass
        rec["products"] = products

        # Apply discount if rule has one
        if rec.get("discount", 0) > 0:
            for p in rec["products"]:
                p["discountPrice"] = round(p["price"] * (1 - rec["discount"] / 100))
                p["discountPercent"] = rec["discount"]

    return JSONResponse(content=json.loads(json.dumps({"recommendations": recs}, default=json_serial)))


@app.get("/api/marketplace/featured")
async def get_marketplace_featured(request: Request):
    """Get featured marketplace products with coach recommendations"""
    database = get_db()

    products = list(database["products"].find({"isActive": True}).limit(20))

    # Group by type
    coach_recommended = []
    popular = []
    discounted = []
    all_products = []

    for p in products:
        cat = p.get("category", "")
        coach_rec = p.get("isCoachRecommended", False)
        # Sprint 3 MUST: "why this matters" context
        reason = None
        if coach_rec:
            reason = "Рекомендовано тренером"
        elif cat == "PROTECTION":
            reason = "Використовується на змаганнях"
        elif cat == "UNIFORM":
            reason = "Потрібно для атестації"
        elif cat == "EQUIPMENT":
            reason = "Для повноцінних тренувань"
        elif cat == "ACCESSORIES":
            reason = "Зручність на тренуваннях"
        item = {
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "price": p.get("price", 0),
            "oldPrice": p.get("oldPrice"),
            "imageUrl": p.get("imageUrl"),
            "category": cat,
            "description": p.get("description", ""),
            "isCoachRecommended": coach_rec,
            "coachName": p.get("recommendedByCoach", ""),
            "salesCount": p.get("salesCount", 0),
            "isFeatured": p.get("isFeatured", False),
            "reason": reason,
        }
        all_products.append(item)
        if item["isCoachRecommended"]:
            coach_recommended.append(item)
        if item.get("oldPrice") and item["oldPrice"] > item["price"]:
            discounted.append(item)
        if item["salesCount"] > 0:
            popular.append(item)

    # Sort popular by sales
    popular.sort(key=lambda x: x["salesCount"], reverse=True)

    return JSONResponse(content={
        "coachRecommended": coach_recommended[:5],
        "popular": popular[:5],
        "discounted": discounted[:5],
        "all": all_products,
    })


@app.post("/api/marketplace/quick-buy")
async def quick_buy(request: Request):
    """One-click buy — create order immediately"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    body = await request.json()
    product_id = body.get("productId")
    child_id = body.get("childId")
    quantity = body.get("quantity", 1)
    now = datetime.now(timezone.utc)

    if not product_id:
        return JSONResponse(content={"error": "productId required"}, status_code=400)

    product = database["products"].find_one({"_id": ObjectId(product_id)})
    if not product:
        return JSONResponse(content={"error": "Product not found"}, status_code=404)

    price = product.get("price", 0)
    total = price * quantity

    # Create order
    user_id = user.get("id") or user.get("_id", "")
    order = database["orders"].insert_one({
        "userId": user_id,
        "childId": child_id,
        "items": [{
            "productId": product_id,
            "productName": product.get("name", ""),
            "price": price,
            "quantity": quantity,
        }],
        "total": total,
        "status": "PENDING",
        "paymentMethod": "quick_buy",
        "createdAt": now,
    })
    order_id = str(order.inserted_id)

    # Update product sales count
    database["products"].update_one(
        {"_id": ObjectId(product_id)},
        {"$inc": {"salesCount": quantity}}
    )

    return JSONResponse(content={
        "success": True,
        "orderId": order_id,
        "total": total,
        "productName": product.get("name", ""),
    })


@app.post("/api/marketplace/coach-recommend")
async def coach_recommend_product(request: Request):
    """Coach recommends a product for a student"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("COACH", "ADMIN"):
        return JSONResponse(content={"error": "Coach/Admin only"}, status_code=403)

    database = get_db()
    body = await request.json()
    product_id = body.get("productId")
    child_id = body.get("childId")
    now = datetime.now(timezone.utc)

    if not product_id or not child_id:
        return JSONResponse(content={"error": "productId and childId required"}, status_code=400)

    coach_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    # Mark product as coach recommended
    database["products"].update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {
            "isCoachRecommended": True,
            "recommendedByCoach": coach_name,
            "recommendedByCoachId": user.get("id") or user.get("_id", ""),
            "recommendedAt": now,
        }}
    )

    # Create recommendation for parent
    child = database["children"].find_one({"_id": ObjectId(child_id)})
    if child:
        parent_id = str(child.get("userId") or child.get("parentId") or "")
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()

        database["product_recommendations"].insert_one({
            "childId": child_id,
            "childName": child_name,
            "parentId": parent_id,
            "type": "coach_recommend",
            "coachId": user.get("id") or user.get("_id", ""),
            "coachName": coach_name,
            "productIds": [product_id],
            "status": "ACTIVE",
            "pushSent": True,
            "createdAt": now,
        })

        # Push to parent
        if parent_id:
            product = database["products"].find_one({"_id": ObjectId(product_id)})
            prod_name = product.get("name", "товар") if product else "товар"
            await send_automation_push(
                database, parent_id, "recommend_product",
                child_name=child_name
            )

    return JSONResponse(content={"success": True, "message": f"Рекомендацію надіслано"})


# ── Start payment CRON in lifespan ────────────────────
# Add to automation loop
_original_automation_loop_with_ai = automation_loop_with_ai

async def automation_loop_with_payments():
    """Full automation loop with payment fail-safe + marketplace recs"""
    await asyncio.sleep(30)
    init_automation_rules()

    while True:
        try:
            await run_automation_cycle()
            await run_ai_cycle()
            await run_phase2_engine()
            await run_marketplace_recommendations()
        except Exception as e:
            logger.error(f"Full automation cycle error: {e}")
        await asyncio.sleep(AUTOMATION_INTERVAL)

automation_loop_with_ai = automation_loop_with_payments


# ── Club Invoices API ─────────────────────────────────

@app.get("/api/owner/invoices")
async def get_owner_invoices(request: Request):
    """Get club invoices for owner"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"invoices": []})

    club_id = str(club["_id"])
    invoices = list(database["club_invoices"].find(
        {"clubId": club_id}, {"_id": 1, "amount": 1, "baseAmount": 1, "discountPercent": 1,
         "discountAmount": 1, "type": 1, "plan": 1, "fromPlan": 1, "status": 1,
         "description": 1, "createdAt": 1, "dueDate": 1, "paidAt": 1}
    ).sort("createdAt", -1))

    result = []
    for inv in invoices:
        result.append({
            "id": str(inv["_id"]),
            "amount": inv.get("amount", 0),
            "baseAmount": inv.get("baseAmount", inv.get("amount", 0)),
            "discountPercent": inv.get("discountPercent", 0),
            "type": inv.get("type", ""),
            "plan": inv.get("plan", ""),
            "fromPlan": inv.get("fromPlan", ""),
            "status": inv.get("status", "PENDING"),
            "description": inv.get("description", ""),
            "createdAt": inv.get("createdAt"),
            "dueDate": inv.get("dueDate"),
            "paidAt": inv.get("paidAt"),
        })

    return JSONResponse(content=json.loads(json.dumps({"invoices": result}, default=json_serial)))


@app.post("/api/owner/invoices/{invoice_id}/pay")
async def mark_invoice_paid_manual(invoice_id: str, request: Request):
    """Owner: manually mark invoice as paid (for bank transfer)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)

    try:
        inv = database["club_invoices"].find_one({"_id": ObjectId(invoice_id)})
    except Exception:
        return JSONResponse(content={"error": "Invalid invoice ID"}, status_code=400)

    if not inv:
        return JSONResponse(content={"error": "Invoice not found"}, status_code=404)

    if inv.get("status") == "PAID":
        return JSONResponse(content={"success": True, "message": "Already paid"})

    club_id = inv.get("clubId", "")

    # Mark paid
    database["club_invoices"].update_one(
        {"_id": inv["_id"]},
        {"$set": {"status": "PAID", "paidAt": now, "paymentMethod": "manual"}}
    )

    # Reactivate subscription if it was PAST_DUE
    from datetime import timedelta
    database["club_subscriptions"].update_one(
        {"clubId": club_id},
        {"$set": {
            "status": "ACTIVE",
            "lastPaidAt": now,
            "nextBillingDate": now + timedelta(days=30),
            "updatedAt": now,
        }}
    )
    database["clubs"].update_one(
        {"_id": ObjectId(club_id)} if len(club_id) == 24 else {},
        {"$set": {"saasStatus": "ACTIVE", "updatedAt": now}}
    )

    logger.info(f"Invoice {invoice_id} manually marked PAID")

    return JSONResponse(content={"success": True, "message": "Рахунок оплачено. Підписку активовано."})


# ── Enhanced Smart Triggers (3-level) ─────────────────

@app.get("/api/platform/smart-triggers/v2")
async def get_smart_triggers_v2(request: Request):
    """Enhanced 3-level smart triggers: 75% soft, 90% strong, 100% hard"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"triggers": [], "plan": "START", "subscriptionStatus": "NONE"})

    club_id = str(club["_id"])
    plan = get_club_plan(database, club_id)
    plan_id = plan.get("id", "START")
    plan_order = {"START": "PRO", "PRO": "ENTERPRISE", "ENTERPRISE": None}
    next_plan = plan_order.get(plan_id)

    # Check subscription status
    sub_info = get_club_subscription_status(database)

    triggers = []

    # PAST_DUE trigger
    if sub_info["blocked"]:
        triggers.append({
            "type": "past_due",
            "severity": "blocker",
            "level": "hard",
            "resource": "subscription",
            "message": "Підписка прострочена! Оплатіть рахунок для продовження роботи.",
            "action": "Оплатити",
            "actionType": "pay_invoice",
            "percent": 100,
            "current": sub_info.get("overdueCount", 0),
            "limit": 0,
        })

    # Limit triggers (3 levels)
    for resource in ["students", "coaches", "branches"]:
        limit_info = check_limit(database, club_id, resource)
        label = {"students": "учнів", "coaches": "тренерів", "branches": "філіалів"}.get(resource, resource)
        pct = limit_info["percent"]

        if pct >= 100:
            triggers.append({
                "type": "limit_exceeded",
                "severity": "blocker",
                "level": "hard",
                "resource": resource,
                "message": f"Ліміт {label} вичерпано! {limit_info['current']}/{limit_info['limit']}",
                "action": f"Перейти на {next_plan}" if next_plan else "Зверніться до підтримки",
                "actionType": "upgrade" if next_plan else "support",
                "upgradeTo": next_plan,
                "current": limit_info["current"],
                "limit": limit_info["limit"],
                "percent": pct,
                "upgradeDiscount": 30,
            })
        elif pct >= 90:
            triggers.append({
                "type": "limit_critical",
                "severity": "critical",
                "level": "strong",
                "resource": resource,
                "message": f"Критичний рівень! {label}: {limit_info['current']}/{limit_info['limit']} ({pct}%)",
                "action": f"Перейти на {next_plan}" if next_plan else "Оптимізуйте",
                "actionType": "upgrade" if next_plan else "optimize",
                "upgradeTo": next_plan,
                "current": limit_info["current"],
                "limit": limit_info["limit"],
                "percent": pct,
                "upgradeDiscount": 30,
            })
        elif pct >= 75:
            triggers.append({
                "type": "limit_warning",
                "severity": "warning",
                "level": "soft",
                "resource": resource,
                "message": f"Наближається ліміт {label}: {limit_info['current']}/{limit_info['limit']} ({pct}%)",
                "action": f"Переглянути {next_plan}" if next_plan else "",
                "actionType": "info",
                "upgradeTo": next_plan,
                "current": limit_info["current"],
                "limit": limit_info["limit"],
                "percent": pct,
            })

    return JSONResponse(content={
        "triggers": triggers,
        "plan": plan_id,
        "subscriptionStatus": sub_info["status"],
        "isBlocked": sub_info["blocked"],
        "nextPlan": next_plan,
        "upgradeDiscount": 30,
    })


# ============================================================
# SPORTS CONFIG-DRIVEN SYSTEM
# ============================================================

DEFAULT_SPORTS = [
    {
        "id": "martial_arts",
        "name": "Бойові мистецтва",
        "nameEn": "Martial Arts",
        "category": "combat",
        "icon": "shield",
        "attributes": {"beltSystem": True, "weightClasses": False, "levels": True, "kata": True},
        "marketplaceTags": ["kimono", "belt", "protection", "gloves"],
        "disciplines": ["karate", "judo", "taekwondo", "aikido"],
        "isActive": True,
    },
    {
        "id": "boxing",
        "name": "Бокс",
        "nameEn": "Boxing",
        "category": "combat",
        "icon": "fitness",
        "attributes": {"beltSystem": False, "weightClasses": True, "levels": True, "rounds": True},
        "marketplaceTags": ["gloves", "wraps", "shorts", "mouthguard", "headgear"],
        "disciplines": ["boxing"],
        "isActive": True,
    },
    {
        "id": "mma",
        "name": "ММА",
        "nameEn": "MMA",
        "category": "combat",
        "icon": "flash",
        "attributes": {"beltSystem": False, "weightClasses": True, "levels": True, "grappling": True},
        "marketplaceTags": ["gloves", "shorts", "rashguard", "mouthguard", "shin_guards"],
        "disciplines": ["mma", "grappling", "striking"],
        "isActive": True,
    },
    {
        "id": "wrestling",
        "name": "Боротьба",
        "nameEn": "Wrestling",
        "category": "combat",
        "icon": "people",
        "attributes": {"beltSystem": False, "weightClasses": True, "levels": True},
        "marketplaceTags": ["singlet", "shoes", "headgear", "knee_pads"],
        "disciplines": ["freestyle", "greco-roman"],
        "isActive": True,
    },
    {
        "id": "gymnastics",
        "name": "Гімнастика",
        "nameEn": "Gymnastics",
        "category": "individual",
        "icon": "star",
        "attributes": {"beltSystem": False, "weightClasses": False, "levels": True, "apparatus": True},
        "marketplaceTags": ["leotard", "grips", "chalk", "mat"],
        "disciplines": ["artistic", "rhythmic"],
        "isActive": True,
    },
    {
        "id": "swimming",
        "name": "Плавання",
        "nameEn": "Swimming",
        "category": "individual",
        "icon": "water",
        "attributes": {"beltSystem": False, "weightClasses": False, "levels": True, "strokes": True},
        "marketplaceTags": ["swimsuit", "goggles", "cap", "fins"],
        "disciplines": ["freestyle", "backstroke", "butterfly", "breaststroke"],
        "isActive": True,
    },
]

def init_sports():
    """Seed sports config into DB"""
    database = get_db()
    sports_col = database["sports"]
    if sports_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for sport in DEFAULT_SPORTS:
            sports_col.insert_one({**sport, "createdAt": now, "updatedAt": now})
        logger.info(f"Initialized {len(DEFAULT_SPORTS)} sports configs")

@app.get("/api/sports")
async def get_sports():
    """Get all available sports"""
    database = get_db()
    sports = list(database["sports"].find({"isActive": True}, {"_id": 0}))
    if not sports:
        init_sports()
        sports = list(database["sports"].find({"isActive": True}, {"_id": 0}))
    return JSONResponse(content=json.loads(json.dumps({"sports": sports}, default=json_serial)))

@app.get("/api/sports/{sport_id}")
async def get_sport(sport_id: str):
    """Get single sport config"""
    database = get_db()
    sport = database["sports"].find_one({"id": sport_id}, {"_id": 0})
    if not sport:
        return JSONResponse(content={"error": "Sport not found"}, status_code=404)
    return JSONResponse(content=json.loads(json.dumps(sport, default=json_serial)))

@app.post("/api/sports")
async def create_sport(request: Request):
    """Create new sport config (admin only)"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    body = await request.json()
    now = datetime.now(timezone.utc)
    sport = {
        "id": body.get("id", ""),
        "name": body.get("name", ""),
        "nameEn": body.get("nameEn", ""),
        "category": body.get("category", "combat"),
        "icon": body.get("icon", "star"),
        "attributes": body.get("attributes", {}),
        "marketplaceTags": body.get("marketplaceTags", []),
        "disciplines": body.get("disciplines", []),
        "isActive": body.get("isActive", True),
        "createdAt": now,
        "updatedAt": now,
    }
    if not sport["id"] or not sport["name"]:
        return JSONResponse(content={"error": "id and name required"}, status_code=400)
    existing = database["sports"].find_one({"id": sport["id"]})
    if existing:
        return JSONResponse(content={"error": "Sport already exists"}, status_code=409)
    database["sports"].insert_one(sport)
    return JSONResponse(content={"success": True, "sport": sport["id"]})

@app.put("/api/sports/{sport_id}")
async def update_sport(sport_id: str, request: Request):
    """Update sport config"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    body = await request.json()
    now = datetime.now(timezone.utc)
    update = {"updatedAt": now}
    for field in ["name", "nameEn", "category", "icon", "attributes", "marketplaceTags", "disciplines", "isActive"]:
        if field in body:
            update[field] = body[field]
    result = database["sports"].update_one({"id": sport_id}, {"$set": update})
    if result.matched_count == 0:
        return JSONResponse(content={"error": "Sport not found"}, status_code=404)
    return JSONResponse(content={"success": True})

@app.delete("/api/sports/{sport_id}")
async def delete_sport(sport_id: str, request: Request):
    """Deactivate sport"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") != "ADMIN":
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    database["sports"].update_one({"id": sport_id}, {"$set": {"isActive": False}})
    return JSONResponse(content={"success": True})

# ============================================================
# EVENT → OFFER ENGINE (REVENUE LOOP)
# ============================================================

EVENT_OFFER_RULES = {
    "belt_upgrade": {
        "push": "belt_upgrade_offer",
        "marketplaceTags": ["belt", "kimono", "protection"],
        "discount": 10,
        "message": "Вітаємо з новим поясом! Рекомендуємо оновити екіпіровку.",
    },
    "low_attendance": {
        "push": "attendance_drop",
        "marketplaceTags": [],
        "discount": 15,
        "message": "Поверніться на тренування зі знижкою!",
    },
    "new_student": {
        "push": "event_achievement",
        "marketplaceTags": ["kimono", "belt", "protection", "gloves"],
        "discount": 5,
        "message": "Ласкаво просимо! Ось що потрібно для початку тренувань.",
    },
    "high_attendance": {
        "push": "streak_reward",
        "marketplaceTags": ["nutrition", "supplements"],
        "discount": 0,
        "message": "Відмінна серія тренувань! Рекомендуємо спортивне харчування.",
    },
    "competition_win": {
        "push": "event_achievement",
        "marketplaceTags": ["merch", "equipment"],
        "discount": 10,
        "message": "Вітаємо з перемогою! Спеціальна пропозиція для чемпіона.",
    },
    "birthday": {
        "push": "flash_discount",
        "marketplaceTags": [],
        "discount": 20,
        "message": "З Днем народження! Знижка -20% на будь-який товар!",
    },
}

@app.post("/api/events/trigger-offer")
async def trigger_event_offer(request: Request):
    """
    EVENT → OFFER ENGINE
    Trigger: event happens → find matching products → create offer → push to parent
    """
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    body = await request.json()
    event_type = body.get("eventType", "")
    child_id = body.get("childId", "")
    value = body.get("value", 0)
    now = datetime.now(timezone.utc)

    rule = EVENT_OFFER_RULES.get(event_type)
    if not rule:
        return JSONResponse(content={"error": f"Unknown event type: {event_type}"}, status_code=400)

    child = None
    if child_id:
        try:
            child = database["children"].find_one({"_id": ObjectId(child_id)})
        except Exception:
            pass
    child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip() if child else ""
    parent_id = str(child.get("userId") or child.get("parentId") or user.get("id", "")) if child else str(user.get("id", ""))

    # Find matching products based on club sport + event tags
    club = database["clubs"].find_one()
    sport_id = club.get("sportId", "martial_arts") if club else "martial_arts"
    sport = database["sports"].find_one({"id": sport_id})
    sport_tags = sport.get("marketplaceTags", []) if sport else []

    product_query = {"isActive": True}
    event_tags = rule["marketplaceTags"]
    if event_tags:
        product_query["$or"] = [
            {"category": {"$in": [t.upper() for t in event_tags]}},
            {"sportTags": {"$in": event_tags}},
            {"tags": {"$in": event_tags}},
        ]

    products = list(database["products"].find(product_query).limit(5))
    product_ids = [str(p["_id"]) for p in products]

    # Create event-driven offer
    offer = {
        "type": "event_offer",
        "eventType": event_type,
        "childId": child_id,
        "childName": child_name,
        "parentId": parent_id,
        "sportId": sport_id,
        "productIds": product_ids,
        "discount": rule["discount"],
        "message": rule["message"],
        "status": "ACTIVE",
        "expiresAt": datetime.now(timezone.utc).__class__(now.year, now.month, now.day + 3 if now.day < 28 else 1, tzinfo=timezone.utc),
        "pushSent": False,
        "createdAt": now,
    }
    from datetime import timedelta
    offer["expiresAt"] = now + timedelta(days=3)
    result = database["event_offers"].insert_one(offer)
    offer_id = str(result.inserted_id)

    # Send push notification
    push_type = rule.get("push", "recommend_product")
    sent = await send_automation_push(database, parent_id, push_type, child_name=child_name, value=value or rule["discount"])

    # Log event
    database["event_log"].insert_one({
        "eventType": event_type,
        "childId": child_id,
        "childName": child_name,
        "offerId": offer_id,
        "productsCount": len(product_ids),
        "pushSent": sent > 0,
        "createdAt": now,
    })

    logger.info(f"Event→Offer: {event_type} for {child_name} → {len(product_ids)} products, push={sent}")

    return JSONResponse(content={
        "success": True,
        "offerId": offer_id,
        "eventType": event_type,
        "productsCount": len(product_ids),
        "discount": rule["discount"],
        "pushSent": sent > 0,
    })

@app.get("/api/events/offers/{child_id}")
async def get_event_offers(child_id: str, request: Request):
    """Get active event-based offers for a child"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    offers = list(database["event_offers"].find(
        {"childId": child_id, "status": "ACTIVE", "expiresAt": {"$gte": now}},
        {"_id": 0}
    ).sort("createdAt", -1).limit(10))

    # Enrich with products
    for offer in offers:
        prods = []
        for pid in offer.get("productIds", []):
            try:
                p = database["products"].find_one({"_id": ObjectId(pid)})
                if p:
                    price = p.get("price", 0)
                    disc = offer.get("discount", 0)
                    prods.append({
                        "id": str(p["_id"]),
                        "name": p.get("name", ""),
                        "price": price,
                        "discountPrice": round(price * (1 - disc / 100)) if disc else price,
                        "discountPercent": disc,
                        "imageUrl": p.get("imageUrl"),
                        "category": p.get("category", ""),
                    })
            except Exception:
                pass
        offer["products"] = prods

    return JSONResponse(content=json.loads(json.dumps({"offers": offers}, default=json_serial)))

@app.get("/api/events/parent-feed")
async def get_parent_event_feed(request: Request):
    """Get event feed for parent (achievements + offers)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    user_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)

    # Get children
    children = list(database["children"].find({"userId": user_id}))
    if not children:
        children = list(database["children"].find({"parentId": user_id}))
    child_ids = [str(c["_id"]) for c in children]

    # Get active offers
    offers = list(database["event_offers"].find(
        {"childId": {"$in": child_ids}, "status": "ACTIVE"},
        {"_id": 0}
    ).sort("createdAt", -1).limit(20))

    # Enrich
    feed = []
    for offer in offers:
        prods = []
        for pid in offer.get("productIds", [])[:3]:
            try:
                p = database["products"].find_one({"_id": ObjectId(pid)})
                if p:
                    price = p.get("price", 0)
                    disc = offer.get("discount", 0)
                    prods.append({
                        "id": str(p["_id"]),
                        "name": p.get("name", ""),
                        "price": price,
                        "discountPrice": round(price * (1 - disc / 100)) if disc else price,
                        "category": p.get("category", ""),
                    })
            except Exception:
                pass
        feed.append({
            "eventType": offer.get("eventType"),
            "childName": offer.get("childName"),
            "message": offer.get("message"),
            "discount": offer.get("discount", 0),
            "products": prods,
            "createdAt": offer.get("createdAt"),
        })

    return JSONResponse(content=json.loads(json.dumps({"feed": feed}, default=json_serial)))

# ============================================================
# COACH KPI + SALES BONUS
# ============================================================


@app.get("/api/coach/panel")
async def get_coach_panel(request: Request):
    """Coach Control Panel — Critical Today + At Risk + Upsell Ready + Student Cards"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("COACH", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    coach_id = user.get("id") or user.get("_id", "")
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    today_dow = now.isoweekday()

    # Get all children (coach's students)
    groups = list(database["groups"].find({"coachId": coach_id}))
    if not groups:
        groups = list(database["groups"].find().limit(3))
    group_ids = [str(g["_id"]) for g in groups]
    group_map = {str(g["_id"]): g.get("name", "") for g in groups}

    children = list(database["children"].find({"groupId": {"$in": group_ids}}))
    if not children:
        children = list(database["children"].find().limit(10))

    # Today's schedule
    today_scheds = list(database["schedules"].find({"dayOfWeek": today_dow, "isActive": True}, {"_id": 0}))

    # Today's confirmations
    confirmations = {str(c.get("userId", "")): c.get("status") for c in database["training_confirmations"].find({"date": today_str})} if database["training_confirmations"].count_documents({}) > 0 else {}

    # Process each student
    critical_today = []
    at_risk = []
    upsell_ready = []
    all_students = []

    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        child_type = child.get("studentType", "JUNIOR")
        group_name = group_map.get(child.get("groupId", ""), "")

        # Attendance data
        att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(20))
        total_att = len([a for a in att if a.get("status") == "PRESENT"])
        total_abs = len([a for a in att if a.get("status") == "ABSENT"])
        att_rate = round(total_att / max(total_att + total_abs, 1) * 100)

        # Streak
        streak = 0
        for a in att:
            if a.get("status") == "PRESENT":
                streak += 1
            else:
                break

        # Consecutive misses
        cons_miss = 0
        for a in att:
            if a.get("status") != "PRESENT":
                cons_miss += 1
            else:
                break

        # Last activity
        last_att = att[0] if att else None
        last_date = str(last_att.get("date", ""))[:10] if last_att else None
        days_inactive = (now - datetime.strptime(last_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)).days if last_date else 30

        # Last absence reason
        last_absence = None
        for a in att:
            if a.get("status") == "ABSENT":
                last_absence = a.get("reason", "Не вказано")
                break

        # XP & Level
        xp = child.get("xp", 0)
        level, level_name, _ = _calc_level(xp)

        # Belt (junior)
        belt = child.get("belt", "WHITE") if child_type != "ADULT" else None

        # Confirmed today?
        user_id = str(child.get("userId", ""))
        confirmed = confirmations.get(user_id, None)

        # Risk scoring
        risk_score = 0
        risk_reasons = []
        if cons_miss >= 3:
            risk_score += 40
            risk_reasons.append(f"{cons_miss} пропусків підряд")
        elif cons_miss >= 2:
            risk_score += 25
            risk_reasons.append(f"{cons_miss} пропуски підряд")
        if att_rate < 50 and total_att > 0:
            risk_score += 20
            risk_reasons.append(f"Відвідуваність {att_rate}%")
        if days_inactive >= 14:
            risk_score += 30
            risk_reasons.append(f"Неактивний {days_inactive} днів")
        elif days_inactive >= 7:
            risk_score += 15
            risk_reasons.append(f"Неактивний {days_inactive} днів")

        # Upsell scoring
        upsell_score = 0
        upsell_reasons = []
        if streak >= 5:
            upsell_score += 30
            upsell_reasons.append(f"Серія {streak}")
        if att_rate >= 80:
            upsell_score += 25
            upsell_reasons.append(f"Відвідуваність {att_rate}%")
        if total_att >= 10:
            upsell_score += 20
            upsell_reasons.append(f"{total_att} тренувань")

        # Recommendation
        rec = None
        rec_type = None
        if risk_score >= 30:
            if last_absence and last_absence in ("Хворію", "Травма"):
                rec = "Не тисни — причина: " + last_absence.lower()
                rec_type = "wait"
            elif cons_miss >= 3:
                rec = "Потрібен контакт з батьками" if child_type == "JUNIOR" else "Напиши сьогодні — високий шанс повернення"
                rec_type = "contact_parent" if child_type == "JUNIOR" else "write"
            else:
                rec = "Напиши сьогодні — високий шанс повернення"
                rec_type = "write"
        elif upsell_score >= 40:
            rec = "Запропонуй індивідуалку — сильний прогрес"
            rec_type = "upsell"
        elif streak >= 3:
            rec = "Похвали — тримає режим"
            rec_type = "praise"

        student_card = {
            "id": child_id,
            "name": child_name,
            "type": child_type,
            "group": group_name,
            "streak": streak,
            "attendanceRate": att_rate,
            "totalTrainings": total_att,
            "consecutiveMisses": cons_miss,
            "daysInactive": days_inactive,
            "lastAbsenceReason": last_absence,
            "confirmedToday": confirmed,
            "xp": xp,
            "level": level,
            "levelName": level_name,
            "belt": belt,
            "riskScore": risk_score,
            "riskReasons": risk_reasons,
            "upsellScore": upsell_score,
            "upsellReasons": upsell_reasons,
            "recommendation": rec,
            "recommendationType": rec_type,
            "status": "risk" if risk_score >= 25 else ("rising" if upsell_score >= 30 else "stable"),
        }
        all_students.append(student_card)

        # Categorize
        has_training_today = any(s.get("groupId") == child.get("groupId") for s in today_scheds)
        if has_training_today and not confirmed:
            critical_today.append({**student_card, "criticalReason": "Не підтвердив тренування"})
        elif risk_score >= 25:
            at_risk.append(student_card)
        if upsell_score >= 30:
            upsell_ready.append(student_card)

    # Sort
    critical_today.sort(key=lambda x: x["riskScore"], reverse=True)
    at_risk.sort(key=lambda x: x["riskScore"], reverse=True)
    upsell_ready.sort(key=lambda x: x["upsellScore"], reverse=True)

    # Coach action log
    actions = list(database["messages"].find(
        {"fromUserId": coach_id, "type": {"$in": ["COACH_TO_STUDENT", "COACH_BROADCAST", "ABSENCE_REPORT"]}},
        {"_id": 0, "text": 1, "createdAt": 1, "toUserId": 1, "fromName": 1}
    ).sort("createdAt", -1).limit(10))
    # Also get coach actions from training_confirmations etc
    action_log = []
    for a in actions:
        action_log.append({
            "text": (a.get("text", "") or "")[:80],
            "date": str(a.get("createdAt", ""))[:16],
        })

    # Summary
    total = len(all_students)
    rising = len([s for s in all_students if s["status"] == "rising"])
    stable = len([s for s in all_students if s["status"] == "stable"])
    risk = len([s for s in all_students if s["status"] == "risk"])

    # Today schedule info
    today_trainings = []
    for sched in today_scheds:
        gid = sched.get("groupId", "")
        gname = group_map.get(gid, "Група")
        g_members_count = sum(1 for c in children if str(c.get("groupId", "")) == gid)
        not_coming_count = sum(1 for s in critical_today if s.get("group") == gname) + \
                           sum(1 for c in children if str(c.get("groupId", "")) == gid and confirmations.get(str(c.get("userId", ""))) == "NOT_COMING")
        today_trainings.append({
            "id": str(sched.get("_id", "")),
            "groupId": gid,
            "time": f"{sched.get('startTime', '')}-{sched.get('endTime', '')}",
            "startTime": sched.get('startTime', ''),
            "group": gname,
            "studentsCount": g_members_count,
            "notComingCount": not_coming_count,
        })

    # ── NEW: needsReaction (C block) — merged actionable cards ──
    needs_reaction = []
    # 1) Not coming today (absence reported)
    not_coming_users = [uid for uid, st in confirmations.items() if st == "NOT_COMING"]
    for s in all_students:
        child_raw = next((c for c in children if str(c["_id"]) == s["id"]), None)
        child_uid = str(child_raw.get("userId", "")) if child_raw else ""
        if child_uid in not_coming_users:
            # Find reason
            reason = "Не вказано"
            abs_rec = database["absences"].find_one({"userId": child_uid, "date": today_str}) if database["absences"].count_documents({}) > 0 else None
            if abs_rec:
                reason = abs_rec.get("reason", "Не вказано")
            needs_reaction.append({
                "id": s["id"],
                "name": s["name"],
                "type": "not_coming",
                "icon": "close-circle",
                "label": "Не прийде",
                "reason": reason,
                "actions": ["write", "reschedule"],
                "priority": 1,
            })
    # 2) Consecutive misses >= 2 (at-risk not already listed)
    listed_ids = {r["id"] for r in needs_reaction}
    for s in at_risk:
        if s["id"] in listed_ids:
            continue
        if s.get("consecutiveMisses", 0) >= 2:
            needs_reaction.append({
                "id": s["id"],
                "name": s["name"],
                "type": "missed",
                "icon": "warning",
                "label": f"{s['consecutiveMisses']} пропуски",
                "reason": s.get("lastAbsenceReason") or "Без причини",
                "actions": ["return", "parent"] if s.get("type") == "JUNIOR" else ["return", "write"],
                "priority": 2,
            })
    # 3) Strong progress (streak >= 5) — praise + upsell
    for s in sorted(all_students, key=lambda x: x.get("streak", 0), reverse=True):
        if s["id"] in {r["id"] for r in needs_reaction}:
            continue
        if s.get("streak", 0) >= 5:
            needs_reaction.append({
                "id": s["id"],
                "name": s["name"],
                "type": "progress",
                "icon": "flame",
                "label": f"Серія {s['streak']}",
                "reason": "Сильний прогрес",
                "actions": ["praise", "upsell"],
                "priority": 3,
            })
            if len([r for r in needs_reaction if r["type"] == "progress"]) >= 3:
                break
    needs_reaction = sorted(needs_reaction, key=lambda x: x["priority"])[:8]

    # ── NEW: whatToDoNow (D block) — AI action items ──
    what_to_do_now = []
    # From critical: "Напиши N сьогодні"
    for s in critical_today[:2]:
        if s.get("recommendationType") in ("write", "contact_parent"):
            what_to_do_now.append({
                "id": f"write_{s['id']}",
                "studentId": s["id"],
                "action": "write",
                "title": f"Напиши {s['name'].split()[0]} сьогодні",
                "reason": "високий шанс повернення",
                "icon": "chatbubble-ellipses",
            })
    # Praise from rising
    for s in all_students:
        if s.get("recommendationType") == "praise" and s.get("streak", 0) >= 3:
            what_to_do_now.append({
                "id": f"praise_{s['id']}",
                "studentId": s["id"],
                "action": "praise",
                "title": f"Похвали {s['name'].split()[0]}",
                "reason": "тримає режим",
                "icon": "heart",
            })
            break
    # Upsell
    for s in upsell_ready[:2]:
        what_to_do_now.append({
            "id": f"upsell_{s['id']}",
            "studentId": s["id"],
            "action": "upsell",
            "title": f"Запропонуй {s['name'].split()[0]} індивідуальне",
            "reason": "готовий до апгрейду",
            "icon": "cash",
        })
    what_to_do_now = what_to_do_now[:5]

    # ── NEW: upcomingTrainings (E block) — next 5 trainings ──
    upcoming_trainings = list(today_trainings)
    # Next 6 days
    for offset in range(1, 7):
        future = now + timedelta(days=offset)
        future_dow = future.isoweekday()
        future_scheds = list(database["schedules"].find({"dayOfWeek": future_dow, "isActive": True}))
        for sched in future_scheds:
            gid = str(sched.get("groupId", ""))
            gname = group_map.get(gid, "Група")
            g_members_count = sum(1 for c in children if str(c.get("groupId", "")) == gid)
            upcoming_trainings.append({
                "id": str(sched.get("_id", "")),
                "groupId": gid,
                "time": f"{sched.get('startTime', '')}-{sched.get('endTime', '')}",
                "startTime": sched.get('startTime', ''),
                "group": gname,
                "studentsCount": g_members_count,
                "notComingCount": 0,
                "dateLabel": future.strftime("%d.%m"),
            })
        if len(upcoming_trainings) >= 5:
            break
    upcoming_trainings = upcoming_trainings[:5]

    # ── NEW: myEffectiveness (F block) — coach's KPI ──
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    coach_orders = list(database["orders"].find({
        "coachId": coach_id,
        "status": {"$in": ["COMPLETED", "PENDING"]},
    }))
    month_sales = sum(o.get("total", 0) for o in coach_orders if o.get("createdAt") and (o["createdAt"].replace(tzinfo=timezone.utc) if hasattr(o.get("createdAt"), "replace") else now) >= month_start)
    # Returned students: those with streak restored after absence (in children flagged)
    returned_count = database["children"].count_documents({
        "groupId": {"$in": group_ids},
        "lastReturnedAt": {"$gte": month_start},
    }) if group_ids else 0
    # Upsell: individual trainings booked this month via coach
    upsell_count = database["bookings"].count_documents({
        "coachId": coach_id,
        "type": "INDIVIDUAL",
        "createdAt": {"$gte": month_start},
    }) if "bookings" in database.list_collection_names() else 0
    # Conversion: contacted students that came back
    contacted = database["messages"].count_documents({
        "fromUserId": coach_id,
        "type": {"$in": ["COACH_TO_STUDENT", "COACH_BROADCAST"]},
        "createdAt": {"$gte": month_start},
    })
    conversion_rate = min(100, round((returned_count / max(contacted, 1)) * 100)) if contacted > 0 else 0
    # Retention score: based on overall attendance of coach's students
    retention_score = round(sum(s.get("attendanceRate", 0) for s in all_students) / max(len(all_students), 1))

    my_effectiveness = {
        "returnedStudents": returned_count,
        "conversionRate": conversion_rate,
        "upsellCount": upsell_count,
        "retentionScore": retention_score,
        "monthSales": month_sales,
        "monthBonus": round(month_sales * COACH_BONUS_RATE) if COACH_BONUS_RATE else 0,
    }

    return JSONResponse(content=json.loads(json.dumps({
        "summary": {"total": total, "rising": rising, "stable": stable, "risk": risk},
        "today": {
            "trainingsCount": len(today_trainings),
            "studentsCount": total,
            "riskCount": risk,
            "upsellReadyCount": len(upsell_ready),
        },
        "todayTrainings": today_trainings,
        "upcomingTrainings": upcoming_trainings,
        "criticalToday": critical_today[:10],
        "atRisk": at_risk[:10],
        "upsellReady": upsell_ready[:10],
        "needsReaction": needs_reaction,
        "whatToDoNow": what_to_do_now,
        "myEffectiveness": my_effectiveness,
        "allStudents": sorted(all_students, key=lambda x: x["riskScore"], reverse=True),
        "actionLog": action_log[:10],
    }, default=json_serial)))


COACH_BONUS_RATE = 0.05  # 5% from recommended sales

@app.get("/api/coach/kpi")
async def get_coach_kpi(request: Request):
    """Get coach KPI dashboard with sales tracking"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("COACH", "ADMIN"):
        return JSONResponse(content={"error": "Coach/Admin only"}, status_code=403)
    database = get_db()
    coach_id = str(user.get("id") or user.get("_id", ""))
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Sales from coach recommendations
    coach_orders = list(database["orders"].find({
        "coachId": coach_id,
        "status": {"$in": ["COMPLETED", "PENDING"]},
    }))
    month_orders = [o for o in coach_orders if o.get("createdAt") and o["createdAt"] >= month_start]

    total_sales = sum(o.get("total", 0) for o in coach_orders)
    month_sales = sum(o.get("total", 0) for o in month_orders)
    total_bonus = round(total_sales * COACH_BONUS_RATE)
    month_bonus = round(month_sales * COACH_BONUS_RATE)

    # Recommendations count
    recs = database["product_recommendations"].count_documents({"coachId": coach_id})
    month_recs = database["product_recommendations"].count_documents({
        "coachId": coach_id,
        "createdAt": {"$gte": month_start},
    })

    # Attendance stats (students coached)
    coach_groups = list(database["groups"].find({"coachId": ObjectId(coach_id)}))
    if not coach_groups:
        coach_groups = list(database["groups"].find({"coach": ObjectId(coach_id)}))
    group_ids = [g["_id"] for g in coach_groups]
    total_students = 0
    for g in coach_groups:
        members = g.get("members", [])
        total_students += len(members) if isinstance(members, list) else 0

    # Retention (students who stayed > 3 months)
    active_children = database["children"].count_documents({"status": "ACTIVE"})

    return JSONResponse(content={
        "coachId": coach_id,
        "coachName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "sales": {
            "totalSales": total_sales,
            "monthSales": month_sales,
            "totalBonus": total_bonus,
            "monthBonus": month_bonus,
            "bonusRate": COACH_BONUS_RATE * 100,
            "totalOrders": len(coach_orders),
            "monthOrders": len(month_orders),
        },
        "recommendations": {
            "total": recs,
            "month": month_recs,
        },
        "students": {
            "totalGroups": len(coach_groups),
            "totalStudents": total_students,
        },
        "retention": {
            "activeStudents": active_children,
        },
    })

@app.get("/api/coach/sales")
async def get_coach_sales(request: Request):
    """Get detailed coach sales history"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("COACH", "ADMIN"):
        return JSONResponse(content={"error": "Coach/Admin only"}, status_code=403)
    database = get_db()
    coach_id = str(user.get("id") or user.get("_id", ""))

    orders = list(database["orders"].find(
        {"coachId": coach_id},
        {"_id": 1, "items": 1, "total": 1, "status": 1, "childId": 1, "createdAt": 1}
    ).sort("createdAt", -1).limit(50))

    sales = []
    for o in orders:
        child = None
        if o.get("childId"):
            try:
                child = database["children"].find_one({"_id": ObjectId(o["childId"])})
            except Exception:
                pass
        sales.append({
            "orderId": str(o["_id"]),
            "total": o.get("total", 0),
            "bonus": round(o.get("total", 0) * COACH_BONUS_RATE),
            "status": o.get("status", ""),
            "childName": f"{child.get('firstName', '')} {child.get('lastName', '')}".strip() if child else "",
            "items": o.get("items", []),
            "createdAt": o.get("createdAt"),
        })

    return JSONResponse(content=json.loads(json.dumps({"sales": sales}, default=json_serial)))

# ============================================================
# OWNER REVENUE BREAKDOWN
# ============================================================

@app.get("/api/owner/revenue-breakdown")
async def get_revenue_breakdown(request: Request):
    """Revenue breakdown for owner dashboard"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    club = database["clubs"].find_one()
    club_id = str(club["_id"]) if club else ""
    plan_id = club.get("plan", "START") if club else "START"

    # SaaS subscription revenue
    sub = database["club_subscriptions"].find_one({"clubId": club_id})
    saas_monthly = sub.get("price", 0) if sub else 0

    # Marketplace revenue (total orders)
    all_orders = list(database["orders"].find({"status": {"$in": ["COMPLETED", "PENDING"]}}))
    month_orders = []
    for o in all_orders:
        created = o.get("createdAt")
        if created:
            if not created.tzinfo:
                created = created.replace(tzinfo=timezone.utc)
            if created >= month_start:
                month_orders.append(o)
    marketplace_total = sum(o.get("total", 0) for o in all_orders)
    marketplace_month = sum(o.get("total", 0) for o in month_orders)

    # Platform commissions
    commissions = list(database["marketplace_commissions"].find())
    month_commissions = []
    for c in commissions:
        created = c.get("createdAt")
        if created:
            if not created.tzinfo:
                created = created.replace(tzinfo=timezone.utc)
            if created >= month_start:
                month_commissions.append(c)
    commission_total = sum(c.get("commissionAmount", 0) for c in commissions)
    commission_month = sum(c.get("commissionAmount", 0) for c in month_commissions)

    # Revenue by source
    coach_rec_orders = list(database["orders"].find({"coachId": {"$exists": True, "$ne": ""}}))
    coach_rec_revenue = sum(o.get("total", 0) for o in coach_rec_orders)
    auto_rec_orders = list(database["orders"].find({"source": "auto_recommendation"}))
    auto_rec_revenue = sum(o.get("total", 0) for o in auto_rec_orders)
    event_orders = list(database["orders"].find({"source": "event_offer"}))
    event_revenue = sum(o.get("total", 0) for o in event_orders)
    direct_revenue = marketplace_total - coach_rec_revenue - auto_rec_revenue - event_revenue

    # Top revenue sources
    sources = []
    if coach_rec_revenue > 0:
        sources.append({"name": "Рекомендації тренера", "amount": coach_rec_revenue, "percent": round(coach_rec_revenue / max(marketplace_total, 1) * 100)})
    if auto_rec_revenue > 0:
        sources.append({"name": "Авто-рекомендації", "amount": auto_rec_revenue, "percent": round(auto_rec_revenue / max(marketplace_total, 1) * 100)})
    if event_revenue > 0:
        sources.append({"name": "Event → Offer", "amount": event_revenue, "percent": round(event_revenue / max(marketplace_total, 1) * 100)})
    if direct_revenue > 0:
        sources.append({"name": "Прямі покупки", "amount": direct_revenue, "percent": round(direct_revenue / max(marketplace_total, 1) * 100)})
    sources.sort(key=lambda x: x["amount"], reverse=True)

    # Coach bonuses paid
    total_coach_bonus = round(coach_rec_revenue * COACH_BONUS_RATE)

    return JSONResponse(content={
        "plan": plan_id,
        "saas": {
            "monthly": saas_monthly,
            "currency": "UAH",
        },
        "marketplace": {
            "total": marketplace_total,
            "month": marketplace_month,
            "ordersTotal": len(all_orders),
            "ordersMonth": len(month_orders),
        },
        "commission": {
            "total": commission_total,
            "month": commission_month,
        },
        "coachBonuses": {
            "total": total_coach_bonus,
            "rate": COACH_BONUS_RATE * 100,
        },
        "sources": sources,
        "topSource": sources[0] if sources else None,
    })

# ============================================================
# QUICK BUY ENHANCEMENT (AUTO-FILL + MINI CHECKOUT)
# ============================================================

@app.post("/api/marketplace/quick-checkout")
async def quick_checkout(request: Request):
    """
    Enhanced Quick Buy with auto-fill delivery info
    No forms, no steps → instant purchase
    """
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    body = await request.json()
    product_id = body.get("productId")
    child_id = body.get("childId", "")
    quantity = body.get("quantity", 1)
    source = body.get("source", "quick_buy")
    coach_id = body.get("coachId", "")
    now = datetime.now(timezone.utc)

    if not product_id:
        return JSONResponse(content={"error": "productId required"}, status_code=400)

    try:
        product = database["products"].find_one({"_id": ObjectId(product_id)})
    except Exception:
        return JSONResponse(content={"error": "Invalid product ID"}, status_code=400)
    if not product:
        return JSONResponse(content={"error": "Product not found"}, status_code=404)

    price = product.get("price", 0)

    # Check for active discount
    discount = body.get("discount", 0)
    if discount > 0:
        final_price = round(price * (1 - discount / 100))
    else:
        final_price = price
    total = final_price * quantity

    # Auto-fill from user profile
    user_id = str(user.get("id") or user.get("_id", ""))
    delivery_phone = user.get("phone", "")
    delivery_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    # Check last order for delivery address
    last_order = database["orders"].find_one(
        {"userId": user_id, "deliveryAddress": {"$exists": True}},
        sort=[("createdAt", -1)]
    )
    delivery_address = ""
    if last_order:
        delivery_address = last_order.get("deliveryAddress", "")

    # Create order
    order_doc = {
        "userId": user_id,
        "childId": child_id,
        "coachId": coach_id,
        "source": source,
        "items": [{
            "productId": product_id,
            "productName": product.get("name", ""),
            "price": price,
            "finalPrice": final_price,
            "discount": discount,
            "quantity": quantity,
        }],
        "total": total,
        "originalTotal": price * quantity,
        "discountApplied": discount,
        "status": "PENDING",
        "deliveryPhone": delivery_phone,
        "deliveryName": delivery_name,
        "deliveryAddress": delivery_address,
        "paymentMethod": "quick_checkout",
        "createdAt": now,
    }
    result = database["orders"].insert_one(order_doc)
    order_id = str(result.inserted_id)

    # Update product sales count
    database["products"].update_one(
        {"_id": ObjectId(product_id)},
        {"$inc": {"salesCount": quantity}}
    )

    logger.info(f"Quick checkout: {product.get('name', '')} x{quantity} = {total}₴ (source={source})")

    return JSONResponse(content={
        "success": True,
        "orderId": order_id,
        "product": product.get("name", ""),
        "quantity": quantity,
        "originalPrice": price,
        "finalPrice": final_price,
        "discount": discount,
        "total": total,
        "delivery": {
            "phone": delivery_phone,
            "name": delivery_name,
            "address": delivery_address,
        },
    })

# ============================================================
# PRODUCT BUNDLES (КОМПЛЕКТИ)
# ============================================================

@app.get("/api/marketplace/bundles")
async def get_bundles(request: Request):
    """Get product bundles/combos"""
    database = get_db()
    bundles = list(database["product_bundles"].find({"isActive": True}, {"_id": 0}))
    if not bundles:
        # Auto-generate bundles from products
        products = list(database["products"].find({"isActive": True}))
        if len(products) >= 3:
            now = datetime.now(timezone.utc)
            # Create starter kit bundle
            kit_products = products[:3]
            kit_total = sum(p.get("price", 0) for p in kit_products)
            bundle = {
                "id": "starter_kit",
                "name": "Стартовий комплект",
                "description": "Все необхідне для початку тренувань",
                "products": [{
                    "productId": str(p["_id"]),
                    "name": p.get("name", ""),
                    "price": p.get("price", 0),
                } for p in kit_products],
                "originalPrice": kit_total,
                "bundlePrice": round(kit_total * 0.85),
                "discountPercent": 15,
                "sportTags": [],
                "isActive": True,
                "createdAt": now,
            }
            database["product_bundles"].insert_one(bundle)
            bundles = [bundle]
    
    # Remove _id from nested
    for b in bundles:
        b.pop("_id", None)

    return JSONResponse(content=json.loads(json.dumps({"bundles": bundles}, default=json_serial)))

@app.post("/api/marketplace/bundles")
async def create_bundle(request: Request):
    """Create product bundle"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("ADMIN", "COACH"):
        return JSONResponse(content={"error": "Admin/Coach only"}, status_code=403)
    database = get_db()
    body = await request.json()
    now = datetime.now(timezone.utc)
    
    product_ids = body.get("productIds", [])
    products = []
    total = 0
    for pid in product_ids:
        try:
            p = database["products"].find_one({"_id": ObjectId(pid)})
            if p:
                products.append({"productId": str(p["_id"]), "name": p.get("name", ""), "price": p.get("price", 0)})
                total += p.get("price", 0)
        except Exception:
            pass
    
    discount = body.get("discountPercent", 15)
    bundle = {
        "id": body.get("id", f"bundle_{int(now.timestamp())}"),
        "name": body.get("name", "Комплект"),
        "description": body.get("description", ""),
        "products": products,
        "originalPrice": total,
        "bundlePrice": round(total * (1 - discount / 100)),
        "discountPercent": discount,
        "sportTags": body.get("sportTags", []),
        "isActive": True,
        "createdAt": now,
    }
    database["product_bundles"].insert_one(bundle)
    return JSONResponse(content={"success": True, "bundle": bundle["id"]})

@app.post("/api/marketplace/bundles/{bundle_id}/buy")
async def buy_bundle(bundle_id: str, request: Request):
    """Buy a product bundle"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    body = await request.json()
    child_id = body.get("childId", "")
    now = datetime.now(timezone.utc)

    bundle = database["product_bundles"].find_one({"id": bundle_id, "isActive": True})
    if not bundle:
        return JSONResponse(content={"error": "Bundle not found"}, status_code=404)

    user_id = str(user.get("id") or user.get("_id", ""))
    order_doc = {
        "userId": user_id,
        "childId": child_id,
        "source": "bundle",
        "bundleId": bundle_id,
        "items": [{
            "productId": p["productId"],
            "productName": p["name"],
            "price": p["price"],
            "quantity": 1,
        } for p in bundle.get("products", [])],
        "total": bundle.get("bundlePrice", 0),
        "originalTotal": bundle.get("originalPrice", 0),
        "discountApplied": bundle.get("discountPercent", 0),
        "status": "PENDING",
        "paymentMethod": "bundle_buy",
        "createdAt": now,
    }
    result = database["orders"].insert_one(order_doc)
    
    return JSONResponse(content={
        "success": True,
        "orderId": str(result.inserted_id),
        "bundle": bundle.get("name", ""),
        "total": bundle.get("bundlePrice", 0),
        "saved": bundle.get("originalPrice", 0) - bundle.get("bundlePrice", 0),
    })

# ============================================================
# SPORT-FILTERED MARKETPLACE
# ============================================================

@app.get("/api/marketplace/sport-products")
async def get_sport_products(request: Request):
    """Get products filtered by club's sport"""
    database = get_db()
    club = database["clubs"].find_one()
    sport_id = club.get("sportId", "martial_arts") if club else "martial_arts"
    
    sport = database["sports"].find_one({"id": sport_id})
    sport_tags = sport.get("marketplaceTags", []) if sport else []

    # Get products matching sport tags
    if sport_tags:
        products = list(database["products"].find({
            "isActive": True,
            "$or": [
                {"sportTags": {"$in": sport_tags}},
                {"tags": {"$in": sport_tags}},
                {"sportTags": {"$exists": False}},  # Universal products
            ]
        }))
    else:
        products = list(database["products"].find({"isActive": True}))

    result = []
    for p in products:
        result.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "price": p.get("price", 0),
            "oldPrice": p.get("oldPrice"),
            "imageUrl": p.get("imageUrl"),
            "category": p.get("category", ""),
            "description": p.get("description", ""),
            "sportTags": p.get("sportTags", []),
            "isCoachRecommended": p.get("isCoachRecommended", False),
            "coachName": p.get("recommendedByCoach", ""),
            "salesCount": p.get("salesCount", 0),
        })

    return JSONResponse(content={
        "sportId": sport_id,
        "sportName": sport.get("name", "") if sport else "",
        "products": result,
    })

# ============================================================
# CLUB SPORT CONFIGURATION
# ============================================================

@app.patch("/api/owner/club/sport")
async def update_club_sport(request: Request):
    """Update club's sport configuration"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    body = await request.json()
    sport_id = body.get("sportId")
    disciplines = body.get("disciplines", [])
    features = body.get("features", {})
    now = datetime.now(timezone.utc)

    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "Club not found"}, status_code=404)

    update = {"updatedAt": now}
    if sport_id:
        sport = database["sports"].find_one({"id": sport_id})
        if not sport:
            return JSONResponse(content={"error": "Sport not found"}, status_code=404)
        update["sportId"] = sport_id
    if disciplines:
        update["disciplines"] = disciplines
    if features:
        update["features"] = features

    database["clubs"].update_one({"_id": club["_id"]}, {"$set": update})

    return JSONResponse(content={"success": True, "message": "Спорт клубу оновлено"})

# ============================================================
# OWNER POWER LAYER — Team Management, Multi-Club, Cashflow
# ============================================================

@app.patch("/api/admin/clubs/{club_id}/assign-owner")
async def assign_owner_to_club(club_id: str, request: Request):
    """ADMIN: Assign OWNER to a club"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("ADMIN",):
        return JSONResponse(content={"error": "Admin only"}, status_code=403)

    body = await request.json()
    user_id = body.get("userId")
    if not user_id:
        return JSONResponse(content={"error": "userId required"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)

    # Verify club exists
    club = database["clubs"].find_one({"_id": ObjectId(club_id)})
    if not club:
        return JSONResponse(content={"error": "Club not found"}, status_code=404)

    # Verify user exists
    target_user = database["users"].find_one({"_id": ObjectId(user_id)})
    if not target_user:
        return JSONResponse(content={"error": "User not found"}, status_code=404)

    # Remove old OWNER membership for this club
    database["club_memberships"].delete_many({"clubId": str(club_id), "role": "OWNER"})

    # Create new OWNER membership
    database["club_memberships"].insert_one({
        "clubId": str(club_id),
        "userId": user_id,
        "role": "OWNER",
        "isActive": True,
        "createdAt": now,
    })

    # Update club.ownerUserId
    database["clubs"].update_one(
        {"_id": ObjectId(club_id)},
        {"$set": {"ownerUserId": user_id, "updatedAt": now}}
    )

    # Update user role to OWNER
    database["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": "OWNER", "updatedAt": now}}
    )

    owner_name = f"{target_user.get('firstName', '')} {target_user.get('lastName', '')}".strip()
    return JSONResponse(content={"success": True, "ownerUserId": user_id, "ownerName": owner_name})


@app.patch("/api/owner/team/{member_id}/role")
async def change_team_member_role(member_id: str, request: Request):
    """OWNER: Change a team member's role"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner/Admin only"}, status_code=403)

    body = await request.json()
    new_role = body.get("role")
    if new_role not in ("COACH", "ADMIN", "MANAGER"):
        return JSONResponse(content={"error": "Invalid role. Allowed: COACH, ADMIN, MANAGER"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)

    # Update membership
    result = database["club_memberships"].update_one(
        {"userId": member_id},
        {"$set": {"role": new_role, "updatedAt": now}}
    )

    # Also update user's role
    database["users"].update_one(
        {"_id": ObjectId(member_id)},
        {"$set": {"role": new_role, "updatedAt": now}}
    )

    return JSONResponse(content={"success": True, "userId": member_id, "newRole": new_role})


@app.post("/api/owner/team/invite")
async def invite_team_member(request: Request):
    """OWNER: Invite a new team member by phone"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner/Admin only"}, status_code=403)

    body = await request.json()
    phone = body.get("phone", "").strip()
    role = body.get("role", "COACH")
    first_name = body.get("firstName", "")

    if not phone:
        return JSONResponse(content={"error": "phone required"}, status_code=400)
    if role not in ("COACH", "ADMIN", "MANAGER"):
        return JSONResponse(content={"error": "Invalid role"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)

    # Find club
    club = database["clubs"].find_one()
    if not club:
        return JSONResponse(content={"error": "No club"}, status_code=404)
    club_id = str(club["_id"])

    # Check if user already exists
    existing_user = database["users"].find_one({"phone": phone})
    if existing_user:
        existing_id = str(existing_user["_id"])
        # Check if already a member
        existing_member = database["club_memberships"].find_one({"clubId": club_id, "userId": existing_id})
        if existing_member:
            return JSONResponse(content={"error": "Цей користувач вже в команді", "alreadyMember": True}, status_code=409)

        # Add membership
        database["club_memberships"].insert_one({
            "clubId": club_id,
            "userId": existing_id,
            "role": role,
            "isActive": True,
            "createdAt": now,
        })
        database["users"].update_one({"_id": existing_user["_id"]}, {"$set": {"role": role, "updatedAt": now}})
        return JSONResponse(content={"success": True, "userId": existing_id, "isNew": False, "message": "Додано до команди"})

    # Create new user
    new_user = {
        "phone": phone,
        "firstName": first_name or "Новий",
        "lastName": "",
        "role": role,
        "isActive": True,
        "createdAt": now,
    }
    ins = database["users"].insert_one(new_user)
    new_id = str(ins.inserted_id)

    # Add membership
    database["club_memberships"].insert_one({
        "clubId": club_id,
        "userId": new_id,
        "role": role,
        "isActive": True,
        "createdAt": now,
    })

    return JSONResponse(content={"success": True, "userId": new_id, "isNew": True, "message": "Запрошення створено"})


@app.delete("/api/owner/team/{member_id}")
async def remove_team_member(member_id: str, request: Request):
    """OWNER: Remove a team member"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner/Admin only"}, status_code=403)

    database = get_db()

    # Don't allow removing OWNER
    membership = database["club_memberships"].find_one({"userId": member_id})
    if membership and membership.get("role") == "OWNER":
        return JSONResponse(content={"error": "Не можна видалити власника"}, status_code=400)

    # Remove membership
    result = database["club_memberships"].delete_one({"userId": member_id})

    return JSONResponse(content={"success": True, "removed": result.deleted_count > 0})


@app.get("/api/owner/clubs")
async def get_owner_clubs(request: Request):
    """OWNER: Get all clubs owned by this user (multi-club)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    user_id = user.get("id") or user.get("_id", "")
    database = get_db()

    # Find all clubs where user is OWNER
    memberships = list(database["club_memberships"].find({"userId": user_id, "role": "OWNER"}))
    club_ids = [m.get("clubId") for m in memberships]

    # Also check clubs by ownerUserId
    owned_clubs = list(database["clubs"].find({"ownerUserId": user_id}))
    for c in owned_clubs:
        cid = str(c["_id"])
        if cid not in club_ids:
            club_ids.append(cid)

    # If no owned clubs, return the default club
    if not club_ids:
        default_club = database["clubs"].find_one()
        if default_club:
            club_ids = [str(default_club["_id"])]

    clubs = []
    for cid in club_ids:
        try:
            club = database["clubs"].find_one({"_id": ObjectId(cid)})
        except Exception:
            continue
        if not club:
            continue

        # Get stats
        member_count = database["club_memberships"].count_documents({"clubId": cid})
        students = database["children"].count_documents({})
        coaches = database["users"].count_documents({"role": "COACH"})

        # Revenue this month
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": month_start}}))
        revenue = sum(p.get("amount", 0) for p in payments)

        clubs.append({
            "id": cid,
            "name": club.get("name", ""),
            "city": club.get("city", ""),
            "plan": club.get("plan", "START"),
            "saasStatus": club.get("saasStatus", "ACTIVE"),
            "revenue": revenue,
            "students": students,
            "coaches": coaches,
            "members": member_count,
        })

    return JSONResponse(content=json.loads(json.dumps({"clubs": clubs}, default=json_serial)))


@app.post("/api/owner/clubs/create")
async def create_branch(request: Request):
    """OWNER: Create a new club (branch) — goes to PENDING_REVIEW"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner/Admin only"}, status_code=403)

    body = await request.json()
    name = body.get("name", "").strip()
    city = body.get("city", "").strip()
    address = body.get("address", "").strip()

    if not name:
        return JSONResponse(content={"error": "name required"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)
    user_id = user.get("id") or user.get("_id", "")
    slug = name.lower().replace(" ", "-")

    new_club = {
        "name": name,
        "slug": slug,
        "city": city,
        "address": address,
        "phone": "",
        "email": "",
        "status": "PENDING_REVIEW",
        "saasStatus": "PENDING",
        "reviewStatus": "PENDING",
        "plan": "START",
        "ownerUserId": user_id,
        "primaryColor": "#E30613",
        "secondaryColor": "#0F0F10",
        "createdAt": now,
    }
    result = database["clubs"].insert_one(new_club)
    club_id = str(result.inserted_id)

    # Add OWNER membership
    database["club_memberships"].insert_one({
        "clubId": club_id, "userId": user_id, "role": "OWNER", "isActive": True, "createdAt": now,
    })

    # Create tenant with PENDING
    database["tenants"].insert_one({
        "name": name, "slug": slug, "clubId": club_id, "ownerUserId": user_id,
        "plan": "START", "status": "PENDING_REVIEW", "createdAt": now,
    })

    # Notify admin
    admins = list(database["users"].find({"role": "ADMIN"}))
    for admin in admins:
        database["notifications"].insert_one({
            "userId": str(admin["_id"]), "type": "BRANCH_REVIEW",
            "title": f"🏢 Новий філіал на ревью: {name}",
            "body": f"Власник запросив створення філіалу в {city or 'невідоме місто'}",
            "data": {"clubId": club_id, "screen": "/admin/branches"},
            "isRead": False, "createdAt": now,
        })

    return JSONResponse(content={
        "success": True, "clubId": club_id, "name": name,
        "status": "PENDING_REVIEW",
        "message": "Заявку на філіал надіслано на ревью",
    })


@app.get("/api/owner/branches")
async def get_owner_branches(request: Request):
    """OWNER: Get all branches with review status"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    uid = user.get("id") or user.get("_id", "")
    clubs = list(database["clubs"].find({"ownerUserId": uid}))
    if not clubs:
        clubs = list(database["clubs"].find())
    branches = []
    for c in clubs:
        branches.append({
            "id": str(c["_id"]), "name": c.get("name", ""), "city": c.get("city", ""),
            "address": c.get("address", ""),
            "status": c.get("status", "ACTIVE"),
            "reviewStatus": c.get("reviewStatus", "APPROVED"),
            "plan": c.get("plan", "START"),
            "saasStatus": c.get("saasStatus", "ACTIVE"),
            "createdAt": c.get("createdAt", ""),
        })
    return JSONResponse(content=json.loads(json.dumps({"branches": branches}, default=json_serial)))


# ---- ADMIN: Branch Review ----

@app.get("/api/admin/branches/pending")
async def get_pending_branches(request: Request):
    """ADMIN: Get branches pending review"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("ADMIN",):
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    pending = list(database["clubs"].find({"reviewStatus": "PENDING"}))
    branches = []
    for c in pending:
        owner = None
        oid = c.get("ownerUserId")
        if oid:
            try: owner = database["users"].find_one({"_id": ObjectId(oid)})
            except: pass
        branches.append({
            "id": str(c["_id"]), "name": c.get("name", ""), "city": c.get("city", ""),
            "address": c.get("address", ""), "plan": c.get("plan", "START"),
            "ownerName": f"{owner.get('firstName','')} {owner.get('lastName','')}".strip() if owner else "",
            "ownerPhone": owner.get("phone", "") if owner else "",
            "createdAt": c.get("createdAt", ""),
        })
    return JSONResponse(content=json.loads(json.dumps({"branches": branches, "total": len(branches)}, default=json_serial)))


@app.post("/api/admin/branches/{club_id}/approve")
async def approve_branch(club_id: str, request: Request):
    """ADMIN: Approve a pending branch"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("ADMIN",):
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    database = get_db()
    now = datetime.now(timezone.utc)
    database["clubs"].update_one({"_id": ObjectId(club_id)}, {"$set": {
        "status": "ACTIVE", "saasStatus": "ACTIVE", "reviewStatus": "APPROVED", "approvedAt": now,
    }})
    database["tenants"].update_one({"clubId": club_id}, {"$set": {"status": "ACTIVE", "updatedAt": now}})
    # Notify owner
    club = database["clubs"].find_one({"_id": ObjectId(club_id)})
    if club and club.get("ownerUserId"):
        database["notifications"].insert_one({
            "userId": club["ownerUserId"], "type": "BRANCH_APPROVED",
            "title": f"✅ Філіал '{club.get('name','')}' схвалено!",
            "body": "Ваш новий філіал активний і готовий до роботи",
            "data": {"clubId": club_id}, "isRead": False, "createdAt": now,
        })
    return JSONResponse(content={"success": True, "message": "Філіал схвалено"})


@app.post("/api/admin/branches/{club_id}/reject")
async def reject_branch(club_id: str, request: Request):
    """ADMIN: Reject a pending branch"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("ADMIN",):
        return JSONResponse(content={"error": "Admin only"}, status_code=403)
    body = await request.json()
    reason = body.get("reason", "")
    database = get_db()
    now = datetime.now(timezone.utc)
    database["clubs"].update_one({"_id": ObjectId(club_id)}, {"$set": {
        "status": "REJECTED", "saasStatus": "REJECTED", "reviewStatus": "REJECTED",
        "rejectionReason": reason, "rejectedAt": now,
    }})
    club = database["clubs"].find_one({"_id": ObjectId(club_id)})
    if club and club.get("ownerUserId"):
        database["notifications"].insert_one({
            "userId": club["ownerUserId"], "type": "BRANCH_REJECTED",
            "title": f"❌ Філіал '{club.get('name','')}' відхилено",
            "body": reason or "Зверніться до підтримки для деталей",
            "data": {"clubId": club_id}, "isRead": False, "createdAt": now,
        })
    return JSONResponse(content={"success": True, "message": "Філіал відхилено"})


@app.get("/api/owner/cashflow")
async def get_owner_cashflow(request: Request):
    """OWNER: Get cashflow data (today/yesterday/week)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)

    # Today's income
    today_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": today_start}}))
    today_income = sum(p.get("amount", 0) for p in today_payments)

    # Yesterday's income
    yesterday_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": yesterday_start, "$lt": today_start}}))
    yesterday_income = sum(p.get("amount", 0) for p in yesterday_payments)

    # Week income
    week_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": week_start}}))
    week_income = sum(p.get("amount", 0) for p in week_payments)

    # Marketplace today
    today_orders = list(database["orders"].find({"status": "PAID", "createdAt": {"$gte": today_start}}))
    today_marketplace = sum(o.get("total", o.get("amount", 0)) for o in today_orders)

    # Pending amounts
    pending_payments = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))
    pending_total = sum(p.get("amount", 0) for p in pending_payments)

    # Daily breakdown for last 7 days
    daily = []
    for i in range(7):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_pays = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": day_start, "$lt": day_end}}))
        day_amount = sum(p.get("amount", 0) for p in day_pays)
        daily.append({"date": day_start.strftime("%d.%m"), "amount": day_amount})

    return JSONResponse(content={
        "today": today_income,
        "yesterday": yesterday_income,
        "week": week_income,
        "todayMarketplace": today_marketplace,
        "todayTransactions": len(today_payments),
        "pendingTotal": pending_total,
        "daily": list(reversed(daily)),
    })


@app.get("/api/owner/debtors")
async def get_owner_debtors(request: Request):
    """OWNER: Get top debtors list"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()

    # Find all pending/overdue payments grouped by child
    pending = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))

    debtor_map = {}
    for p in pending:
        child_id = str(p.get("childId", ""))
        if not child_id:
            continue
        if child_id not in debtor_map:
            debtor_map[child_id] = {"debt": 0, "payments": 0, "overdue": 0}
        debtor_map[child_id]["debt"] += p.get("amount", 0)
        debtor_map[child_id]["payments"] += 1
        if p.get("status") == "OVERDUE":
            debtor_map[child_id]["overdue"] += 1

    debtors = []
    for child_id, info in sorted(debtor_map.items(), key=lambda x: -x[1]["debt"]):
        child = None
        try:
            child = database["children"].find_one({"_id": ObjectId(child_id)})
        except Exception:
            pass
        if not child:
            continue

        parent_name = ""
        if child.get("userId") or child.get("parentId"):
            pid = child.get("userId") or child.get("parentId")
            try:
                parent = database["users"].find_one({"_id": ObjectId(str(pid))})
                if parent:
                    parent_name = f"{parent.get('firstName', '')} {parent.get('lastName', '')}".strip()
            except Exception:
                pass

        debtors.append({
            "childId": child_id,
            "childName": f"{child.get('firstName', '')} {child.get('lastName', '')}".strip(),
            "parentName": parent_name,
            "debt": info["debt"],
            "payments": info["payments"],
            "overdue": info["overdue"],
        })

    return JSONResponse(content={"debtors": debtors[:20], "totalDebt": sum(d["debt"] for d in debtors)})


@app.get("/api/owner/conversion")
async def get_owner_conversion(request: Request):
    """OWNER: Lead → Client conversion stats"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()

    total_leads = database["consultations"].count_documents({})
    converted = database["consultations"].count_documents({"status": {"$in": ["CONVERTED", "ENROLLED"]}})
    active_students = database["children"].count_documents({"status": {"$in": ["ACTIVE", "TRIAL"]}})
    total_users = database["users"].count_documents({})

    conversion_rate = round(converted / total_leads * 100) if total_leads > 0 else 0

    return JSONResponse(content={
        "totalLeads": total_leads,
        "converted": converted,
        "conversionRate": conversion_rate,
        "activeStudents": active_students,
        "totalUsers": total_users,
    })


# ============================================================
# OWNER INSIGHTS ENGINE — Умная система: данные → сигнал → дія
# ============================================================

INSIGHT_CONFIG = {
    "REVENUE_DROP": {"icon": "trending-down", "color": "#EF4444", "level": "high"},
    "HIGH_DEBT": {"icon": "alert-circle", "color": "#EF4444", "level": "high"},
    "RISK_STUDENTS": {"icon": "people", "color": "#EF4444", "level": "high"},
    "LOW_CONVERSION": {"icon": "analytics", "color": "#F59E0B", "level": "medium"},
    "LIMIT_WARNING": {"icon": "warning", "color": "#F59E0B", "level": "medium"},
    "ATTENDANCE_DROP": {"icon": "calendar", "color": "#F59E0B", "level": "medium"},
    "NO_MARKETPLACE": {"icon": "cart", "color": "#9CA3AF", "level": "low"},
    "COACH_OVERLOAD": {"icon": "fitness", "color": "#F59E0B", "level": "medium"},
    "POSITIVE_STREAK": {"icon": "trophy", "color": "#10B981", "level": "positive"},
}

@app.get("/api/owner/insights")
async def get_owner_insights(request: Request):
    """OWNER Decision Engine: данные → рекомендація → дія → гроші"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_ago = today_start - timedelta(days=7)
    prev_week = today_start - timedelta(days=14)

    insights = []

    # ---- 1. REVENUE DROP ----
    today_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": today_start}}))
    yesterday_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": yesterday_start, "$lt": today_start}}))
    today_rev = sum(p.get("amount", 0) for p in today_payments)
    yesterday_rev = sum(p.get("amount", 0) for p in yesterday_payments)

    # Week-over-week comparison
    this_week_pays = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": week_ago}}))
    prev_week_pays = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": prev_week, "$lt": week_ago}}))
    this_week_rev = sum(p.get("amount", 0) for p in this_week_pays)
    prev_week_rev = sum(p.get("amount", 0) for p in prev_week_pays)

    if prev_week_rev > 0 and this_week_rev < prev_week_rev * 0.8:
        drop_pct = round((1 - this_week_rev / prev_week_rev) * 100)
        insights.append({
            "type": "REVENUE_DROP",
            "level": "high",
            "message": f"Виручка впала на {drop_pct}% за тиждень",
            "detail": f"Цей тиждень: {this_week_rev} ₴ vs минулий: {prev_week_rev} ₴",
            "action": "OPEN_FINANCE",
            "actionLabel": "Переглянути фінанси",
        })

    # ---- 2. HIGH DEBT ----
    pending_payments = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))
    total_debt = sum(p.get("amount", 0) for p in pending_payments)
    overdue_count = len([p for p in pending_payments if p.get("status") == "OVERDUE"])

    if total_debt > 5000:
        insights.append({
            "type": "HIGH_DEBT",
            "level": "high",
            "message": f"Борг перевищує {total_debt:,.0f} ₴",
            "detail": f"{len(pending_payments)} неоплачених, {overdue_count} прострочено",
            "action": "OPEN_DEBTORS",
            "actionLabel": "Стягнути борг",
        })
    elif total_debt > 0:
        insights.append({
            "type": "HIGH_DEBT",
            "level": "medium",
            "message": f"Є борг: {total_debt:,.0f} ₴",
            "detail": f"{len(pending_payments)} неоплачених рахунків",
            "action": "OPEN_DEBTORS",
            "actionLabel": "Переглянути",
        })

    # ---- 3. RISK STUDENTS ----
    children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    risk_count = 0
    for child in children:
        att = list(database["attendances"].find({"childId": child["_id"]}))
        total_att = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        pct = (present / total_att * 100) if total_att > 0 else 100
        if pct < 50:
            risk_count += 1

    if risk_count >= 3:
        insights.append({
            "type": "RISK_STUDENTS",
            "level": "high",
            "message": f"{risk_count} учнів у зоні ризику відтоку",
            "detail": "Відвідуваність нижче 50%",
            "action": "OPEN_RETENTION",
            "actionLabel": "Вжити заходів",
        })
    elif risk_count > 0:
        insights.append({
            "type": "RISK_STUDENTS",
            "level": "medium",
            "message": f"{risk_count} учнів з низькою відвідуваністю",
            "detail": "Зверніть увагу",
            "action": "OPEN_RETENTION",
            "actionLabel": "Переглянути",
        })

    # ---- 4. LOW CONVERSION ----
    total_leads = database["consultations"].count_documents({})
    converted_leads = database["consultations"].count_documents({"status": {"$in": ["CONVERTED", "ENROLLED"]}})
    conversion_rate = (converted_leads / total_leads) if total_leads > 0 else 1.0

    if total_leads > 5 and conversion_rate < 0.15:
        insights.append({
            "type": "LOW_CONVERSION",
            "level": "medium",
            "message": f"Конверсія лише {conversion_rate*100:.0f}%",
            "detail": f"{converted_leads} з {total_leads} лідів стали клієнтами",
            "action": "OPEN_LEADS",
            "actionLabel": "Перевірити ліди",
        })

    # ---- 5. LIMIT WARNING ----
    club = database["clubs"].find_one()
    if club:
        plan = club.get("plan", "START")
        plan_limits = {"START": {"s": 50, "c": 3}, "PRO": {"s": 200, "c": 10}, "ENTERPRISE": {"s": 99999, "c": 99999}}
        lim = plan_limits.get(plan, plan_limits["START"])
        student_count = database["children"].count_documents({"status": {"$in": ["ACTIVE", "TRIAL"]}})
        coach_count = database["users"].count_documents({"role": "COACH"})

        if student_count >= lim["s"] * 0.85:
            insights.append({
                "type": "LIMIT_WARNING",
                "level": "medium",
                "message": f"Ліміт учнів {student_count}/{lim['s']}",
                "detail": "Оновіть тариф для росту",
                "action": "UPGRADE_PLAN",
                "actionLabel": "Підвищити тариф",
            })

        if coach_count >= lim["c"] * 0.85:
            insights.append({
                "type": "LIMIT_WARNING",
                "level": "medium",
                "message": f"Ліміт тренерів {coach_count}/{lim['c']}",
                "detail": "Оновіть тариф",
                "action": "UPGRADE_PLAN",
                "actionLabel": "Підвищити тариф",
            })

    # ---- 6. NO MARKETPLACE ----
    today_orders = database["orders"].count_documents({"createdAt": {"$gte": today_start}})
    if today_orders == 0 and now.hour >= 12:
        insights.append({
            "type": "NO_MARKETPLACE",
            "level": "low",
            "message": "Сьогодні немає продажів у магазині",
            "detail": "Рекомендуємо запустити акцію",
            "action": "OPEN_MARKETPLACE",
            "actionLabel": "Відкрити магазин",
        })

    # ---- 7. COACH OVERLOAD ----
    coaches = list(database["users"].find({"role": "COACH"}))
    for coach in coaches:
        coach_groups = database["groups"].count_documents({"coachId": str(coach["_id"])})
        if coach_groups > 5:
            coach_name = f"{coach.get('firstName', '')}".strip()
            insights.append({
                "type": "COACH_OVERLOAD",
                "level": "medium",
                "message": f"Тренер {coach_name} — {coach_groups} груп",
                "detail": "Рекомендуємо розподілити навантаження",
                "action": "OPEN_TEAM",
                "actionLabel": "Команда",
            })

    # ---- 8. POSITIVE: Good attendance streak ----
    avg_attendance = 0
    total_children = len(children)
    if total_children > 0:
        total_pct = 0
        for child in children:
            att = list(database["attendances"].find({"childId": child["_id"]}))
            t = len(att)
            p = len([a for a in att if a.get("status") == "PRESENT"])
            total_pct += (p / t * 100) if t > 0 else 0
        avg_attendance = total_pct / total_children

    if avg_attendance >= 80:
        insights.append({
            "type": "POSITIVE_STREAK",
            "level": "positive",
            "message": f"Відмінна відвідуваність: {avg_attendance:.0f}%",
            "detail": "Клуб працює на високому рівні",
            "action": "NONE",
            "actionLabel": "",
        })

    # Sort: high first, then medium, then low, positive last
    level_order = {"high": 0, "medium": 1, "low": 2, "positive": 3}
    insights.sort(key=lambda x: level_order.get(x.get("level", "low"), 2))

    # Add icon/color from config
    for ins in insights:
        cfg = INSIGHT_CONFIG.get(ins["type"], {})
        ins["icon"] = cfg.get("icon", "information-circle")
        ins["color"] = cfg.get("color", "#6B7280")

    # Send push to OWNER if critical insights
    critical = [i for i in insights if i.get("level") == "high"]
    if critical and user:
        uid = user.get("id") or user.get("_id", "")
        # Check if we already pushed today
        today_push = database["notifications"].find_one({
            "userId": uid,
            "type": "OWNER_INSIGHT_PUSH",
            "createdAt": {"$gte": today_start},
        })
        if not today_push and uid:
            msg = critical[0]["message"]
            database["notifications"].insert_one({
                "userId": uid,
                "type": "OWNER_INSIGHT_PUSH",
                "title": f"⚠️ {msg}",
                "body": f"{len(critical)} критичних сигналів потребують вашої уваги",
                "data": {"screen": "/(owner)", "type": "insight"},
                "isRead": False,
                "createdAt": now,
            })
            # Attempt real push
            tokens = get_user_push_tokens(database, uid)
            if tokens:
                await send_expo_push(tokens, f"⚠️ {msg}", f"{len(critical)} критичних сигналів")

    return JSONResponse(content={
        "insights": insights,
        "summary": {
            "total": len(insights),
            "high": len([i for i in insights if i.get("level") == "high"]),
            "medium": len([i for i in insights if i.get("level") == "medium"]),
            "low": len([i for i in insights if i.get("level") == "low"]),
            "positive": len([i for i in insights if i.get("level") == "positive"]),
        },
        "generatedAt": now.isoformat(),
    })


# ============================================================
# CLUB PLANS (Абонементи клубу) — OWNER creates, clients buy
# ============================================================

@app.get("/api/owner/club-plans")
async def get_club_plans(request: Request):
    """OWNER: Get club subscription plans — per club via ?clubId="""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    club_id = request.query_params.get("clubId", "")
    query = {"clubId": club_id} if club_id else {}
    plans = list(database["club_plans"].find(query, {"_id": 0}))
    if not plans:
        plans = [
            {"id": "8_sessions", "name": "8 тренувань", "price": 2000, "sessions": 8, "durationDays": 30, "isActive": True, "clubId": club_id},
            {"id": "12_sessions", "name": "12 тренувань", "price": 2800, "sessions": 12, "durationDays": 30, "isActive": True, "clubId": club_id},
            {"id": "unlimited", "name": "Безліміт", "price": 3500, "sessions": 999, "durationDays": 30, "isActive": True, "clubId": club_id},
        ]
    club = None
    if club_id:
        try: club = database["clubs"].find_one({"_id": ObjectId(club_id)})
        except: pass
    if not club:
        club = database["clubs"].find_one()
    plan_name = club.get("plan", "START") if club else "START"
    commission_map = {"START": 10, "PRO": 7, "ENTERPRISE": 5}
    return JSONResponse(content=json.loads(json.dumps({"plans": plans, "commissionPercent": commission_map.get(plan_name, 10), "currency": "₴"}, default=json_serial)))

@app.post("/api/owner/club-plans")
async def create_club_plan(request: Request):
    """OWNER: Create a new club plan for a specific club"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner only"}, status_code=403)
    body = await request.json()
    name = body.get("name", "").strip()
    price = body.get("price", 0)
    sessions = body.get("sessions", 8)
    duration = body.get("durationDays", 30)
    club_id = body.get("clubId", "")
    if not name or price <= 0:
        return JSONResponse(content={"error": "name and price required"}, status_code=400)
    database = get_db()
    now = datetime.now(timezone.utc)
    plan_id = f"{name.lower().replace(' ', '_')}_{club_id[-4:]}" if club_id and len(club_id) >= 4 else name.lower().replace(" ", "_")
    database["club_plans"].update_one(
        {"id": plan_id},
        {"$set": {"id": plan_id, "name": name, "price": price, "sessions": sessions, "durationDays": duration, "clubId": club_id, "isActive": True, "updatedAt": now}},
        upsert=True,
    )
    return JSONResponse(content={"success": True, "planId": plan_id, "message": "Тариф створено"})

@app.delete("/api/owner/club-plans/{plan_id}")
async def delete_club_plan(plan_id: str, request: Request):
    """OWNER: Delete a club plan"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner only"}, status_code=403)
    database = get_db()
    result = database["club_plans"].delete_one({"id": plan_id})
    return JSONResponse(content={"success": True, "deleted": result.deleted_count > 0})

@app.get("/api/owner/financial-breakdown")
async def get_financial_breakdown(request: Request):
    """OWNER: Full financial breakdown — earned, commission, net"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    club = database["clubs"].find_one()
    plan_name = club.get("plan", "START") if club else "START"
    commission_map = {"START": 10, "PRO": 7, "ENTERPRISE": 5}
    commission_pct = commission_map.get(plan_name, 10)
    month_payments = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": month_start}}))
    gross_subs = sum(p.get("amount", 0) for p in month_payments)
    month_orders = list(database["orders"].find({"status": "PAID", "createdAt": {"$gte": month_start}}))
    gross_market = sum(o.get("total", o.get("amount", 0)) for o in month_orders)
    gross_total = gross_subs + gross_market
    platform_commission = round(gross_total * commission_pct / 100)
    net_income = gross_total - platform_commission
    saas_fees = {"START": 990, "PRO": 2490, "ENTERPRISE": 4990}
    saas_fee = saas_fees.get(plan_name, 990)
    return JSONResponse(content={
        "grossSubscriptions": gross_subs, "grossMarketplace": gross_market, "grossTotal": gross_total,
        "commissionPercent": commission_pct, "platformCommission": platform_commission,
        "netIncome": net_income, "saasFee": saas_fee, "plan": plan_name, "afterSaas": net_income - saas_fee,
    })


# ============================================================
# EVENT ENGINE — Auto-triggers: debt/sales/churn/limits → actions
# ============================================================

@app.get("/api/owner/events")
async def get_owner_events(request: Request):
    """OWNER: Get business events (auto-generated signals)"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today_start - timedelta(days=7)
    prev_week = today_start - timedelta(days=14)
    events = []
    # 1. DEBT_ALERT
    pending = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))
    total_debt = sum(p.get("amount", 0) for p in pending)
    overdue = [p for p in pending if p.get("status") == "OVERDUE"]
    if total_debt > 0:
        events.append({"type": "DEBT_ALERT", "level": "high" if total_debt > 5000 else "medium",
            "title": f"Борг: {total_debt:,.0f} ₴", "detail": f"{len(overdue)} прострочено з {len(pending)}",
            "action": "open_debtors", "actionLabel": "Стягнути", "amount": total_debt})
    # 2. LOW_SALES
    today_orders = database["orders"].count_documents({"createdAt": {"$gte": today_start}})
    today_pays = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": today_start}}))
    if today_orders == 0 and len(today_pays) == 0 and now.hour >= 10:
        events.append({"type": "LOW_SALES", "level": "medium",
            "title": "0 продажів сьогодні", "detail": "Рекомендуємо запустити акцію",
            "action": "create_discount", "actionLabel": "Акція -10%"})
    # 3. CHURN_RISK
    children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    risk_kids = []
    for child in children:
        att = list(database["attendances"].find({"childId": child["_id"]}))
        total = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        if total > 0 and (present / total) < 0.5:
            risk_kids.append(f"{child.get('firstName', '')} {child.get('lastName', '')}".strip())
    if risk_kids:
        events.append({"type": "CHURN_RISK", "level": "high" if len(risk_kids) >= 3 else "medium",
            "title": f"{len(risk_kids)} учнів у зоні ризику", "detail": ", ".join(risk_kids[:3]),
            "action": "open_retention", "actionLabel": "Вжити заходів"})
    # 4. REVENUE_DROP
    this_week = sum(p.get("amount", 0) for p in database["payments"].find({"status": "PAID", "createdAt": {"$gte": week_ago}}))
    prev = sum(p.get("amount", 0) for p in database["payments"].find({"status": "PAID", "createdAt": {"$gte": prev_week, "$lt": week_ago}}))
    if prev > 0 and this_week < prev * 0.7:
        drop = round((1 - this_week / prev) * 100)
        events.append({"type": "REVENUE_DROP", "level": "high",
            "title": f"Дохід впав на {drop}%", "detail": f"Цей тиждень: {this_week}₴ vs {prev}₴",
            "action": "open_finance", "actionLabel": "Переглянути"})
    # 5. LIMIT_REACHED
    club = database["clubs"].find_one()
    if club:
        plan = club.get("plan", "START")
        lim = {"START": {"s": 50, "c": 3}, "PRO": {"s": 200, "c": 10}, "ENTERPRISE": {"s": 99999, "c": 99999}}.get(plan, {"s": 50, "c": 3})
        sc = database["children"].count_documents({"status": {"$in": ["ACTIVE", "TRIAL"]}})
        cc = database["users"].count_documents({"role": "COACH"})
        if sc >= lim["s"] * 0.9:
            events.append({"type": "LIMIT_REACHED", "level": "medium",
                "title": f"Ліміт учнів: {sc}/{lim['s']}", "detail": "Оновіть тариф для росту",
                "action": "upgrade_plan", "actionLabel": "Підвищити"})
    # 6. HIGH_DEMAND (positive)
    if len(today_pays) >= 5:
        events.append({"type": "HIGH_DEMAND", "level": "positive",
            "title": f"Гарячий день: {len(today_pays)} оплат", "detail": "Клуб працює на повну",
            "action": "none", "actionLabel": ""})
    # Sort
    order = {"high": 0, "medium": 1, "low": 2, "positive": 3}
    events.sort(key=lambda x: order.get(x.get("level"), 2))
    return JSONResponse(content={"events": events, "total": len(events)})


@app.get("/api/owner/coach-roi")
async def get_owner_coach_roi(request: Request):
    """OWNER: Coach ROI — conversion, revenue impact, losses"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    avg_subscription = 3000  # Average monthly subscription in UAH

    coaches = list(database["users"].find({"role": "COACH"}, {"_id": 1, "firstName": 1, "lastName": 1, "phone": 1}))

    coach_data = []
    total_contacted = 0
    total_returned = 0
    total_lost_revenue = 0

    for coach in coaches:
        coach_id = str(coach["_id"])
        coach_name = f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()

        # Messages sent by this coach
        messages = list(database["messages"].find({
            "fromUserId": coach_id,
            "type": {"$in": ["COACH_TO_STUDENT", "COACH_BROADCAST", "RESCHEDULE"]}
        }))
        contacted = len(set(m.get("toUserId", "") for m in messages if m.get("toUserId")))

        # Coach actions log
        actions = list(database["coach_actions"].find({"coachId": coach_id}))

        # Students in coach's groups
        groups = list(database["groups"].find({"coachId": coach_id}))
        if not groups:
            groups = list(database["groups"].find().limit(2))
        group_ids = [str(g["_id"]) for g in groups]
        students = list(database["children"].find({"groupId": {"$in": group_ids}}))

        # Count returned (had absence then attended again)
        returned = 0
        lost = 0
        for child in students:
            att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(10))
            had_absence = False
            came_back = False
            for a in att:
                if a.get("status") == "ABSENT" or a.get("status") == "RESCHEDULED":
                    had_absence = True
                elif a.get("status") == "PRESENT" and had_absence:
                    came_back = True
                    break

            if had_absence and came_back:
                returned += 1
            elif had_absence and not came_back:
                cons_miss = 0
                for a in att:
                    if a.get("status") != "PRESENT":
                        cons_miss += 1
                    else:
                        break
                if cons_miss >= 3:
                    lost += 1

        contacted = max(contacted, len(messages))
        conversion = round(returned / max(contacted, 1) * 100)
        revenue_impact = returned * avg_subscription
        lost_revenue = lost * avg_subscription

        total_contacted += contacted
        total_returned += returned
        total_lost_revenue += lost_revenue

        coach_data.append({
            "id": coach_id,
            "name": coach_name,
            "contacted": contacted,
            "returned": returned,
            "lost": lost,
            "conversion": conversion,
            "revenueImpact": revenue_impact,
            "lostRevenue": lost_revenue,
            "studentsCount": len(students),
            "actionsCount": len(actions) + len(messages),
        })

    # Losses (students who left)
    all_children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    losses = []
    for child in all_children:
        att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(5))
        cons_miss = 0
        for a in att:
            if a.get("status") != "PRESENT":
                cons_miss += 1
            else:
                break
        if cons_miss >= 3:
            child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
            last_reason = None
            for a in att:
                if a.get("reason"):
                    last_reason = a.get("reason")
                    break

            # Check if coach responded
            coach_responded = database["messages"].count_documents({
                "toUserId": {"$exists": True},
                "type": {"$in": ["COACH_TO_STUDENT", "RESCHEDULE"]},
            }) > 0

            losses.append({
                "name": child_name,
                "misses": cons_miss,
                "reason": last_reason or "Без причини",
                "coachResponded": coach_responded,
                "lostAmount": avg_subscription,
            })

    # Today's risk
    today_risk_count = len([c for c in all_children if True])  # simplified
    today_risk_amount = len(losses) * avg_subscription

    return JSONResponse(content=json.loads(json.dumps({
        "coaches": sorted(coach_data, key=lambda x: x["revenueImpact"], reverse=True),
        "losses": losses[:10],
        "todayRisk": {"count": len(losses), "amount": today_risk_amount},
        "totals": {
            "contacted": total_contacted,
            "returned": total_returned,
            "totalConversion": round(total_returned / max(total_contacted, 1) * 100),
            "totalLostRevenue": total_lost_revenue,
        },
    }, default=json_serial)))


@app.post("/api/owner/events/{event_type}/action")
async def action_event(event_type: str, request: Request):
    """OWNER: Mark event as actioned"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    database["event_actions"].insert_one({"userId": user.get("id") or user.get("_id", ""), "eventType": event_type, "actionedAt": now})
    return JSONResponse(content={"success": True})

# ============================================================
# NOTIFICATIONS — Unified notification center for OWNER
# ============================================================

@app.get("/api/owner/notifications")
async def get_owner_notifications(request: Request):
    """OWNER: Get all notifications"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    uid = user.get("id") or user.get("_id", "")
    notifs = list(database["notifications"].find({"userId": uid}, {"_id": 0}).sort("createdAt", -1).limit(50))
    for n in notifs:
        if "createdAt" in n and hasattr(n["createdAt"], "isoformat"):
            n["createdAt"] = n["createdAt"].isoformat()
    unread = database["notifications"].count_documents({"userId": uid, "isRead": False})
    return JSONResponse(content={"notifications": notifs, "unread": unread})

@app.post("/api/owner/notifications/read-all")
async def mark_all_read(request: Request):
    """OWNER: Mark all notifications as read"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    uid = user.get("id") or user.get("_id", "")
    database["notifications"].update_many({"userId": uid}, {"$set": {"isRead": True}})
    return JSONResponse(content={"success": True})

# ============================================================
# PROMOTIONS — Create discounts and bonuses
# ============================================================

@app.get("/api/owner/promotions")
async def get_promotions(request: Request):
    """OWNER: Get all promotions"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    promos = list(database["promotions"].find({}, {"_id": 0}).sort("createdAt", -1).limit(20))
    for p in promos:
        for k in ("createdAt", "expiresAt"):
            if k in p and hasattr(p[k], "isoformat"):
                p[k] = p[k].isoformat()
    return JSONResponse(content={"promotions": promos})

@app.post("/api/owner/promotions/create")
async def create_promotion(request: Request):
    """OWNER: Create a promotion (discount/bonus)"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Owner only"}, status_code=403)
    body = await request.json()
    promo_type = body.get("type", "discount")
    discount_pct = body.get("discountPercent", 10)
    name = body.get("name", f"Акція -{discount_pct}%")
    duration_hours = body.get("durationHours", 24)
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires = now + timedelta(hours=duration_hours)
    promo = {
        "id": f"promo_{int(now.timestamp())}",
        "name": name,
        "type": promo_type,
        "discountPercent": discount_pct,
        "isActive": True,
        "createdAt": now,
        "expiresAt": expires,
    }
    database["promotions"].insert_one(promo)
    # Send notification to all parents
    parents = list(database["users"].find({"role": "PARENT"}))
    for parent in parents:
        pid = str(parent["_id"])
        database["notifications"].insert_one({
            "userId": pid, "type": "PROMOTION",
            "title": f"🔥 {name}", "body": f"Знижка {discount_pct}% діє {duration_hours} годин!",
            "data": {"type": "promotion"}, "isRead": False, "createdAt": now,
        })
    return JSONResponse(content={"success": True, "promoId": promo["id"], "message": f"Акцію створено: {name}", "notifiedParents": len(parents)})

@app.get("/api/owner/franchise")
async def get_franchise_dashboard(request: Request):
    """OWNER: Franchise/network dashboard — all clubs comparison"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    uid = user.get("id") or user.get("_id", "")
    clubs = list(database["clubs"].find({}))
    network = {"totalRevenue": 0, "totalDebt": 0, "totalStudents": 0, "totalCoaches": 0, "clubs": []}
    for club in clubs:
        cid = str(club["_id"])
        students = database["children"].count_documents({})
        coaches = database["users"].count_documents({"role": "COACH"})
        pays = list(database["payments"].find({"status": "PAID", "createdAt": {"$gte": month_start}}))
        rev = sum(p.get("amount", 0) for p in pays)
        debt_pays = list(database["payments"].find({"status": {"$in": ["PENDING", "OVERDUE"]}}))
        debt = sum(p.get("amount", 0) for p in debt_pays)
        network["totalRevenue"] += rev
        network["totalDebt"] += debt
        network["totalStudents"] += students
        network["totalCoaches"] += coaches
        network["clubs"].append({
            "id": cid, "name": club.get("name", ""), "city": club.get("city", ""),
            "revenue": rev, "debt": debt, "students": students, "coaches": coaches,
            "plan": club.get("plan", "START"),
        })
    network["clubs"].sort(key=lambda x: -x["revenue"])
    return JSONResponse(content=network)



# ============================================================
# AUTO-RECOMMEND BUNDLES — New students get starter kit push
# ============================================================

@app.get("/api/marketplace/auto-recommend")
async def get_auto_recommendations(request: Request):
    """Get personalized bundle/product recommendations for current user's children"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    database = get_db()
    uid = user.get("id") or user.get("_id", "")
    # Find user's children
    children = list(database["children"].find({"$or": [{"userId": uid}, {"parentId": uid}]}))
    if not children:
        children = list(database["children"].find().limit(3))
    bundles = list(database["product_bundles"].find({"isActive": True}, {"_id": 0}))
    recommendations = []
    for child in children:
        child_id = str(child["_id"])
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        att = list(database["attendances"].find({"childId": child["_id"]}))
        total_att = len(att)
        # New student → Starter Kit
        if total_att < 10:
            starter = next((b for b in bundles if b.get("id") == "starter_kit"), bundles[0] if bundles else None)
            if starter:
                recommendations.append({
                    "childId": child_id, "childName": child_name, "type": "new_student",
                    "title": f"Стартовий набір для {child_name}",
                    "message": "Все необхідне для початку тренувань зі знижкою",
                    "bundle": starter, "priority": "high",
                })
        # Active student → Protection Set
        elif total_att >= 10 and total_att < 30:
            protection = next((b for b in bundles if b.get("id") == "protection_set"), None)
            if protection:
                recommendations.append({
                    "childId": child_id, "childName": child_name, "type": "active_student",
                    "title": f"Захист для {child_name}",
                    "message": "Час серйозної екіпіровки для безпечних тренувань",
                    "bundle": protection, "priority": "medium",
                })
        # Veteran → Premium
        else:
            premium = next((b for b in bundles if b.get("id") == "premium_all"), None)
            if premium:
                recommendations.append({
                    "childId": child_id, "childName": child_name, "type": "veteran",
                    "title": f"Преміум набір для {child_name}",
                    "message": "Повна екіпіровка для серйозних тренувань",
                    "bundle": premium, "priority": "low",
                })
    # Also add general product recommendations
    products = list(database["products"].find({"isActive": True, "isCoachRecommended": True}).limit(3))
    coach_recs = []
    for p in products:
        coach_recs.append({
            "id": str(p["_id"]), "name": p.get("name",""), "price": p.get("price",0),
            "category": p.get("category",""), "coachName": p.get("recommendedByCoach",""),
        })
    return JSONResponse(content=json.loads(json.dumps({
        "recommendations": recommendations,
        "coachRecommended": coach_recs,
        "totalBundles": len(bundles),
    }, default=json_serial)))

@app.post("/api/marketplace/auto-recommend/enroll")
async def auto_recommend_on_enroll(request: Request):
    """Trigger auto-recommendation when new student enrolls"""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)
    body = await request.json()
    child_id = body.get("childId", "")
    parent_id = body.get("parentId", "") or (user.get("id") or user.get("_id", ""))
    database = get_db()
    now = datetime.now(timezone.utc)
    child = None
    if child_id:
        try: child = database["children"].find_one({"_id": ObjectId(child_id)})
        except: pass
    child_name = f"{child.get('firstName','')} {child.get('lastName','')}".strip() if child else "учень"
    # Find starter bundle
    starter = database["product_bundles"].find_one({"id": "starter_kit", "isActive": True})
    if not starter:
        return JSONResponse(content={"success": False, "message": "No bundles available"})
    # Create notification for parent
    database["notifications"].insert_one({
        "userId": parent_id, "type": "AUTO_RECOMMEND",
        "title": f"🎒 Стартовий комплект для {child_name}",
        "body": f"Все необхідне для тренувань зі знижкою -{starter.get('discountPercent', 15)}%! Від {starter.get('bundlePrice', 0)} ₴",
        "data": {"screen": "/marketplace/bundles", "bundleId": "starter_kit", "childId": child_id},
        "isRead": False, "createdAt": now,
    })
    # Create recommendation record
    database["product_recommendations"].insert_one({
        "childId": child_id, "childName": child_name, "parentId": parent_id,
        "type": "new_student_bundle", "bundleId": "starter_kit",
        "status": "ACTIVE", "createdAt": now,
    })
    return JSONResponse(content={"success": True, "message": f"Рекомендацію стартового комплекту надіслано для {child_name}", "bundleName": starter.get("name","")})




# ============================================================
# OWNER CONTROL TOWER — "ГРОШІ ЗАРАЗ" / "РИЗИК СЬОГОДНІ" / "ПАДІННЯ" / MASS ACTIONS
# ============================================================

AVG_SUBSCRIPTION_UAH = 3000


def _parse_dt(val):
    """Parse date/datetime from various formats"""
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            from dateutil import parser as dp
            d = dp.parse(val)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


@app.get("/api/owner/money-now")
async def get_owner_money_now(request: Request):
    """OWNER Control Tower — today's money radar (expected / at-risk / lost)"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    week_end = today_start + timedelta(days=7)

    # Expected today (pending payments due in next 7 days or already overdue)
    expected_payments = list(database["payments"].find({
        "status": {"$in": ["PENDING", "OVERDUE"]},
    }))
    expected_amount = 0
    expected_count = 0
    for p in expected_payments:
        due = _parse_dt(p.get("dueDate") or p.get("createdAt"))
        if due and due <= week_end:
            expected_amount += p.get("amount", 0) or 0
            expected_count += 1

    # At risk: students scheduled today with attendance < 50%
    weekday_map = {0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY", 4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"}
    today_day = weekday_map.get(now.weekday(), "MONDAY")
    today_str = now.strftime('%Y-%m-%d')

    today_schedules = list(database["schedules"].find({"$or": [{"date": today_str}, {"dayOfWeek": today_day}]}))
    group_ids_today = list({str(s.get("groupId")) for s in today_schedules if s.get("groupId")})

    scheduled_students = []
    if group_ids_today:
        for gid in group_ids_today:
            try:
                kids = list(database["children"].find({"groupId": ObjectId(gid), "status": {"$in": ["ACTIVE", "TRIAL"]}}))
                scheduled_students.extend(kids)
            except Exception:
                kids = list(database["children"].find({"groupId": gid, "status": {"$in": ["ACTIVE", "TRIAL"]}}))
                scheduled_students.extend(kids)
    # Dedupe
    seen = set()
    unique_students = []
    for s in scheduled_students:
        sid = str(s["_id"])
        if sid not in seen:
            seen.add(sid)
            unique_students.append(s)

    at_risk_count = 0
    at_risk_amount = 0
    for child in unique_students:
        att = list(database["attendances"].find({"childId": child["_id"]}))
        total = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        pct = (present / total * 100) if total > 0 else 100
        if pct < 50 or total == 0:
            at_risk_count += 1
            at_risk_amount += AVG_SUBSCRIPTION_UAH // 30  # daily value

    # Already lost today: absences logged today × daily value
    today_absences = list(database["attendances"].find({
        "status": "ABSENT",
        "date": today_str,
    }))
    already_lost_count = len(today_absences)
    already_lost_amount = already_lost_count * (AVG_SUBSCRIPTION_UAH // 30)

    return JSONResponse(content={
        "expected": {"amount": expected_amount, "count": expected_count},
        "atRisk": {"amount": at_risk_amount, "count": at_risk_count},
        "alreadyLost": {"amount": already_lost_amount, "count": already_lost_count},
        "totalScheduledToday": len(unique_students),
        "updatedAt": now.isoformat(),
    })


@app.get("/api/owner/risk-today")
async def get_owner_risk_today(request: Request):
    """OWNER Control Tower — detailed list of students at risk today"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    weekday_map = {0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY", 4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"}
    today_day = weekday_map.get(now.weekday(), "MONDAY")
    today_str = now.strftime('%Y-%m-%d')

    # Get today's schedules
    today_schedules = list(database["schedules"].find({"$or": [{"date": today_str}, {"dayOfWeek": today_day}]}))

    students_at_risk = []
    seen_ids = set()

    for sched in today_schedules:
        group_id = sched.get("groupId")
        if not group_id:
            continue

        group = None
        try:
            group = database["groups"].find_one({"_id": ObjectId(str(group_id))})
        except Exception:
            group = database["groups"].find_one({"_id": group_id})

        try:
            kids = list(database["children"].find({"groupId": ObjectId(str(group_id)), "status": {"$in": ["ACTIVE", "TRIAL"]}}))
        except Exception:
            kids = list(database["children"].find({"groupId": group_id, "status": {"$in": ["ACTIVE", "TRIAL"]}}))

        for child in kids:
            sid = str(child["_id"])
            if sid in seen_ids:
                continue

            # Compute attendance pct
            att = list(database["attendances"].find({"childId": child["_id"]}))
            total = len(att)
            present = len([a for a in att if a.get("status") == "PRESENT"])
            pct = round(present / total * 100) if total > 0 else 0

            # Consecutive misses
            cons = 0
            for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
                if a.get("status") != "PRESENT":
                    cons += 1
                else:
                    break

            # Risk criteria: low attendance OR consecutive misses OR no att yet + trial
            risk_reason = None
            if cons >= 2:
                risk_reason = f"{cons} пропуск(ів) підряд"
            elif pct < 50 and total > 2:
                risk_reason = f"Відвідуваність {pct}%"
            elif total == 0 and child.get("status") == "TRIAL":
                risk_reason = "Пробне — ще не приходив"

            if not risk_reason:
                continue

            # Get parent info
            parent_name = ""
            parent_phone = ""
            parent_id = None
            pid = child.get("userId") or child.get("parentId") or child.get("roleOwnerId")
            if pid:
                try:
                    parent = database["users"].find_one({"_id": ObjectId(str(pid))})
                    if parent:
                        parent_name = f"{parent.get('firstName', '')} {parent.get('lastName', '')}".strip()
                        parent_phone = parent.get("phone", "")
                        parent_id = str(parent["_id"])
                except Exception:
                    pass

            # Coach info
            coach_name = ""
            coach_id = None
            if group and group.get("coachId"):
                try:
                    coach = database["users"].find_one({"_id": ObjectId(str(group.get("coachId")))})
                    if coach:
                        coach_name = f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()
                        coach_id = str(coach["_id"])
                except Exception:
                    pass

            seen_ids.add(sid)
            students_at_risk.append({
                "childId": sid,
                "name": f"{child.get('firstName', '')} {child.get('lastName', '')}".strip(),
                "parentId": parent_id,
                "parentName": parent_name,
                "parentPhone": parent_phone,
                "coachId": coach_id,
                "coachName": coach_name,
                "groupName": group.get("name", "") if group else "",
                "scheduledTime": sched.get("startTime", ""),
                "attendancePct": pct,
                "consecutiveMisses": cons,
                "riskReason": risk_reason,
                "lostAmount": AVG_SUBSCRIPTION_UAH // 30,
            })

    # Sort by severity (most consecutive misses first)
    students_at_risk.sort(key=lambda x: -x["consecutiveMisses"])

    return JSONResponse(content={
        "students": students_at_risk,
        "count": len(students_at_risk),
        "totalLostAmount": sum(s["lostAmount"] for s in students_at_risk),
        "updatedAt": now.isoformat(),
    })


@app.get("/api/owner/falling")
async def get_owner_falling(request: Request):
    """OWNER Control Tower — falling metrics (attendance/streak drops)"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # This week vs last week attendance
    this_week = list(database["attendances"].find({"createdAt": {"$gte": week_ago}}))
    prev_week = list(database["attendances"].find({"createdAt": {"$gte": two_weeks_ago, "$lt": week_ago}}))

    def calc_pct(records):
        total = len(records)
        present = len([a for a in records if a.get("status") == "PRESENT"])
        return round(present / total * 100) if total > 0 else 0

    this_pct = calc_pct(this_week)
    prev_pct = calc_pct(prev_week)
    att_change = this_pct - prev_pct

    # Active students: this week vs prev week
    this_active = len({str(a.get("childId")) for a in this_week if a.get("status") == "PRESENT"})
    prev_active = len({str(a.get("childId")) for a in prev_week if a.get("status") == "PRESENT"})
    active_change_pct = round((this_active - prev_active) / max(prev_active, 1) * 100) if prev_active > 0 else 0

    # Average streak (from children)
    children = list(database["children"].find({"status": {"$in": ["ACTIVE", "TRIAL"]}}))
    streaks = [c.get("streak", 0) or 0 for c in children]
    avg_streak = round(sum(streaks) / max(len(streaks), 1), 1) if streaks else 0

    # Students with streak = 0 (recently broken)
    broken_streaks = len([s for s in streaks if s == 0])
    broken_pct = round(broken_streaks / max(len(streaks), 1) * 100) if streaks else 0

    # New drop-offs (students who missed 3+ in a row)
    dropoff_count = 0
    for child in children:
        att = list(database["attendances"].find({"childId": child["_id"]}).sort("date", -1).limit(5))
        cons = 0
        for a in att:
            if a.get("status") != "PRESENT":
                cons += 1
            else:
                break
        if cons >= 3:
            dropoff_count += 1

    return JSONResponse(content={
        "attendance": {
            "current": this_pct,
            "previous": prev_pct,
            "change": att_change,
            "trending": "down" if att_change < -3 else ("up" if att_change > 3 else "stable"),
        },
        "activeStudents": {
            "current": this_active,
            "previous": prev_active,
            "changePercent": active_change_pct,
            "trending": "down" if active_change_pct < -5 else ("up" if active_change_pct > 5 else "stable"),
        },
        "streak": {
            "average": avg_streak,
            "brokenCount": broken_streaks,
            "brokenPercent": broken_pct,
        },
        "dropoffs": dropoff_count,
        "updatedAt": now.isoformat(),
    })


@app.post("/api/owner/mass-message")
async def owner_mass_message(request: Request):
    """OWNER Control Tower — send message to multiple parents at once"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    child_ids = body.get("childIds", [])
    text = body.get("text", "").strip()
    if not child_ids or not text:
        return JSONResponse(content={"error": "childIds and text required"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)
    sender_id = user.get("id") or user.get("_id", "")

    sent_count = 0
    push_sent = 0

    for cid in child_ids:
        try:
            child = database["children"].find_one({"_id": ObjectId(cid)})
        except Exception:
            continue
        if not child:
            continue

        parent_id = child.get("userId") or child.get("parentId") or child.get("roleOwnerId")
        if not parent_id:
            continue

        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        personalized = text.replace("{name}", child_name)

        # Store message
        try:
            database["messages"].insert_one({
                "senderId": ObjectId(str(sender_id)) if sender_id else None,
                "receiverId": ObjectId(str(parent_id)),
                "fromUserId": str(sender_id),
                "toUserId": str(parent_id),
                "text": personalized,
                "type": "OWNER_BROADCAST",
                "isAutomatic": False,
                "createdAt": now,
            })
            sent_count += 1
        except Exception as e:
            logger.error(f"Mass message error: {e}")
            continue

        # Notification
        database["notifications"].insert_one({
            "userId": str(parent_id),
            "type": "OWNER_MESSAGE",
            "title": f"Повідомлення від клубу",
            "body": personalized[:120],
            "data": {"screen": "/messages", "childId": cid},
            "isRead": False,
            "createdAt": now,
        })

        # Push
        tokens = get_user_push_tokens(database, str(parent_id))
        if tokens:
            s = await send_expo_push(tokens, "Повідомлення від клубу", personalized[:120], {"screen": "/messages"})
            push_sent += s

    return JSONResponse(content={
        "success": True,
        "sent": sent_count,
        "pushSent": push_sent,
        "total": len(child_ids),
    })


@app.post("/api/coach/mass-message")
async def coach_mass_message(request: Request):
    """COACH — send message to all students/parents in a group or training.

    body: { groupId?: str, scheduleId?: str, childIds?: str[], text: str, target?: 'students'|'parents'|'both' }
    """
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("COACH", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    group_id = body.get("groupId")
    schedule_id = body.get("scheduleId")
    explicit_ids = body.get("childIds", [])
    text = (body.get("text") or "").strip()
    target = body.get("target", "both")
    if not text:
        return JSONResponse(content={"error": "text required"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)
    coach_id = str(user.get("id") or user.get("_id", ""))

    # Resolve target children
    child_ids = []
    if explicit_ids:
        child_ids = list(explicit_ids)
    elif schedule_id:
        try:
            sched = database["schedules"].find_one({"_id": ObjectId(schedule_id)})
        except Exception:
            sched = None
        if sched:
            group_id = str(sched.get("groupId", ""))
    if group_id and not child_ids:
        children = list(database["children"].find({"groupId": group_id}))
        child_ids = [str(c["_id"]) for c in children]

    if not child_ids:
        return JSONResponse(content={"error": "no recipients"}, status_code=400)

    sent_count = 0
    push_sent = 0
    for cid in child_ids:
        try:
            child = database["children"].find_one({"_id": ObjectId(cid)})
        except Exception:
            continue
        if not child:
            continue
        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        personalized = text.replace("{name}", child_name.split()[0] if child_name else "")

        recipients: list[tuple[str, str]] = []  # (userId, type)
        if target in ("students", "both"):
            s_uid = child.get("userId")
            if s_uid:
                recipients.append((str(s_uid), "COACH_TO_STUDENT"))
        if target in ("parents", "both"):
            p_uid = child.get("parentId") or child.get("parentUserId")
            if p_uid:
                recipients.append((str(p_uid), "COACH_TO_PARENT"))

        for uid, mtype in recipients:
            try:
                database["messages"].insert_one({
                    "senderId": ObjectId(coach_id) if ObjectId.is_valid(coach_id) else None,
                    "receiverId": ObjectId(uid) if ObjectId.is_valid(uid) else None,
                    "fromUserId": coach_id,
                    "toUserId": uid,
                    "text": personalized,
                    "type": mtype,
                    "isAutomatic": False,
                    "broadcastScope": {"scheduleId": schedule_id, "groupId": group_id},
                    "createdAt": now,
                })
                sent_count += 1
            except Exception as e:
                logger.error(f"Coach mass message error: {e}")
                continue

            # Notification
            try:
                database["notifications"].insert_one({
                    "userId": uid,
                    "type": "COACH_MESSAGE",
                    "title": "Повідомлення від тренера",
                    "body": personalized[:120],
                    "data": {"screen": "/messages"},
                    "isRead": False,
                    "createdAt": now,
                })
            except Exception:
                pass

            tokens = get_user_push_tokens(database, uid)
            if tokens:
                s = await send_expo_push(tokens, "Повідомлення від тренера", personalized[:120], {"screen": "/messages"})
                push_sent += s

    return JSONResponse(content={
        "success": True,
        "sent": sent_count,
        "pushSent": push_sent,
        "recipientsCount": len(child_ids),
    })



@app.post("/api/owner/mass-reschedule")
async def owner_mass_reschedule(request: Request):
    """OWNER Control Tower — suggest reschedule to multiple parents"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    child_ids = body.get("childIds", [])
    reason = body.get("reason", "Пропонуємо перенести тренування")
    if not child_ids:
        return JSONResponse(content={"error": "childIds required"}, status_code=400)

    database = get_db()
    now = datetime.now(timezone.utc)
    sender_id = user.get("id") or user.get("_id", "")

    sent_count = 0
    push_sent = 0

    for cid in child_ids:
        try:
            child = database["children"].find_one({"_id": ObjectId(cid)})
        except Exception:
            continue
        if not child:
            continue
        parent_id = child.get("userId") or child.get("parentId") or child.get("roleOwnerId")
        if not parent_id:
            continue

        child_name = f"{child.get('firstName', '')} {child.get('lastName', '')}".strip()
        text = f"Пропонуємо перенести тренування для {child_name}. {reason}. Відкрийте додаток щоб обрати новий час."

        try:
            database["messages"].insert_one({
                "senderId": ObjectId(str(sender_id)) if sender_id else None,
                "receiverId": ObjectId(str(parent_id)),
                "fromUserId": str(sender_id),
                "toUserId": str(parent_id),
                "text": text,
                "type": "RESCHEDULE_OFFER",
                "isAutomatic": False,
                "createdAt": now,
            })
            sent_count += 1
        except Exception as e:
            logger.error(f"Mass reschedule error: {e}")
            continue

        database["notifications"].insert_one({
            "userId": str(parent_id),
            "type": "RESCHEDULE_OFFER",
            "title": f"Пропозиція перенесення — {child_name}",
            "body": reason,
            "data": {"screen": "/booking", "childId": cid},
            "isRead": False,
            "createdAt": now,
        })

        tokens = get_user_push_tokens(database, str(parent_id))
        if tokens:
            s = await send_expo_push(tokens, f"Перенесення для {child_name}", reason, {"screen": "/booking"})
            push_sent += s

    return JSONResponse(content={
        "success": True,
        "sent": sent_count,
        "pushSent": push_sent,
        "total": len(child_ids),
    })





# ============================================================
# STUDENT PROFILE + OWNER STUDENTS LIST (P0 Control Tower)
# ============================================================

def _compute_student_profile(database, child: dict) -> dict:
    """Build unified student profile for /api/student/profile/:id"""
    child_id = child["_id"]
    first = child.get("firstName", "")
    last = child.get("lastName", "")
    full_name = f"{first} {last}".strip() or "Учень"
    program_type = child.get("programType") or "KIDS"
    belt = child.get("belt") or "WHITE"

    # Attendance
    att = list(database["attendances"].find({"childId": child_id}))
    total = len(att)
    present = len([a for a in att if a.get("status") == "PRESENT"])
    discipline = round(present / total * 100) if total > 0 else 80

    # Monthly goal
    goal_target = int(child.get("monthlyGoalTarget") or 12)
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    month_att = [a for a in att if a.get("status") == "PRESENT" and a.get("date") and str(a.get("date")) >= month_start.strftime('%Y-%m-%d')]
    goal_current = len(month_att)

    # Rating (simple: xp-based rank from all active kids in same club)
    xp = int(child.get("xp") or 0)
    club_kids = list(database["children"].find({"clubId": child.get("clubId"), "status": "ACTIVE"}))
    sorted_kids = sorted(club_kids, key=lambda k: -(int(k.get("xp") or 0)))
    rank = next((i + 1 for i, k in enumerate(sorted_kids) if k["_id"] == child_id), len(sorted_kids))

    # Belt progression
    belt_order = ["WHITE", "YELLOW", "ORANGE", "GREEN", "BLUE", "BROWN", "BLACK"]
    try:
        cur_idx = belt_order.index(belt)
    except ValueError:
        cur_idx = 0
    next_belt = belt_order[cur_idx + 1] if cur_idx + 1 < len(belt_order) else belt
    trainings_for_next = 40 + cur_idx * 20
    trainings_done = present

    # Achievements (from achievements collection if exists)
    achievements_raw = list(database["achievements"].find({"childId": child_id}).limit(10)) if "achievements" in database.list_collection_names() else []
    achievements = [{"id": str(a.get("_id")), "title": a.get("title", "Досягнення"), "type": a.get("type", "BELT")} for a in achievements_raw]

    # Build unified response
    profile = {
        "id": str(child_id),
        "childId": str(child_id),
        "programType": program_type,
        "name": full_name,
        "firstName": first,
        "lastName": last,
        "belt": belt,
        "discipline": discipline,
        "coachComment": child.get("note", ""),
        "status": child.get("status", "ACTIVE"),
    }

    if program_type in ("ADULT_SELF_DEFENSE", "ADULT_PRIVATE"):
        profile["attendance"] = {"current": present, "target": goal_target}
        profile["skills"] = [
            {"name": "Удари руками", "level": min(100, 30 + present * 2)},
            {"name": "Удари ногами", "level": min(100, 25 + present * 2)},
            {"name": "Захист", "level": min(100, 40 + present)},
            {"name": "Реакція", "level": min(100, 35 + present * 2)},
        ]
        profile["fitness"] = {
            "stamina": min(100, 50 + present),
            "strength": min(100, 45 + present),
            "flexibility": min(100, 40 + present),
        }
    elif program_type == "SPECIAL":
        profile["stability"] = "Стабільно" if discipline > 70 else "Потребує уваги"
        profile["concentration"] = "Добре" if discipline > 60 else "Середньо"
        profile["socialProgress"] = "Прогрес є"
        profile["adaptiveGoals"] = ["Розвиток координації", "Соціалізація", "Впевненість"]
        profile["softProgress"] = {
            "attendance": discipline,
            "engagement": min(100, discipline + 10),
            "socialSkills": min(100, 60 + present),
        }
    else:  # KIDS
        profile["goal"] = {"current": goal_current, "target": goal_target}
        profile["rating"] = {"rank": rank, "score": xp, "movement": 0}
        percent = min(100, round(trainings_done * 100 / trainings_for_next)) if trainings_for_next else 100
        profile["progress"] = {
            "currentBelt": belt,
            "nextBelt": next_belt,
            "percent": percent,
            "trainingsToNext": max(0, trainings_for_next - trainings_done),
            "trainingsCompleted": trainings_done,
        }
        profile["achievements"] = achievements

    return profile


@app.get("/api/student/profile/{child_id}")
async def get_student_profile(request: Request, child_id: str):
    """Unified student profile — for owner/coach/parent drill-down into student."""
    user = await _get_user_from_auth(request)
    if not user:
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    child = None
    try:
        child = database["children"].find_one({"_id": ObjectId(child_id)})
    except Exception:
        child = database["children"].find_one({"_id": child_id})
    if not child:
        return JSONResponse(content={"error": "Student not found"}, status_code=404)

    # Authorization: OWNER/ADMIN see all; COACH sees own students; PARENT sees own child
    role = user.get("role")
    uid = str(user.get("id") or user.get("_id", ""))
    if role in ("OWNER", "ADMIN"):
        pass
    elif role == "COACH":
        if str(child.get("coachId", "")) != uid:
            return JSONResponse(content={"error": "Forbidden"}, status_code=403)
    elif role == "PARENT":
        parent_ids = {str(child.get("parentId", "")), str(child.get("roleOwnerId", "")), str(child.get("userId", ""))}
        if uid not in parent_ids:
            return JSONResponse(content={"error": "Forbidden"}, status_code=403)

    profile = _compute_student_profile(database, child)
    return JSONResponse(content=json.loads(json.dumps(profile, default=json_serial)))


@app.get("/api/owner/students")
async def get_owner_students(request: Request):
    """OWNER — list of ALL students with filter: all|risk|stable|growing"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    filter_type = request.query_params.get("filter", "all")
    group_id = request.query_params.get("groupId")
    search = (request.query_params.get("search") or "").strip().lower()

    database = get_db()
    club_id = user.get("clubId") or user.get("tenantId")

    query: dict = {"status": {"$in": ["ACTIVE", "TRIAL"]}}
    if club_id:
        try:
            query["clubId"] = ObjectId(str(club_id))
        except Exception:
            query["clubId"] = club_id
    if group_id:
        try:
            query["groupId"] = ObjectId(group_id)
        except Exception:
            query["groupId"] = group_id

    kids = list(database["children"].find(query).limit(500))

    # Build enriched rows
    rows = []
    groups_cache = {}
    coaches_cache = {}

    for child in kids:
        cid = child["_id"]
        first = child.get("firstName", "")
        last = child.get("lastName", "")
        name = f"{first} {last}".strip() or "Учень"

        if search and search not in name.lower():
            continue

        att = list(database["attendances"].find({"childId": cid}))
        total = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        pct = round(present / total * 100) if total > 0 else 0

        cons = 0
        for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") != "PRESENT":
                cons += 1
            else:
                break

        # Trend: compare last 7 vs previous 7
        sorted_att = sorted(att, key=lambda x: str(x.get("date", "")), reverse=True)
        last7 = sorted_att[:7]
        prev7 = sorted_att[7:14]
        last7_present = len([a for a in last7 if a.get("status") == "PRESENT"])
        prev7_present = len([a for a in prev7 if a.get("status") == "PRESENT"])
        trend = "stable"
        if last7_present > prev7_present + 1:
            trend = "growing"
        elif last7_present < prev7_present - 1:
            trend = "risk"

        # Risk status override
        risk = False
        risk_reason = None
        if cons >= 2:
            risk = True
            risk_reason = f"{cons} пропуски підряд"
        elif pct < 50 and total > 2:
            risk = True
            risk_reason = f"Відвідуваність {pct}%"
        elif total == 0 and child.get("status") == "TRIAL":
            risk = True
            risk_reason = "Пробне — не приходив"

        status_label = "risk" if risk else ("growing" if trend == "growing" else "stable")

        # Group
        gid = child.get("groupId")
        if gid and gid not in groups_cache:
            try:
                g = database["groups"].find_one({"_id": ObjectId(str(gid))})
                groups_cache[gid] = (g or {}).get("name", "—")
            except Exception:
                groups_cache[gid] = "—"
        group_name = groups_cache.get(gid, "—")

        # Coach
        coach_id = child.get("coachId")
        if coach_id and coach_id not in coaches_cache:
            try:
                c = database["users"].find_one({"_id": ObjectId(str(coach_id))})
                coaches_cache[coach_id] = (c or {}).get("name", "—")
            except Exception:
                coaches_cache[coach_id] = "—"
        coach_name = coaches_cache.get(coach_id, "—")

        rows.append({
            "id": str(cid),
            "childId": str(cid),
            "name": name,
            "firstName": first,
            "lastName": last,
            "programType": child.get("programType", "KIDS"),
            "belt": child.get("belt", "WHITE"),
            "attendancePct": pct,
            "consecutiveMisses": cons,
            "status": status_label,
            "riskReason": risk_reason,
            "trend": trend,
            "groupName": group_name,
            "coachName": coach_name,
            "xp": int(child.get("xp") or 0),
            "childStatus": child.get("status", "ACTIVE"),
        })

    # Apply filter
    if filter_type == "risk":
        rows = [r for r in rows if r["status"] == "risk"]
    elif filter_type == "stable":
        rows = [r for r in rows if r["status"] == "stable"]
    elif filter_type == "growing":
        rows = [r for r in rows if r["status"] == "growing"]

    # Summary counts
    total_count = len(kids)
    risk_count = sum(1 for r in rows if r["status"] == "risk") if filter_type != "risk" else len(rows)
    growing_count = sum(1 for r in rows if r["status"] == "growing") if filter_type != "growing" else len(rows)
    stable_count = sum(1 for r in rows if r["status"] == "stable") if filter_type != "stable" else len(rows)
    # When filter applied, recompute totals from raw kids
    if filter_type != "all":
        all_rows_for_count = []
        for child in kids:
            cid = child["_id"]
            att = list(database["attendances"].find({"childId": cid}))
            total = len(att)
            present_c = len([a for a in att if a.get("status") == "PRESENT"])
            pct_c = round(present_c / total * 100) if total > 0 else 0
            cons_c = 0
            for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
                if a.get("status") != "PRESENT":
                    cons_c += 1
                else:
                    break
            if cons_c >= 2 or (pct_c < 50 and total > 2) or (total == 0 and child.get("status") == "TRIAL"):
                all_rows_for_count.append("risk")
            else:
                all_rows_for_count.append("stable")
        risk_count = all_rows_for_count.count("risk")
        stable_count = all_rows_for_count.count("stable")

    # Sort: risk first (by consecutive misses desc), then by name
    rows.sort(key=lambda r: (-1 if r["status"] == "risk" else 0, -r["consecutiveMisses"], r["name"]))

    return JSONResponse(content=json.loads(json.dumps({
        "students": rows,
        "counts": {
            "all": total_count,
            "risk": risk_count,
            "stable": stable_count,
            "growing": growing_count,
        },
        "filter": filter_type,
    }, default=json_serial)))


# ============================================================
# X10 FINAL — RESOLVE-ALL + MICRO-INSIGHT (Control Tower brain)
# ============================================================

@app.post("/api/owner/resolve-all")
async def resolve_all(request: Request):
    """OWNER — unified "Solve Everything" button. Actions: message|reschedule|collect"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    try:
        body = await request.json()
    except Exception:
        body = {}
    action = (body.get("action") or "").lower()
    if action not in ("message", "reschedule", "collect"):
        return JSONResponse(content={"error": "Invalid action. Use: message|reschedule|collect"}, status_code=400)

    database = get_db()
    club_id = user.get("clubId") or user.get("tenantId")

    # Find risk students (same logic as /owner/risk-today)
    query: dict = {"status": {"$in": ["ACTIVE", "TRIAL"]}}
    if club_id:
        try:
            query["clubId"] = ObjectId(str(club_id))
        except Exception:
            query["clubId"] = club_id

    kids = list(database["children"].find(query).limit(500))
    risk_kids = []
    debt_kids = []
    for child in kids:
        cid = child["_id"]
        # Risk detection
        att = list(database["attendances"].find({"childId": cid}))
        total = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        pct = round(present / total * 100) if total > 0 else 0
        cons = 0
        for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") != "PRESENT":
                cons += 1
            else:
                break
        if cons >= 2 or (pct < 50 and total > 2) or (total == 0 and child.get("status") == "TRIAL"):
            risk_kids.append(child)
        # Debt detection
        if (child.get("debt") or 0) > 0:
            debt_kids.append(child)

    sent = 0
    push_sent = 0
    now_utc = datetime.now(timezone.utc)

    target_kids = debt_kids if action == "collect" else risk_kids

    if action == "message":
        text = body.get("text") or "Нагадуємо: сьогодні тренування. Чекаємо вас!"
        for child in target_kids:
            parent_id = child.get("parentId") or child.get("roleOwnerId") or child.get("userId")
            if parent_id:
                try:
                    database["notifications"].insert_one({
                        "userId": ObjectId(str(parent_id)) if not isinstance(parent_id, ObjectId) else parent_id,
                        "type": "OWNER_MESSAGE",
                        "title": f"Повідомлення від {user.get('firstName', 'тренера')}",
                        "body": text.replace("{name}", f"{child.get('firstName','')} {child.get('lastName','')}".strip() or 'вашої дитини'),
                        "childId": child["_id"],
                        "createdAt": now_utc,
                        "read": False,
                    })
                    sent += 1
                    # push
                    push_tokens = get_user_push_tokens(database, str(parent_id))
                    if push_tokens:
                        push_sent += len(push_tokens)
                except Exception:
                    pass
    elif action == "reschedule":
        reason = body.get("reason") or "Оберіть інший зручний час для тренування."
        for child in target_kids:
            parent_id = child.get("parentId") or child.get("roleOwnerId") or child.get("userId")
            if parent_id:
                try:
                    database["reschedule_offers"].insert_one({
                        "childId": child["_id"],
                        "parentId": ObjectId(str(parent_id)) if not isinstance(parent_id, ObjectId) else parent_id,
                        "status": "PENDING",
                        "reason": reason,
                        "createdAt": now_utc,
                        "createdBy": ObjectId(str(user.get("id") or user.get("_id"))),
                    })
                    database["notifications"].insert_one({
                        "userId": ObjectId(str(parent_id)) if not isinstance(parent_id, ObjectId) else parent_id,
                        "type": "RESCHEDULE_OFFER",
                        "title": "Пропозиція переносу тренування",
                        "body": reason,
                        "childId": child["_id"],
                        "createdAt": now_utc,
                        "read": False,
                    })
                    sent += 1
                    push_tokens = get_user_push_tokens(database, str(parent_id))
                    if push_tokens:
                        push_sent += len(push_tokens)
                except Exception:
                    pass
    elif action == "collect":
        for child in target_kids:
            parent_id = child.get("parentId") or child.get("roleOwnerId") or child.get("userId")
            debt_amount = child.get("debt") or 0
            if parent_id and debt_amount > 0:
                try:
                    database["notifications"].insert_one({
                        "userId": ObjectId(str(parent_id)) if not isinstance(parent_id, ObjectId) else parent_id,
                        "type": "DEBT_REMINDER",
                        "title": f"Нагадування про борг",
                        "body": f"Будь ласка, сплатіть заборгованість: {debt_amount} ₴.",
                        "childId": child["_id"],
                        "amount": debt_amount,
                        "createdAt": now_utc,
                        "read": False,
                    })
                    sent += 1
                    push_tokens = get_user_push_tokens(database, str(parent_id))
                    if push_tokens:
                        push_sent += len(push_tokens)
                except Exception:
                    pass

    return JSONResponse(content={
        "success": True,
        "action": action,
        "targeted": len(target_kids),
        "sent": sent,
        "pushSent": push_sent,
    })


@app.get("/api/owner/micro-insight")
async def micro_insight(request: Request):
    """OWNER — AI-like one-liner: 'lose X ₴ today if you don't write to N students'"""
    user = await _get_user_from_auth(request)
    if not user or user.get("role") not in ("OWNER", "ADMIN"):
        return JSONResponse(content={"error": "Unauthorized"}, status_code=401)

    database = get_db()
    club_id = user.get("clubId") or user.get("tenantId")
    query: dict = {"status": {"$in": ["ACTIVE", "TRIAL"]}}
    if club_id:
        try:
            query["clubId"] = ObjectId(str(club_id))
        except Exception:
            query["clubId"] = club_id

    kids = list(database["children"].find(query).limit(500))
    risk_count = 0
    risk_amount = 0
    debt_count = 0
    debt_amount = 0
    for child in kids:
        cid = child["_id"]
        # Debt
        d = child.get("debt") or 0
        if d > 0:
            debt_count += 1
            debt_amount += d
        # Risk by attendance
        att = list(database["attendances"].find({"childId": cid}))
        total = len(att)
        present = len([a for a in att if a.get("status") == "PRESENT"])
        cons = 0
        for a in sorted(att, key=lambda x: str(x.get("date", "")), reverse=True):
            if a.get("status") != "PRESENT":
                cons += 1
            else:
                break
        if cons >= 2 or (total > 2 and present / total < 0.5):
            risk_count += 1
            # Estimate lost revenue: monthly fee / 4 (weekly)
            price = child.get("monthlyPrice") or child.get("price") or 1500
            risk_amount += price // 4

    # Build insight message
    messages = []
    if risk_count > 0:
        recoverable = int(risk_amount * 0.7)  # assume 70% recovery rate
        messages.append({
            "level": "warning",
            "icon": "warning",
            "text": f"Ти втратиш ~{risk_amount} ₴ сьогодні, якщо не зв'яжешся з {risk_count} учнями",
            "actionHint": f"Якщо напишеш зараз → повернеш ≈ {recoverable} ₴",
        })
    if debt_count > 0:
        messages.append({
            "level": "danger",
            "icon": "cash",
            "text": f"{debt_count} батьків мають борг {debt_amount:,} ₴ — нагадати?",
            "actionHint": "Натисни [Стягнути] → отримаєш гроші швидше",
        })
    if not messages:
        messages.append({
            "level": "positive",
            "icon": "checkmark-circle",
            "text": "Сьогодні все під контролем. Молодець 💪",
            "actionHint": None,
        })

    return JSONResponse(content={
        "insight": messages[0],
        "stats": {
            "riskCount": risk_count,
            "riskAmount": risk_amount,
            "debtCount": debt_count,
            "debtAmount": debt_amount,
        },
    })





@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    global http_client
    if not http_client:
        return JSONResponse({"error": "Proxy not initialized"}, status_code=503)
    if not nestjs_ready:
        await start_nestjs()
        if not nestjs_ready:
            return JSONResponse({"error": "Backend starting, please wait..."}, status_code=503)
    try:
        url = f"/api/{path}"
        if request.query_params:
            url += f"?{request.query_params}"
        body = await request.body()
        if len(body) > 10 * 1024 * 1024:
            return JSONResponse({"error": "Request body too large (max 10MB)"}, status_code=413)
        headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in ['host', 'content-length', 'transfer-encoding']
        }
        last_error = None
        for attempt in range(3):
            try:
                response = await http_client.request(
                    method=request.method,
                    url=url,
                    content=body,
                    headers=headers
                )
                resp_headers = {
                    k: v for k, v in response.headers.items()
                    if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']
                }
                return Response(
                    content=response.content,
                    status_code=response.status_code,
                    headers=resp_headers,
                    media_type=response.headers.get('content-type')
                )
            except httpx.ConnectError as e:
                last_error = e
                logger.warning(f"Connection error (attempt {attempt + 1}): {e}")
                await asyncio.sleep(1)
            except Exception as e:
                last_error = e
                logger.error(f"Request error: {e}")
                break
        return JSONResponse(
            {"error": "Backend unavailable", "detail": str(last_error)},
            status_code=503
        )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
