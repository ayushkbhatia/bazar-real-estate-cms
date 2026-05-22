import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsApiPage() {
  return (
    <SettingsStub
      title="API & webhooks"
      intro="Generate API keys for third-party integrations and configure outgoing webhooks for event-driven sync."
      willShipIn="Sprint 8 (api_keys + webhooks tables) + Sprint 13 (UI cards)"
      bullets={[
        "API key generator with scoped roles (read / write / admin)",
        "Per-key last-used timestamp + rotation",
        "Outgoing webhook config — target URL, event selectors, secret",
        "Delivery history with retry on failure",
        "Signing secret rotation",
        "Inbound webhook endpoints (Resend, Mailchimp, DocuSign) — managed in /admin/settings/integrations",
      ]}
    />
  );
}
