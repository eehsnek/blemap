1. Project Overview
  Definition: What is BleMap? It is a problem and solution intelligence platform
  Problem Addressed: Find validated problems and solutions by real data and users powered by AI
  Target Users: Students, Scientists, Researchers, Community Leaders, Businessmen, Professionals, Technicians
  Core Value Proposition: Not sure what problem to look for? Find it at BleMap!

2. System Architecture
  Layers: Scraping, Pre-AI Database, Artificial Intelligence, Post-AI Database, UI
  Request-Response Flow Diagram:
    App to User: Display the problems or solutions
    User to App: Validate, confirm, search for problems or solutions

3. Tech Stack Justification
  Reddit API, Gemini API, and Snoowrap (A fully-featured JavaScript wrapper for the Reddit API)

4. Functional Requirements
  FOR SURE:
    a. User Management
      - Register with Email & Password
      - Log-in & Log-Out
      - State the User Roles: Prospector*, Poster, Guest, Commenter (verify the various roles since these roles are interchangeable)
      - Edit Profile (simple)
      - Handle Authentication via Supabase Auth* (verify this via AI)
    b. Case Submission
      Definition: handles the intake of user-submitted problems through a dual-track system — an AI-assisted track for general users and a trusted track for verified communities. The goal is to capture natural human expression while maintaining data integrity for the problem matrix.
        b1. Freeform Case Input
          - System must provide a single free-form text input field for problem submission
          - System must not present structured form fields to the user
          - System must accept natural language input without formatting requirements
          - System must display a submission button below the text input
          - System must display a placeholder prompt — "Describe your problem in your own words..."
        b2. Dual Track Routing
          - System must determine submission track upon form submission
          - System must route general user submissions through the AI-assisted track
          - System must route verified community submissions through the trusted track
          - System must identify the user track based on the account verification status and community membership
        b3.  AI-Assisted Track
          - System must send raw submission to Gemini API for processing
          - AI must validate whether the submission is a genuine problem or noise
          - AI must extract and generate the following from raw input:

            Structured problem summary
            Category classification
            Inferred pain level
            Gap score
            Prospector CTA

          - System must display AI-generated output to user for review before posting
          - System must allow user to confirm AI output as accurate
          - System must allow user to edit AI output before posting
          - System must not post case to matrix without explicit user confirmation
          - System must store AI-generated output permanently in Supabase upon confirmation
          - System must never regenerate AI output after confirmation — response is persisted
        b4. Trusted Track
          - System must allow verified community members to bypass AI layer
          - System must post trusted submissions directly to matrix without AI processing
          - System must still subject trusted submissions to community validation
          - System must still allow reporting of trusted submissions
        b5. AI Rejection Handling
          - System must notify user if AI determines submission is not a genuine problem
          - System must display a gentle, non-harsh rejection message
          - System must prompt user to elaborate rather than hard-blocking submission
          - System must allow user to resubmit with additional context
          - System must not permanently block any user based on single rejection
        b6. Duplicate Detection
          - System must check submitted problem against existing matrix entries
          - AI must determine if submission is semantically similar to existing problem
          - System must notify user if duplicate is detected
          - System must display existing similar problem to user
          - System must allow user to confirm existing problem instead of creating duplicate
          - System must increment pain score of existing problem upon user confirmation
        b7. Community Validation
          - System must hold all new submissions in pending state upon posting
          - System must make pending problems invisible on matrix
          - System must require minimum five confirmations before problem appears on matrix
          - System must auto-archive problems with zero confirmations after seven days
          - System must display confirmation count on pending problems to submitter
        b8. Domain Sensitivity Handling
          - System must detect if submission belongs to Law or Medicine domain
          - System must apply stricter AI validation to high sensitivity submissions
          - System must attach disclaimer to all Law and Medicine problem entries
          - Disclaimer must read: "Community suggested — not professional advice. Always consult a licensed professional."
        b9. Submission Persistence
          - System must store all confirmed submissions permanently in Supabase
          - System must store original raw user input alongside AI-generated output
          - System must record submission timestamp, user ID, track type, and domain
          - System must never delete confirmed submissions without admin authorization
        b10. Reporting
          - System must display a report button on every problem card
          - System must allow any user to flag a problem as fake, harmful, or irrelevant
          - System must send flagged problems to admin review queue
          - System must hide problem from matrix upon reaching five reports
          - System must restore problem if admin clears the report
    c. AI Validation & Convergence
      - Send every submitted case to the Gemini API for validation
      - Determine if the case submission is a genuine problem/solution or noise
      - Check if submission is similar to existing problems; converge similar problems into one weighted entry
      - generate a structured problem statement from raw input
      - gap score based on problem & existing solutions
      - generate a call to action for prospectors
    d. Web Scraping
      - scrape Reddit for real-world complaints via reddit api and Snoowrap
      - pull from relevant subreddits (r/mildlyinfuriating, r/legaladvice, r/askdocs)
      - extract post titles, bodies as problems
      - extract top comments as solutions
      - run automatically at defined intervals via Vercel Cron Jobs
      - scraped data passes through AI validation before storage
    e. Case Matrix
      - display validated case on a two-axis matrix where the Y-axis is pain level, X-axis is solution existence
      - cases are dots sized by pain score
      - dots colored by status (Amber for problem, Grey for mixed, Patine Green for solved)
      - Update matrix in real time when new cases are added via Supabase Realtime
      - allow users to hover over dots to preview the problem card and expand the full case
    f. Case Dossier?
      - display a row of domains
    g. Case Card
      - display full case statement, pain score, category tag, existing solutions, gap score, matrix position indicator (niche, urgent, case study, ignore), current status (unclaimed, claimed, solved), cta
      - the purpose of the system components
      - list of features: submission of problems (telephone?), AI validation, matrix display, solution proposal
      - The system must flag the case on sensitivity (simple = low; complex = high)
      - The system must display a disclaimer on all legal and medical problem cards
      - AI must apply stricter validation on high-sensitivity domain submissions
      - It needs an external prospector for it to be validated
    h. Problem-Solution Connection (not complete)
      - System must allow registered users to propose solutions to existing problems
      - System must display community-proposed solutions on the case
      - System must display Reddit comment solutions on the case
      - System must allow users to upvote solutions
      - System must label all community solutions with a disclaimer — "Community suggested — not professional advice."
      - AI must filter and validate the proposed case solution before displaying
      - AI must cluster similar solutions together
    i. Community Validation
      - System must allow users to claim, validate, solve, and bookmark a case
      - System must update pain score based on confirmations
      - The system must prevent users from confirming the same case twice
      - System must use confirmation count to influence matrix position
    j. Prospecting
      - System must allow the prospector to browse cases filtered by unclaimed status
      - System must allow the prospector to sort cases by gap score
      - System must allow the prospector to claim a case
      - System must increment the case status to Claimed when the prospector claims it
      - System must allow the prospector to mark a case as solved, hence incrementing it
      - System must update the problem status to Solved when the developer resolves it
    k. Search and Filter
      - System must allow users to search cases by keyword
      - System must allow users to filter by category
      - System must allow users to filter by status — Unclaimed, Claimed, Solved
      - System must allow users to filter by domain — Tech, Law, Medicine, Finance, etc.
      - System must allow users to switch between Matrix View and Table View
  NOT SURE:
    11. Real-time Updates (demo will be static for now)
      - System must update the matrix in real time when new problems are scraped
      - System must update the pain score in real time when users confirm a problem
      - System must update problem status in real time when the developer claims or solves it
    12. Notifications (conceptual first)
      - System must notify developers when a new high gap score problem appears
      - System must notify the problem poster when their problem receives a solution
      - System must notify users when a problem they confirmed gets solved
    13. Responsive Design and PWA (what framework is this)
      - System must be fully responsive on desktop, tablet, and mobile
      - System must function as a Progressive Web App
      - System must be installable on the mobile home screen
      - System must be accessible via public URL on Vercel

5. Non-functional requirements
- The system must perform like once run ra kay giatay nalang if kada change kay every 5 seconds (AI Response Persistence)
- Reddit scraper runs every X hours
- AI response time under X seconds

6. Use Case Diagram
- Actors: Guest, Registered User, Prospector, Admin

7. Use Case Description:
- Use case: "Submit a Case."
- Actor: Registered User
- Precondition: User is logged in
- Main Flow: Fill form -> submit -> ai validation -> stored in database
- Alternative flow: AI rejection -> user revises?

8. Entity Relationship Diagram
- Database tables, relationships
- Users, problems, solutions, upvotes, claims, and categories

9. Data Flow Diagram
- Reddit -> AI -> Supabase -> Frontend

10. UI Wireframes
- dashboard/matrix view
- problem card
- submission card
- developer view
- mobile layout

11. API Documentation
- Every endpoint your backend exposes
- GET /problems - fetch all problems
- POST /problems - submit new problem
- GET /problems/:id - fetch single problem
- POST /solution - submit solution

12. Development Roadmap
1. Environment & scaffolding - node/express setup, folder structure, dependencies, routes skeleton
2. AI validation & convergence layer - case operation via API + AI validation layer
3. reddit scraping - pull real complaints from subreddits
4. case lifecycle - case submission, claim case, propose solutions, mark solved
5. UI integration - wire frontend (case_submission, dossier, matrix, index, profile) to API endpoints

13. limitations and expansion plans
- more data sources, creative industry users, mobile app

14. glossary
- define key terms: pain score, gap score, convergence, problem intelligence

  









