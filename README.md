# E-Pharmacy Backend

NestJS REST API for an e-pharmacy application. The service exposes catalog,
pharmacy store, customer review, and authentication endpoints backed by MongoDB.

## Live API

Deployed app URL:

```text
https://e-pharmacy-backend-z5z2.onrender.com
```

API base URL:

```text
https://e-pharmacy-backend-z5z2.onrender.com/api
```

Health check:

```bash
curl https://e-pharmacy-backend-z5z2.onrender.com/api
```

## Features

- Product catalog with filtering by category, partial name search, sorting, and
  bounded result limits.
- Store listing for pharmacies and nearest pharmacies.
- Customer review listing sorted by newest first.
- User registration, login, profile lookup, token refresh, and logout.
- Access token authentication with `Authorization: Bearer <token>`.
- Refresh token stored in an HTTP-only secure cookie.
- Password hashing with Node.js `crypto.scrypt`.
- Token revocation through an in-memory blacklist on logout.
- MongoDB integration through Mongoose schemas and indexes.
- Global request validation with DTO-based input rules.
- Global response wrapper for successful responses.
- Centralized exception formatting for validation, auth, database, and 404
  errors.
- CORS support for one or more configured frontend origins.

## Tech Stack

- Node.js
- NestJS 11
- TypeScript
- MongoDB
- Mongoose
- Jest
- ESLint
- Prettier

## Project Structure

```text
src/
  app.controller.ts               Health check endpoint
  app.module.ts                   Root module and MongoDB configuration
  main.ts                         App bootstrap, CORS, validation, filters
  common/
    filters/                      Global exception formatter
    interceptors/                 Global success response wrapper
    utils/                        Shared helpers
  config/                         Environment validation
  customer-reviews/               Customer review module
  products/                       Product catalog module
  stores/                         Pharmacy store module
  token-blacklist/                Access token revocation service
  user/                           Authentication and user profile module
test/                             E2E tests
```

## Getting Started

### Prerequisites

- Node.js 20 or newer recommended.
- npm.
- MongoDB database, either local or hosted with MongoDB Atlas.

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. |
| `AUTH_TOKEN_SECRET` | Secret used to sign access and refresh tokens. Use a long random value. |

Optional variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port. |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin. Supports comma-separated values. |
| `MONGODB_DB_NAME` | Mongo URI default | Database name to use from the MongoDB connection. |
| `AUTH_TOKEN_TTL` | `86400` | Access token lifetime in seconds. |
| `AUTH_REFRESH_TOKEN_TTL` | `604800` | Refresh token lifetime in seconds when omitted at runtime. |

Example:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=e-pharmacy
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
AUTH_TOKEN_TTL=3600
AUTH_REFRESH_TOKEN_TTL=2592000
```

### Run Locally

```bash
npm run start:dev
```

Local API base URL:

```text
http://localhost:3000/api
```

## API Reference

All endpoints are prefixed with `/api`.

### Health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api` | No | Returns API name, status, and server timestamp. |

### Products

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/products` | No | Returns products sorted by name. |
| `GET` | `/api/products/:id` | No | Returns one product by public product `id`. |

Product query parameters:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `category` | string | none | One of `Medicine`, `Heart`, `Head`, `Hand`, `Leg`, `Dental Care`, `Skin Care`. Matching is normalized and case-insensitive in the database query. |
| `name` | string | none | Partial case-insensitive search. Maximum 100 characters. |
| `limit` | number | `50` | Integer from `1` to `100`. |

Examples:

```bash
curl "http://localhost:3000/api/products"
curl "http://localhost:3000/api/products?category=Medicine&limit=20"
curl "http://localhost:3000/api/products?name=aspirin"
curl "http://localhost:3000/api/products/product-001"
```

Product fields:

```json
{
  "id": "product-001",
  "photo": "https://example.com/product.png",
  "name": "Aspirin",
  "suppliers": "Acme Pharma",
  "stock": "In Stock",
  "price": "12.99",
  "category": "Medicine"
}
```

### Stores

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/stores` | No | Returns pharmacies sorted by name. |
| `GET` | `/api/stores/nearest` | No | Returns nearest pharmacies sorted by rating descending, then name. |

Store query parameters:

| Endpoint | Parameter | Default | Rules |
| --- | --- | --- | --- |
| `/api/stores` | `limit` | `50` | Integer from `1` to `100`. |
| `/api/stores/nearest` | `limit` | `10` | Integer from `1` to `100`. |

Examples:

```bash
curl "http://localhost:3000/api/stores?limit=25"
curl "http://localhost:3000/api/stores/nearest?limit=5"
```

Store fields:

```json
{
  "name": "Central Pharmacy",
  "address": "1 Main St",
  "city": "Kyiv",
  "phone": "+380991112233",
  "rating": 4.8
}
```

### Customer Reviews

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/customer-reviews` | No | Returns reviews sorted by newest first. |

Example:

```bash
curl "http://localhost:3000/api/customer-reviews"
```

Review fields:

```json
{
  "name": "Customer Name",
  "testimonial": "Great service."
}
```

### Authentication

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/user/register` | No | Creates a user, returns an access token, and sets a refresh token cookie. |
| `POST` | `/api/user/login` | No | Authenticates a user, returns an access token, and sets a refresh token cookie. |
| `POST` | `/api/user/refresh` | Refresh cookie | Issues a new access token from the `refreshToken` cookie. |
| `GET` | `/api/user/profile` | Bearer token | Returns full current user profile. |
| `GET` | `/api/user/user-info` | Bearer token | Returns lightweight current user info. |
| `GET` | `/api/user/logout` | Optional bearer token | Clears the refresh cookie and revokes the supplied access token when present. |

Registration body:

```json
{
  "name": "Nadiia S",
  "email": "nadiia@example.com",
  "phone": "+380991112233",
  "password": "StrongPass1!"
}
```

Registration validation:

| Field | Rules |
| --- | --- |
| `name` | 2 to 60 characters. Letters, spaces, apostrophes, and hyphens only. Supports Latin and Ukrainian letters. |
| `email` | Valid email, maximum 254 characters. |
| `phone` | Valid phone number. |
| `password` | 8 to 64 characters with uppercase, lowercase, number, and special character. |

Login body:

```json
{
  "email": "nadiia@example.com",
  "password": "StrongPass1!"
}
```

Auth response data:

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Nadiia S",
    "email": "nadiia@example.com",
    "phone": "+380991112233",
    "role": "user"
  },
  "token": "<access-token>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

Use the access token for protected routes:

```bash
curl \
  -H "Authorization: Bearer <access-token>" \
  "http://localhost:3000/api/user/profile"
```

When calling auth endpoints from a browser frontend, include credentials so the
refresh cookie can be stored and sent:

```ts
fetch("https://e-pharmacy-backend-z5z2.onrender.com/api/user/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "nadiia@example.com",
    password: "StrongPass1!",
  }),
});
```

## Response Format

Successful responses are wrapped by the global response interceptor:

```json
{
  "statusCode": 200,
  "message": "Request completed successfully",
  "data": {}
}
```

`POST /api/user/register` returns `201` with:

```json
{
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {}
}
```

Error responses are formatted by the global exception filter:

```json
{
  "statusCode": 400,
  "message": [
    "limit must not be greater than 100"
  ],
  "error": "BAD_REQUEST",
  "timestamp": "2026-05-14T09:10:05.187Z",
  "path": "/api/products?limit=101"
}
```

Common errors:

| Status | Typical cause |
| --- | --- |
| `400` | Invalid query parameter or request body. |
| `401` | Missing, invalid, expired, or revoked token. |
| `404` | Unknown route or product not found. |
| `409` | Duplicate user email. |
| `500` | Unhandled server error. |

## Database Collections

| Collection | Used by | Notes |
| --- | --- | --- |
| `products` | Product catalog | Indexed by category and name. |
| `pharmacies` | Store listing | Indexed by name. |
| `nearest_pharmacies` | Nearest store listing | Indexed by rating and name. |
| `reviews` | Customer reviews | Indexed by creation date. |
| `users` | Authentication | Stores password hashes, not raw passwords. |

## Available Scripts

```bash
npm run start:dev      # Start local server in watch mode
npm run start          # Start Nest app
npm run start:prod     # Start compiled app from dist/
npm run build          # Compile TypeScript
npm run format         # Format source and test files
npm run lint           # Run ESLint with auto-fix
npm test               # Run unit tests
npm run test:watch     # Run unit tests in watch mode
npm run test:cov       # Run tests with coverage
npm run test:e2e       # Run E2E tests
```

## Validation and Security Notes

- Unknown request body fields are rejected by the global validation pipe.
- Request bodies are limited to `1mb`.
- `x-powered-by` is disabled.
- CORS credentials are enabled.
- Refresh tokens are sent as secure, HTTP-only, `SameSite=None` cookies.
- Browsers may not store the secure refresh cookie over plain HTTP localhost.
  Use the deployed HTTPS API, a local HTTPS proxy, or an API client when testing
  refresh-cookie behavior locally.
- Access token logout uses an in-memory blacklist. In a multi-instance or
  serverless deployment, move token revocation to a shared store such as Redis.
- Use a strong `AUTH_TOKEN_SECRET` in every non-local environment.

## Deployment Notes

For Render or a similar Node.js host:

1. Set the build command to:

   ```bash
   npm install && npm run build
   ```

2. Set the start command to:

   ```bash
   npm run start:prod
   ```

3. Configure environment variables in the hosting dashboard.
4. Set `CORS_ORIGIN` to the deployed frontend URL. Use a comma-separated list
   if local and deployed frontends both need access.
5. Ensure the MongoDB provider allows connections from the hosting platform.

## Quality Checks

Before opening a pull request or deploying, run:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```
