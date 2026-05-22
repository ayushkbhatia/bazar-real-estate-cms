import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsCompliancePage() {
  return (
    <SettingsStub
      title="Compliance · RERA / DMT / KYC"
      intro="The regulatory dashboard. Office Registration Number (ORN), per-broker BRN list, Trakheesi/DARI permits, and KYC review queue."
      willShipIn="Sprint 8 (licenses table) + Sprint 10 (permit-expiry cron + KYC review endpoints)"
      bullets={[
        "ORN registration certificate — file + expiry + renewal reminder",
        "Per-advisor BRN tracker — number, expiry, training certificates",
        "Trakheesi / DARI listing permit register",
        "Permit-expiry sweep (alerts admin 30d before)",
        "KYC review queue — pending documents with approve / reject actions",
        "Suspicious-activity (goAML) reporting placeholder",
      ]}
    />
  );
}
