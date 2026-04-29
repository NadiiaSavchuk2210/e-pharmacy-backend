# E-Pharmacy Backend

NestJS backend for the e-pharmacy project with:

- MongoDB connection through Mongoose
- global CORS configuration
- unified success responses
- centralized error handling with readable messages
- request validation for query params

## Environment variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Default values:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=e-pharmacy
AUTH_TOKEN_SECRET=change-me-to-a-long-random-string
AUTH_TOKEN_TTL=86400
```

## Install dependencies

```bash
npm install
```

## Run MongoDB

Before starting the server, make sure MongoDB is running locally or replace `MONGODB_URI` with your Atlas connection string.

If you use MongoDB Atlas, keep the cluster URI in `MONGODB_URI` and set:

```env
MONGODB_DB_NAME=e-pharmacy
```

That makes Mongoose read the `products` collection from the `e-pharmacy` database instead of Atlas's default database.

Example local connection:

```bash
mongod --dbpath ~/data/db
```

## Start development server

```bash
npm run start:dev
```

The API is available under:

```text
http://localhost:3000/api
```

## Main endpoints

- `GET /api` - health check
- `GET /api/products` - get all products
- `GET /api/products?category=Medicine` - filter by category
- `GET /api/products?name=asp` - filter by product name
- `GET /api/products/:id` - get one product by public `id`
- `POST /api/user/register` - register a user with `name`, `email`, `phone`, `password`
- `POST /api/user/login` - authenticate a user with `email`, `password`
- `GET /api/user/profile` - get the current user profile with `Authorization: Bearer <token>`

## Authentication flow

`POST /api/user/register` request body:

```json
{
  "name": "Nadiia S",
  "email": "nadiia@example.com",
  "phone": "+380991112233",
  "password": "StrongPass1!"
}
```

The same response data shape is returned by both `register` and `login`:

```json
{
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Nadiia S",
      "email": "nadiia@example.com",
      "phone": "+380991112233",
      "role": "user"
    },
    "token": "<bearer-token>",
    "tokenType": "Bearer",
    "expiresIn": 86400
  }
}
```

`login` returns the same `data` object with HTTP status `200`.

## Response format

Successful response:

```json
{
  "statusCode": 200,
  "message": "Request completed successfully",
  "data": {}
}
```

Error response:

```json
{
  "statusCode": 400,
  "message": [
    "category must be one of the following values: Medicine, Heart, Head, Hand, Leg, Dental Care, Skin Care"
  ],
  "error": "BAD_REQUEST",
  "timestamp": "2026-04-29T00:00:00.000Z",
  "path": "/api/products"
}
```

## Verification

Verified locally in this workspace:

- `npm run build`
- `npm test -- --runInBand`
- `npm run test:e2e -- --runInBand`

MongoDB server startup was not verified here because no local MongoDB instance was running on `127.0.0.1:27017`.
