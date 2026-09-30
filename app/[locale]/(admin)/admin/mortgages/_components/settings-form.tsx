"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { MortgageHoliday, MortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { cn } from "@/lib/utils";
import { setMortgageHoliday, updateMortgageSettings } from "../_actions";
import { Card } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const FIELD = "h-10 rounded-md border border-bz-border bg-bz-surface px-3 text-[13px]";

function Radios<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[12px] font-medium text-bz-ink-2">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 accent-bz-ink" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The mortgage module's settings (not designed; IMPLEMENTATION §1.10). The Head of mortgages only. */
export function SettingsForm({ settings }: { settings: MortgageSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    flag: settings.flag,
    assignmentMode: settings.assignment_mode,
    ltvNational: settings.ltv_national_pct,
    ltvExpat: settings.ltv_expat_pct,
  });
  return (
    <Card title={t("settings.title")}>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateMortgageSettings(form);
            if (r.ok) toast.success(r.message ?? t("settings.saved"));
            else toast.error(r.message);
            router.refresh();
          });
        }}
      >
        <Radios
          name="flag"
          legend={t("settings.flag.title")}
          value={form.flag}
          onChange={(flag) => setForm((f) => ({ ...f, flag }))}
          options={[
            { value: "off", label: t("settings.flag.off") },
            { value: "staff", label: t("settings.flag.staff") },
            { value: "public", label: t("settings.flag.public") },
          ]}
        />
        <Radios
          name="assignment"
          legend={t("settings.assignment.title")}
          value={form.assignmentMode}
          onChange={(assignmentMode) => setForm((f) => ({ ...f, assignmentMode }))}
          options={[
            { value: "round_robin", label: t("settings.assignment.round_robin") },
            { value: "claim", label: t("settings.assignment.claim") },
          ]}
        />
        <fieldset>
          <legend className="mb-2 text-[12px] font-medium text-bz-ink-2">{t("settings.ltv.title")}</legend>
          <div className="grid max-w-[420px] grid-cols-2 gap-4">
            {(
              [
                ["ltvNational", "settings.ltv.national"],
                ["ltvExpat", "settings.ltv.expat"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5 text-[12px] text-bz-ink-2">
                {t(label)}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className={cn(FIELD, "mono")}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="submit" disabled={pending} className="text-[13px]">
            {t("settings.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function HolidaysCard({ holidays }: { holidays: readonly MortgageHoliday[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const save = (input: { day: string; name: string; remove: boolean }, reset?: boolean) =>
    start(async () => {
      const r = await setMortgageHoliday(input);
      if (r.ok) {
        toast.success(r.message ?? t("settings.saved"));
        if (reset) {
          setDay("");
          setName("");
        }
      } else toast.error(r.message);
      router.refresh();
    });
  return (
    <Card title={t("settings.holidays.title")}>
      {holidays.length === 0 ? (
        <p className="text-[12.5px] text-bz-muted">{t("settings.holidays.none")}</p>
      ) : (
        <ul className="divide-y divide-bz-border">
          {holidays.map((h) => (
            <li key={h.day} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="mono w-[110px] text-bz-ink-2">{h.day}</span>
              <span className="flex-1">{h.name}</span>
              <Button variant="ghost" className="text-[12.5px]" disabled={pending} onClick={() => save({ day: h.day, name: h.name, remove: true })}>
                {t("settings.holidays.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-bz-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save({ day, name, remove: false }, true);
        }}
      >
        <label className="flex flex-col gap-1.5 text-[12px] text-bz-ink-2">
          {t("settings.holidays.day")}
          <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-[12px] text-bz-ink-2">
          {t("settings.holidays.name")}
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </label>
        <Button type="submit" variant="outline" disabled={pending || !day || !name.trim()} className="text-[13px]">
          {t("settings.holidays.add")}
        </Button>
      </form>
    </Card>
  );
}
