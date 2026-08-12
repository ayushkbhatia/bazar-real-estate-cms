/**
 * /admin/settings/api — read-only summary of the API keys + outgoing
 * webhooks configured today. CRUD UI lands in a later sprint; this page
 * exists so the team and client can see what's wired without staring at
 * a "ships in Sprint N" placeholder.
 */

import { Eyebrow } from "@/components/brand/eyebrow";
import { listApiKeys } from "@/lib/queries/api-keys";
import { listWebhooks } from "@/lib/queries/webhooks";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSettingsApiPage() {
  const [apiKeys, webhooks] = await Promise.all([
    listApiKeys(),
    listWebhooks(),
  ]);

  const activeKeys = apiKeys.filter((k) => k.status === "active").length;
  const activeWebhooks = webhooks.filter((w) => w.status === "active").length;
  const failingWebhooks = webhooks.filter((w) => w.status === "failing").length;

  return (
    <div>
      <Eyebrow>Settings · API & webhooks</Eyebrow>
      <h2
        className="serif text-[28px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        API & webhooks
      </h2>
      <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
        API keys for third-party integrations and outgoing webhooks for
        event-driven sync. Creation, rotation, and delivery-history UI
        lands in a future sprint; the rows below are reads from the
        live <code className="mono text-[12.5px]">api_keys</code> and{" "}
        <code className="mono text-[12.5px]">webhooks</code> tables.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[640px]">
        <StatCard label="API keys" total={apiKeys.length} active={activeKeys} />
        <StatCard
          label="Webhooks"
          total={webhooks.length}
          active={activeWebhooks}
          warning={failingWebhooks > 0 ? `${failingWebhooks} failing` : null}
        />
      </div>

      <section className="mt-10 max-w-[860px]">
        <Eyebrow>API keys</Eyebrow>
        {apiKeys.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-bz-muted">
            No API keys issued yet.
          </p>
        ) : (
          <div className="mt-3 rounded-md border border-bz-border bg-bz-surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-bz-bg text-bz-muted text-[11.5px] uppercase tracking-wider">
                <tr>
                  <th className="text-start px-3 py-2 font-normal">Name</th>
                  <th className="text-start px-3 py-2 font-normal">Prefix</th>
                  <th className="text-start px-3 py-2 font-normal">Role</th>
                  <th className="text-start px-3 py-2 font-normal">Status</th>
                  <th className="text-start px-3 py-2 font-normal">Last used</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id} className="border-t border-bz-border">
                    <td className="px-3 py-2">{k.name}</td>
                    <td className="px-3 py-2 mono text-[12px] text-bz-muted">
                      {k.key_prefix}…
                    </td>
                    <td className="px-3 py-2 capitalize">{k.role}</td>
                    <td className="px-3 py-2 capitalize">{k.status}</td>
                    <td className="px-3 py-2 mono text-[12px] text-bz-muted">
                      {formatDate(k.last_used_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 max-w-[860px]">
        <Eyebrow>Outgoing webhooks</Eyebrow>
        {webhooks.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-bz-muted">
            No webhooks configured yet.
          </p>
        ) : (
          <div className="mt-3 rounded-md border border-bz-border bg-bz-surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-bz-bg text-bz-muted text-[11.5px] uppercase tracking-wider">
                <tr>
                  <th className="text-start px-3 py-2 font-normal">Name</th>
                  <th className="text-start px-3 py-2 font-normal">Target</th>
                  <th className="text-start px-3 py-2 font-normal">Events</th>
                  <th className="text-start px-3 py-2 font-normal">Status</th>
                  <th className="text-start px-3 py-2 font-normal">Last success</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id} className="border-t border-bz-border">
                    <td className="px-3 py-2">{w.name}</td>
                    <td className="px-3 py-2 mono text-[12px] text-bz-muted truncate max-w-[200px]">
                      {w.target_url}
                    </td>
                    <td className="px-3 py-2 mono text-[12px] text-bz-muted">
                      {w.events.join(", ")}
                    </td>
                    <td className="px-3 py-2 capitalize">{w.status}</td>
                    <td className="px-3 py-2 mono text-[12px] text-bz-muted">
                      {formatDate(w.last_success_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PlannedPanel
        willShipIn="Sprint 8 (api_keys + webhooks tables) + Sprint 13 (UI cards)"
        bullets={[
          "API key generator with scoped roles (read / write / admin)",
          "Per-key rotation",
          "Outgoing webhook config — target URL, event selectors, secret",
          "Delivery history with retry on failure",
          "Signing secret rotation",
          "Inbound webhook endpoints (Resend, Mailchimp, DocuSign) are managed in /admin/settings/integrations",
        ]}
      />
    </div>
  );
}

function StatCard({
  label,
  total,
  active,
  warning,
}: {
  label: string;
  total: number;
  active: number;
  warning?: string | null;
}) {
  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <div className="serif text-[32px] leading-none">{total}</div>
        <div className="text-[13px] text-bz-ink-2">
          {active} active
        </div>
      </div>
      {warning ? (
        <div className="mt-2 text-[12.5px] text-bz-accent mono">{warning}</div>
      ) : null}
    </div>
  );
}

function PlannedPanel({
  willShipIn,
  bullets,
}: {
  willShipIn: string;
  bullets: string[];
}) {
  return (
    <div className="mt-10 rounded-md border border-dashed border-bz-border bg-bz-surface p-6 max-w-[640px]">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        Planned enhancements
      </div>
      <div className="mono text-[13px] mt-1 text-bz-accent">{willShipIn}</div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {bullets.map((b) => (
          <li key={b} className="text-[13.5px] text-bz-ink-2 leading-snug">
            · {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
