import sqlite3, os, sys

db_path = os.path.join(os.path.dirname(__file__), 'jobpilot.db')
print(f"Migrating: {db_path}")

con = sqlite3.connect(db_path, timeout=30)
cur = con.cursor()

cur.execute("PRAGMA table_info(users)")
existing = [row[1] for row in cur.fetchall()]
print("Existing columns:", existing)

new_cols = [
    ("years_of_experience", "INTEGER"),
    ("ai_provider", "VARCHAR(50)"),
    ("ai_api_key", "VARCHAR(500)"),
]

for col, dtype in new_cols:
    if col not in existing:
        cur.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype}")
        print(f"  ✓ Added column: {col}")
    else:
        print(f"  - Already exists: {col}")

con.commit()
con.close()
print("Migration complete!")
