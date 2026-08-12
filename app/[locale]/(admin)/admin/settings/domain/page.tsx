import { SettingsStub } from "../_components/settings-stub";

export default function AdminSettingsDomainPage() {
  return (
    <SettingsStub
      title="Domain & SEO"
      intro="Canonical domain, redirects, robots.txt rules, default Open Graph image."
      willShipIn="Sprint 11 (auth + JSON-LD + OG composition)"
      bullets={[
        "Canonical domain selector (apex vs www) with 301 enforcement",
        "Redirects table — slug ➝ slug, with type (301 / 302 / 410)",
        "Robots.txt editor with per-environment override",
        "Default site-wide Open Graph image upload",
        "Verified webmaster property links (Google, Bing)",
      ]}
    />
  );
}
