# Cloud Stock Management

Modular Monolith stock management system built with Node.js, Express, React, PostgreSQL 16, Redis 7, and Prisma ORM.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and Redis:
   ```bash
   docker compose up -d
   ```

4. Run migrations and database seed:
   ```bash
   npm run db:deploy
   npm run db:seed
   ```

5. Start development servers:
   ```bash
   npm run dev:api    # API: http://localhost:5001
   npm run dev:web    # Web: http://localhost:5173
   ```

## Default Seed Accounts

- Admin: `admin@cloudstock.dev` / `AdminPassword123!`
- Manager: `manager@cloudstock.dev` / `ManagerPassword123!`
- Staff: `staff@cloudstock.dev` / `StaffPassword123!`

## Project Structure

- `apps/api`: Express.js REST API and Prisma ORM
- `apps/web`: React Vite frontend
- `packages/shared`: Shared types, interfaces, and enums
- `docs/`: Architecture, ERD, and API contract specifications
