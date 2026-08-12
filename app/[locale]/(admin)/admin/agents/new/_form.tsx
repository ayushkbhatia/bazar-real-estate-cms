"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { inviteStaff } from "../../users/_actions";

/**
 * Sprint 3 (backfilled): dedicated /admin/agents/new page. Reuses the
 * existing `inviteStaff` action from /admin/users so there's exactly one
 * server-side staff-invitation path — the page only changes the framing.
 */
export function InviteAgentForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<StaffInviteInput>({
    resolver: zodResolver(staffInviteSchema),
    defaultValues: {
      email: "",
      display_name: "",
      role: "agent",
    },
  });

  function onSubmit(values: StaffInviteInput) {
    startTransition(async () => {
      const result = await inviteStaff(values);
      if (result.status === "ok") {
        toast.success(result.message ?? "Invitation sent.");
        router.push("/admin/agents");
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

  const selectedRole = form.watch("role");

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-5 max-w-[560px]"
    >
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder="advisor@bazar.ae"
          {...form.register("email")}
          autoFocus
        />
        {form.formState.errors.email?.message ? (
          <p className="text-[12px] text-bz-danger mt-1">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="invite-name">Display name</Label>
        <Input
          id="invite-name"
          placeholder="Mariam Al-Hashimi"
          {...form.register("display_name")}
        />
        {form.formState.errors.display_name?.message ? (
          <p className="text-[12px] text-bz-danger mt-1">
            {form.formState.errors.display_name.message}
          </p>
        ) : null}
      </div>
      <div>
        <Label>Role</Label>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {STAFF_ROLES.map((role) => (
            <label
              key={role}
              className={
                selectedRole === role
                  ? "flex items-start gap-3 p-3 rounded-md border border-bz-ink bg-bz-surface cursor-pointer"
                  : "flex items-start gap-3 p-3 rounded-md border border-bz-border bg-bz-surface cursor-pointer hover:border-bz-border-strong"
              }
            >
              <input
                type="radio"
                value={role}
                {...form.register("role")}
                className="mt-1"
              />
              <div>
                <div className="text-[14px] font-medium text-bz-ink">
                  {ROLE_LABEL[role]}
                </div>
                <div className="text-[12px] text-bz-muted mt-0.5 leading-relaxed">
                  {ROLE_DESCRIPTION[role]}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/agents")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending invite…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
