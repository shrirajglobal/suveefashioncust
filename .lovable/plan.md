

## Plan: Add CSV Download Button for Selected Customers (Admin Only)

**Location:** `src/components/crm/CustomerTable.tsx`, in the bulk action bar (lines 212-275).

**Changes:**

1. Import `Download` from `lucide-react`.

2. Add a `handleDownloadCSV` function that:
   - Filters `sortedCustomers` by `selectedIds`
   - Builds CSV with headers: `Name,Mobile No,DND Status`
   - Maps each customer to `name, mobileNo, dnd ? "Yes" : "No"`
   - Creates a Blob and triggers browser download as `customers_export.csv`

3. Add a "Download CSV" button in the bulk action bar, after the Critical toggle section and before the Cancel button (around line 270). Gated by `isAdminOrAccounts` so only Admin/Accounts users see it:

```tsx
{isAdminOrAccounts && (
  <>
    <div className="h-4 w-px bg-border mx-1" />
    <Button size="sm" variant="outline" onClick={handleDownloadCSV} className="gap-1">
      <Download className="h-4 w-4" />
      Download CSV
    </Button>
  </>
)}
```

No database changes needed. Single file edit.

