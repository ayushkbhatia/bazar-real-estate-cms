import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsFieldsPage() {
  return (
    <SettingsStub
      title="Property fields"
      intro="Amenities taxonomy, view options, orientation options, and custom fields available on the property edit form."
      willShipIn="Sprint 8 (amenities_taxonomy table) + Sprint 7c (form refactor)"
      bullets={[
        "Amenities taxonomy editor — 21 entries with code, label, category, icon",
        "Editable view options (Sea / Skyline / Beach / Garden / Park / Pool)",
        "Editable orientation options (N / NE / E / SE / S / SW / W / NW)",
        "Custom-field definitions for upcoming property types",
        "Maps free-text legacy amenities to canonical taxonomy entries (one-shot migration)",
      ]}
    />
  );
}
