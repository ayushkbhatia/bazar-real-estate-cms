import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsBillingPage() {
  return (
    <SettingsStub
      title="Billing"
      intro="Vendor invoices (Vercel, Supabase, Resend, Mailchimp, Mapbox, Meilisearch, Voyage) and Bazar's outgoing client invoices."
      willShipIn="Phase 8+ (post-launch finance ops)"
      bullets={[
        "Vendor invoice tracker — uploads + due-date alerts",
        "Outgoing client invoice generator (1.5% advisory at DLD transfer)",
        "Receivables / payables ageing report",
        "Tax / VAT register (UAE 5%)",
        "Stripe + Telr connection for online payment of advisory invoices",
      ]}
    />
  );
}
