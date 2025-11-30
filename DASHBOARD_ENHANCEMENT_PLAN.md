# Dashboard Enhancement Plan - BPMN Process Modeler

## Overview
Transform the Dashboard into a full-featured BPMN modeler with role-based editing, process linking, and advanced filtering with visual highlighting.

## Current State
- Basic BPMN canvas showing processes as tasks
- Simple system filtering
- Position saving capability
- Uses bpmn-js@18.9.1

## Target State
- Full BPMN modeler with Call Activities
- Role-based editing (Promaster/BA can edit, User read-only)
- Property panel for linking Call Activities to Processes
- Multi-dimensional filtering (Systems, Regions, Controls, Critical Operations)
- Visual highlighting based on filters (borders, overlays, colors)
- Maximized canvas space (remove redundant headers)
- Click to open process in Process Manager

## Architecture Changes

### 1. Dashboard Layout
**Before:**
```
┌─────────────────────────────────────────┐
│ Card Header                              │
│ "Process Model Canvas"                   │
│ [System Filter] [Save Positions]        │
├─────────────────────────────────────────┤
│                                          │
│        BPMN Canvas (600px)               │
│                                          │
└─────────────────────────────────────────┘
```

**After:**
```
┌───┬─────────────────────────────────────┐
│ F │                                     │
│ i │                                     │
│ l │       BPMN Canvas (Full Height)     │
│ t │                                     │
│ e │                                     │
│ r │                                     │
│ s │                                     │
│   │                                     │
│ [Save]                                  │
└───┴─────────────────────────────────────┘
```

### 2. Required NPM Packages
```json
{
  "bpmn-js": "^18.9.1", // Already installed
  "bpmn-js-properties-panel": "^5.0.0", // NEW - For property panel
  "bpmn-js-create-append-anything": "^0.5.0", // OPTIONAL - Custom palette
  "@bpmn-io/properties-panel": "^3.0.0" // NEW - UI for properties
}
```

### 3. BPMN Element Strategy

**Current:** Using `<bpmn:task>` elements
**New:** Using `<bpmn:callActivity>` elements

**Why Call Activities?**
- Standard BPMN element for referencing external processes
- Has `calledElement` property perfect for linking to our Process table
- Visually distinct (thicker border by default)
- Semantic meaning matches our use case

**Example BPMN XML:**
```xml
<bpmn:callActivity id="CallActivity_1" name="Order Processing" calledElement="process-uuid-123">
  <bpmn:extensionElements>
    <custom:processData>
      <custom:processId>process-uuid-123</custom:processId>
      <custom:processName>Order Processing</custom:processName>
      <custom:pmProcessId>12345</custom:pmProcessId>
      <custom:processUniqueId>abc-def-123</custom:processUniqueId>
    </custom:processData>
  </bpmn:extensionElements>
</bpmn:callActivity>
```

### 4. Role-Based Permissions

| Role | Capabilities |
|------|-------------|
| **Promaster** | - Create/delete Call Activities<br>- Edit connections<br>- Link to processes<br>- Save diagram |
| **Business Analyst** | - Create/delete Call Activities<br>- Edit connections<br>- Link to processes<br>- Save diagram |
| **User** | - View diagram (read-only)<br>- Click to open in Process Manager<br>- Use filters |

### 5. Property Panel Implementation

**Location:** Right sidebar (collapsible)
**Width:** 300px
**Fields:**
- **Linked Process** (Select dropdown)
  - Search/filter processes
  - Display: process_name
  - Value: process ID
- **Process Manager ID** (Read-only, auto-populated)
- **Process Unique ID** (Read-only, auto-populated)
- **Open in Process Manager** (Link button)

### 6. Filtering System

**Filter Types:**

1. **Systems** (Multi-select)
   - Data Source: `systems` table
   - Visual Effect: Green border on related Call Activities
   - Logic: Match via `process_systems` junction table

2. **Regions** (Multi-select)
   - Data Source: Unique values from `processes.regions` array
   - Visual Effect: Overlay with region label
   - Logic: Check if process.regions contains selected region

3. **Controls** (Multi-select)
   - Data Source: `controls` table
   - Visual Effect: Blue border or badge
   - Logic: Match via `controls.process_id`

4. **Critical Operations** (Multi-select)
   - Data Source: `critical_operations` table
   - Visual Effect: Red border or color badge
   - Logic: Match via `critical_operations.process_id`

**Filter UI:**
```
┌─ FILTERS ────────────┐
│                      │
│ 🔍 Search            │
│                      │
│ ▼ Systems (2)        │
│   ☑ SAP              │
│   ☑ Salesforce       │
│   ☐ Oracle           │
│                      │
│ ▼ Regions (1)        │
│   ☑ EMEA             │
│   ☐ APAC             │
│   ☐ Americas         │
│                      │
│ ▼ Controls (0)       │
│   ☐ SOX Control 1    │
│   ☐ GDPR Check       │
│                      │
│ ▼ Critical Ops (1)   │
│   ☑ Payment Process  │
│   ☐ Data Export      │
│                      │
│ [Clear All]          │
│                      │
│ [Save Diagram]       │
└──────────────────────┘
```

### 7. Visual Highlighting Logic

```typescript
interface HighlightStyle {
  border?: {
    color: string
    width: number
  }
  overlay?: {
    html: string
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }
  fill?: string
}

function calculateHighlighting(
  callActivity: CallActivity,
  filters: FilterState
): HighlightStyle {
  const styles: HighlightStyle = {}

  // System filter -> Green border
  if (filters.systems.length > 0 && matchesSystem(callActivity, filters.systems)) {
    styles.border = { color: '#10b981', width: 3 }
  }

  // Region filter -> Overlay with region names
  if (filters.regions.length > 0) {
    const matchedRegions = getMatchedRegions(callActivity, filters.regions)
    if (matchedRegions.length > 0) {
      styles.overlay = {
        html: `<div class="region-badge">${matchedRegions.join(', ')}</div>`,
        position: 'top-right'
      }
    }
  }

  // Controls filter -> Blue border
  if (filters.controls.length > 0 && matchesControl(callActivity, filters.controls)) {
    styles.border = { color: '#3b82f6', width: 3 }
  }

  // Critical Operations -> Red border (highest priority)
  if (filters.criticalOperations.length > 0 && matchesCriticalOp(callActivity, filters.criticalOperations)) {
    styles.border = { color: '#ef4444', width: 3 }
  }

  return styles
}
```

### 8. Custom Palette Provider

Restrict palette to only show:
- **Hand Tool** (pan/navigate)
- **Lasso Tool** (select multiple)
- **Space Tool** (create space)
- **Create Call Activity** (only for Promaster/BA)
- **Create Connection** (sequence flow)

Remove:
- All other BPMN elements (tasks, gateways, events, etc.)

```typescript
class CustomPaletteProvider {
  constructor(palette, create, elementFactory, spaceTool, lassoTool, handTool, userRole) {
    this.palette = palette
    this.create = create
    this.elementFactory = elementFactory
    this.userRole = userRole

    palette.registerProvider(this)
  }

  getPaletteEntries() {
    const entries = {}

    // Always available
    entries['hand-tool'] = { ... }
    entries['lasso-tool'] = { ... }
    entries['space-tool'] = { ... }

    // Only for Promaster/BA
    if (this.userRole === 'promaster' || this.userRole === 'business_analyst') {
      entries['create.call-activity'] = {
        group: 'activity',
        className: 'bpmn-icon-call-activity',
        title: 'Create Call Activity',
        action: {
          dragstart: createCallActivity,
          click: createCallActivity
        }
      }

      entries['global-connect-tool'] = { ... } // Connection tool
    }

    return entries
  }
}
```

### 9. Data Flow

```
┌─────────────┐
│  Dashboard  │
│   (Page)    │
└──────┬──────┘
       │
       ├─ Fetch: processes (with systems, regions)
       ├─ Fetch: systems
       ├─ Fetch: controls
       ├─ Fetch: critical_operations
       │
       ▼
┌──────────────────┐
│  BpmnModeler     │
│  (Component)     │
├──────────────────┤
│ - Custom Palette │
│ - Properties     │
│ - Highlighting   │
│ - Event Handlers │
└──────┬───────────┘
       │
       ├─ On CallActivity Created
       │  └─> Show Properties Panel
       │  └─> Focus on Process Selector
       │
       ├─ On CallActivity Selected
       │  └─> Populate Properties Panel
       │  └─> Show linked process data
       │
       ├─ On Filter Changed
       │  └─> Recalculate highlights
       │  └─> Update borders/overlays
       │
       └─ On "Open in PM" Clicked
          └─> Navigate to: https://{pm_site_url}/{tenant_id}/Process/{process_unique_id}
```

### 10. Diagram Persistence

**Storage Format:**
```json
{
  "bpmnXml": "<bpmn:definitions>...</bpmn:definitions>",
  "processLinks": {
    "CallActivity_1": "process-uuid-123",
    "CallActivity_2": "process-uuid-456"
  },
  "metadata": {
    "lastModified": "2025-01-15T10:30:00Z",
    "modifiedBy": "user@example.com",
    "version": 2
  }
}
```

**Database Schema Update:**
Add to `accounts` or create new `diagrams` table:
```sql
CREATE TABLE process_diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  bpmn_xml TEXT NOT NULL,
  process_links JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_by TEXT,
  modified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Implementation Steps

### Phase 1: Setup (1 task)
1. ✅ Install bpmn-js-properties-panel and @bpmn-io/properties-panel

### Phase 2: Core Modeler (3 tasks)
2. Create CustomPaletteProvider (restrict to Call Activities)
3. Create CustomContextPadProvider (restrict available actions)
4. Update BpmnCanvas to use Call Activities instead of Tasks

### Phase 3: Property Panel (2 tasks)
5. Create ProcessPropertiesProvider component
6. Integrate properties panel into BpmnCanvas

### Phase 4: Filtering (3 tasks)
7. Create FiltersSidebar component
8. Implement highlighting module (borders, overlays)
9. Connect filters to highlighting engine

### Phase 5: Dashboard Layout (2 tasks)
10. Redesign Dashboard layout (remove card header, maximize canvas)
11. Add filters sidebar with collapsible sections

### Phase 6: Testing & Polish (2 tasks)
12. Test with all three roles (Promaster, BA, User)
13. Add "Open in Process Manager" functionality

## File Structure

```
src/
├── components/
│   └── bpmn/
│       ├── BpmnCanvas.tsx (major refactor)
│       ├── BpmnModeler.tsx (NEW - wraps bpmn-js with custom modules)
│       ├── FiltersSidebar.tsx (NEW)
│       ├── ProcessPropertiesPanel.tsx (NEW)
│       ├── modeler/
│       │   ├── CustomPaletteProvider.ts (NEW)
│       │   ├── CustomContextPadProvider.ts (NEW)
│       │   ├── HighlightingModule.ts (NEW)
│       │   └── index.ts (NEW - export all custom modules)
│       └── utils/
│           ├── bpmnXmlGenerator.ts (refactored from BpmnCanvas)
│           └── highlightCalculator.ts (NEW)
├── pages/
│   └── Dashboard.tsx (major refactor)
└── hooks/
    └── useBpmnFilters.ts (NEW)
```

## Example Usage

```typescript
// Dashboard.tsx
<div className="flex h-screen">
  <FiltersSidebar
    systems={systems}
    regions={regions}
    controls={controls}
    criticalOperations={criticalOperations}
    selectedFilters={filters}
    onFilterChange={setFilters}
  />

  <div className="flex-1">
    <BpmnModeler
      processes={processes}
      userRole={profile.role}
      filters={filters}
      onSave={handleSave}
      onOpenProcess={handleOpenInPM}
    />
  </div>
</div>
```

## Success Criteria

- ✅ Promaster/BA can create Call Activities
- ✅ User sees read-only diagram
- ✅ Call Activities linked to processes via property panel
- ✅ System filter adds green border to related elements
- ✅ Region filter adds overlay labels
- ✅ Controls filter adds blue border
- ✅ Critical Operations filter adds red border
- ✅ Click on Call Activity opens process in Process Manager
- ✅ Diagram persists to database
- ✅ Canvas takes up majority of screen space

## Next Steps

1. Start with Phase 1 (install dependencies)
2. Proceed with Phase 2 (core modeler changes)
3. Continue through each phase sequentially
4. Test thoroughly after each phase

Would you like to proceed with implementation?
