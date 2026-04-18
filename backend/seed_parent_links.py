"""
ATAKA — Parent↔Child linkage seed
Links existing seeded children to parent users.
"""
import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
import random

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def main():
    parents = list(db.users.find({"role": "PARENT"}))
    children = list(db.children.find({"parentId": {"$exists": False}}))

    if not parents:
        print("No PARENT users found. Nothing to link.")
        return

    if not children:
        print("No unlinked children. Nothing to link.")
        return

    print(f"Found {len(parents)} parents and {len(children)} unlinked children.")

    # Primary demo parent: +380501234569 (Ірина)
    primary = db.users.find_one({"phone": "+380501234569"})

    # Distribute children:
    # Primary parent gets 3 children (demo-quality), others get 1–2 each
    random.seed(42)
    random.shuffle(children)

    linked = 0
    if primary:
        # Assign first 3 children to primary parent
        for ch in children[:3]:
            db.children.update_one(
                {"_id": ch["_id"]},
                {"$set": {"parentId": primary["_id"], "updatedAt": datetime.now(timezone.utc)}}
            )
            linked += 1
        remaining = children[3:]
    else:
        remaining = children

    # Distribute remaining across other parents (1–3 each)
    other_parents = [p for p in parents if not primary or p["_id"] != primary["_id"]]
    if other_parents and remaining:
        idx = 0
        for p in other_parents:
            n = random.randint(1, 3)
            for _ in range(n):
                if idx >= len(remaining):
                    break
                ch = remaining[idx]
                db.children.update_one(
                    {"_id": ch["_id"]},
                    {"$set": {"parentId": p["_id"], "updatedAt": datetime.now(timezone.utc)}}
                )
                linked += 1
                idx += 1
            if idx >= len(remaining):
                break

    print(f"Linked {linked} children to parents.")

    # Seed a few parent invites (invite codes parents can redeem)
    db.parent_invites.create_index("code", unique=True)
    existing_codes = set(d["code"] for d in db.parent_invites.find({}, {"code": 1}))
    unlinked_after = list(db.children.find({"parentId": {"$exists": False}}).limit(5))
    created_codes = []
    for ch in unlinked_after:
        for _ in range(20):
            code = ''.join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))
            if code not in existing_codes:
                existing_codes.add(code)
                break
        try:
            db.parent_invites.insert_one({
                "code": code,
                "childId": ch["_id"],
                "used": False,
                "createdAt": datetime.now(timezone.utc),
            })
            created_codes.append((code, f"{ch.get('firstName','?')} {ch.get('lastName','?')}"))
        except Exception:
            pass

    # Verify primary parent has linkage
    if primary:
        n = db.children.count_documents({"parentId": primary["_id"]})
        print(f"\n✓ Primary parent '+380501234569' (Ірина) now has {n} children linked")
        for c in db.children.find({"parentId": primary["_id"]}):
            print(f"  - {c.get('firstName','?')} {c.get('lastName','?')} ({c.get('belt','WHITE')})")

    if created_codes:
        print(f"\n✓ Created {len(created_codes)} parent invite codes:")
        for code, name in created_codes:
            print(f"  - {code}  →  {name}")

    print("\n✅ Parent↔Child linkage complete.")

if __name__ == "__main__":
    main()
