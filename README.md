# AssetFlow 📦

**Enterprise Asset & Resource Management System**

AssetFlow is a centralized, role-based web application designed to give organizations real-time control over physical assets and shared resources. Built for modern teams, it tracks assets from registration to disposal, prevents double-booking, manages maintenance workflows, and simplifies auditing.

## 🚀 Key Features

- **Role-Based Access Control (RBAC):** Distinct interfaces and permissions for Admins, Asset Managers, Department Heads, Employees, and Auditors.
- **Asset Lifecycle Tracking:** Monitor assets through states: Available, Allocated, Reserved, Under Maintenance, Lost, Retired, and Disposed.
- **Conflict-Free Allocation & Booking:** Prevent double allocation and ensure shared resources (like meeting rooms or projectors) are never double-booked.
- **Maintenance Workflows:** Request, approve, and track repairs with full history.
- **Comprehensive Audits:** Run scheduled audit cycles to verify assets, identify missing/damaged items, and generate discrepancy reports.
- **Real-Time Dashboards:** Role-specific KPIs, utilization trends, and overdue return alerts.
- **Immutable Activity Logs:** Complete traceability for every privileged or operational action.

## 🛠️ Technology Stack

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), React, [Tailwind CSS](https://tailwindcss.com/)
- **Backend/Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- **Language:** TypeScript

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ (or Bun/pnpm/yarn)
- A Supabase account / project

### Installation

1. **Clone the repository (or navigate to the project folder):**
   ```bash
   cd assetflow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or yarn install / pnpm install / bun install
   ```

3. **Set up Environment Variables:**
   Copy the `.env.local.example` or create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # If required for backend tasks
   ```

4. **Database Setup:**
   - Apply the database schema and security policies using the Supabase SQL editor or CLI based on the provided SDD requirements.
   - Run the seed script if available: `node seed.js` (or similar) to populate initial categories, departments, and demo users.

5. **Run the Development Server:**
   ```bash
   npm run dev
   # or yarn dev / pnpm dev / bun dev
   ```

6. **Open the Application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 👥 User Roles

- **Admin:** Manages organization data, roles, audit cycles, and views global analytics.
- **Asset Manager:** Registers/allocates assets, approves transfers and maintenance.
- **Department Head:** Manages department assets, approves internal transfers, books resources.
- **Employee:** Views assigned assets, books resources, initiates requests.
- **Auditor:** Verifies scoped assets during open audit cycles.

## 📝 License

This project was initially prepared for the Odoo Hackathon.
