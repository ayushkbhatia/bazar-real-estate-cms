"use client";

import { useId, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { saveBank } from "../_banks-actions";
import { BankMark, useAction } from "./file-actions";
import { Pill } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export type BankItem = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  active: boolean;
  inboxes: string[];
  sortOrder: number;
};

/** The partner banks (not designed): each with its mark, its package inboxes and whether files can go to it. */
export function BanksList({ banks, canEdit }: { banks: readonly BankItem[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<BankItem | null>(null);
  if (banks.length === 0) return <p className="px-5 py-6 text-[13px] text-bz-muted">{t("banks.empty")}</p>;
  return (
    <>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-bz-border text-start text-[11.5px] text-bz-muted">
            <th className="px-5 py-2.5 text-start font-normal">{t("banks.col.bank")}</th>
            <th className="hidden px-3 py-2.5 text-start font-normal md:table-cell">{t("banks.col.inboxes")}</th>
            <th className="px-3 py-2.5 text-start font-normal">{t("banks.col.status")}</th>
            {canEdit ? <th className="w-px px-5 py-2.5" aria-hidden /> : null}
          </tr>
        </thead>
        <tbody>
          {banks.map((bank) => (
            <tr key={bank.id} className="border-t border-bz-border first:border-t-0">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <BankMark code={bank.code} color={bank.color} size={32} />
                  <div className="min-w-0">
                    <div className="font-medium">{bank.name}</div>
                    <div className="mono text-[11px] text-bz-muted">{bank.code}</div>
                  </div>
                </div>
              </td>
              <td className="mono hidden max-w-[320px] px-3 py-3 text-[11.5px] text-bz-ink-2 md:table-cell">
                {bank.inboxes.length ? bank.inboxes.map((inbox) => <div key={inbox} className="truncate">{inbox}</div>) : "—"}
              </td>
              <td className="px-3 py-3">
                <Pill tone={bank.active ? "success" : "muted"} small dot={bank.active}>
                  {bank.active ? t("banks.active") : t("banks.inactive")}
                </Pill>
              </td>
              {canEdit ? (
                <td className="px-5 py-3 text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12.5px]"
                    onClick={() => setEditing(bank)}
                    aria-label={t("banks.dialog.edit", { name: bank.name })}
                  >
                    <Pencil strokeWidth={1.6} />
                    {t("banks.edit")}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {editing ? <BankDialog key={editing.id} bank={editing} nextOrder={editing.sortOrder} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

export function AddBankButton({ nextOrder }: { nextOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="text-[13px]" onClick={() => setOpen(true)}>
        <Plus strokeWidth={1.8} />
        {t("banks.add")}
      </Button>
      {open ? <BankDialog bank={null} nextOrder={nextOrder} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BankDialog({ bank, nextOrder, onClose }: { bank: BankItem | null; nextOrder: number; onClose: () => void }) {
  const { pending, run } = useAction();
  const id = useId();
  const [code, setCode] = useState(bank?.code ?? "");
  const [name, setName] = useState(bank?.name ?? "");
  const [color, setColor] = useState(bank?.color ?? "");
  const [inboxes, setInboxes] = useState((bank?.inboxes ?? []).join("\n"));
  const [active, setActive] = useState(bank?.active ?? true);
  const [order, setOrder] = useState(String(bank?.sortOrder ?? nextOrder));
  const label = "text-[12px] font-medium text-bz-ink-2";
  const hint = "mt-1 text-[11.5px] text-bz-muted";
  const list = inboxes
    .split(/[\n,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{bank ? t("banks.dialog.edit", { name: bank.name }) : t("banks.dialog.add")}</DialogTitle>
          <DialogDescription>{t("banks.lede")}</DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveBank({
                  id: bank?.id ?? null,
                  code: code.toUpperCase(),
                  name,
                  color,
                  active,
                  inboxes: list,
                  sortOrder: Number(order) || 0,
                }),
              (r) => r.ok && onClose(),
            );
          }}
        >
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
            <div>
              <label htmlFor={`${id}-code`} className={label}>
                {t("banks.field.code")}
              </label>
              <Input
                id={`${id}-code`}
                className="mono mt-1.5 h-9 uppercase"
                value={code}
                maxLength={12}
                autoComplete="off"
                required
                disabled={pending}
                onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                aria-describedby={`${id}-code-hint`}
              />
            </div>
            <div>
              <label htmlFor={`${id}-name`} className={label}>
                {t("banks.field.name")}
              </label>
              <Input
                id={`${id}-name`}
                className="mt-1.5 h-9"
                value={name}
                maxLength={80}
                autoComplete="off"
                required
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <p id={`${id}-code-hint`} className={`${hint} -mt-2.5`}>
            {t("banks.field.codeHint")}
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
            <div>
              <label htmlFor={`${id}-color`} className={label}>
                {t("banks.field.colour")}
              </label>
              <div className="mt-1.5 flex items-center gap-2.5">
                <BankMark code={code || "—"} color={color || null} size={32} />
                <input
                  type="color"
                  aria-label={t("banks.field.colour")}
                  value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#3b4a5c"}
                  disabled={pending}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-md border border-bz-border bg-bz-surface p-1"
                />
                <Input
                  id={`${id}-color`}
                  className="mono h-9"
                  value={color}
                  maxLength={40}
                  autoComplete="off"
                  disabled={pending}
                  onChange={(e) => setColor(e.target.value.trim())}
                />
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-order`} className={label}>
                {t("banks.field.order")}
              </label>
              <Input
                id={`${id}-order`}
                className="mono mt-1.5 h-9"
                inputMode="numeric"
                value={order}
                disabled={pending}
                onChange={(e) => setOrder(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-inboxes`} className={label}>
              {t("banks.field.inboxes")}
            </label>
            <textarea
              id={`${id}-inboxes`}
              rows={3}
              value={inboxes}
              disabled={pending}
              onChange={(e) => setInboxes(e.target.value)}
              aria-describedby={`${id}-inboxes-hint`}
              className="mono mt-1.5 w-full resize-y rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[12px] leading-[1.6] outline-none focus-visible:border-bz-accent"
            />
            <p id={`${id}-inboxes-hint`} className={hint}>
              {t("banks.field.inboxesHint")}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
            <input type="checkbox" checked={active} disabled={pending} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-bz-ink" />
            {t("banks.field.active")}
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={pending || !code || !name.trim() || list.length > 5}>
            {t("banks.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
