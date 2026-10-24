import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage, logError } from "@/lib/errorHandler";

async function fetchAll<T>(table: "customers" | "transactions" | "profiles", columns: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data as unknown as T[]) || []));
    if (!data || data.length < size) break;
  }
  return out;
}

const fmt = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
  if (isNaN(dt.getTime())) return "";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

export function CustomerMasterExport() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      type C = { id: string; name: string; mobile_no: string; address: string | null; city: string | null; assigned_to: string | null; dnd: boolean; is_critical: boolean; last_contacted_date: string | null; created_at: string };
      type T = { customer_id: string; amount: number; transaction_date: string };
      type P = { user_id: string; full_name: string };
      const [customers, txns, profiles] = await Promise.all([
        fetchAll<C>("customers", "id,name,mobile_no,address,city,assigned_to,dnd,is_critical,last_contacted_date,created_at"),
        fetchAll<T>("transactions", "customer_id,amount,transaction_date"),
        fetchAll<P>("profiles", "user_id,full_name"),
      ]);
      const names = new Map(profiles.map((p) => [p.user_id, p.full_name]));
      const agg = new Map<string, { total: number; count: number; last: string }>();
      for (const t of txns) {
        const a = agg.get(t.customer_id) || { total: 0, count: 0, last: "" };
        a.total += Number(t.amount) || 0;
        a.count += 1;
        if (t.transaction_date > a.last) a.last = t.transaction_date;
        agg.set(t.customer_id, a);
      }
      const headers = ["Name", "Mobile No", "Address", "City", "Assigned Salesperson", "DND", "Critical", "Total Sales (INR)", "Number of Sales", "Last Sale Date", "Last Contacted Date", "Created On"];
      const rows = customers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const a = agg.get(c.id);
          return [c.name, c.mobile_no, c.address || "", c.city || "", c.assigned_to ? names.get(c.assigned_to) || "" : "", c.dnd ? "Yes" : "No", c.is_critical ? "Yes" : "No", a?.total || 0, a?.count || 0, fmt(a?.last), fmt(c.last_contacted_date), fmt(c.created_at)];
        });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [28, 15, 40, 16, 22, 7, 9, 18, 15, 15, 18, 13].map((wch) => ({ wch }));
      headers.forEach((_, i) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: i });
        ws[ref].s = { font: { bold: true, name: "Arial" }, fill: { fgColor: { rgb: "E5E7EB" } } };
      });
      for (let r = 1; r <= rows.length; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: 7 });
        if (ws[ref]) ws[ref].z = "₹#,##0";
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `customer-master-${stamp}.xlsx`);
      toast.success(`Downloaded ${rows.length} customers`);
    } catch (e) {
      logError("CustomerMasterExport", e);
      toast.error(getSafeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Export Customer Master</CardTitle>
        <CardDescription>Download all customers with address, DND, salesperson and sales totals as an Excel sheet.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full gap-2" onClick={handleDownload} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loading ? "Preparing..." : "Download Excel"}
        </Button>
      </CardContent>
    </Card>
  );
}
