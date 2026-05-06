"Function first, UI later" - API-first development

Before we delve into UI, let's fundamentally answers these questions by developing function first:
- Does AI convergence actually work?
- Does the scraper pull real problems?
- Does the dual-track submission route correctly?
- Does the case matrix visualize meaningfully?

Note: There's actually UI, but it is barebones first.

Phase 2
Part 1 - Dummy First
- Supabase tables created
- Auth working (register, login)
- Case submission storing to database
- AI validation returning real output
- Test everything via Postman or Thunder Client

Part 2 - Scraper
- Does snoowrap connect?
- Reddit API pulling real posts
- Parser extracting problems and solutions (case)
- Are comments being filtered properly?
- Determine the extraction to case as either problem, mixed, or solution
- Pipeling storing to Supabase

Part 3 - Gemini
- Send one hardcoded clean prompt
- Does it return valid JSON?
- Correct structure expectation?

Part 4 - Test both Scraper and Gemini AI
- feed real reddit post into gemini
- does ai handle messy, informal language?
- does convergence detect duplicates correctly?

Tools: Thunder Client? Postman?