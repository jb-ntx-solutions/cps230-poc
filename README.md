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

### 🎯 Dashboard - BPMN Process Modeler
- Full BPMN modeler with Call Activities for process linking
- Role-based editing: Promaster/Business Analyst can edit, Users read-only
- Property panel for linking Call Activities to processes
- Multi-dimensional filtering with visual highlighting:
  - Systems (green border)
  - Regions (blue overlay badges)
  - Controls (blue border)
  - Critical Operations (red border - highest priority)
- Click Call Activities to open in Nintex Process Manager
- Maximized canvas space with intuitive filters sidebar

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
- **Process Visualization**: BPMN.js (v18.9.1) with custom palette and properties panel
- **Backend API**: Supabase Edge Functions (Deno)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Deployment**: Vercel (Frontend) + Supabase (Edge Functions)
- **State Management**: TanStack Query (React Query v5)

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
│   │   ├── bpmn/         # BPMN modeler components
│   │   │   ├── BpmnCanvas.tsx
│   │   │   ├── FiltersSidebar.tsx
│   │   │   ├── ProcessPropertiesPanel.tsx
│   │   │   ├── modeler/  # Custom BPMN modules
│   │   │   │   ├── CustomPaletteProvider.ts
│   │   │   │   ├── CustomContextPadProvider.ts
│   │   │   │   └── index.ts
│   │   │   └── utils/    # BPMN utilities
│   │   │       ├── bpmnXmlGenerator.ts
│   │   │       └── highlightCalculator.ts
│   │   ├── AppLayout.tsx # Main app layout with sidebar
│   │   └── ProtectedRoute.tsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   │   ├── supabase.ts  # Supabase client
│   │   ├── api.ts       # API layer (Edge Functions)
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
│   ├── functions/       # Edge Functions (API layer)
│   │   ├── _shared/     # Shared utilities (cors, auth)
│   │   ├── systems/
│   │   ├── processes/
│   │   ├── controls/
│   │   ├── critical-operations/
│   │   ├── settings/
│   │   ├── user-profiles/
│   │   ├── sync-history/
│   │   └── sync-process-manager/
│   ├── schema.sql       # Database schema
│   └── README.md        # Database setup instructions
├── public/              # Static assets
│   └── favicon.ico      # Nintex logo
├── References/          # Reference materials
│   ├── Documents/       # PDF and Excel references
│   └── Images/          # Design reference screenshots
├── .env.example         # Environment variables template
├── vercel.json          # Vercel configuration with API rewrites
├── DASHBOARD_ENHANCEMENT_PLAN.md
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
- [x] Authentication system with account-based multi-tenancy
- [x] Main app layout and navigation
- [x] BPMN.js canvas integration with Call Activities
- [x] Custom palette and context pad providers
- [x] Property panel for process linking
- [x] Multi-dimensional filtering with visual highlighting
- [x] Data table implementations (processes, systems, controls, critical operations)
- [x] User management functionality
- [x] Settings and Nintex API integration
- [x] Sync functionality with batch processing
- [x] API layer with Supabase Edge Functions
- [x] Process Manager integration (open process in PM)
- [ ] Export capabilities
- [ ] Audit logging
- [ ] Advanced reporting

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
