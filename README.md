# HRIS & Payroll Management System

A full-stack Human Resource Information System (HRIS) and Payroll Management application built with **React + Vite** (frontend) and **Node.js + Express** (backend), backed by a **PostgreSQL** database.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Deployment Instructions](#deployment-instructions)
  - [1. Database Setup](#1-database-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Running the Application](#4-running-the-application)
- [User Roles & Access Control](#user-roles--access-control)
- [API Endpoints Overview](#api-endpoints-overview)

---

## Project Overview

This system is designed for multi-branch organizations to manage their workforce end-to-end — from onboarding to exit — while automating payroll computation, leave tracking, loan management, and financial approvals.

---

## Features

### Dashboard
- Overview KPIs: total employees, leave requests, loan requests, and total accounts payable
- Balances breakdown chart (receivables vs payables)

### Staff Information
- Create, view, edit, and manage employee records
- Upload staff photos and attachments
- View leave history, remittances (SSS, PhilHealth, HDMF), deductions, and compensation details

### Departments
- Manage organizational departments per branch

### Payslip / Salary
- Generate and view individual payslips
- Breakdown of salary, ECOLA, deductions, and net pay

### Schedule of Balances
- View and manage staff balance schedules

### HRIS Transactions (Admin Orders)
All transactions are role-restricted to Admin and Branch Manager:

| Transaction | Description |
|---|---|
| **Transfer Staff Order** | Move staff to another branch/area |
| **Deployment Order** | Deploy newly hired or recommenced staff to a branch |
| **Promotion Order** | Record staff promotions |
| **Demotion Order** | Record staff demotions |
| **Suspension Order** | Temporarily suspend a staff member's work status |
| **Leave Requests** | Create and manage leave requests (pending / approved / rejected) |
| **Exit Staff** | Process resignations or terminations |
| **Statement of Accounts (SOA)** | Register exit staff last pay and liabilities |

### Branch Payroll
- View and generate payroll reports per branch
- Computes salary + ECOLA, deductions (SSS, PhilHealth, HDMF, tax, loans, advances), and net pay

### Finance Approval
- Approve or reject pending financial transactions

### System Configuration (Admin Only)
- Configure salary & allowance rates (ECOLA, transportation defaults)
- Overtime rules configuration (coming soon)

### User Management (Admin Only)
- Create, edit, reset passwords, and delete system users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router DOM 7, Axios, Recharts, jsPDF, html2canvas, XLSX |
| Backend | Node.js, Express 5, JSON Web Tokens (JWT), bcryptjs, Multer |
| Database | PostgreSQL (via `pg` pool) |
| Auth | JWT Bearer Token (8-hour expiry) |

---

## Project Structure

```
/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── api/       # Axios client configuration
│   │   ├── assets/    # Images and static assets
│   │   ├── components/# Shared UI components (Sidebar, Header, Modals)
│   │   ├── pages/     # Page components (Dashboard, Payroll, Staff, etc.)
│   │   └── styles/    # CSS stylesheets
│   ├── .env           # Frontend environment variables
│   └── package.json
│
└── backend/           # Node.js + Express API
    ├── Controllers/   # Auth controller
    ├── middlewares/   # JWT auth middleware & role guard
    ├── routes/        # All API route handlers
    ├── uploads/       # Staff photo uploads (served as static files)
    ├── db.js          # PostgreSQL pool configuration
    ├── server.js      # Express app entry point
    ├── .env           # Backend environment variables
    └── package.json
```

---

## Prerequisites

Before deploying, ensure the following are installed:

- **Node.js** v18 or higher
- **npm** v9 or higher
- **PostgreSQL** v14 or higher

---

## Environment Variables

### Backend (`backend/.env`)

```env
# PostgreSQL connection
PG_USER=postgres
PG_PASSWORD=your_db_password
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=payroll

# JWT secret (use a long, random string in production)
JWT_SECRET=your_super_secret_jwt_key

# Server port
PORT=5000
```

### Frontend (`frontend/.env`)

```env
# Backend API base URL
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Deployment Instructions

### 1. Database Setup

1. Start your PostgreSQL server and connect:
   ```bash
   psql -U postgres
   ```

2. Create the database:
   ```sql
   CREATE DATABASE payroll;
   ```

3. Connect to the database and run your schema migration scripts to create the required tables:
   - `public.users`
   - `public.staff`
   - `public.branches`
   - `public.departments`
   - `public.deployment_orders`
   - `public.transfer_staff_orders`
   - `public.promotion_orders`
   - `public.demotion_orders`
   - `public.suspension_orders`
   - `public.leave_requests`
   - `public.loan_requests`
   - `public.staff_accounts_payable`
   - `public.schedule_balances`
   - `public.comp_rates`
   - And other supporting tables

4. Create the initial admin user (password must be bcrypt-hashed):
   ```sql
   INSERT INTO public.users (username, password, role)
   VALUES ('admin', '<bcrypt_hashed_password>', 'admin');
   ```

---

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the `.env` file using the template above.

4. Create the uploads directory if it does not exist:
   ```bash
   mkdir -p uploads
   ```

5. Start the backend server:

   **Development (with auto-reload):**
   ```bash
   npx nodemon server.js
   ```

   **Production:**
   ```bash
   node server.js
   ```

   The backend will be available at: `http://localhost:5000`

   Verify by visiting: `http://localhost:5000/test`
   Expected response: `Backend is working!`

---

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the `.env` file using the template above.

4. Build or start the application:

   **Development:**
   ```bash
   npm run dev
   ```
   The app will be available at: `http://localhost:5173`

   **Production Build:**
   ```bash
   npm run build
   ```
   This generates a `dist/` folder. Serve it with any static file server (e.g., Nginx, Apache, or `vite preview`):
   ```bash
   npm run preview
   ```

---

### 4. Running the Application

1. Ensure PostgreSQL is running.
2. Start the backend: `node server.js` (from `backend/`)
3. Start the frontend: `npm run dev` (from `frontend/`)
4. Open your browser at `http://localhost:5173`
5. Log in with your admin credentials.

---

## User Roles & Access Control

| Role | Access |
|---|---|
| **Admin** | Full access to all modules including System Configuration, User Management, and all transactions |
| **Branch Manager** | Access to dashboard, staff information, departments, payroll, transactions, and approvals for their assigned branch |

Route protection is enforced on both the frontend (via `ProtectedRoute` component) and backend (via `requireAuth` and `requireRole` middleware).

---

## API Endpoints Overview

All API routes are prefixed with `/api`.

| Route | Description |
|---|---|
| `POST /api/auth/login` | Authenticate user and receive JWT token |
| `GET/POST/PUT/DELETE /api/staff` | Staff CRUD |
| `GET/POST/PUT/DELETE /api/deployments` | Deployment order management |
| `PUT /api/deployments/:id/approve` | Approve a deployment (Admin only) |
| `GET/POST/PUT/DELETE /api/transfer-staff-orders` | Transfer order management |
| `GET/POST/PUT/DELETE /api/promotion-orders` | Promotion order management |
| `GET/POST/PUT/DELETE /api/demotion-orders` | Demotion order management |
| `GET/POST/PUT/DELETE /api/suspension-orders` | Suspension order management |
| `GET/POST/PUT/DELETE /api/leave` | Leave request management |
| `GET/POST/PUT/DELETE /api/loan-requests` | Loan request management |
| `GET/POST/PUT/DELETE /api/exit-staff` | Exit staff management |
| `GET/POST/PUT/DELETE /api/sap` | Statement of accounts (SOA) |
| `GET/POST/PUT/DELETE /api/branches` | Branch management |
| `GET/POST/PUT/DELETE /api/departments` | Department management |
| `GET/POST/PUT/DELETE /api/comp-rates` | Compensation rates |
| `GET/POST/PUT/DELETE /api/users` | User management (Admin only) |
| `GET /api/reports` | Report generation |
| `GET /uploads/:filename` | Serve staff photo uploads |
| `GET /test` | Health check |

> **Authentication:** All protected routes require the `Authorization: Bearer <token>` header. Tokens expire after 8 hours.
