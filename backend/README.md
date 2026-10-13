# PlaceIn admin API

NestJS API for the head-office portal and the agency portal. PostgreSQL is local. Prisma holds the schema. Swagger is the contract.

## Run

PostgreSQL must already be running on `localhost:5432`. The app uses database `placein` and the local role `pino`.

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run start
```

- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Admin UI: `cd ../admin && npm run dev` then http://localhost:3000

Copy `.env.example` if `.env` is missing. `DATABASE_URL` must point at the local database.

## Demo accounts

Password for every seeded account: `PlaceIn2026!`

| Email | Role |
| --- | --- |
| ahad@placein.com | Super admin, finance access |
| support@placein.com | Admin / support, no finance |
| tech@placein.com | Maintenance, technical tickets and health only |
| sarah@aminaproperties.my | Owner of Amina Properties |

Invitation token for Aisyah Rahman: `invite-aisyah-demo`.

Forgot-password returns the reset token in the response because local email is not connected. Two-factor, when enabled, shows its code once.

## Rules enforced by the API

- An agency cannot read another agency.
- Maintenance cannot open invoices, exports of users, or billing settings.
- An accepted offer does not mark a property sold.
- A photo under the platform minimum cannot be published.
- Overdue or past-due subscriptions block new publication and leave existing live listings up.
- Payment status comes from payment attempt records.
- Sessions can be revoked.
