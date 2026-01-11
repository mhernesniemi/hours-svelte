# in5ide

## Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose

## Development Setup

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start services

Start PostgreSQL and LDAP containers:

```sh
docker compose up -d
```

### 3. Configure environment

Create and modify `.env` file based on `.env.example`:

```sh
cp .env.example .env
```

### 4. Setup database

Push the schema to the database:

```sh
pnpm db:push
```

### 5. Start development server

```sh
pnpm dev
```

## Test Users

LDAP test user credentials:

- Username: `testuser`
- Password: `testpassword`

## Drizzle Studio for database management

Open Drizzle Studio:

```sh
pnpm db:studio
```
