import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, Calendar, Clock } from "lucide-react";
import { HolidaysSettings } from "./settings/HolidaysSettings";
import { ShiftsSettings } from "./settings/ShiftsSettings";

interface HRSettingsDialogProps {
  trigger?: React.ReactNode;
}

export function HRSettingsDialog({ trigger }: HRSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">HR Settings</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            HR Settings
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="holidays" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="holidays" className="gap-2">
              <Calendar className="h-4 w-4" />
              Paid Holidays
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-2">
              <Clock className="h-4 w-4" />
              Work Shifts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="holidays" className="flex-1 overflow-auto mt-4">
            <HolidaysSettings />
          </TabsContent>
          
          <TabsContent value="shifts" className="flex-1 overflow-auto mt-4">
            <ShiftsSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
