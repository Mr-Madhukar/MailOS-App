# MailOS ⚡

> **Keyboard-First AI Command Center for Email and Calendar**

MailOS is a modern, high-performance productivity application that acts as a keyboard-driven command center for managing emails (Gmail) and schedules (Google Calendar). Guided by an integrated AI assistant, users can perform complex actions—such as summarizing threads, drafting responses, scheduling events, and checking agendas—using plain English and keyboard shortcuts.

---

## 🌐 Live Demo & Demo Credentials

You can access the live version of MailOS at: **[https://mailos-app.vercel.app](https://mailos-app.vercel.app)**

To test the application, you can use the following demo credentials:
* **Email:** `madhukar200202@gmail.com`
* **Password:** `Mailos@1`

---

## 🛠️ Tech Stack

MailOS is built using modern, type-safe, and scalable web technologies:

*   **Frontend & Routing**: [Next.js 14](https://nextjs.org/) (React, App Router, Server Actions)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [PostCSS](https://postcss.org/)
*   **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai/docs) (`ai` library)
*   **AI Inference Provider**: [OpenRouter API](https://openrouter.ai/) (defaulting to Gemma-4-31b-it)
*   **Integration Framework**: [Corsair SDK](https://github.com/corsair-dev/corsair) (`corsair`, `@corsair-dev/gmail`, `@corsair-dev/googlecalendar`) for secure, multi-tenant integration credential management
*   **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/) (Docker local, Neon Postgres in cloud)
*   **Package Manager**: [pnpm](https://pnpm.io/)

---

## 📂 Directory Structure

```filepath
MailOS App/
├── .next/                  # Next.js build outputs (gitignored)
├── drizzle/                # Drizzle migration SQL files
├── patches/                # Local pnpm patches for dependencies
├── scripts/                # Database checks, setup, and testing utilities
├── src/
│   ├── app/                # Next.js page layouts, auth routes, and API endpoints
│   │   ├── api/            # API endpoints (AI chat, settings, Gmail/Calendar OAuth callbacks)
│   │   ├── dashboard/      # Main keyboard-first command center page
│   │   ├── login/          # User authentication login page
│   │   └── signup/         # User registration page
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility modules (JWT helper, password hashing)
│   └── server/             # Database connection & Corsair server instances
├── docker-compose.yml      # Local Postgres database container definition
├── drizzle.config.ts       # Drizzle CLI and kit configuration
├── GOOGLE_SETUP.md         # Detailed guide to set up Google OAuth credentials
└── tsconfig.json           # TypeScript configuration
```

---

## 🚀 Getting Started

Follow these steps to run MailOS locally on your machine.

### Prerequisites

Ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [pnpm](https://pnpm.io/) (Package manager)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local database)

---

### Step 1: Install Dependencies

Clone the project and install packages using `pnpm`:

```bash
pnpm install
```

> [!NOTE]
> During installation, `pnpm` will automatically apply the local patch file under `/patches` to resolve event-type constraints inside `@corsair-dev/googlecalendar`.

---

### Step 2: Configure Environment Variables

Create your local `.env` file by copying the example template:

```bash
cp .env.example .env
```

Open the newly created `.env` file and configure the variables:
*   **`DATABASE_URL`**: Point this to your local PostgreSQL instance (default Docker container is `postgresql://postgres:postgres@localhost:5435/mailos`).
*   **`JWT_ACCESS_SECRET`**: Used to sign authentication cookies. You can generate a random 32-byte secret using:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
*   **`CORSAIR_KEK`**: The Key Encryption Key. This is a 32-character encryption key (prefixed with `kek_`) used by Corsair to encrypt third-party OAuth access tokens before writing them to the database.
*   **`OPENROUTER_API_KEY`**: Your OpenRouter API key.
*   **`CORSAIR_DEV_KEY`**: Your Corsair Developer Token.

---

### Step 3: Run Database Locally

Launch the local PostgreSQL instance inside Docker:

```bash
docker compose up -d
```

This starts a Postgres server listening on port `5435`.

---

### Step 4: Push Database Schema

Pushes the database tables directly from the TypeScript schema definition to your Postgres database:

```bash
npx drizzle-kit push
```

---

### Step 5: Configure Google OAuth Credentials

To connect Gmail and Google Calendar, you need to create a project in the Google Cloud Console.

1. Refer to [GOOGLE_SETUP.md](file:///d:/ALL%20CODING/ChaiCode%20WebDev/MailOS%20App/GOOGLE_SETUP.md) for step-by-step instructions.
2. After creating your credentials, fill in the following values in your `.env` file:
   *   `GOOGLE_OAUTH_CLIENT_ID`
   *   `GOOGLE_OAUTH_CLIENT_SECRET`
   *   `GOOGLE_OAUTH_REDIRECT_URI` (usually `http://localhost:3000/api/auth/callback`)

---

### Step 6: Start the App

Start the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Register an account, log in, go to the settings page, and connect your Gmail and Calendar accounts!

---

## 🗄️ Database Management

MailOS uses Drizzle ORM to manage database migrations and schema integrity. Here are useful database commands:

| Command | Description |
| :--- | :--- |
| `npx drizzle-kit push` | Push TypeScript schema modifications directly to the database. |
| `npx drizzle-kit generate` | Generate SQL migration scripts under `./drizzle`. |
| `npx drizzle-kit migrate` | Execute generated SQL migration files against the database. |
| `npx drizzle-kit studio` | Open Drizzle's interactive database GUI (starts on `http://localhost:11232`). |


