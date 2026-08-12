"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assignEnquiryToMe } from "../_actions";

export function AssignToMeButton({ enquiryId }: { enquiryId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await assignEnquiryToMe(enquiryId);
          if (r.status === "error") toast.error(r.message);
          else toast.success(r.message ?? "Assigned.");
        });
      }}
    >
      <UserPlus size={13} strokeWidth={1.8} />
      Assign to me
    </Button>
  );
}
