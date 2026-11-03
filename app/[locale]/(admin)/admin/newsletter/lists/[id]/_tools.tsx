"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseContacts, LIST_IMPORT_MAX } from "@/lib/newsletter/lists";
import { addContact, deleteList, exportList, importContacts, updateList } from "../_actions";

const INPUT = "w-full border border-bz-border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent";

/** A list's header: rename, upload, add one, download, delete. */
export function ListTools({ id, name, description }: { id: string; name: string; description: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"upload" | "add" | "edit" | null>(null);
  const [busy, start] = useTransition();

  function download() {
    start(async () => {
      const r = await exportList(id);
      if (r.status === "error") {
        toast.error(r.message);
        return;
      }
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function remove() {
    if (!window.confirm(`Delete “${name}” and every address on it? Campaigns already sent keep their totals. This can't be undone.`)) return;
    start(async () => {
      const r = await deleteList(id);
      if (r?.status === "error") toast.error(r.message);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {description ? <p className="text-[13px] text-bz-ink-2 max-w-[80ch]">{description}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDialog("upload")}>
          <FileUp size={14} strokeWidth={1.8} /> Upload CSV
        </Button>
        <Button variant="outline" onClick={() => setDialog("add")}>
          <UserPlus size={14} strokeWidth={1.8} /> Add someone
        </Button>
        <Button variant="outline" onClick={download} disabled={busy}>
          <Download size={14} strokeWidth={1.8} /> Download CSV
        </Button>
        <Button variant="ghost" onClick={() => setDialog("edit")}>
          <Pencil size={14} strokeWidth={1.8} /> Rename
        </Button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="ms-auto inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
        >
          <Trash2 size={12} /> Delete list
        </button>
      </div>
      <UploadDialog open={dialog === "upload"} id={id} onClose={() => setDialog(null)} onDone={() => router.refresh()} />
      <AddDialog open={dialog === "add"} id={id} onClose={() => setDialog(null)} onDone={() => router.refresh()} />
      <EditDialog open={dialog === "edit"} id={id} name={name} description={description} onClose={() => setDialog(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function UploadDialog({ open, id, onClose, onDone }: { open: boolean; id: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (text ? parseContacts(text) : null), [text]);

  async function read(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Keep the file under 5 MB — split a bigger list in two.");
      return;
    }
    setFile(f.name);
    setText(await f.text());
  }

  function reset() {
    setText("");
    setFile("");
    setConsent(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function run() {
    start(async () => {
      const r = await importContacts(id, text, consent);
      if (r.status === "error") {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      reset();
      onClose();
      onDone();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Upload a CSV</DialogTitle>
          <DialogDescription>
            A spreadsheet saved as CSV, with an <strong>email</strong> column and a <strong>name</strong> column (or first
            name and last name). An optional <strong>language</strong> column — “ar” or “Arabic” — sends that person the
            Arabic edition. Up to {LIST_IMPORT_MAX.toLocaleString("en-GB")} people.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileUp size={14} /> Choose file
          </Button>
          <span className="text-[12.5px] text-bz-ink-2 truncate max-w-[340px]">{file || "No file chosen"}</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
        </div>
        {parsed ? (
          <div className="rounded-md border border-bz-border bg-bz-surface-2 p-3 text-[12.5px] flex flex-col gap-2">
            <p>
              <strong className="mono">{parsed.contacts.length}</strong> {parsed.contacts.length === 1 ? "person" : "people"} to add
              {parsed.duplicates ? ` · ${parsed.duplicates} repeated in the file` : ""}
              {parsed.invalid.length ? ` · ${parsed.invalid.length} lines without a usable address` : ""}
              {parsed.truncated ? ` · ${parsed.truncated} past the limit, not read` : ""}
            </p>
            <p className="text-[11.5px] text-bz-muted">
              {parsed.columns.header ? "Read the header row." : "No header row — took the column with addresses as email."} Anyone who
              unsubscribed or bounced before is left out when you import.
            </p>
            {parsed.contacts.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-bz-muted">
                    <th className="text-start font-normal py-1">Name</th>
                    <th className="text-start font-normal py-1">Email</th>
                    <th className="text-start font-normal py-1">Language</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.contacts.slice(0, 5).map((c) => (
                    <tr key={c.email} className="border-t border-bz-border">
                      <td className="py-1">{c.name || "—"}</td>
                      <td className="py-1 mono">{c.email}</td>
                      <td className="py-1">{c.locale === "ar" ? "Arabic" : "English"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {parsed.invalid.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-[11.5px] text-bz-ink-2">Lines left out</summary>
                <ul className="mt-1 text-[11.5px] text-bz-muted max-h-[120px] overflow-y-auto">
                  {parsed.invalid.slice(0, 50).map((i) => (
                    <li key={i.line}>
                      Line {i.line}: {i.reason}
                      {i.value ? ` (${i.value})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        <label className="flex items-start gap-2 text-[12.5px] text-bz-ink-2">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="accent-bz-navy mt-0.5" />
          <span>
            Everyone on this list agreed to hear from Bazar Real Estate — they registered, attended or asked to be kept
            informed. Each email they get carries an unsubscribe link.
          </span>
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !parsed || parsed.contacts.length === 0 || !consent}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Import {parsed ? parsed.contacts.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ open, id, onClose, onDone }: { open: boolean; id: string; onClose: () => void; onDone: () => void }) {
  const [values, setValues] = useState({ email: "", name: "", locale: "en" });
  const [busy, start] = useTransition();
  function run() {
    start(async () => {
      const r = await addContact(id, values);
      if (r.status === "error") {
        toast.error(r.fieldErrors?.email ?? r.message);
        return;
      }
      toast.success(r.message);
      setValues({ email: "", name: "", locale: "en" });
      onClose();
      onDone();
    });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add someone</DialogTitle>
          <DialogDescription>Only someone who agreed to hear from Bazar.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-bz-ink-2">Email</span>
          <input type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} className={INPUT} autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-bz-ink-2">Name</span>
          <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} maxLength={120} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-bz-ink-2">Language</span>
          <select value={values.locale} onChange={(e) => setValues((v) => ({ ...v, locale: e.target.value }))} className={INPUT}>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !values.email.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  id,
  name,
  description,
  onClose,
  onDone,
}: {
  open: boolean;
  id: string;
  name: string;
  description: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState({ name, description });
  const [busy, start] = useTransition();
  function run() {
    start(async () => {
      const r = await updateList(id, values);
      if (r.status === "error") {
        toast.error(r.fieldErrors?.name ?? r.message);
        return;
      }
      toast.success(r.message);
      onClose();
      onDone();
    });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Rename the list</DialogTitle>
          <DialogDescription>Only your team sees this.</DialogDescription>
        </DialogHeader>
        <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} maxLength={120} className={INPUT} aria-label="Name" />
        <textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          maxLength={400}
          rows={2}
          className={INPUT}
          aria-label="Description"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !values.name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
