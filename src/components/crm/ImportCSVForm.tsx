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
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      });
      return;
    }

    const validPurchases: Array<{
      customerMobile: string;
      amount: number;
      date: Date;
      description?: string;
    }> = [];

    const errors: string[] = [];
    const notFoundMobiles: Set<string> = new Set();

    rows.forEach((row, index) => {
      const customerMobile = (
        row.customerMobile || 
        row.customer_mobile || 
        row.mobile || 
        row.mobileNo
      )?.toString().trim();

      const amountStr = row.amount?.toString().trim();
      const dateStr = row.date?.trim();

      if (!customerMobile) {
        errors.push(`Row ${index + 2}: Missing customer mobile`);
        return;
      }
      if (!amountStr) {
        errors.push(`Row ${index + 2}: Missing amount`);
        return;
      }
      if (!dateStr) {
        errors.push(`Row ${index + 2}: Missing date`);
        return;
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Row ${index + 2}: Invalid amount`);
        return;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push(`Row ${index + 2}: Invalid date format`);
        return;
      }

      // Check if customer exists
      if (!customerLookup.has(customerMobile)) {
        notFoundMobiles.add(customerMobile);
        return;
      }

      validPurchases.push({
        customerMobile,
        amount,
        date,
        description: row.description?.trim(),
      });
    });

    if (notFoundMobiles.size > 0) {
      const mobiles = Array.from(notFoundMobiles).slice(0, 3);
      errors.push(
        `Customers not found for mobiles: ${mobiles.join(", ")}${
          notFoundMobiles.size > 3 ? ` and ${notFoundMobiles.size - 3} more` : ""
        }`
      );
    }

    if (validPurchases.length === 0) {
      setResult({
        success: false,
        message: `No valid purchases found.\n${errors.slice(0, 5).join("\n")}`,
      });
      return;
    }

    onImportPurchases(validPurchases, customerLookup);
    setResult({
      success: true,
      message: `Successfully imported ${validPurchases.length} purchases${
        errors.length > 0 ? `. ${errors.length} rows skipped.` : ""
      }`,
      count: validPurchases.length,
    });

    toast({
      title: "Import Successful",
      description: `${validPurchases.length} purchases imported`,
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
                type="file"
                accept=".csv"
                className="hidden"
                id="purchases-file"
                onChange={(e) => handleFileUpload(e, "purchases")}
              />
              <Button
                onClick={() => document.getElementById("purchases-file")?.click()}
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
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="whitespace-pre-line">
              {result.message}
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
