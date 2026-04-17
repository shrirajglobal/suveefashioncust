

# SaaS Audit Report

```json
{
  "summary": "The CRM/HR platform is functional with solid RBAC and RLS foundations, but suffers from significant performance debt (full-table fetches on every login), critical date-parsing bugs in CSV import that silently corrupt sales data for Indian users, and several UX gaps that hurt sales-team productivity. Architecture is clean but tightly coupled to a single mega-hook.",
  "overallScore": 62,
  "categories": {
    "code": {
      "score": 65,
      "rating": "Fair",
      "findings": [
        {
          "severity": "high",
          "title": "useSupabaseCRM is a 631-line god-hook",
          "detail": "Customers, transactions, profiles, roles, segments, stats, imports, and CRUD all live in one hook. Hard to test, causes unnecessary re-renders, and re-runs every full fetch after each import row.",
          "fix": "Split into useCustomers, usePurchases, useSalesTeam, useImport. Move to React Query mutations with targeted cache invalidation instead of fetchData() after every write."
        },
        {
          "severity": "high",
          "title": "Sequential awaits inside import loops (N+1 round-trips)",
          "detail": "importCustomers and importPurchases call addCustomer/addPurchase one row at a time inside a for-loop, then call fetchData() at the end. A 1000-row import = 1000+ HTTP calls + 1 full re-fetch of all customers and transactions.",
          "fix": "Batch with supabase.from('customers').upsert(rows, { onConflict: 'mobile_no' }) in chunks of 500. For transactions, single insert with array. Eliminate the trailing fetchData()."
        },
        {
          "severity": "medium",
          "title": "No foreign keys defined on any table",
          "detail": "transactions.customer_id, employee_master.reporting_manager_id, monthly_payroll.employee_id, etc. have no FK constraints. Orphan rows are possible; cascade deletes won't work.",
          "fix": "Add FK constraints with ON DELETE CASCADE/SET NULL where appropriate. Will surface existing orphans you should clean first."
        },
        {
          "severity": "medium",
          "title": "Type safety eroded by `any` casts",
          "detail": "fetchAllRows uses `let q: any`, updateCustomer uses `Record<string, any>`. Defeats the generated Supabase types.",
          "fix": "Use `PostgrestFilterBuilder` typing or `ReturnType<typeof supabase.from>`. Type updateData as `Database['public']['Tables']['customers']['Update']`."
        },
        {
          "severity": "low",
          "title": "Duplicate signature logic in 3 places",
          "detail": "`${customerId}-${amount}-${date.toDateString()}` is built in ImportCSVForm, importPurchases, and getExistingPurchases. Drift risk.",
          "fix": "Extract `purchaseSignature(p)` into src/lib/crm.ts."
        },
        {
          "severity": "low",
          "title": "Only one example test file (src/test/example.test.ts)",
          "detail": "Zero coverage of validation, RBAC gating, import logic, or financial-year math.",
          "fix": "Add Vitest unit tests for parseImportDate, segment assignment, and CSV duplicate detection — these are the highest-blast-radius pure functions."
        }
      ],
      "topWin": "Batch CSV imports via upsert and remove the trailing fetchData() — single biggest reduction in code complexity AND latency."
    },
    "security": {
      "score": 78,
      "rating": "Good",
      "findings": [
        {
          "severity": "high",
          "title": "Anon key hardcoded in system prompt and shipped to client",
          "detail": "Standard for Supabase, but combined with `Require authentication for profiles` policy `(auth.uid() IS NOT NULL)` and similar on `user_roles`, ANY authenticated user can read every profile (full_name, email, mobile, salary, sales_target). Salary leak across staff.",
          "fix": "Drop the broad `Require authentication for profiles` policy. Replace with: users see only their own profile; admins see all (already exists). Same for user_roles — remove the catch-all `auth.uid() IS NOT NULL` ALL policy."
        },
        {
          "severity": "high",
          "title": "WhatsApp/wa.me links use unvalidated phone strings",
          "detail": "`https://wa.me/${phone.replace(/\\D/g,'')}` opens with whatever digits remain. Phone field has no server-side format validation — a malicious admin import could inject JS via `target=_blank` referrer leakage scenarios or craft very long numbers.",
          "fix": "Add zod regex `/^\\+?[1-9]\\d{7,14}$/` on customer mobile_no in both client form and a Postgres CHECK or BEFORE INSERT trigger."
        },
        {
          "severity": "medium",
          "title": "No leaked-password (HIBP) protection enabled",
          "detail": "Lovable Cloud supports it; not turned on.",
          "fix": "Enable Password HIBP Check in Cloud → Users → Auth Settings."
        },
        {
          "severity": "medium",
          "title": "No rate limiting on auth or imports",
          "detail": "Brute-force on signIn and 1000-row import floods are unmitigated.",
          "fix": "Use Supabase Auth rate limit settings (already partial) and add a debounced single-import-at-a-time guard client-side; long-term, move bulk import to an edge function with row caps."
        },
        {
          "severity": "low",
          "title": "Console error logs may leak internals in prod",
          "detail": "logError() calls console.error with raw error objects.",
          "fix": "Strip stack/message in production build; ship to a logger like Sentry instead."
        }
      ],
      "topWin": "Tighten profiles/user_roles RLS — currently every logged-in user can read all salaries and emails."
    },
    "performance": {
      "score": 48,
      "rating": "Poor",
      "findings": [
        {
          "severity": "critical",
          "title": "Every login fetches ALL customers + ALL transactions",
          "detail": "fetchAllRows paginates 1000 at a time but pulls the entire table. At ~10k customers and ~50k transactions this is multiple MB and multi-second TTI. Re-runs on every user switch and after every CSV import.",
          "fix": "Server-side pagination + filtering. Move segment computation to a Postgres view or RPC (`get_customer_segments(salesperson_id)`) that returns only counts + page of customers. For sales-team users, scope query to assigned customers only."
        },
        {
          "severity": "high",
          "title": "Segments and stats recomputed on every render of any consumer",
          "detail": "useMemo dependencies are fine, but segmentedCustomers iterates customers × purchases (O(n*m)) by filtering inside map.",
          "fix": "Build a `Map<customerId, Purchase[]>` once, then lookup in O(1). Same for lastPurchaseDate — sort once and index."
        },
        {
          "severity": "high",
          "title": "Missing indexes on hot columns",
          "detail": "customers.assigned_to (used in every sales-team RLS check), customers.mobile_no (lookup), transactions.customer_id, transactions.transaction_date, attendance_logs.employee_id+date are likely unindexed.",
          "fix": "Add btree indexes: `customers(assigned_to)`, `customers(mobile_no)`, `transactions(customer_id, transaction_date DESC)`, `attendance_logs(employee_id, date)`."
        },
        {
          "severity": "medium",
          "title": "No code splitting beyond pages",
          "detail": "AdminDashboard, RevenueComparisonChart, Recharts all bundled into the main Index page chunk.",
          "fix": "Lazy-load heavy CRM components (charts, BulkWhatsAppDialog) with React.lazy."
        },
        {
          "severity": "medium",
          "title": "QueryClient configured but barely used",
          "detail": "useSupabaseCRM bypasses React Query entirely with manual useState + useEffect.",
          "fix": "Migrate to useQuery / useMutation — get caching, dedup, and background refetch for free."
        }
      ],
      "topWin": "Stop fetching all customers+transactions on login. Move to RPC-backed paginated/segmented endpoints."
    },
    "ux": {
      "score": 60,
      "rating": "Fair",
      "findings": [
        {
          "severity": "critical",
          "title": "CSV bulk-import date parsing is locale-broken (the issue you flagged)",
          "detail": "ImportCSVForm.tsx line 220 and 411 use `new Date(dateStr)`. For `01/02/2024` this yields Jan 2 in Chrome (US default) but Indian users mean Feb 1. For `13/02/2024` it returns Invalid Date and the row is silently dropped from validRows (line 222 still pushes!). For ISO `2024-02-01` it parses as UTC midnight, then `.toISOString().split('T')[0]` may shift the date by one day in IST. Sales totals therefore appear lower (rows dropped) and dates appear off-by-one or off-by-month. This explains the 'sales amount very less' regression.",
          "fix": "See dedicated section below. Build parseImportDate() that requires explicit format selection in the import dialog (DD/MM/YYYY default for India, plus ISO and MM/DD/YYYY radio options). Reject ambiguous rows loudly instead of silently mis-parsing. Store dates as local-noon to avoid TZ shift."
        },
        {
          "severity": "high",
          "title": "No empty/loading/error states on call list",
          "detail": "TodaysCallList shows blank when no customers due. Salespeople think the app broke.",
          "fix": "Add explicit empty state ('No customers to call today — great work!'), skeletons during initial fetch, retry CTA on error."
        },
        {
          "severity": "high",
          "title": "Mobile responsiveness on customer table is weak",
          "detail": "11+ columns (name, mobile, city, last contact, totals, badges, actions) overflow on phones. Sales reps work on mobile.",
          "fix": "Build a CardList view <md and keep the table ≥md. Stack actions vertically; pin the WhatsApp/Call buttons."
        },
        {
          "severity": "medium",
          "title": "Bulk action bar lacks keyboard a11y and screen reader labels",
          "detail": "New Download CSV button uses an icon with text but checkbox column and selection state aren't announced.",
          "fix": "aria-label on icon-only buttons, role='status' on '{n} selected' counter, focus trap when bar appears."
        },
        {
          "severity": "medium",
          "title": "No undo/confirm step after bulk DND or bulk delete",
          "detail": "One mis-click can mark hundreds of customers DND, killing future revenue. Toast offers no undo.",
          "fix": "Add a confirm dialog that lists count + sample names, plus a 5-sec undo toast that reverses the last bulk write."
        },
        {
          "severity": "low",
          "title": "Inconsistent terminology",
          "detail": "Mix of 'Sales', 'Purchases', 'Transactions' for the same entity confuses users.",
          "fix": "Pick one ('Sales') and rename UI labels accordingly."
        }
      ],
      "topWin": "Fix CSV import date handling — currently corrupting financial data without warning."
    }
  },
  "priorityRoadmap": [
    {
      "phase": "Immediate (0-2 weeks)",
      "items": [
        "Fix CSV bulk-import date parsing (full plan below) — restore correct sales totals",
        "Tighten RLS on profiles and user_roles (remove blanket auth.uid() IS NOT NULL ALL policies) — stop salary leakage",
        "Add db indexes on customers(assigned_to, mobile_no) and transactions(customer_id, transaction_date)",
        "Enable HIBP password protection",
        "Replace per-row import inserts with batched upserts; remove trailing fetchData()"
      ]
    },
    {
      "phase": "Short-term (1 month)",
      "items": [
        "Move segment/stats computation to a Postgres RPC; switch sales-team users to assigned-only fetch",
        "Migrate useSupabaseCRM to React Query (useQuery + useMutation with cache invalidation)",
        "Mobile-first redesign of CustomerTable (card view <md)",
        "Add empty/loading/error states across call list and dashboards",
        "Add foreign keys + cascade rules; clean orphans first",
        "Confirm + undo on all bulk destructive actions"
      ]
    },
    {
      "phase": "Medium-term (1-3 months)",
      "items": [
        "Split useSupabaseCRM into domain hooks; add Vitest coverage for pure logic",
        "Move bulk import to an edge function with progress streaming and row caps",
        "Add Sentry (or similar) with PII scrubbing for production error monitoring",
        "Lazy-load heavy chart components and BulkWhatsAppDialog",
        "Audit-log table for all admin actions (bulk DND, delete, reassign, salary change)"
      ]
    }
  ]
}
```

---

## Deep Dive: CSV Bulk Sales Import Date Bug

### Root Causes (verified in code)

**Location 1 — `src/components/crm/ImportCSVForm.tsx:411`**
```ts
const date = new Date(dateStr);
if (isNaN(date.getTime())) {
  errorDetails.push({ row: rowNum, ..., reason: `Invalid date format: "${dateStr}"` });
  return;
}
```
Three concrete failure modes:

1. **Ambiguous slash dates**: `01/02/2024` → Chrome/V8 parses as **Jan 2** (US locale) but Indian users mean **Feb 1**. Row imports silently with the wrong month.
2. **Day > 12 with DD/MM/YYYY**: `13/02/2024` → `new Date()` returns Invalid Date → row is **rejected and dropped**. This is the main reason "sales amount has gone down" — rows where the day is 13–31 silently disappear.
3. **ISO + timezone shift**: `2024-02-01` → parsed as UTC midnight → `.toISOString().split('T')[0]` in IST (+5:30) is still `2024-02-01`, but `new Date('2024-02-01').toDateString()` used for the dedup signature returns the **local** day, which can differ from the stored date for users in negative-offset zones. More critically, when later sorted/displayed, "last purchase date" can show one day earlier.

**Location 2 — `ImportCSVForm.tsx:220`** has the same bug AND a logic flaw:
```ts
const date = new Date(row.date);
if (isNaN(amount) || isNaN(date.getTime())) {
  validRows.push(row);  // BUG: invalid rows still pushed to validRows
  return;
}
```
Invalid rows get pushed into `validRows` then re-fail later — inflating the "valid" count shown to the user before the real validation in `processPurchases`.

**Location 3 — `useSupabaseCRM.ts:333, 466`**
```ts
transaction_date: new Date(data.date).toISOString().split("T")[0]
```
For an IST user adding a sale on 1-Feb at 02:00 local, `data.date` is `2024-02-01T00:00:00+05:30` → `.toISOString()` gives `2024-01-31T18:30:00Z` → split → **`2024-01-31`** stored. Sales appear in the previous month/FY.

### Fix Plan

**1. New utility `src/lib/dateImport.ts`**
```ts
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "auto";

export function parseImportDate(raw: string, fmt: DateFormat): 
  { ok: true; date: Date } | { ok: false; reason: string } {
  // Trim, normalise separators (- . / → /)
  // Reject empty, future dates beyond +1 day, dates before 2000
  // For DD/MM/YYYY: split, validate 1-31 / 1-12 / 4-digit year, build local-noon Date (avoids TZ shift)
  // For auto: only accept ISO YYYY-MM-DD or unambiguous (day>12); otherwise return ok:false with reason "ambiguous — choose explicit format"
}

export function toDbDateString(d: Date): string {
  // Return YYYY-MM-DD using local components, NOT toISOString
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

**2. Update import dialog UI** — add a required radio: "Date format in your CSV: (•) DD/MM/YYYY (Indian)  ( ) MM/DD/YYYY (US)  ( ) YYYY-MM-DD (ISO)". Default DD/MM. Pass selection into parser.

**3. Replace all `new Date(dateStr)` and `new Date(data.date).toISOString().split('T')[0]`** in ImportCSVForm and useSupabaseCRM with `parseImportDate(...)` and `toDbDateString(...)`.

**4. Fix the "push invalid rows" bug** at line 220 — `return` without pushing.

**5. Show a pre-import preview**: after parsing, display first 5 rows with parsed date alongside raw string, plus counts of "parsed", "ambiguous-rejected", "invalid". User must confirm before write.

**6. Backfill check (one-time)**: query transactions where `transaction_date` looks suspicious (e.g. created_at month ≠ transaction_date month for recent imports) and offer admin a CSV of probable mis-imports.

**7. Add tests** in `src/test/dateImport.test.ts` for: `01/02/2024` DD/MM, `01/02/2024` MM/DD, `13/02/2024` DD/MM, `2024-02-01` ISO, `31/02/2024` invalid, empty, "Feb 1, 2024", DST boundaries, IST vs UTC.

**Prevention**: lint rule (eslint custom or grep in CI) banning `new Date(` in `src/components/crm` and `src/hooks/useSupabaseCRM.ts` outside the new utility.

