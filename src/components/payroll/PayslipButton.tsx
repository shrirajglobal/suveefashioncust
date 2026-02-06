import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { usePayslipGenerator } from '@/hooks/usePayslipGenerator';

interface PayslipButtonProps {
  payrollId: string;
  existingUrl?: string | null;
  onGenerated?: (url: string) => void;
}

export const PayslipButton = ({ payrollId, existingUrl, onGenerated }: PayslipButtonProps) => {
  const { generatePayslip, downloadPayslip, isGenerating } = usePayslipGenerator();
  const [payslipUrl, setPayslipUrl] = useState(existingUrl);

  const handleGenerate = async () => {
    const url = await generatePayslip(payrollId);
    if (url) {
      setPayslipUrl(url);
      onGenerated?.(url);
    }
  };

  const handleDownload = () => {
    if (payslipUrl) {
      downloadPayslip(payslipUrl);
    }
  };

  if (payslipUrl) {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-1"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="gap-1"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Regenerate
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleGenerate}
      disabled={isGenerating}
      className="gap-1"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          Generate Payslip
        </>
      )}
    </Button>
  );
};
