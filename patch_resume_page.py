with open('frontend/app/dashboard/resume/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { ResumeUploader, ResumeCard, AiProfileView, ParsedProfileView, AIChat } from './_components';",
    "import { ResumeUploader, ResumeCard, AiProfileView, ParsedProfileView, AIChat, ATSMatcher } from './_components';"
)

content = content.replace(
    "                {/* AI Chat */}",
    "                <ATSMatcher primaryResume={primaryResume} />\n\n                {/* AI Chat */}"
)

with open('frontend/app/dashboard/resume/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added ATSMatcher to page.tsx!")
