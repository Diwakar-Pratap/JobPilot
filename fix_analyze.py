import re

with open('backend/routers/resume/analyze.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('f\\\"\\\"\\\"', 'f\"\"\"')
content = content.replace('\\\"\\\"\\\"', '\"\"\"')

with open('backend/routers/resume/analyze.py', 'w', encoding='utf-8') as f:
    f.write(content)

