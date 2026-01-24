import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface ImportCSVFormProps {
  onImportCustomers: (customers: Array<{
    name: string;
    address: string;
    city: string;
    mobileNo: string;
  }>, overwrite?: boolean) => Promise<{ imported: number; skipped: number; updated: number }> | { imported: number; skipped: number; updated: number };
  onImportPurchases: (purchases: Array<{
    customerMobile: string;
    amount: number;
    date: Date;
    description?: string;
  }>, customerLookup: Map<string, string>, overwrite?: boolean) => Promise<{ imported: number; skipped: number; updated: number }> | { imported: number; skipped: number; updated: number };
  customerLookup: Map<string, string>;
  existingCustomerMobiles: Set<string>;
  existingPurchases: Array<{ customerId: string; amount: number; date: Date }>;
}

interface CustomerRow {
  name: string;
  address?: string;
  city?: string;
  mobileNo: string;
  mobile?: string;
  mobile_no?: string;
}

interface PurchaseRow {
  customerMobile?: string;
  customer_mobile?: string;
  mobile?: string;
  mobileNo?: string;
  amount: string | number;
  date: string;
  description?: string;
}

interface DuplicateInfo {
  type: "customers" | "purchases";
  duplicateCount: number;
  newCount: number;
  data: CustomerRow[] | PurchaseRow[];
  duplicates: string[];
}

export function ImportCSVForm({ 
  onImportCustomers, 
  onImportPurchases, 
  customerLookup,
  existingCustomerMobiles,
  existingPurchases,
}: ImportCSVFormProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
    skippedCount?: number;
  } | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const purchasesFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const downloadTemplate = (type: "customers" | "purchases") => {
    let content = "";
    let filename = "";

    if (type === "customers") {
      content = "name,mobileNo,address,city\nJohn Doe,+91 98765 43210,123 Main St,Mumbai\nJane Smith,+91 87654 32109,456 Oak Ave,Delhi";
      filename = "customers_template.csv";
    } else {
      content = "customerMobile,amount,date,description\n+91 98765 43210,5000,2024-01-15,Product A\n+91 87654 32109,3500,2024-01-16,Service B";
      filename = "purchases_template.csv";
    }

    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "customers" | "purchases"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (type === "customers") {
            checkCustomerDuplicates(results.data as CustomerRow[]);
          } else {
            checkPurchaseDuplicates(results.data as PurchaseRow[]);
          }
        } catch (error) {
          setResult({
            success: false,
            message: error instanceof Error ? error.message : "Failed to process file",
          });
        }
        setImporting(false);
      },
      error: (error) => {
        setResult({
          success: false,
          message: `Parse error: ${error.message}`,
        });
        setImporting(false);
      },
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (purchasesFileRef.current) purchasesFileRef.current.value = "";
  };

  const checkCustomerDuplicates = (rows: CustomerRow[]) => {
    const duplicates: string[] = [];
    const validRows: CustomerRow[] = [];

    rows.forEach((row) => {
      const mobileNo = (row.mobileNo || row.mobile || row.mobile_no)?.trim();
      if (!mobileNo || !row.name?.trim()) return;
      
      if (existingCustomerMobiles.has(mobileNo)) {
        duplicates.push(mobileNo);
      }
      validRows.push(row);
    });

    if (duplicates.length > 0) {
      setDuplicateDialog({
        type: "customers",
        duplicateCount: duplicates.length,
        newCount: validRows.length - duplicates.length,
        data: validRows,
        duplicates: duplicates.slice(0, 10),
      });
    } else {
      processCustomers(validRows, false);
    }
  };

  const checkPurchaseDuplicates = (rows: PurchaseRow[]) => {
    const duplicates: string[] = [];
    const validRows: PurchaseRow[] = [];

    // Create a set of existing purchase signatures for quick lookup
    const existingSignatures = new Set(
      existingPurchases.map(p => `${p.customerId}-${p.amount}-${new Date(p.date).toDateString()}`)
    );

    rows.forEach((row) => {
      const customerMobile = (
        row.customerMobile || row.customer_mobile || row.mobile || row.mobileNo
      )?.toString().trim();
      
      if (!customerMobile || !row.amount || !row.date) return;
      
      const customerId = customerLookup.get(customerMobile);
      if (!customerId) {
        validRows.push(row);
        return;
      }

      const amount = parseFloat(row.amount.toString());
      const date = new Date(row.date);
      if (isNaN(amount) || isNaN(date.getTime())) {
        validRows.push(row);
        return;
      }

      const signature = `${customerId}-${amount}-${date.toDateString()}`;
      if (existingSignatures.has(signature)) {
        duplicates.push(`${customerMobile} - ₹${amount} on ${date.toLocaleDateString()}`);
      }
      validRows.push(row);
    });

    if (duplicates.length > 0) {
      setDuplicateDialog({
        type: "purchases",
        duplicateCount: duplicates.length,
        newCount: validRows.length - duplicates.length,
        data: validRows,
        duplicates: duplicates.slice(0, 10),
      });
    } else {
      processPurchases(validRows, false);
    }
  };

  const handleDuplicateChoice = (overwrite: boolean) => {
    if (!duplicateDialog) return;

    if (duplicateDialog.type === "customers") {
      processCustomers(duplicateDialog.data as CustomerRow[], overwrite);
    } else {
      processPurchases(duplicateDialog.data as PurchaseRow[], overwrite);
    }
    setDuplicateDialog(null);
  };

  const processCustomers = async (rows: CustomerRow[], overwrite: boolean) => {
    if (rows.length === 0) {
      setResult({
        success: false,
        message: "No data found in the CSV file",
        errors: [],
        skippedCount: 0,
      });
      return;
    }

    const validCustomers: Array<{
      name: string;
      address: string;
      city: string;
      mobileNo: string;
    }> = [];

    const errors: string[] = [];

    rows.forEach((row, index) => {
      const name = row.name?.trim();
      const mobileNo = (row.mobileNo || row.mobile || row.mobile_no)?.trim();

      if (!name) {
        errors.push(`Row ${index + 2}: Missing name`);
        return;
      }
      if (!mobileNo) {
        errors.push(`Row ${index + 2}: Missing mobile number`);
        return;
      }

      validCustomers.push({
        name,
        address: row.address?.trim() || "",
        city: row.city?.trim() || "",
        mobileNo,
      });
    });

    if (validCustomers.length === 0) {
      setResult({
        success: false,
        message: `No valid customers found.`,
        errors: errors.slice(0, 10),
        skippedCount: rows.length,
      });
      return;
    }

    const importResult = await onImportCustomers(validCustomers, overwrite);
    
    const messages: string[] = [];
    if (importResult.imported > 0) messages.push(`${importResult.imported} new customers added`);
    if (importResult.updated > 0) messages.push(`${importResult.updated} customers updated`);
    if (importResult.skipped > 0) messages.push(`${importResult.skipped} duplicates skipped`);

    setResult({
      success: true,
      message: `✅ ${messages.join(", ")}`,
      count: importResult.imported + importResult.updated,
      errors: errors.length > 0 ? errors : undefined,
      skippedCount: errors.length,
    });

    toast({
      title: "Import Completed",
      description: messages.join(", "),
    });
  };

  const processPurchases = async (rows: PurchaseRow[], overwrite: boolean) => {
    if (rows.length === 0) {
      setResult({
        success: false,
        message: "No data found in the CSV file",
        errors: [],
        skippedCount: 0,
      });
      return;
    }

    const validPurchases: Array<{
      customerMobile: string;
      amount: number;
      date: Date;
      description?: string;
    }> = [];

    const errorDetails: { row: number; mobile: string; reason: string }[] = [];
    const notFoundMobiles: Map<string, number[]> = new Map();

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const customerMobile = (
        row.customerMobile || 
        row.customer_mobile || 
        row.mobile || 
        row.mobileNo
      )?.toString().trim();

      const amountStr = row.amount?.toString().trim();
      const dateStr = row.date?.trim();

      if (!customerMobile) {
        errorDetails.push({ row: rowNum, mobile: "-", reason: "Missing customer mobile" });
        return;
      }
      if (!amountStr) {
        errorDetails.push({ row: rowNum, mobile: customerMobile, reason: "Missing amount" });
        return;
      }
      if (!dateStr) {
        errorDetails.push({ row: rowNum, mobile: customerMobile, reason: "Missing date" });
        return;
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errorDetails.push({ row: rowNum, mobile: customerMobile, reason: `Invalid amount: "${amountStr}"` });
        return;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errorDetails.push({ row: rowNum, mobile: customerMobile, reason: `Invalid date format: "${dateStr}"` });
        return;
      }

      if (!customerLookup.has(customerMobile)) {
        const existing = notFoundMobiles.get(customerMobile) || [];
        existing.push(rowNum);
        notFoundMobiles.set(customerMobile, existing);
        return;
      }

      validPurchases.push({
        customerMobile,
        amount,
        date,
        description: row.description?.trim(),
      });
    });

    const allErrors: string[] = [];
    
    if (notFoundMobiles.size > 0) {
      const notFoundCount = Array.from(notFoundMobiles.values()).reduce((sum, rows) => sum + rows.length, 0);
      allErrors.push(`⚠️ ${notFoundCount} purchases skipped - Customer mobile not found:`);
      
      Array.from(notFoundMobiles.entries()).slice(0, 10).forEach(([mobile, rows]) => {
        allErrors.push(`   • ${mobile} (${rows.length} transactions)`);
      });
      
      if (notFoundMobiles.size > 10) {
        allErrors.push(`   ... and ${notFoundMobiles.size - 10} more mobile numbers`);
      }
    }

    if (errorDetails.length > 0) {
      allErrors.push(`\n⚠️ ${errorDetails.length} rows skipped due to validation errors:`);
      errorDetails.slice(0, 10).forEach((err) => {
        allErrors.push(`   • Row ${err.row}: ${err.reason}`);
      });
      if (errorDetails.length > 10) {
        allErrors.push(`   ... and ${errorDetails.length - 10} more errors`);
      }
    }

    const totalSkipped = errorDetails.length + Array.from(notFoundMobiles.values()).reduce((sum, rows) => sum + rows.length, 0);

    if (validPurchases.length === 0) {
      setResult({
        success: false,
        message: `No valid purchases imported out of ${rows.length} rows.`,
        errors: allErrors,
        skippedCount: totalSkipped,
      });
      return;
    }

    const importResult = await onImportPurchases(validPurchases, customerLookup, overwrite);
    
    const messages: string[] = [];
    if (importResult.imported > 0) messages.push(`${importResult.imported} new purchases added`);
    if (importResult.updated > 0) messages.push(`${importResult.updated} purchases updated`);
    if (importResult.skipped > 0) messages.push(`${importResult.skipped} duplicates skipped`);

    setResult({
      success: true,
      message: `✅ ${messages.join(", ")}`,
      count: importResult.imported + importResult.updated,
      errors: allErrors.length > 0 ? allErrors : undefined,
      skippedCount: totalSkipped + importResult.skipped,
    });

    toast({
      title: "Import Completed",
      description: messages.join(", "),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import customers or purchases
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">mobileNo</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">address</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">city</code>
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary"
                  onClick={() => downloadTemplate("customers")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download template
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "customers")}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importing..." : "Select CSV File"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">customerMobile</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">amount</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">date</code>,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">description</code>
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary"
                  onClick={() => downloadTemplate("purchases")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download template
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  ref={purchasesFileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "purchases")}
                />
                <Button
                  onClick={() => purchasesFileRef.current?.click()}
                  disabled={importing}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importing..." : "Select CSV File"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {result && (
            <div className="space-y-3">
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-medium">{result.message}</div>
                  {result.skippedCount !== undefined && result.skippedCount > 0 && (
                    <div className="text-sm mt-1">
                      {result.skippedCount} row(s) were skipped
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              
              {result.errors && result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-sm">
                  <div className="font-medium mb-2 text-destructive">Error Details:</div>
                  {result.errors.map((error, i) => (
                    <div key={i} className="text-muted-foreground whitespace-pre-wrap">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Duplicate Data Found
            </DialogTitle>
            <DialogDescription>
              {duplicateDialog?.type === "customers" ? (
                <>
                  Found <strong>{duplicateDialog.duplicateCount}</strong> customer(s) with mobile numbers that already exist in your database.
                </>
              ) : (
                <>
                  Found <strong>{duplicateDialog?.duplicateCount}</strong> purchase(s) that appear to be duplicates (same customer, amount, and date).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium mb-2">Duplicate entries:</div>
              <div className="max-h-32 overflow-y-auto rounded-md bg-muted p-2 text-xs">
                {duplicateDialog?.duplicates.map((dup, i) => (
                  <div key={i} className="py-0.5">• {dup}</div>
                ))}
                {duplicateDialog && duplicateDialog.duplicates.length < duplicateDialog.duplicateCount && (
                  <div className="py-0.5 text-muted-foreground">
                    ... and {duplicateDialog.duplicateCount - duplicateDialog.duplicates.length} more
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              New entries to add: <strong>{duplicateDialog?.newCount}</strong>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleDuplicateChoice(false)}
              className="w-full sm:w-auto"
            >
              Skip Duplicates
            </Button>
            <Button
              variant="default"
              onClick={() => handleDuplicateChoice(true)}
              className="w-full sm:w-auto"
            >
              Overwrite Existing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
