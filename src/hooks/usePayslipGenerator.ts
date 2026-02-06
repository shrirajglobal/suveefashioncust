import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePayslipGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePayslip = async (payrollId: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payslip', {
        body: { payroll_id: payrollId },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success('Payslip generated successfully');
        return data.payslip_url;
      } else {
        throw new Error(data.error || 'Failed to generate payslip');
      }
    } catch (error: any) {
      console.error('Payslip generation error:', error);
      toast.error(error.message || 'Failed to generate payslip');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPayslip = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    if (filename) {
      link.download = filename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    generatePayslip,
    downloadPayslip,
    isGenerating,
  };
};
