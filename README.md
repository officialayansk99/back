# Equiti Capitals Backend (MERN + MT5 Microservice)

## Architecture

The backend follows clean architecture layers:

- Controller layer: HTTP request/response mapping.
- Service layer: business rules and orchestration.
- Repository layer: persistence access with Mongoose.
- DTO layer: Joi input validation.
- Middleware: auth guard, role guard, validation, centralized errors.

## Folder Structure

```text
src/
  app.js
  server.js
  config/
    env.js
    database.js
  routes/
    index.js
  common/
    errors/
    middleware/
    utils/
  integrations/
    mt5/
      mt5.client.js
  modules/
    auth/
      controllers/
      services/
      routes/
      dto/
    users/
      model/
      repositories/
    mt5Accounts/
      model/
      controllers/
      services/
      repositories/
      routes/
      dto/
    admin/
      controllers/
      services/
      routes/
      dto/
    transactions/
      model/
      controllers/
      services/
      repositories/
      routes/
      dto/
```

## Environment Variables

Copy `.env.example` to `.env` and fill values.

- `MONGO_URI`
- `JWT_SECRET`
- `MT5_SERVICE_BASE_URL`
- `MT5_LOGIN`
- `MT5_PASSWORD`
- `MT5_SERVER`

## Run

```bash
npm install
npm run dev
```

## API Routes (Examples)

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

### Client

- `GET /api/v1/mt5-accounts/mine`
- `POST /api/v1/mt5-accounts/mine`
- `GET /api/v1/transactions/mine`

### Super Admin

- `GET /api/v1/admin/clients`
- `PATCH /api/v1/admin/users/:userId`
- `DELETE /api/v1/admin/users/:userId`
- `GET /api/v1/admin/analytics`
- `POST /api/v1/mt5-accounts/reset-password`
- `POST /api/v1/transactions/manual`

## Sample Success Response

```json
{
  "success": true,
  "message": "MT5 account created successfully",
  "data": {
    "account": {
      "login": 1082341,
      "type": "live",
      "server": "MT5-Live-01",
      "leverage": 500,
      "group": "LIVE-GROUP-01"
    },
    "credentialsDelivery": {
      "channel": "secure-inbox",
      "sentAt": "2026-04-17T10:10:10.100Z"
    }
  },
  "meta": null
}
```

## Sample Error Response

```json
{
  "success": false,
  "error": {
    "code": "KYC_NOT_APPROVED",
    "message": "KYC must be approved before creating live account",
    "details": null
  }
}
```

## Error Handling Strategy

- `AppError` for controlled domain/application errors.
- Centralized error middleware for all exceptions.
- Joi validation errors converted to structured payload.
- Unknown errors normalized to `INTERNAL_SERVER_ERROR`.

## MT5 Integration Pattern

Node never calls MT5 Manager API directly.

Node calls dedicated MT5 microservice endpoints:

- `POST /mt5/create-account`
- `POST /mt5/reset-password`
- `GET /mt5/account/:login`

## Scaling Best Practices

- Stateless API + JWT suitable for horizontal scaling.
- Layered services/repositories simplify domain growth.
- Move heavy analytics to async workers/queues.
- Add Redis for caching account snapshots and sessions.
- Use idempotency keys for money movement endpoints.
- Add audit trail and immutable ledger for financial compliance.
- Add distributed tracing and structured logs for observability.
- Add circuit breaker/retry policies around MT5 microservice.
