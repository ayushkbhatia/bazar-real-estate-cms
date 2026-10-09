"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRight, GripVertical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOARD_COLUMNS, boardMove, type BoardMove, type BoardService } from "@/lib/mortgage-requests/board";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { declineReasonsFor } from "@/lib/mortgage-requests/decline";
import { formatDuration } from "@/lib/mortgage-requests/sla";
import type { QueueParams, RequestStatus } from "@/lib/mortgage-requests/queue";
import type { BoardCard, BoardResult } from "@/lib/mortgage-requests/server/cms-queries";
import { cn } from "@/lib/utils";
import { logContactAttempt, markConsultationHeld, type MortgageActionResult } from "../_actions";
import { loadBoard, loadBoardMoveContext, startReview, type BoardMoveContext } from "../_board-actions";
import { declineApplication } from "../_decision-actions";
import { cancelReupload } from "../_review-actions";
import { DeclineFields, useDeclineDraft } from "./file-actions";
import { ConsultCell, DocumentBar, OwnerAvatar, PromiseClock, STATUS, WebsiteCell } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const POLL_MS = 30_000;

const DOC_KEY: Record<string, string> = {
  emirates_id: "doc.emiratesId",
  passport: "doc.passport",
  salary_certificate: "doc.salaryCertificate",
  bank_statements_3m: "doc.bankStatements3m",
  trade_license: "doc.tradeLicense",
  bank_statements_12m: "doc.bankStatements12m",
};

const SERVICE_KEY: Record<BoardService, string> = {
  pre_approval: "service.preApproval",
  consultancy: "service.consultancy",
};

const columnId = (service: BoardService, status: RequestStatus) => `${service}:${status}`;

const TONE_BAR: Record<string, string> = {
  accent: "bg-bz-accent",
  warn: "bg-[oklch(0.75_0.13_75)]",
  muted: "bg-bz-muted-2",
  info: "bg-[oklch(0.6_0.1_240)]",
  success: "bg-[oklch(0.62_0.12_150)]",
  danger: "bg-[oklch(0.58_0.17_28)]",
};

/** A drop in progress: the card, where it's going, and what the move asks for. */
type Pending = {
  card: BoardCard;
  to: RequestStatus;
  move: BoardMove;
  context?: BoardMoveContext | null;
};

/**
 * C1's board (Bazar, 9 Oct 2026): the open files of each service in columns,
 * one per status, dragged from one to the next. What a drop does is
 * `boardMove()`: the board runs the moves it can make itself (start a review,
 * log a contact, mark a consultation held, cancel a re-upload, decline) and
 * opens the file at the right step for the rest. Only the owner or the Head
 * can move a file; the database checks again either way. Each card also has a
 * Move menu, the same moves without a pointer.
 */
export function BoardView({
  initial,
  params,
  query,
}: {
  initial: BoardResult | null;
  params: QueueParams;
  /** The search box's text, debounced by the list header. */
  query: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<BoardResult | null>(initial);
  const [failed, setFailed] = useState(initial === null);
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistic moves: reference → the column it was dropped on, until the board reloads.
  const [moved, setMoved] = useState<Record<string, RequestStatus>>({});
  const seq = useRef(0);
  // dnd-kit numbers its accessibility ids from a module counter, which differs between server and client: name them.
  const dndId = useId();

  const reload = useCallback(async () => {
    const n = ++seq.current;
    const res = await loadBoard({ service: params.service, owner: params.owner, risk: params.risk }, query);
    if (n !== seq.current) return;
    if (res.ok) {
      setResult(res.result);
      setFailed(false);
      setMoved({});
    } else {
      setFailed(true);
    }
  }, [params.service, params.owner, params.risk, query]);

  // Re-read when the search or filters change (after a beat, so typing settles), every 30 s, and on focus.
  useEffect(() => {
    const first = window.setTimeout(() => void reload(), 0);
    const id = window.setInterval(() => void reload(), POLL_MS);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const sensors = useSensors(
    // A short travel before a drag starts, so a click still opens the file.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const lanes = useMemo(() => {
    if (!result) return [];
    // Apply optimistic moves: take each moved card out of its column and into the one it was dropped on.
    return result.lanes.map((lane) => {
      const cards = lane.columns.flatMap((c) => c.cards);
      return {
        ...lane,
        columns: lane.columns.map((col) => {
          const stay = col.cards.filter((c) => !moved[c.reference] || moved[c.reference] === col.status);
          const arriving = cards.filter((c) => moved[c.reference] === col.status && c.status !== col.status);
          return { ...col, cards: [...arriving, ...stay] };
        }),
      };
    });
  }, [result, moved]);

  /** Run an action from the board: say how it went, close the dialog, re-read the board. */
  const run = async (action: () => Promise<MortgageActionResult>, optimistic?: { reference: string; to: RequestStatus }) => {
    setBusy(true);
    if (optimistic) setMoved((m) => ({ ...m, [optimistic.reference]: optimistic.to }));
    try {
      const r = await action();
      if (r.ok) {
        if (r.message) (r.warning ? toast.warning : toast.success)(r.message);
        setPending(null);
      } else {
        toast.error(r.message);
        if (optimistic) setMoved(({ [optimistic.reference]: _gone, ...rest }) => rest);
      }
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const target = (card: BoardCard) => ({ requestId: card.id, reference: card.reference, updatedAt: card.updatedAt });

  /** A drop or a Move-menu choice: refuse it, run it, ask one question, or open the file. */
  const attempt = async (card: BoardCard, to: RequestStatus) => {
    const move = boardMove(card.service as BoardService, card.status, to);
    if (move.kind === "same") return;
    if (move.kind === "illegal") {
      toast.error(t(`board.illegal.${move.why}`));
      return;
    }
    if (!card.canAct) {
      toast.error(t("common.notOwner"));
      return;
    }
    if (move.kind === "start_review") {
      await run(() => startReview(target(card)), { reference: card.reference, to });
      return;
    }
    if (move.kind === "request_reupload" || move.kind === "cancel_reupload") {
      setPending({ card, to, move, context: null });
      const res = await loadBoardMoveContext(card.id);
      setPending((p) => (p && p.card.reference === card.reference ? { ...p, context: res.ok ? res.context : undefined } : p));
      if (!res.ok) toast.error(t("common.failed"));
      return;
    }
    setPending({ card, to, move });
  };

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as { card: BoardCard }).card);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const card = (e.active.data.current as { card: BoardCard } | undefined)?.card;
    const over = e.over?.data.current as { status: RequestStatus; service: BoardService } | undefined;
    if (!card || !over || over.service !== card.service) return;
    void attempt(card, over.status);
  };

  if (failed && !result) {
    return <p className="px-[18px] py-10 text-center text-[13px] text-bz-muted">{t("c1.error")}</p>;
  }
  if (!result) return null;

  return (
    <div className="flex flex-col gap-6 px-[18px] pb-[18px] pt-1">
      <p className="text-[12px] text-bz-muted">{t("board.hint")}</p>
      <DndContext id={dndId} sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {lanes.map((lane) => (
          <section key={lane.service} aria-label={t(SERVICE_KEY[lane.service])}>
            {lanes.length > 1 ? (
              <h2 className="mb-2.5 text-[12px] font-medium tracking-[0.06em] text-bz-muted uppercase">
                {t("board.lane", {
                  service: t(SERVICE_KEY[lane.service]),
                  count: lane.columns.filter((c) => !["pre_approved", "declined", "completed"].includes(c.status)).reduce((n, c) => n + c.cards.length, 0),
                })}
              </h2>
            ) : null}
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${lane.columns.length}, minmax(248px, 1fr))` }}
              >
                {lane.columns.map((col) => (
                  <BoardColumnView
                    key={col.status}
                    service={lane.service}
                    status={col.status}
                    count={col.total + col.cards.length - result.lanes.find((l) => l.service === lane.service)!.columns.find((c) => c.status === col.status)!.cards.length}
                    shown={col.cards.length}
                    dragging={dragging}
                  >
                    {col.cards.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-bz-muted-2">{t("board.empty")}</p>
                    ) : (
                      col.cards.map((card) => (
                        <DraggableCard key={card.reference} card={card} onMove={(to) => void attempt(card, to)} />
                      ))
                    )}
                  </BoardColumnView>
                ))}
              </div>
            </div>
          </section>
        ))}
        <DragOverlay dropAnimation={null}>{dragging ? <CardBody card={dragging} lifted /> : null}</DragOverlay>
      </DndContext>

      <MoveDialog
        pending={pending}
        busy={busy}
        myFirstName={result.myFirstName}
        onClose={() => setPending(null)}
        onOpen={(href) => {
          setPending(null);
          router.push(href);
        }}
        onContact={(outcome) => pending && void run(() => logContactAttempt({ ...target(pending.card), outcome }), { reference: pending.card.reference, to: pending.to })}
        onHeld={() => pending && void run(() => markConsultationHeld(target(pending.card)), { reference: pending.card.reference, to: pending.to })}
        onCancelReupload={(reuploadId, kind) =>
          pending && void run(() => cancelReupload({ ...target(pending.card), reuploadId, kind }))
        }
        onDecline={(fields) =>
          pending &&
          void run(
            () => declineApplication({ ...target(pending.card), ...fields, firstName: pending.card.firstName }),
            { reference: pending.card.reference, to: "declined" },
          )
        }
      />
    </div>
  );
}

function BoardColumnView({
  service,
  status,
  count,
  shown,
  dragging,
  children,
}: {
  service: BoardService;
  status: RequestStatus;
  count: number;
  shown: number;
  dragging: BoardCard | null;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(service, status), data: { service, status } });
  const s = STATUS[status];
  // While a card is held over a column, say whether the drop is one the file can make.
  const verdict =
    dragging && dragging.service === service && isOver ? boardMove(service, dragging.status, status).kind : null;
  const closed = ["pre_approved", "declined", "completed"].includes(status);
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={t("board.column", { status: t(s.key), count })}
      className={cn(
        "flex min-h-[220px] flex-col rounded-[12px] border bg-bz-surface-2/50 transition-colors",
        verdict === null || verdict === "same"
          ? "border-bz-border"
          : verdict === "illegal"
            ? "border-[oklch(0.75_0.12_28)] bg-[oklch(0.975_0.02_28)]"
            : "border-bz-accent bg-bz-accent-soft/50",
      )}
    >
      <div className="flex items-center gap-2 border-b border-bz-border px-3 py-2.5">
        <span aria-hidden className={cn("size-2 rounded-full", TONE_BAR[s.tone] ?? "bg-bz-muted-2")} />
        <span className="text-[12.5px] font-medium text-bz-ink">{t(s.key)}</span>
        <span className="mono ms-auto rounded-full bg-bz-surface px-2 py-0.5 text-[11px] text-bz-ink-2">{count}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
      {closed && count > shown ? (
        <Link
          href={`/admin/mortgages?tab=closed${service === "consultancy" ? "&service=consultancy" : "&service=pre_approval"}`}
          className="border-t border-bz-border px-3 py-2 text-[11.5px] text-bz-ink-2 hover:underline"
        >
          {t("board.closedMore", { shown, total: count })} · {t("board.closedAll")}
        </Link>
      ) : null}
    </div>
  );
}

function DraggableCard({ card, onMove }: { card: BoardCard; onMove: (to: RequestStatus) => void }) {
  const closed = ["pre_approved", "declined", "completed"].includes(card.status);
  const disabled = !card.canAct || closed;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.reference,
    data: { card },
    disabled,
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")} data-reference={card.reference}>
      <CardBody
        card={card}
        handle={
          disabled ? null : (
            <button
              type="button"
              aria-label={t("board.moveTo", { reference: card.reference })}
              className="-ms-1 inline-flex size-6 cursor-grab items-center justify-center rounded text-bz-muted-2 hover:bg-bz-surface-2 hover:text-bz-ink-2 active:cursor-grabbing"
              {...listeners}
              {...attributes}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          )
        }
        menu={disabled ? null : <MoveMenu card={card} onMove={onMove} />}
        title={card.canAct ? undefined : t("common.notOwner")}
      />
    </div>
  );
}

function CardBody({
  card,
  handle,
  menu,
  lifted,
  title,
}: {
  card: BoardCard;
  handle?: ReactNode;
  menu?: ReactNode;
  lifted?: boolean;
  title?: string;
}) {
  return (
    <article
      title={title}
      className={cn(
        "rounded-[10px] border border-bz-border bg-bz-surface p-3 text-[13px] shadow-[0_1px_0_oklch(0_0_0/0.03)]",
        lifted && "rotate-[1.5deg] shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5">
        {handle}
        <span className="mono text-[11.5px] text-bz-ink-2">{card.reference}</span>
        <span className="ms-auto flex items-center gap-1">
          {card.website ? <WebsiteCell website={card.website} /> : null}
          {menu}
        </span>
      </div>
      <Link href={`/admin/mortgages/${card.reference}`} className="mt-1.5 block font-medium text-bz-ink hover:underline">
        {card.fullName}
      </Link>
      <p className="mt-0.5 text-[11.5px] text-bz-muted">{card.profile}</p>
      {card.docs ? (
        <div className="mt-2.5">
          <DocumentBar states={card.docs} />
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {card.sla ? <PromiseClock sla={card.sla} width={150} /> : card.consult ? <ConsultCell {...card.consult} /> : null}
        </div>
        <OwnerAvatar owner={card.owner} />
      </div>
      <p className="mt-2 text-[11px] text-bz-muted-2">{card.received}</p>
    </article>
  );
}

function MoveMenu({ card, onMove }: { card: BoardCard; onMove: (to: RequestStatus) => void }) {
  const service = card.service as BoardService;
  const targets = BOARD_COLUMNS[service].filter((to) => {
    const kind = boardMove(service, card.status, to).kind;
    return kind !== "same" && kind !== "illegal";
  });
  if (targets.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("board.moveTo", { reference: card.reference })}
          className="inline-flex size-6 items-center justify-center rounded text-bz-muted hover:bg-bz-surface-2 hover:text-bz-ink"
        >
          <MoreHorizontal size={15} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="text-[11px] font-normal text-bz-muted">{t("board.move")}</DropdownMenuLabel>
        {targets.map((to) => (
          <DropdownMenuItem key={to} onSelect={() => onMove(to)} className="text-[13px]">
            <ArrowRight size={14} aria-hidden />
            {t(STATUS[to].key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The question a drop asks, or the step it opens. */
function MoveDialog({
  pending,
  busy,
  myFirstName,
  onClose,
  onOpen,
  onContact,
  onHeld,
  onCancelReupload,
  onDecline,
}: {
  pending: Pending | null;
  busy: boolean;
  myFirstName: string;
  onClose: () => void;
  onOpen: (href: string) => void;
  onContact: (outcome: "reached" | "no_answer" | "left_message") => void;
  onHeld: () => void;
  onCancelReupload: (reuploadId: string, kind: BoardMoveContext["reuploads"][number]["kind"]) => void;
  onDecline: (fields: { reason: NonNullable<ReturnType<typeof useDeclineDraft>["reason"]>; message: string; channels: ("email" | "whatsapp")[] }) => void;
}) {
  const open = pending !== null;
  const kind = pending?.move.kind;
  const card = pending?.card;
  const firstName = card?.firstName ?? "";
  const href = card ? `/admin/mortgages/${card.reference}` : "";

  let body: ReactNode = null;
  if (card && kind === "decline") {
    body = <DeclineBody key={card.reference} card={card} myFirstName={myFirstName} busy={busy} onClose={onClose} onDecline={onDecline} />;
  } else if (card && (kind === "send_to_banks" || kind === "decide" || kind === "book")) {
    const key = kind === "send_to_banks" ? "send" : kind;
    const to = kind === "send_to_banks" ? `${href}?do=accept` : kind === "decide" ? `${href}/decision` : `${href}?do=book`;
    body = (
      <>
        <DialogHeader>
          <DialogTitle>{t(`board.dialog.${key}.title`, { firstName })}</DialogTitle>
          <DialogDescription>{t(`board.dialog.${key}.lede`, { firstName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onOpen(to)}>{t(`board.dialog.${key}.cta`)}</Button>
        </DialogFooter>
      </>
    );
  } else if (card && kind === "log_contact") {
    body = (
      <>
        <DialogHeader>
          <DialogTitle>{t("board.dialog.contact.title", { firstName })}</DialogTitle>
          <DialogDescription>{t("board.dialog.contact.lede", { firstName })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(["reached", "no_answer", "left_message"] as const).map((outcome) => (
            <Button key={outcome} variant="outline" disabled={busy} onClick={() => onContact(outcome)}>
              {t(outcome === "reached" ? "c6.log.reached" : outcome === "no_answer" ? "c6.log.noAnswer" : "c6.log.leftMessage")}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </>
    );
  } else if (card && kind === "held") {
    body = (
      <>
        <DialogHeader>
          <DialogTitle>{t("board.dialog.held.title")}</DialogTitle>
          <DialogDescription>{t("board.dialog.held.lede", { firstName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={busy} onClick={onHeld}>
            {t("board.dialog.held.cta")}
          </Button>
        </DialogFooter>
      </>
    );
  } else if (card && (kind === "request_reupload" || kind === "cancel_reupload")) {
    const context = pending?.context;
    const reupload = kind === "request_reupload";
    body = (
      <>
        <DialogHeader>
          <DialogTitle>{reupload ? t("board.dialog.reupload.title", { firstName }) : t("board.dialog.cancel.title")}</DialogTitle>
          <DialogDescription>
            {reupload ? t("board.dialog.reupload.lede") : t("board.dialog.cancel.lede", { firstName })}
          </DialogDescription>
        </DialogHeader>
        {context === null ? (
          <p className="text-[13px] text-bz-muted">{t("board.dialog.loading")}</p>
        ) : context === undefined ? (
          <p className="text-[13px] text-bz-muted">{t("common.failed")}</p>
        ) : reupload ? (
          <ul className="flex flex-col gap-1.5">
            {context.documents.map((d) => (
              <li key={d.kind}>
                <button
                  type="button"
                  disabled={d.state === "reupload_requested"}
                  onClick={() => onOpen(`${href}/documents/${d.kind}?reupload=1`)}
                  className="flex w-full items-center justify-between rounded-lg border border-bz-border px-3 py-2.5 text-start text-[13px] hover:border-bz-border-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{t(DOC_KEY[d.kind] ?? d.kind)}</span>
                  {d.state === "reupload_requested" ? (
                    <span className="text-[11.5px] text-bz-muted">{t("board.dialog.reupload.requested")}</span>
                  ) : (
                    <ArrowRight size={14} aria-hidden className="text-bz-muted" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            {context.reuploads.map((r) => (
              <Button key={r.id} variant="outline" disabled={busy} onClick={() => onCancelReupload(r.id, r.kind)}>
                {t("board.dialog.cancel.cta", { document: t(DOC_KEY[r.kind] ?? r.kind) })}
              </Button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className={kind === "decline" ? "sm:max-w-[560px]" : "sm:max-w-[460px]"}>{body}</DialogContent>
    </Dialog>
  );
}

function DeclineBody({
  card,
  myFirstName,
  busy,
  onClose,
  onDecline,
}: {
  card: BoardCard;
  myFirstName: string;
  busy: boolean;
  onClose: () => void;
  onDecline: (fields: { reason: NonNullable<ReturnType<typeof useDeclineDraft>["reason"]>; message: string; channels: ("email" | "whatsapp")[] }) => void;
}) {
  const draft = useDeclineDraft(card.firstName, myFirstName);
  const elapsed = card.sla?.elapsedSeconds != null ? formatDuration(card.sla.elapsedSeconds) : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("decline.title", { firstName: card.firstName })}</DialogTitle>
        <DialogDescription>{t("decline.lede", { firstName: card.firstName })}</DialogDescription>
      </DialogHeader>
      <DeclineFields draft={draft} reasons={declineReasonsFor(card.status)} firstName={card.firstName} pending={busy} />
      <p className="rounded-lg bg-bz-surface-2 px-3 py-2.5 text-[11.5px] leading-[1.5] text-bz-ink-2">
        {elapsed ? t("decline.note", { elapsed }) : t("decline.noteNoClock")}
        {card.status === "awaiting_applicant" ? <> {t("decline.noteAwaiting")}</> : null}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          className="bg-destructive text-white hover:bg-destructive/90"
          disabled={!draft.ready || busy}
          onClick={() =>
            onDecline({
              reason: draft.reason!,
              message: draft.message,
              channels: draft.whatsapp ? ["email", "whatsapp"] : ["email"],
            })
          }
        >
          {t("decline.cta", { firstName: card.firstName })}
        </Button>
      </DialogFooter>
    </>
  );
}
