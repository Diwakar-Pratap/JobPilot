import re

with open('frontend/app/dashboard/jobs/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"const res = await fetch\([^\n]+", "const res = await fetch(\/api/jobs/export-filtered?\, {", content)
content = re.sub(r"headers: \{ Authorization: Bearer [^\n]+", "headers: { Authorization: Bearer \ }", content)

with open('frontend/app/dashboard/jobs/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed with regex!")
