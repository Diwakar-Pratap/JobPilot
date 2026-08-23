import re

with open('frontend/app/dashboard/jobs/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad_fetch = "const res = await fetch(/api/jobs/export-filtered?, {"
good_fetch = "const res = await fetch(\/api/jobs/export-filtered?\, {"

content = content.replace("const res = await fetch(/api/jobs/export-filtered?, {", "const res = await fetch(\/api/jobs/export-filtered?\, {")
content = content.replace("headers: { Authorization: Bearer  }", "headers: { Authorization: Bearer \ }")

with open('frontend/app/dashboard/jobs/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed template literals!")
