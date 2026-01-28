import { AlertTriangle, FileText, RefreshCw, PhoneOff, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface QualityMetrics {
  id: string;
  name: string;
  avgNotesLength: number;
  shortNotesCount: number;
  repetitiveNotesCount: number;
  totalInteractions: number;
  connectedCount: number;
  notConnectedCount: number;
}

interface InteractionQualityCardProps {
  qualityMetrics: QualityMetrics[];
}

export function InteractionQualityCard({ qualityMetrics }: InteractionQualityCardProps) {
  if (qualityMetrics.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Interaction Quality Monitoring
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Notes quality analysis and connection success rates
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Salesperson</TableHead>
              <TableHead className="text-center">Avg Notes Length</TableHead>
              <TableHead className="text-center">Short Notes</TableHead>
              <TableHead className="text-center">Repetitive</TableHead>
              <TableHead className="text-center">Connected Ratio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qualityMetrics.map((sp) => {
              // Quality flags
              const poorNotesLength = sp.avgNotesLength < 20;
              const highShortNotes = sp.shortNotesCount > 5 && sp.totalInteractions > 0;
              const highRepetitive = sp.repetitiveNotesCount > 3 && sp.totalInteractions > 0;
              
              const totalCalls = sp.connectedCount + sp.notConnectedCount;
              const connectedPercent = totalCalls > 0 
                ? Math.round((sp.connectedCount / totalCalls) * 100) 
                : 0;
              const poorConnectionRate = totalCalls > 5 && connectedPercent < 30;
              
              const hasQualityIssues = poorNotesLength || highShortNotes || highRepetitive || poorConnectionRate;

              return (
                <TableRow key={sp.id} className={hasQualityIssues ? "bg-destructive/5" : ""}>
                  <TableCell className={`font-medium ${hasQualityIssues ? "text-destructive" : ""}`}>
                    {sp.name}
                    {hasQualityIssues && (
                      <AlertTriangle className="inline-block ml-2 h-3 w-3 text-destructive" />
                    )}
                  </TableCell>
                  
                  {/* Avg Notes Length */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-medium ${poorNotesLength ? "text-destructive" : ""}`}>
                        {Math.round(sp.avgNotesLength)} chars
                      </span>
                      {poorNotesLength && (
                        <Badge variant="destructive" className="text-xs">Too short</Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* Short Notes */}
                  <TableCell className="text-center">
                    <Badge 
                      variant={highShortNotes ? "destructive" : sp.shortNotesCount > 0 ? "outline" : "secondary"}
                    >
                      {sp.shortNotesCount}
                    </Badge>
                    {highShortNotes && (
                      <p className="text-xs text-destructive mt-1">Flag!</p>
                    )}
                  </TableCell>
                  
                  {/* Repetitive Notes */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {highRepetitive && <RefreshCw className="h-3 w-3 text-destructive" />}
                      <Badge 
                        variant={highRepetitive ? "destructive" : sp.repetitiveNotesCount > 0 ? "outline" : "secondary"}
                      >
                        {sp.repetitiveNotesCount}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  {/* Connected Ratio */}
                  <TableCell className="text-center">
                    {totalCalls > 0 ? (
                      <div className="flex flex-col items-center gap-1 min-w-[120px]">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 text-green-600">
                            <PhoneCall className="h-3 w-3" />
                            {sp.connectedCount}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <PhoneOff className="h-3 w-3" />
                            {sp.notConnectedCount}
                          </span>
                        </div>
                        <div className="w-full flex items-center gap-2">
                          <Progress 
                            value={connectedPercent} 
                            className={`h-2 ${poorConnectionRate ? "[&>div]:bg-destructive" : "[&>div]:bg-green-600"}`}
                          />
                          <span className={`text-xs font-medium ${poorConnectionRate ? "text-destructive" : ""}`}>
                            {connectedPercent}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">No calls</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {/* Quality Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
            Issues: {"<"}20 char avg, {">"}5 short notes, {">"}3 repetitive, or {"<"}30% connected
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Short = {"<"}15 chars
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Repetitive = same text reused
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
