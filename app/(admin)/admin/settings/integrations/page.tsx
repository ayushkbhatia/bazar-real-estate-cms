import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsIntegrationsPage() {
  return (
    <SettingsStub
      title="Integrations"
      intro="Connect Bazar to the external services we transact with — feeds, comms, signing, payments."
      willShipIn="Sprint 13 (integrations table + per-integration cards)"
      bullets={[
        "Property Finder — XML feed pull configuration",
        "Bayut — XML feed pull configuration",
        "WhatsApp Business Cloud API (deferred to post-launch; deep-links in the meantime)",
        "Mailchimp — newsletter list sync + opt-out webhook",
        "Mapbox — geocoding, isochrones, static maps",
        "Meilisearch Cloud — index sync, master key, search-only public key",
        "Voyage AI — embedding generation for the concierge",
        "DLD comparables — weekly CSV import",
        "DocuSign — envelope creation + signed-doc callback",
      ]}
    />
  );
}
