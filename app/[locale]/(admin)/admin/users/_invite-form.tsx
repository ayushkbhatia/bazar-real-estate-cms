"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  staffInviteSchema,
  STAFF_ROLES,
  ROLE_LABEL,
  ROLE_DESCRIPTION,
  type StaffInviteInput,
} from "@/lib/schemas/staff";
import { inviteStaff } from "./_actions";

export function InviteStaffButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<StaffInviteInput>({
    resolver: zodResolver(staffInviteSchema),
    defaultValues: { email: "", display_name: "", role: "agent" },
  });

  function onSubmit(values: StaffInviteInput) {
    startTransition(async () => {
      const result = await inviteStaff(values);
      if (result.status === "ok") {
        // The row exists either way, so the dialog still closes — but a green
        // toast for an invite nobody received is worse than no toast at all.
        if (result.emailed === false) {
          toast.warning(result.message ?? "Invitation created, but no email was sent.");
        } else {
          toast.success(result.message ?? "Invitation sent.");
        }
        form.reset();
        setOpen(false);
      } else {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, v] of Object.entries(result.fieldErrors)) {
            form.setError(k as keyof StaffInviteInput, { message: v });
          }
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus size={14} strokeWidth={1.8} />
          Invite staff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 mt-2"
        >
          <Field
            label="Email"
            error={form.formState.errors.email?.message}
          >
            <Input
              type="email"
              autoComplete="off"
              placeholder="jameel@bazar.ae"
              {...form.register("email")}
            />
          </Field>
          <Field
            label="Display name"
            error={form.formState.errors.display_name?.message}
          >
            <Input
              autoComplete="off"
              placeholder="Jameel Khan"
              {...form.register("display_name")}
            />
          </Field>
          <Field label="Role" error={form.formState.errors.role?.message}>
            <select
              {...form.register("role")}
              className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {ROLE_DESCRIPTION[r]}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[12px] text-bz-muted leading-[1.5]">
            We&apos;ll email a magic-link sign-in. When they sign in for the
            first time, a staff row is created automatically with this role.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px] text-bz-ink-2 font-normal">{label}</Label>
      {children}
      {error ? (
        <div className="text-[11.5px] text-bz-danger">{error}</div>
      ) : null}
    </div>
  );
}
