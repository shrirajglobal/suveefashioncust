## Plan: Customer Master Excel Download in Settings (Super Admin only)

**What you'll see:** A new "Export Customers" item in the Settings sidebar, visible only to Super Admin. It opens a card with a "Download Excel" button that saves `customer-master-YYYY-MM-DD.xlsx`.

**Columns in the sheet:**
Name, Mobile No, Address, City, Assigned Salesperson, DND (Yes/No), Critical (Yes/No), Total Sales (INR), Number of Sales, Last Sale Date, Last Contacted Date, Created On.

Dates are shown as DD/MM/YYYY. GST is skipped, as you asked.

## Technical details
- Add the `xlsx` (SheetJS) package. Build the workbook in the browser and download it through a Blob.
- New component `src/components/crm/CustomerMasterExport.tsx`:
  - Fetches all customers, transactions and profiles in batches of 1000, so the 1000-row limit does not cut the export short.
  - Totals sales per customer and maps `assigned_to` to the salesperson's name.
  - Sets column widths and bolds the header row.
  - Shows the record count and a loading state. Errors go through `errorHandler`.
- `Settings.tsx`: add an `"export"` section (FileSpreadsheet icon), gated by `userRole === "super_admin"`.
- No database changes. Existing permissions already let Super Admin read every customer.
