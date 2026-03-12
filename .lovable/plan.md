

## Plan: Add WhatsApp Button to Call List

**Problem:** The call list cards only have "Call" and "Log" buttons. Users want a WhatsApp button between them to directly message customers, matching the pattern already used in the customer table.

**What changes:**

In `src/components/crm/TodaysCallList.tsx`:

1. Import `MessageCircle` from lucide-react (already has other icons imported).

2. In the `CustomerCallCard` component, add a WhatsApp button between the Call and Log buttons. It will use the same `https://wa.me/` pattern from the customer table:
   - Link: `https://wa.me/${phone.replace(/\D/g, '')}`
   - Opens in new tab
   - Green-styled button with `MessageCircle` icon
   - Respects DND status (customers with DND are already filtered out of this list)

**Button order will be:** Call → WhatsApp → Log

The implementation mirrors exactly how `CustomerTable.tsx` (line 424-432) handles WhatsApp links, ensuring consistency across the app.

