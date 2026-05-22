import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsBackupsPage() {
  return (
    <SettingsStub
      title="Backups & exports"
      intro="Database snapshot history, one-shot CSV exports, and the regulatory 7-year retention surface for KYC and transaction records."
      willShipIn="Phase 7 (launch hardening) + Sprint 8 schema work"
      bullets={[
        "Supabase point-in-time recovery history (last 14 days)",
        "Weekly full-DB snapshot list with restore button (admin-only)",
        "One-shot CSV / JSON exports per entity (properties, enquiries, deals, audit)",
        "PDPL data-subject export queue (separate from individual /account/data-export)",
        "Per-table retention policy display (KYC + deals = 7 years)",
      ]}
    />
  );
}
