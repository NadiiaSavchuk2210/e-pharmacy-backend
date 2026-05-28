# E-Pharmacy Backend

NestJS REST API for an e-pharmacy application. The service exposes catalog,
pharmacy store, customer review, authentication, cart, and order endpoints
backed by MongoDB.

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

- Product catalog with filtering by category, discount, partial name search,
  sorting, and bounded result limits.
- Store listing for pharmacies, random store samples, nearest pharmacies, and
  store details.
- Customer review listing sorted by newest first.
- User registration, login, profile lookup, token refresh, and logout.
- Protected cart management with add/update/remove item support.
- Protected checkout flow that creates orders, clears carts, and atomically
  decreases numeric product stock.
- Protected order history and order status updates with allowed transition
  checks.
- Delivery quote calculation with a free-delivery threshold.
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
    decorators/                   Shared metadata decorators
    filters/                      Global exception formatter
    interceptors/                 Global success response wrapper
    types/                        Shared response types
    utils/                        Shared helpers
  config/                         Environment validation
  cart/                           Cart, checkout, and delivery quote module
    dto/                          Cart request DTOs
    helpers/                      Cart pricing, lookup, stock, and response helpers
    schemas/                      Cart and order Mongoose schemas
    types/                        Cart service/response types
  customer-reviews/               Customer review module
  orders/                         Order history and status module
  products/                       Product catalog module
    dto/                          Product request/query DTOs
      transformers/               Product DTO transform helpers
      validators/                 Product DTO custom validators
    schemas/                      Product Mongoose schema
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

| Variable            | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `MONGODB_URI`       | MongoDB connection string.                                              |
| `AUTH_TOKEN_SECRET` | Secret used to sign access and refresh tokens. Use a long random value. |

Optional variables:

| Variable                 | Default                 | Description                                                |
| ------------------------ | ----------------------- | ---------------------------------------------------------- |
| `PORT`                   | `3000`                  | HTTP server port.                                          |
| `CORS_ORIGIN`            | `http://localhost:5173` | Allowed frontend origin. Supports comma-separated values.  |
| `MONGODB_DB_NAME`        | Mongo URI default       | Database name to use from the MongoDB connection.          |
| `AUTH_TOKEN_TTL`         | `86400`                 | Access token lifetime in seconds.                          |
| `AUTH_REFRESH_TOKEN_TTL` | `604800`                | Refresh token lifetime in seconds when omitted at runtime. |

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

Keep MongoDB credentials in the backend environment only. Do not copy
`MONGODB_URI` or database credentials into frontend `.env` files.

Checkout uses MongoDB transactions in production. Local/non-production
standalone MongoDB instances that do not support transactions fall back to a
sequential checkout path so development checkout can still create the order,
decrement stock, and clear the cart.

For production/deployment, `MONGODB_URI` must point to MongoDB Atlas or another
replica set deployment.

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

| Method | Endpoint | Auth | Description                                     |
| ------ | -------- | ---- | ----------------------------------------------- |
| `GET`  | `/api`   | No   | Returns API name, status, and server timestamp. |

### Products

| Method  | Endpoint            | Auth | Description                                 |
| ------- | ------------------- | ---- | ------------------------------------------- |
| `POST`  | `/api/products`     | No   | Creates one product.                        |
| `GET`   | `/api/products`     | No   | Returns products sorted by name.            |
| `GET`   | `/api/products/:id` | No   | Returns one product by public product `id`. |
| `PATCH` | `/api/products/:id` | No   | Updates one product by public product `id`. |

Product query parameters:

| Parameter  | Type   | Default | Rules                                                                                                                                             |
| ---------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category` | string | none    | One of `Medicine`, `Heart`, `Head`, `Hand`, `Leg`, `Dental Care`, `Skin Care`. Matching is normalized and case-insensitive in the database query. |
| `name`     | string | none    | Partial case-insensitive search. Maximum 100 characters.                                                                                          |
| `discount` | number | none    | Integer from `0` to `100`. Accepts values like `70` or `70%` and matches numeric or string discount values in MongoDB.                            |
| `limit`    | number | `9`     | Integer from `1` to `100`. Controls products per page.                                                                                            |
| `page`     | number | `1`     | Integer from `1`. Controls the page number.                                                                                                       |

Examples:

```bash
curl "http://localhost:3000/api/products"
curl "http://localhost:3000/api/products?category=Medicine&limit=9&page=2"
curl "http://localhost:3000/api/products?name=aspirin"
curl "http://localhost:3000/api/products?category=Medicine&discount=70"
curl "http://localhost:3000/api/products/product-001"
```

Product create/update bodies may include reviewed rich description data:
`description`, `descriptionSections`, and `sourceUrl`. The API stores and
returns these fields from MongoDB; it does not generate medical description
text during requests.

Product list response:

```json
{
  "items": [
    {
      "id": "product-001",
      "photo": "https://example.com/product.png",
      "name": "Aspirin",
      "suppliers": "Acme Pharma",
      "stock": "In Stock",
      "price": "12.99",
      "discount": 70,
      "category": "Medicine",
      "description": "Reviewed product description.",
      "descriptionSections": [
        {
          "title": "Overview",
          "body": "Reviewed section text."
        }
      ],
      "sourceUrl": "https://example.com/source"
    }
  ],
  "meta": {
    "totalItems": 42,
    "currentPage": 1,
    "perPage": 9,
    "totalPages": 5
  }
}
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
  "discount": 70,
  "category": "Medicine",
  "description": "Reviewed product description.",
  "descriptionSections": [
    {
      "title": "Overview",
      "body": "Reviewed section text."
    }
  ],
  "sourceUrl": "https://example.com/source"
}
```

### Stores

| Method | Endpoint                     | Auth | Description                                                                                |
| ------ | ---------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `GET`  | `/api/stores`                | No   | Returns pharmacies sorted by name.                                                         |
| `GET`  | `/api/stores/nearest`        | No   | Returns nearest pharmacies sorted by rating descending, then name.                         |
| `GET`  | `/api/stores/random-nearest` | No   | Returns random nearest pharmacies from the database.                                       |
| `GET`  | `/api/stores/:id`            | No   | Returns one store from `pharmacies` or `nearest_pharmacies` by public `id` or Mongo `_id`. |

Store query parameters:

| Endpoint                     | Parameter | Default | Rules                                                                                                                       |
| ---------------------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/api/stores`                | `limit`   | `9`     | Integer from `1` to `100`. Controls pharmacies per page. Use `limit=6&random=true` for the home page medicine stores block. |
| `/api/stores`                | `page`    | `1`     | Integer from `1`. Controls the page number when `random` is not enabled.                                                    |
| `/api/stores`                | `random`  | `false` | Boolean. When `true`, returns a random sample from the pharmacies collection.                                               |
| `/api/stores/nearest`        | `limit`   | `10`    | Integer from `1` to `100`.                                                                                                  |
| `/api/stores/random-nearest` | `limit`   | `6`     | Integer from `1` to `100`. Controls the random sample size.                                                                 |

Examples:

```bash
curl "http://localhost:3000/api/stores?limit=9&page=2"
curl "http://localhost:3000/api/stores?limit=6&random=true"
curl "http://localhost:3000/api/stores/nearest?limit=5"
curl "http://localhost:3000/api/stores/random-nearest?limit=6"
curl "http://localhost:3000/api/stores/store-001"
```

Store list response:

```json
{
  "items": [
    {
      "id": "store-001",
      "name": "Central Pharmacy",
      "address": "1 Main St",
      "city": "Kyiv",
      "phone": "+380991112233",
      "rating": 4.8,
      "isOpen": true
    }
  ],
  "meta": {
    "totalItems": 24,
    "currentPage": 1,
    "perPage": 9,
    "totalPages": 3
  }
}
```

Store fields:

```json
{
  "id": "store-001",
  "name": "Central Pharmacy",
  "address": "1 Main St",
  "city": "Kyiv",
  "phone": "+380991112233",
  "rating": 4.8,
  "isOpen": true
}
```

Store responses expose `isOpen` as the open/closed state for both
`pharmacies` and `nearest_pharmacies` documents.

### Customer Reviews

| Method | Endpoint                | Auth | Description                             |
| ------ | ----------------------- | ---- | --------------------------------------- |
| `GET`  | `/api/customer-reviews` | No   | Returns reviews sorted by newest first. |

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

| Method | Endpoint              | Auth                  | Description                                                                     |
| ------ | --------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `POST` | `/api/user/register`  | No                    | Creates a user, returns an access token, and sets a refresh token cookie.       |
| `POST` | `/api/user/login`     | No                    | Authenticates a user, returns an access token, and sets a refresh token cookie. |
| `POST` | `/api/user/refresh`   | Refresh cookie        | Issues a new access token from the `refreshToken` cookie.                       |
| `GET`  | `/api/user/profile`   | Bearer token          | Returns full current user profile.                                              |
| `GET`  | `/api/user/user-info` | Bearer token          | Returns lightweight current user info.                                          |
| `GET`  | `/api/user/logout`    | Optional bearer token | Clears the refresh cookie and revokes the supplied access token when present.   |

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

| Field      | Rules                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `name`     | 2 to 60 characters. Letters, spaces, apostrophes, and hyphens only. Supports Latin and Ukrainian letters. |
| `email`    | Valid email, maximum 254 characters.                                                                      |
| `phone`    | Valid phone number.                                                                                       |
| `password` | 8 to 64 characters with uppercase, lowercase, number, and special character.                              |

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
fetch('https://e-pharmacy-backend-z5z2.onrender.com/api/user/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'nadiia@example.com',
    password: 'StrongPass1!',
  }),
});
```

### Cart

All cart endpoints require `Authorization: Bearer <token>` and return raw data
without the global success wrapper.

| Method | Endpoint                   | Auth         | Description                                                         |
| ------ | -------------------------- | ------------ | ------------------------------------------------------------------- |
| `GET`  | `/api/cart`                | Bearer token | Returns the current user's cart.                                    |
| `PUT`  | `/api/cart/update`         | Bearer token | Adds, updates, or removes one cart item.                            |
| `POST` | `/api/cart/delivery-quote` | Bearer token | Returns delivery and additional fee estimates for the current cart. |
| `POST` | `/api/cart/checkout`       | Bearer token | Creates an order from the cart and clears cart.                     |

Recommended checkout flow:

1. Use `PUT /api/cart/update` whenever the user adds, removes, or changes a
   product quantity.
2. Use `GET /api/cart` to render or confirm the authenticated user's saved
   server-side cart.
3. Call `POST /api/cart/checkout` with shipping and payment details only.
   The backend reads cart items from MongoDB, fetches current product data, and
   calculates prices server-side.

Update cart body:

```json
{
  "productId": "product-001",
  "quantity": 2
}
```

Set `quantity` to `0` to remove the product from the cart.

Cart response:

```json
{
  "items": [
    {
      "product": {
        "id": "product-001",
        "_id": "507f1f77bcf86cd799439011",
        "photo": "https://example.com/product.png",
        "name": "Aspirin",
        "suppliers": "Acme Pharma",
        "stock": "5",
        "price": "12.50",
        "category": "Medicine",
        "discount": 0
      },
      "quantity": 2
    }
  ],
  "totalItems": 2,
  "totalPrice": 25
}
```

Cart totals, delivery quote subtotal, and checkout order totals use the
server-side product price after applying the stored product `discount` when it
is present.

Delivery quote body:

```json
{
  "address": "Kyiv, Main 1"
}
```

Delivery quotes use the authenticated user's server-side cart subtotal.

Delivery quote response:

```json
{
  "subtotal": 25,
  "deliveryFee": 50,
  "additionalFee": 0,
  "freeDeliveryThreshold": 500,
  "amountToFreeDelivery": 475,
  "message": "Delivery and extra fees are calculated based on shipping address"
}
```

Checkout body:

Checkout uses the authenticated user's server-side cart. Do not send `items`
or prices in this request; add/update products first with `PUT /api/cart/update`
and confirm them with `GET /api/cart` when needed.

```json
{
  "shippingInfo": {
    "name": "Nadiia S",
    "email": "nadiia@example.com",
    "phone": "+380991112233",
    "address": "Kyiv, Main 1"
  },
  "paymentMethod": "cash_on_delivery",
  "comment": "Call before delivery"
}
```

Checkout response:

```json
{
  "order": {
    "id": "507f1f77bcf86cd799439012",
    "items": [
      {
        "productId": "product-001",
        "name": "Aspirin",
        "price": 12.5,
        "quantity": 2,
        "total": 25
      }
    ],
    "shippingInfo": {
      "name": "Nadiia S",
      "email": "nadiia@example.com",
      "phone": "+380991112233",
      "address": "Kyiv, Main 1"
    },
    "paymentMethod": "cash_on_delivery",
    "subtotal": 25,
    "deliveryFee": 50,
    "additionalFee": 0,
    "total": 75,
    "status": "pending",
    "createdAt": "2026-05-25T10:00:00.000Z"
  }
}
```

Checkout troubleshooting:

- `property items should not exist`: the client sent `items` to checkout.
  Remove `items` from the checkout body.
- `Cart is empty`: the authenticated user's server-side cart has no saved
  items. Call `PUT /api/cart/update` with the same bearer token, then verify
  with `GET /api/cart`.
- `Not enough stock`: requested quantity is larger than current product stock.
- `Internal server error`: check backend logs; unexpected errors are logged
  with stack traces by the global exception filter.

Cart implementation notes:

- Cart-only pure helpers live in `src/cart/helpers/cart.helpers.ts`.
- Shared order response types live in `src/common/types/order-response.types.ts`.
- Shared order and shipping serializers live in
  `src/common/utils/order-response.util.ts`.

### Orders

All order endpoints require `Authorization: Bearer <token>` and return raw data
without the global success wrapper.

| Method  | Endpoint                 | Auth         | Description                            |
| ------- | ------------------------ | ------------ | -------------------------------------- |
| `GET`   | `/api/orders`            | Bearer token | Returns current user's order history.  |
| `PATCH` | `/api/orders/:id/status` | Bearer token | Updates one order status when allowed. |

Order list response:

```json
{
  "orders": [
    {
      "id": "507f1f77bcf86cd799439012",
      "items": [
        {
          "productId": "product-001",
          "name": "Aspirin",
          "price": 12.5,
          "quantity": 2,
          "total": 25
        }
      ],
      "shippingInfo": {
        "name": "Nadiia S",
        "email": "nadiia@example.com",
        "phone": "+380991112233",
        "address": "Kyiv, Main 1"
      },
      "paymentMethod": "cash_on_delivery",
      "subtotal": 25,
      "deliveryFee": 50,
      "additionalFee": 0,
      "total": 75,
      "status": "pending",
      "createdAt": "2026-05-25T10:00:00.000Z"
    }
  ]
}
```

Update order status body:

```json
{
  "status": "paid"
}
```

Allowed status transitions:

| Current     | Allowed next statuses    |
| ----------- | ------------------------ |
| `pending`   | `paid`, `cancelled`      |
| `paid`      | `completed`, `cancelled` |
| `completed` | none                     |
| `cancelled` | none                     |

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

Cart and order controllers opt out of this wrapper and return their documented
payloads directly.

Error responses are formatted by the global exception filter:

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
  "error": "BAD_REQUEST",
  "timestamp": "2026-05-14T09:10:05.187Z",
  "path": "/api/products?limit=101"
}
```

Common errors:

| Status | Typical cause                                |
| ------ | -------------------------------------------- |
| `400`  | Invalid query parameter or request body.     |
| `401`  | Missing, invalid, expired, or revoked token. |
| `404`  | Unknown route or product not found.          |
| `409`  | Duplicate user email.                        |
| `500`  | Unhandled server error.                      |

## Database Collections

| Collection           | Used by               | Notes                                                    |
| -------------------- | --------------------- | -------------------------------------------------------- |
| `products`           | Product catalog       | Unique public id; indexed by category/name and discount. |
| `pharmacies`         | Store listing         | Indexed by name and public id.                           |
| `nearest_pharmacies` | Nearest store listing | Indexed by rating/name and public id.                    |
| `reviews`            | Customer reviews      | Indexed by creation date.                                |
| `users`              | Authentication        | Stores password hashes, not raw passwords.               |
| `carts`              | Cart module           | Stores one cart per authenticated user.                  |
| `orders`             | Orders module         | Stores checkout records and statuses.                    |

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
