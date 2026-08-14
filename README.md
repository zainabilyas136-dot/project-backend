# Project 5 Backend — Inventory, Sales Order & Stock Movement System

Backend REST API for **Project 5: Inventory, Sales Order & Stock Movement System**. It is built with Node.js, Express.js, MongoDB, Mongoose, JWT authentication, bcryptjs password hashing, role-based authorization, validation, centralized error handling, inventory transactions, and reporting endpoints.

## Live Links

- **Backend API:** https://project-backend-1-nyty.onrender.com
- **Frontend:** https://ideo-project-khaki.vercel.app
- **Backend Repository:** https://github.com/itshamzadev/project-backend

API routes are served under:

```text
https://project-backend-1-nyty.onrender.com/api
```

The backend root endpoint returns an API-running response.

---

## Technology Stack

- Node.js
- Express.js 5
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcryptjs
- CORS
- dotenv
- Node.js built-in test runner
- Nodemon for local development

---

## Main Backend Features

- JWT-based login and protected API routes
- Password hashing with bcryptjs
- Role-based authorization for Admin, Sales Staff, and Warehouse Staff
- Admin user management
- Product and category management
- Customer management and order history
- Stock receipt processing with multiple product items
- Sales orders with multiple dynamic items
- Backend-calculated prices, subtotals, discount, and total
- Stock availability validation
- Order workflow management
- Transactional stock reduction when an order is confirmed
- Transactional stock restoration after an approved cancellation
- Stock movement history for inventory increases and decreases
- Low-stock, sales, inventory, and top-selling product reporting
- Search, filters, pagination, validation, and consistent error handling
- Atomic order-number generation using the Counter helper model

---

## User Roles

### Admin

Admin users can:

- Manage users
- Manage products and categories
- Access customers and orders
- Confirm orders
- Process order statuses
- Approve or reject cancellation requests
- Access stock receipts and stock movements
- View sales and inventory reports

### Sales Staff

Sales users can:

- View products
- Manage customers
- Create sales orders
- View their permitted orders
- Edit Draft orders
- Confirm orders
- Cancel Draft orders
- Request cancellation of eligible confirmed/processing orders

### Warehouse Staff

Warehouse users can:

- View products
- Record stock receipts
- View stock movements
- Process allowed order status changes
- View permitted dashboard information

---

## Demo Accounts

The seed script creates these test accounts:

| Role            | Email                   | Password       |
| --------------- | ----------------------- | -------------- |
| Admin           | `admin@example.com`     | `admin123`     |
| Sales Staff     | `sales@example.com`     | `sales123`     |
| Warehouse Staff | `warehouse@example.com` | `warehouse123` |

> These credentials are intended for project demonstration only.

---

## Project Structure

```text
server/
├── config/
│   └── db.js
├── controllers/
│   ├── auth.controller.js
│   ├── category.controller.js
│   ├── customer.controller.js
│   ├── order.controller.js
│   ├── product.controller.js
│   ├── report.controller.js
│   ├── stockMovement.controller.js
│   ├── stockReceipt.controller.js
│   └── user.controller.js
├── middlewares/
│   ├── admin.middleware.js
│   ├── adminOrSales.middleware.js
│   ├── adminOrWarehouse.middleware.js
│   ├── error.middleware.js
│   ├── protect.middleware.js
│   ├── sales.middleware.js
│   ├── validateObjectId.middleware.js
│   └── warehouse.middleware.js
├── models/
│   ├── Category.js
│   ├── Counter.js
│   ├── Customer.js
│   ├── Product.js
│   ├── SalesOrder.js
│   ├── StockMovement.js
│   ├── StockReceipt.js
│   └── User.js
├── routes/
│   ├── index.routes.js
│   └── modules/
│       ├── auth.routes.js
│       ├── category.routes.js
│       ├── customer.routes.js
│       ├── order.routes.js
│       ├── product.routes.js
│       ├── report.routes.js
│       ├── stockMovement.routes.js
│       ├── stockReceipt.routes.js
│       └── user.routes.js
├── services/
├── tests/
│   └── critical.test.js
├── utils/
├── .env.example
├── package.json
├── seed.js
└── server.js
```

---

## Database Models

The backend contains eight Mongoose models:

1. `User`
2. `Category`
3. `Product`
4. `Customer`
5. `SalesOrder`
6. `StockReceipt`
7. `StockMovement`
8. `Counter` — helper model used for atomic order number generation

Important relationships include:

- Product → Category
- SalesOrder → Customer
- SalesOrder → User (`createdBy`)
- SalesOrder items → Product
- StockReceipt → User (`receivedBy`)
- StockReceipt items → Product
- StockMovement → Product
- StockMovement → User (`createdBy`)
- StockMovement stores `referenceType` and `referenceId` for the related inventory event

---

## Environment Variables

Create a `.env` file inside the backend folder:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=http://localhost:5173
```

For the deployed backend, set `CLIENT_URL` to the deployed frontend URL:

```env
CLIENT_URL=https://ideo-project-khaki.vercel.app
```

### Optional Test Variable

The automated critical workflow test requires a separate MongoDB URI:

```env
TEST_MONGODB_URI=mongodb://<test-database-uri>
```

The test database must support MongoDB transactions. A replica set or MongoDB Atlas deployment is recommended.

> Never commit real `.env` files, database credentials, or JWT secrets to Git.

---

## Local Installation

### 1. Clone the backend repository

```bash
git clone https://github.com/itshamzadev/project-backend.git
cd project-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env` using `.env.example` and enter your MongoDB connection string and JWT secret.

### 4. Seed demo data

```bash
npm run seed
```

**Important:** the current seed script clears the existing users, categories, products, customers, sales orders, stock receipts, stock movements, and counters before inserting demo data. Do not run it against a database containing data you need to keep.

### 5. Start development server

```bash
npm run dev
```

Or run normally:

```bash
npm start
```

Default local backend URL:

```text
http://localhost:5000
```

Default API base URL:

```text
http://localhost:5000/api
```

---

## NPM Commands

```bash
npm run dev
```

Starts the backend with Nodemon.

```bash
npm start
```

Starts the backend with Node.js.

```bash
npm run seed
```

Resets project collections and inserts demo data.

```bash
npm run check
```

Runs a Node.js syntax check on `server.js`.

```bash
npm test
```

Runs the optional critical API workflow test. `TEST_MONGODB_URI` must be configured before running it.

---

# API Documentation

All routes below use the `/api` prefix.

Protected endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

## Authentication

| Method | Endpoint          | Access        | Purpose                           |
| ------ | ----------------- | ------------- | --------------------------------- |
| POST   | `/api/auth/login` | Public        | Log in with email and password    |
| GET    | `/api/auth/me`    | Authenticated | Return logged-in user information |

There is no public registration endpoint. Users are created by an Admin.

---

## Users

All user-management endpoints require Admin access.

| Method | Endpoint         | Purpose                                            |
| ------ | ---------------- | -------------------------------------------------- |
| GET    | `/api/users`     | List users with supported search/filter/pagination |
| POST   | `/api/users`     | Create a user                                      |
| PATCH  | `/api/users/:id` | Update a user                                      |

---

## Products

| Method | Endpoint            | Access        | Purpose                                              |
| ------ | ------------------- | ------------- | ---------------------------------------------------- |
| GET    | `/api/products`     | Authenticated | List/search/filter/paginate products                 |
| GET    | `/api/products/:id` | Authenticated | Get product details                                  |
| POST   | `/api/products`     | Admin         | Create product                                       |
| PATCH  | `/api/products/:id` | Admin         | Update product                                       |
| DELETE | `/api/products/:id` | Admin         | Delete/deactivate product according to backend rules |

---

## Categories

| Method | Endpoint                  | Access        | Purpose                                               |
| ------ | ------------------------- | ------------- | ----------------------------------------------------- |
| GET    | `/api/categories`         | Authenticated | List categories                                       |
| GET    | `/api/categories/options` | Authenticated | Return category options for forms                     |
| POST   | `/api/categories`         | Admin         | Create category                                       |
| PATCH  | `/api/categories/:id`     | Admin         | Update category                                       |
| DELETE | `/api/categories/:id`     | Admin         | Delete/deactivate category according to backend rules |

---

## Customers

Customer routes require Admin or Sales access.

| Method | Endpoint             | Purpose                                            |
| ------ | -------------------- | -------------------------------------------------- |
| GET    | `/api/customers`     | List/search/paginate customers                     |
| GET    | `/api/customers/:id` | Get customer details and related order information |
| POST   | `/api/customers`     | Create customer                                    |
| PATCH  | `/api/customers/:id` | Update customer                                    |
| DELETE | `/api/customers/:id` | Delete customer when allowed                       |

---

## Sales Orders

| Method | Endpoint                               | Access            | Purpose                                              |
| ------ | -------------------------------------- | ----------------- | ---------------------------------------------------- |
| POST   | `/api/orders`                          | Admin / Sales     | Create a Draft order                                 |
| GET    | `/api/orders`                          | Authenticated     | List permitted orders with search/filter/pagination  |
| GET    | `/api/orders/:id`                      | Authenticated     | Get permitted order details                          |
| PATCH  | `/api/orders/:id`                      | Admin / Sales     | Edit a permitted Draft order                         |
| PATCH  | `/api/orders/:id/confirm`              | Admin / Sales     | Confirm order and reduce stock transactionally       |
| PATCH  | `/api/orders/:id/status`               | Admin / Warehouse | Process an allowed order status transition           |
| PATCH  | `/api/orders/:id/cancel`               | Admin / Sales     | Directly cancel an eligible Draft order              |
| PATCH  | `/api/orders/:id/request-cancellation` | Admin / Sales     | Request cancellation for an eligible order           |
| PATCH  | `/api/orders/:id/cancellation/approve` | Admin             | Approve cancellation and restore stock when required |
| PATCH  | `/api/orders/:id/cancellation/reject`  | Admin             | Reject cancellation request                          |

Order totals are calculated by the backend. Client-supplied totals are not trusted.

Stock quantities are validated so inventory cannot become negative.

---

## Stock Receipts

Stock receipt routes require Admin or Warehouse access.

| Method | Endpoint              | Purpose                                           |
| ------ | --------------------- | ------------------------------------------------- |
| POST   | `/api/stock-receipts` | Record incoming stock with multiple product items |
| GET    | `/api/stock-receipts` | List stock receipts                               |

Creating a stock receipt updates product stock and creates corresponding StockMovement records inside a MongoDB transaction.

---

## Stock Movements

| Method | Endpoint               | Access            | Purpose                         |
| ------ | ---------------------- | ----------------- | ------------------------------- |
| GET    | `/api/stock-movements` | Admin / Warehouse | View inventory movement history |

Stock movement records include product, movement type, quantity, previous stock, new stock, reference type, reference ID, and creator.

---

## Reports

| Method | Endpoint                 | Access        | Purpose                                             |
| ------ | ------------------------ | ------------- | --------------------------------------------------- |
| GET    | `/api/reports/dashboard` | Authenticated | Role-aware dashboard statistics and recent activity |
| GET    | `/api/reports/sales`     | Admin         | Sales reporting and top-selling product data        |
| GET    | `/api/reports/inventory` | Admin         | Inventory and low-stock reporting                   |

---

## Order and Inventory Business Rules

The backend enforces the important Project 5 rules, including:

- SKU values must be unique.
- Order numbers are generated by the backend using an atomic Counter sequence.
- Order prices and totals are calculated on the backend.
- Requested quantities cannot exceed available stock.
- Stock cannot become negative.
- Order confirmation reduces stock transactionally.
- Every stock increase/decrease creates StockMovement history.
- Confirmed/processing cancellation follows the cancellation approval workflow.
- Approved cancellation restores stock only when stock was previously adjusted.
- Stock restoration is protected against being applied more than once.
- Completed orders cannot be edited as Draft orders.
- Sales users are restricted by order ownership rules where applicable.
- Role-restricted APIs return authorization errors when accessed by the wrong role.

---

## Authentication and Security

The backend uses:

- bcryptjs password hashing
- JWT authentication
- protected routes
- Admin/Sales/Warehouse authorization middleware
- ownership checks
- ObjectId validation
- Mongoose schema validation
- centralized not-found and error middleware
- environment variables for secrets and connection strings
- CORS restricted to `CLIENT_URL`

Password fields are not intended to be exposed in normal API responses.

---

## Database Transactions

MongoDB transactions are used for inventory-sensitive operations where multiple records must stay consistent, including stock changes associated with order confirmation/cancellation and stock receipts.

For transaction support, use MongoDB Atlas or another MongoDB deployment configured as a replica set.

---

## Optional Automated Tests

Automated tests are included as additional project quality assurance; they are not required to use the application.

Configure:

```env
TEST_MONGODB_URI=<transaction-capable-test-database-uri>
```

Then run:

```bash
npm test
```

The critical workflow test covers important areas such as authentication, password hashing, authorization, pagination/filtering, duplicate handling, transactions, inventory consistency, order ownership, stock changes, and cancellation behavior.

**Use a dedicated test database.** The test suite drops its connected test database during setup.

---

## Deployment on Render

Typical Render backend configuration:

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

Configure these environment variables in Render:

```text
MONGODB_URI
JWT_SECRET
CLIENT_URL
PORT
```

`PORT` may be supplied automatically by the hosting platform. The server reads `process.env.PORT` and falls back to port `5000` locally.

After deployment, confirm:

1. Backend root URL responds successfully.
2. `/api/auth/login` works using a demo account.
3. `CLIENT_URL` exactly matches the deployed frontend origin, including `https://`.
4. Protected endpoints reject unauthenticated requests.
5. Role restrictions work for Admin, Sales, and Warehouse accounts.

---

## Demonstration Workflow

A useful backend demonstration sequence is:

1. Login as Admin and manage products/categories/users.
2. Login as Sales and create a customer/order.
3. Confirm the order and show stock reduction.
4. Login as Warehouse and record incoming stock.
5. Show StockMovement history.
6. Process an order through the allowed status workflow.
7. Request a cancellation and approve/reject it as Admin.
8. Show stock restoration after an approved eligible cancellation.
9. Open dashboard, sales report, inventory report, low-stock data, and top-selling products.
10. Demonstrate an unauthorized request returning the correct error response.

---

## Final Submission Notes

Before submitting the backend repository or ZIP:

- Do not include `.env`.
- Do not include `node_modules`.
- Do not include `.git` inside a submission ZIP unless explicitly requested.
- Keep `.env.example` with variable names only.
- Confirm the deployed backend URL works.
- Confirm demo credentials work.
- Confirm the frontend URL configured in `CLIENT_URL` is correct.
- Commit and push the final README and source code to GitHub.

---

## Project

**Project 5 — Inventory, Sales Order & Stock Movement System**  
MERN Stack Project Assignment
"# project-backend" 
