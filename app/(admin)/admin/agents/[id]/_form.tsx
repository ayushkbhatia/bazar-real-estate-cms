"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  agentEditSchema,
  type AgentEditInput,
} from "@/lib/schemas/agent";
import { updateAgentAction } from "../_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] text-bz-danger mt-1">{message}</p>;
}

export function AgentEditForm({
  userId,
  initial,
}: {
  userId: string;
  initial: AgentEditInput;
}) {
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AgentEditInput>({
    resolver: zodResolver(agentEditSchema),
    defaultValues: initial,
  });

  const languages = watch("languages");
  const specialties = watch("specialties");
  const credentials = watch("credentials");

  function onSubmit(values: AgentEditInput) {
    setServerErrors({});
    startTransition(async () => {
      const result = await updateAgentAction(userId, values);
      if (result.status === "ok") {
        toast.success("Saved.");
      } else {
        if (result.fieldErrors) setServerErrors(result.fieldErrors);
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <Label htmlFor="display_name">Display name</Label>
          <Input id="display_name" {...register("display_name")} />
          <FieldError
            message={errors.display_name?.message ?? serverErrors.display_name}
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            placeholder="firstname-lastname"
            {...register("slug")}
          />
          <FieldError message={errors.slug?.message ?? serverErrors.slug} />
          <p className="text-[11.5px] text-bz-muted mt-1">
            Used in /agents/{watch("slug") || "…"} and /insights/author/…
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Senior Advisor · Saadiyat & Yas"
          {...register("title")}
        />
        <FieldError message={errors.title?.message ?? serverErrors.title} />
      </div>

      <div>
        <Label htmlFor="brn">BRN (RERA broker number)</Label>
        <Input
          id="brn"
          placeholder="BRN-12345"
          className="font-mono"
          {...register("brn")}
        />
        <FieldError message={errors.brn?.message ?? serverErrors.brn} />
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          rows={5}
          {...register("bio")}
          placeholder="Twelve years in Saadiyat. The advisor families ask for when the deal needs to close quietly."
          className="mt-1.5 w-full px-3 py-2 rounded-md border border-bz-border bg-bz-bg text-[14px] leading-relaxed resize-y focus:outline-none focus:border-bz-border-strong"
        />
        <FieldError message={errors.bio?.message ?? serverErrors.bio} />
      </div>

      <div>
        <Label htmlFor="photo_url">Photo URL</Label>
        <Input
          id="photo_url"
          placeholder="https://…"
          {...register("photo_url")}
        />
        <FieldError
          message={errors.photo_url?.message ?? serverErrors.photo_url}
        />
        <p className="text-[11.5px] text-bz-muted mt-1">
          Full URL to a 4:5 portrait. Storage upload lands in Sprint 7d.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <Label>Languages</Label>
          <Input
            placeholder="English, Arabic, French"
            defaultValue={languages?.join(", ") ?? ""}
            onChange={(e) =>
              setValue(
                "languages",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
          <p className="text-[11.5px] text-bz-muted mt-1">Comma separated.</p>
        </div>
        <div>
          <Label>Specialties</Label>
          <Input
            placeholder="Beachfront, Off-market, Family relocation"
            defaultValue={specialties?.join(", ") ?? ""}
            onChange={(e) =>
              setValue(
                "specialties",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      </div>

      <div>
        <Label>Credentials</Label>
        <Input
          placeholder="RERA cert 2018, CFA Level II"
          defaultValue={credentials?.join(", ") ?? ""}
          onChange={(e) =>
            setValue(
              "credentials",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
