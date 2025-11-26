# CPS230 Critical Operations Ecosystem

A comprehensive management application for visualizing and managing critical operations processes in compliance with APRA CPS230 regulations.

## Overview

This application enables organizations to:
- Visualize process connections and dependencies through an interactive BPMN canvas
- Manage processes synced from Nintex Process Manager
- Define and track Critical Operations and their Controls
- Understand system dependencies and regional responsibilities
- Manage user access with role-based permissions

## Features

### 🎯 Dashboard
- Interactive BPMN.js canvas for process visualization
- Drag-and-drop process arrangement (Business Analysts and Promasters)
- Visual representation of process connections and dependencies
- Filter by Critical Operations, Systems, and Regions

### 📊 Data Management
- **Processes**: View and manage processes from Nintex Process Manager
- **Systems**: Track systems and applications used across processes
- **Critical Operations**: Define and manage CPS230 critical operations
- **Controls**: Configure controls that govern critical operations

### 👥 User Management (Promaster only)
- Three user roles:
  - **User**: View-only access to all data
  - **Business Analyst**: Can edit process canvas and connections
  - **Promaster**: Full admin access to all features

### ⚙️ Settings (Promaster only)
- Configure Nintex Process Manager API connection
- Manage service account credentials
- Configure available regions
- Trigger manual sync with Nintex

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (based on Radix UI)
- **Styling**: Tailwind CSS with Nintex Textura design system
- **Font**: Plus Jakarta Sans
- **Icons**: Streamline Sharp (to be integrated)
- **Process Visualization**: BPMN.js
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel
- **State Management**: TanStack Query (React Query)

## Design System

The application follows the **Nintex Textura Design System**:
- Primary Color: Nintex Navy (#1D2746)
- Accent Color: Nintex Orange (#FF6633)
- Font: Plus Jakarta Sans
- Clean, professional interface inspired by Nintex applications

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- Nintex Process Manager account (for data sync)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cps230-poc
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**

   a. Create a new Supabase project at [https://supabase.com](https://supabase.com)

   b. Run the database schema:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase/schema.sql`
   - Execute the script

   c. Note your project URL and anon key from the Supabase dashboard

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:8080`

### First User Setup

The first user to sign up will be created with the "user" role. To promote them to Promaster:

1. Sign up through the application
2. Go to your Supabase dashboard → Table Editor → user_profiles
3. Find your user and update the `role` field to `promaster`

## Deployment to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to [https://vercel.com](https://vercel.com)
2. Import your Git repository
3. Vercel will auto-detect the Vite framework
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

## Project Structure

```
cps230-poc/
├── src/
│   ├── components/        # Reusable components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── AppLayout.tsx # Main app layout with sidebar
│   │   └── ProtectedRoute.tsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   │   ├── supabase.ts  # Supabase client
│   │   └── utils.ts     # Helper functions
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Data.tsx
│   │   ├── Users.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   └── Signup.tsx
│   ├── types/           # TypeScript type definitions
│   │   └── database.ts  # Supabase database types
│   ├── App.tsx          # Main app component with routes
│   ├── index.css        # Global styles and design system
│   └── main.tsx         # App entry point
├── supabase/
│   ├── schema.sql       # Database schema
│   └── README.md        # Database setup instructions
├── public/              # Static assets
├── References/          # Reference materials
│   ├── Documents/       # PDF and Excel references
│   └── Images/          # Design reference screenshots
├── .env.example         # Environment variables template
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies and scripts
```

## User Roles & Permissions

| Feature | User | Business Analyst | Promaster |
|---------|------|-----------------|-----------|
| View Dashboard | ✓ | ✓ | ✓ |
| View Data | ✓ | ✓ | ✓ |
| Edit Process Canvas | ✗ | ✓ | ✓ |
| Modify Processes | ✗ | ✓ | ✓ |
| Manage Users | ✗ | ✗ | ✓ |
| Access Settings | ✗ | ✗ | ✓ |
| Manage Critical Operations | ✗ | ✗ | ✓ |
| Manage Controls | ✗ | ✗ | ✓ |
| Sync with Nintex | ✗ | ✗ | ✓ |

## Nintex Process Manager Integration

The application integrates with Nintex Process Manager to:
- Sync process definitions and metadata
- Import process connections (inputs/outputs)
- Pull system/application mappings
- Update process ownership and regions

Configuration is managed through the Settings page (Promaster access only).

## Development Roadmap

- [x] Project setup and configuration
- [x] Nintex Textura design system implementation
- [x] Supabase database schema and RLS
- [x] Authentication system
- [x] Main app layout and navigation
- [ ] BPMN.js canvas integration
- [ ] Data table implementations
- [ ] User management functionality
- [ ] Settings and Nintex API integration
- [ ] Sync functionality
- [ ] Advanced filtering and search
- [ ] Export capabilities
- [ ] Audit logging

## Contributing

This is a proof-of-concept application. For contributions or questions, please contact the project team.

## License

Copyright © 2025. All rights reserved.

## Reference Materials

- **Design System**: [Nintex Textura](https://textura.nintex.io/)
- **Icons**: [Streamline Sharp](https://www.streamlinehq.com/icons/sharp-sets)
- **Process Modeling**: [BPMN.js](https://bpmn.io/toolkit/bpmn-js/)
- **Compliance**: APRA CPS230 Operational Risk Management

## Support

For issues or questions:
1. Check the documentation in the `/supabase/README.md` for database-related issues
2. Review the reference materials in `/References/`
3. Contact the project administrator
