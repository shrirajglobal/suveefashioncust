import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  }>) => void;
  onImportPurchases: (purchases: Array<{
    customerMobile: string;
    amount: number;
    date: Date;
    description?: string;
  }>, customerLookup: Map<string, string>) => void;
  customerLookup: Map<string, string>; // mobileNo -> customerId
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

export function ImportCSVForm({ 
  onImportCustomers, 
  onImportPurchases, 
  customerLookup 
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

    // Validate file type
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
            processCustomers(results.data as CustomerRow[]);
          } else {
            processPurchases(results.data as PurchaseRow[]);
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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processCustomers = (rows: CustomerRow[]) => {
    if (rows.length === 0) {
      setResult({
        success: false,
        message: "No data found in the CSV file",
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
        message: `No valid customers found. Errors:\n${errors.slice(0, 5).join("\n")}`,
      });
      return;
    }

    onImportCustomers(validCustomers);
    setResult({
      success: true,
      message: `Successfully imported ${validCustomers.length} customers`,
      count: validCustomers.length,
    });

    toast({
      title: "Import Successful",
      description: `${validCustomers.length} customers imported`,
    });
  };

  const processPurchases = (rows: PurchaseRow[]) => {
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
    const notFoundMobiles: Map<string, number[]> = new Map(); // mobile -> row numbers

    rows.forEach((row, index) => {
      const rowNum = index + 2; // Account for header row
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

      // Check if customer exists
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

    // Build comprehensive error messages
    const allErrors: string[] = [];
    
    // Add customer not found errors (grouped by mobile)
    if (notFoundMobiles.size > 0) {
      const notFoundCount = Array.from(notFoundMobiles.values()).reduce((sum, rows) => sum + rows.length, 0);
      allErrors.push(`⚠️ ${notFoundCount} purchases skipped - Customer mobile not found in database:`);
      
      Array.from(notFoundMobiles.entries()).slice(0, 10).forEach(([mobile, rows]) => {
        allErrors.push(`   • ${mobile} (${rows.length} transactions, rows: ${rows.slice(0, 3).join(", ")}${rows.length > 3 ? "..." : ""})`);
      });
      
      if (notFoundMobiles.size > 10) {
        allErrors.push(`   ... and ${notFoundMobiles.size - 10} more mobile numbers`);
      }
    }

    // Add other validation errors
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

    onImportPurchases(validPurchases, customerLookup);
    
    const hasErrors = totalSkipped > 0;
    setResult({
      success: true,
      message: `✅ Successfully imported ${validPurchases.length} of ${rows.length} purchases.`,
      count: validPurchases.length,
      errors: hasErrors ? allErrors : undefined,
      skippedCount: totalSkipped,
    });

    toast({
      title: hasErrors ? "Import Completed with Warnings" : "Import Successful",
      description: `${validPurchases.length} purchases imported${hasErrors ? `, ${totalSkipped} skipped` : ""}`,
      variant: hasErrors ? "default" : "default",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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
  );
}
