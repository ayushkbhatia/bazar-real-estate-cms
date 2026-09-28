/* eslint-disable */
// Shared UI atoms for Bazar designs.
// All exported globally so screen JSX files can use them directly.

// ─── Icons (minimal stroke set) ─────────────────────────────────────
const Icn = ({ d, size = 16, fill = "none", stroke = "currentColor", sw = 1.6, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {d}
  </svg>
);
const I = {
  search:   <Icn d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>} />,
  pin:      <Icn d={<><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></>} />,
  bed:      <Icn d={<><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 14h18M3 18h18"/></>} />,
  bath:     <Icn d={<><path d="M4 12V6a2 2 0 1 1 4 0"/><path d="M3 12h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/></>} />,
  area:     <Icn d={<><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v3M15 17v3M4 9h3M17 15h3"/></>} />,
  heart:    <Icn d={<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>} />,
  share:    <Icn d={<><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4M8 13l8 4"/></>} />,
  filter:   <Icn d={<path d="M4 6h16M7 12h10M10 18h4"/>} />,
  grid:     <Icn d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />,
  list:     <Icn d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>} />,
  map:      <Icn d={<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></>} />,
  arrowR:   <Icn d={<path d="M5 12h14M13 6l6 6-6 6"/>} />,
  arrowL:   <Icn d={<path d="M19 12H5M11 18l-6-6 6-6"/>} />,
  chevR:    <Icn d={<path d="m9 6 6 6-6 6"/>} />,
  chevD:    <Icn d={<path d="m6 9 6 6 6-6"/>} />,
  chevU:    <Icn d={<path d="m6 15 6-6 6 6"/>} />,
  plus:     <Icn d={<path d="M12 5v14M5 12h14"/>} />,
  cross:    <Icn d={<path d="M6 6l12 12M18 6 6 18"/>} />,
  dots:     <Icn d={<><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>} />,
  dotsV:    <Icn d={<><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></>} />,
  user:     <Icn d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>} />,
  bell:     <Icn d={<><path d="M6 9a6 6 0 0 1 12 0v4l2 4H4l2-4z"/><path d="M9 21a3 3 0 0 0 6 0"/></>} />,
  mail:     <Icn d={<><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></>} />,
  phone:    <Icn d={<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2Z"/>} />,
  check:    <Icn d={<path d="m5 12 5 5L20 7"/>} />,
  calendar: <Icn d={<><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 9h18M8 3v4M16 3v4"/></>} />,
  upload:   <Icn d={<><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></>} />,
  download: <Icn d={<><path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/></>} />,
  edit:     <Icn d={<><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m14 6 4 4"/></>} />,
  trash:    <Icn d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>} />,
  eye:      <Icn d={<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>} />,
  image:    <Icn d={<><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m4 19 5-5 4 3 3-3 4 4"/></>} />,
  doc:      <Icn d={<><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></>} />,
  star:     <Icn d={<path d="m12 3 2.6 5.4 5.9.6-4.4 4 1.3 5.8L12 16l-5.4 2.8 1.3-5.8L3.5 9l5.9-.6Z"/>} />,
  inbox:    <Icn d={<><path d="M3 13V5h18v8M3 13l3 6h12l3-6"/><path d="M9 13h6"/></>} />,
  home:     <Icn d={<><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></>} />,
  bldg:     <Icn d={<><rect x="4" y="3" width="16" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>} />,
  settings: <Icn d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 0 0-2 1.2L5 5.8 3 9.2l2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.2-.8.2-1.2Z"/></>} />,
  layers:   <Icn d={<><path d="m12 4 9 4-9 4-9-4 9-4Z"/><path d="m3 12 9 4 9-4M3 16l9 4 9-4"/></>} />,
  chart:    <Icn d={<><path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-2"/></>} />,
  link:     <Icn d={<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11 7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L13 17"/></>} />,
  globe:    <Icn d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>} />,
  ar:       <Icn d={<><path d="M3 7v10l9 5 9-5V7l-9-5z"/><path d="m3 7 9 5 9-5M12 12v10"/></>} />,
  expand:   <Icn d={<path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6"/>} />,
  sliders:  <Icn d={<><path d="M4 6h6M14 6h6M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>} />,
  save:     <Icn d={<><path d="M5 21V3h11l3 3v15z"/><path d="M7 3v6h9V3M7 21v-7h10v7"/></>} />,
  refresh:  <Icn d={<><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></>} />,
  send:     <Icn d={<><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></>} />,
  tag:      <Icn d={<><path d="M3 12V3h9l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/></>} />,
  mortgage: <Icn d={<><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="m9.5 17.5 5-5"/><circle cx="10" cy="13" r=".9"/><circle cx="14" cy="17" r=".9"/></>} />,
};

// ─── Building blocks ──────────────────────────────────────────────
function Btn({ kind = "outline", size, icon, children, style, ...rest }) {
  const cls = ["bz-btn", `bz-btn--${kind}`, size && `bz-btn--${size}`].filter(Boolean).join(" ");
  return <button className={cls} style={style} {...rest}>{icon}{children}</button>;
}
function Badge({ kind = "default", children, dot, style }) {
  return <span className={`bz-badge ${kind !== "default" ? "bz-badge--" + kind : ""}`} style={style}>
    {dot && <span className="bz-dot" />}
    {children}
  </span>;
}
function Img({ label = "image", style, className = "", dark, accent, children }) {
  const c = ["bz-img", dark && "bz-img--dark", accent && "bz-img--accent", className].filter(Boolean).join(" ");
  return <div className={c} data-label={label} style={style}>{children}</div>;
}
function Field({ label, hint, children, style }) {
  return <div style={style}>
    {label && <label className="bz-label">{label}</label>}
    {children}
    {hint && <div className="bz-hint">{hint}</div>}
  </div>;
}
function Avatar({ initials, size = 32, accent }) {
  return <div style={{
    width: size, height: size, borderRadius: 999, fontSize: size * 0.38,
    fontWeight: 500, letterSpacing: 0,
    background: accent ? "var(--bz-accent)" : "var(--bz-surface-3)",
    color: accent ? "var(--bz-accent-fg)" : "var(--bz-ink)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--bz-font-sans)", flexShrink: 0,
  }}>{initials}</div>;
}

// ─── Public site nav + footer ─────────────────────────────────────
function PublicNav({ active = "Buy", dark }) {
  const items = ["Buy", "Rent", "Off-Plan", "Commercial", "Sell", "Insights"];
  return (
    <header className="bz-nav">
      <div className="bz-nav__logo"><b>Bazar</b><span style={{ color: "var(--bz-muted)", marginLeft: 4, fontSize: 12, letterSpacing: ".05em", fontStyle: "normal", fontFamily: "var(--bz-font-sans)" }}>· Abu Dhabi</span></div>
      <nav className="bz-nav__items" style={{ flex: 1 }}>
        {items.map(i => <a key={i} className={i === active ? "is-active" : ""}>{i}</a>)}
      </nav>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn kind="ghost" size="sm" icon={I.heart}>Saved</Btn>
        <Btn kind="ghost" size="sm">Sign in</Btn>
        <Btn kind="primary" size="sm">List a property</Btn>
      </div>
    </header>
  );
}

function PublicFooter() {
  const cols = [
    ["Company", ["About", "Careers", "News & Insights", "Developers", "Communities", "New Projects"]],
    ["Services", ["Buy a Property", "Sell Your Property", "Rent a Property", "List Your Property", "Property Management", "Mortgage Support"]],
    ["Popular areas", ["Hudayriyat Island", "Al Reem Island", "Yas Island", "Saadiyat Island", "Al Raha Beach", "Masdar City", "Al Ghadeer", "Zayed City"]],
  ];
  const socials = ["Facebook", "Instagram", "TikTok", "YouTube", "LinkedIn"];
  return (
    <footer className="bz-footer">
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(3, 1fr) 1.15fr", gap: 44, paddingBottom: 48 }}>
        <div>
          <div style={{ fontFamily: "var(--bz-font-serif)", fontSize: 28, color: "#fff" }}>Bazar</div>
          <p style={{ marginTop: 12, color: "oklch(0.7 0.005 80)", fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
            Bazar Real Estate is a leading UAE real estate agency, serving the property market with expertise since 2005.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {socials.map(s => (
              <a key={s} style={{ padding: "6px 12px", border: "1px solid oklch(0.3 0 0)", borderRadius: 999, fontSize: 11.5, letterSpacing: 0.2, color: "oklch(0.8 0.005 80)" }}>{s}</a>
            ))}
          </div>
        </div>
        {cols.map(([title, list]) => (
          <div key={title}>
            <h4>{title}</h4>
            <ul>{list.map(l => <li key={l}><a>{l}</a></li>)}</ul>
          </div>
        ))}
        <div>
          <h4>Contact</h4>
          <ul style={{ gap: 14 }}>
            <li>
              <div style={{ color: "oklch(0.6 0.005 80)", fontSize: 11.5, marginBottom: 2 }}>Phone / WhatsApp</div>
              <div style={{ color: "#fff" }}>+971 2 632 2223</div>
              <div style={{ color: "#fff" }}>+971 50 691 1103</div>
            </li>
            <li>
              <div style={{ color: "oklch(0.6 0.005 80)", fontSize: 11.5, marginBottom: 2 }}>Email</div>
              <a style={{ color: "#fff" }}>info@bazarrealestate.ae</a>
            </li>
            <li>
              <div style={{ color: "oklch(0.6 0.005 80)", fontSize: 11.5, marginBottom: 2 }}>Office location</div>
              <div style={{ lineHeight: 1.55 }}>Sheikha Salama Building, Office 4<br />Zayed The First Street, Al Bateen<br />Abu Dhabi, United Arab Emirates</div>
            </li>
          </ul>
        </div>
      </div>
      <div style={{ borderTop: "1px solid oklch(0.28 0 0)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "oklch(0.6 0.005 80)", gap: 24, flexWrap: "wrap" }}>
        <div>© 2026 Bazar Real Estate L.L.C. All rights reserved. · ADM: 202400997397 · Regulated by ADREC &amp; DLD</div>
        <div style={{ display: "flex", gap: 24 }}><a>Privacy Policy</a><a>Terms of Use</a><a>Cookies</a><a>Sitemap</a></div>
      </div>
    </footer>
  );
}

// ─── Listing card ─────────────────────────────────────────────────
function ListingCard({ price, title, location, beds, baths, area, badge, badgeKind, imgLabel, mediaDark, accent, variant = "default" }) {
  const Media = (
    <Img label={imgLabel || "property"} style={{ aspectRatio: variant === "editorial" ? "5/4" : "4/3" }} dark={mediaDark} accent={accent}>
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
        {badge && <Badge kind={badgeKind || "ink"}>{badge}</Badge>}
      </div>
      <div style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bz-ink-2)" }}>
        {I.heart}
      </div>
    </Img>
  );

  if (variant === "editorial") {
    return (
      <div className="bz-listing bz-listing--editorial">
        {Media}
        <div className="bz-listing__body">
          <div className="eyebrow" style={{ marginBottom: -2 }}>{location}</div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, color: "var(--bz-ink)" }}>{title}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <div className="bz-listing__price">{price}</div>
            <div className="bz-listing__meta">
              <span>{beds} bd</span><span>{baths} ba</span><span>{area} ft²</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === "row") {
    return (
      <div className="bz-listing bz-listing--row">
        <div style={{ width: 280, flexShrink: 0 }}>{Media}</div>
        <div className="bz-listing__body">
          <div style={{ display: "flex", gap: 6 }}>{badge && <Badge kind={badgeKind || "ink"}>{badge}</Badge>}</div>
          <div className="bz-listing__price">{price}</div>
          <div className="bz-listing__title">{title}</div>
          <div className="bz-listing__loc">📍 {location}</div>
          <div className="bz-listing__meta" style={{ marginTop: 8 }}>
            <span>{beds} bedrooms</span><span>{baths} bathrooms</span><span>{area} ft²</span>
          </div>
        </div>
      </div>
    );
  }
  // default
  return (
    <div className="bz-listing">
      {Media}
      <div className="bz-listing__body">
        <div className="bz-listing__price">{price}</div>
        <div className="bz-listing__title">{title}</div>
        <div className="bz-listing__loc">{location}</div>
        <div style={{ display: "flex", gap: 16, marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--bz-border)", color: "var(--bz-muted)", fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.bed} {beds}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.bath} {baths}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.area} {area} ft²</span>
        </div>
      </div>
    </div>
  );
}

// ─── CMS shell ────────────────────────────────────────────────────
function CmsShell({ active, title, breadcrumbs, primary, secondary, children }) {
  const nav = [
    { group: "Workspace", items: [
      ["Dashboard", I.home, "Dashboard"],
      ["Analytics", I.chart, "Analytics"],
    ]},
    { group: "Catalogue", items: [
      ["Properties", I.bldg, "Properties"],
      ["Media library", I.image, "Media"],
      ["Agents & team", I.user, "Agents"],
    ]},
    { group: "Inbox", items: [
      ["Enquiries", I.inbox, "Enquiries"],
      ["Mortgage requests", I.mortgage, "Mortgages", "5"],
    ]},
    { group: "Content", items: [
      ["Blog editor", I.doc, "Blog"],
      ["Pages & blocks", I.layers, "Pages"],
    ]},
    { group: "Admin", items: [
      ["Users & roles", I.user, "Users"],
      ["Site settings", I.settings, "Settings"],
    ]},
  ];
  return (
    <div className="bz-cms">
      <aside className="bz-cms__side">
        <div className="bz-cms__brand">Bazar <span style={{ color: "var(--bz-muted)", fontSize: 11, marginLeft: 6, letterSpacing: 0.5, fontFamily: "var(--bz-font-sans)" }}>CMS</span></div>
        {nav.map(g => (
          <React.Fragment key={g.group}>
            <div className="bz-cms__navgroup">{g.group}</div>
            {g.items.map(([label, icon, key, count]) => (
              <div key={key} className={`bz-cms__navitem ${active === key ? "is-active" : ""}`}>
                <span className="bz-icn">{icon}</span>{label}
                {count && <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: "var(--bz-font-mono)", padding: "1px 7px", borderRadius: 999, background: active === key ? "rgba(255,255,255,.18)" : "var(--bz-accent-soft)", color: active === key ? "var(--bz-bg)" : "var(--bz-accent)" }}>{count}</span>}
              </div>
            ))}
          </React.Fragment>
        ))}
        <div style={{ marginTop: "auto", padding: "16px 10px 0", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--bz-border)" }}>
          <Avatar initials="MA" size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Mariam Al-Hashimi</div>
            <div style={{ fontSize: 11, color: "var(--bz-muted)" }}>Admin</div>
          </div>
          <div style={{ marginLeft: "auto", color: "var(--bz-muted)" }}>{I.dotsV}</div>
        </div>
      </aside>
      <div className="bz-cms__main">
        <div className="bz-cms__topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            {breadcrumbs && <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginBottom: 2 }}>{breadcrumbs}</div>}
            <div className="bz-cms__title">{title}</div>
          </div>
          <div style={{ position: "relative", width: 280 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--bz-muted)" }}>{I.search}</span>
            <input className="bz-field" placeholder="Search anything…" style={{ paddingLeft: 36 }} />
          </div>
          <Btn kind="ghost" size="sm" icon={I.bell} />
          {secondary}
          {primary}
        </div>
        <div className="bz-cms__content">{children}</div>
      </div>
    </div>
  );
}

// ─── Frame helper for design canvas ────────────────────────────────
function Frame({ children, dark, density }) {
  // density: "compact" → 0.85, "regular" → 1, "comfy" → 1.1
  const densityValue = density === "compact" ? 0.88 : density === "comfy" ? 1.08 : 1;
  return (
    <div className={`bz ${dark ? "bz-dark" : ""}`} style={{ "--bz-density": densityValue }}>
      {children}
    </div>
  );
}

Object.assign(window, {
  I, Icn, Btn, Badge, Img, Field, Avatar,
  PublicNav, PublicFooter, ListingCard, CmsShell, Frame,
});
