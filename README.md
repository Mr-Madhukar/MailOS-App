# MailOS — Keyboard-First AI Command Center for Gmail + Google Calendar

MailOS puts Gmail and Google Calendar in one fast, keyboard-driven window where every action — triage, reply, search, schedule — is a single keystroke.

Built on the [Corsair SDK](https://corsair.dev) for the Corsair Hackathon.

## Key Features

- **Inbox** — Cache-first Gmail inbox with stale-while-revalidate, search, label management, and keyboard navigation (`j/k/Enter`).
- **AI Priority** — Rank inbox threads by urgency using OpenAI + Corsair Gmail data.
- **Human-in-the-Loop Queue** — Every AI-suggested or queued action (email sends, drafts, calendar events) stages in the Queue for your approval before execution.
- **AI Agent** — Plain-language assistant with 57 tools that draft mail, check calendar events, and build schedules under your approval.
- **Calendar** — Quick keyboard-first view, event scheduling, and rescheduling.
- **MCP Server** — Full Model Context Protocol (MCP) server at `/mcp` exposing 57 tools to connect your inbox to Cursor or Claude directly.

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (PostgreSQL)
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (User OAuth)
- `CORSAIR_DEV_KEY` / `CORSAIR_KEK` (Gmail + Calendar SDK integrations)
- `OPENAI_API_KEY` (AI Agent and ranking)

### 3. Run Migrations & Start Servers
```bash
# Apply database migrations
pnpm db:migrate

# Start Next.js frontend (:3000) and Express API (:8000)
pnpm dev
```

---

## CLI & Development Commands

```bash
pnpm dev              # Start development servers
pnpm build            # Production build
pnpm check-types      # TypeScript typecheck
pnpm lint             # Code linting
pnpm test             # Run test suites
pnpm db:migrate       # Apply migrations
```

---

## Documentation

For full details on the architecture, MCP tools list, and production runbooks:
- [Technical Architecture Guide](file:///d:/ALL%20CODING/ChaiCode%20WebDev/Project/MailOS-App/DOCS.md)
- [Judge Walkthrough & Demo Login](file:///d:/ALL%20CODING/ChaiCode%20WebDev/Project/MailOS-App/JUDGE_WALKTHROUGH.md)
