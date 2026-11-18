/**
 * The "Add block" library: ready-made variants of each block, laid over its
 * defaults (catalogue.ts). Each is a starting point — every word, colour and
 * image stays editable once it is in the email.
 */

import { BAZAR } from "./palette";
import type { BlockPreset } from "./types";

const P = (id: string, type: string, label: string, description: string, props: BlockPreset["props"] = {}): BlockPreset => ({
  id,
  type,
  label,
  description,
  props,
});

export const PRESETS: BlockPreset[] = [
  // Headers
  P("hero-launch", "hero", "Launch hero", "Photograph, white logo, “NEW LAUNCH” headline, centred.", {
    eyebrow: "",
    heading: "New launch",
    subheading: "Yas Island, Abu Dhabi",
    text: "The final waterfront launch on the island.",
    height: "l",
    overlayOpacity: 30,
  }),
  P("hero-left", "hero", "Hero, words on the left", "Headline and button set to the start, darker overlay.", {
    align: "start",
    overlayOpacity: 50,
    eyebrow: "Exclusive preview",
    heading: "Your next address",
    text: "A first look before the public launch.",
    buttonLabel: "Register your interest",
    buttonUrl: "/contact",
    buttonColor: BAZAR.cream,
    buttonTextColor: BAZAR.navy,
  }),
  P("hero-colour", "hero", "Colour hero, no photo", "A navy band with the logo and a headline — for when there's no picture.", {
    image: null,
    overlayOpacity: 0,
    height: "s",
    heading: "Market update",
    subheading: "",
    eyebrow: "November 2026",
  }),
  P("hero-showcase", "hero", "Showcase hero", "Bazar's logo and the developer's in the top corners, the headline at the foot of the photo, a tag in a pill.", {
    shape: "wide",
    textPosition: "bottom",
    logoPosition: "corners",
    logoWidth: 84,
    heading: "The project's name",
    subheading: "The new residential phase",
    subheadingStyle: "caps",
    tag: "Yas Island, Abu Dhabi",
    text: "",
    overlayOpacity: 30,
  }),
  P("hero-minimal", "hero", "Photograph only", "The picture and the logo, nothing else.", {
    heading: "",
    subheading: "",
    text: "",
    height: "l",
    overlayOpacity: 10,
  }),
  P("logo-centre", "logo", "Logo, centred", "The colour logo on white."),
  P("logo-navy", "logo", "Logo on navy", "The white logo on a navy band.", { logo: "white", background: BAZAR.navy, padding: "m" }),
  P("logo-link", "logo", "Logo with a link", "Logo at the start, a link at the end.", {
    align: "start",
    linkLabel: "bazarrealestate.ae",
    linkUrl: "/",
    padding: "s",
  }),

  // Text
  P("heading-serif", "heading", "Serif heading", "A large serif heading, centred."),
  P("heading-eyebrow", "heading", "Heading with a line above", "Small capitals over a heading.", { eyebrow: "In this issue", heading: "What's new this month" }),
  P("heading-start", "heading", "Heading at the start", "A medium heading set to the start.", { align: "start", size: "m" }),
  P("text-plain", "text", "Paragraph", "Prose, at the start."),
  P("text-centred", "text", "Centred paragraph", "A short centred paragraph.", { align: "center" }),
  P("text-lead", "text", "Large intro", "An opening line in a larger size.", { size: "l", align: "center" }),
  P("section-cream", "section", "Intro on cream", "Heading, paragraph and button on a cream band.", {}),
  P("section-white", "section", "Intro on white", "Heading, paragraph and button on white.", { background: "", padding: "m" }),
  P("section-fade", "section", "Intro on a fade", "White words on a band fading from navy to teal.", {
    background: BAZAR.navy,
    backgroundTo: BAZAR.teal,
    textColor: "#FFFFFF",
    buttonColor: "#FFFFFF",
    buttonStyle: "outline",
  }),
  P("section-navy", "section", "Intro on navy", "White words on a navy band.", {
    background: BAZAR.navy,
    textColor: "#FFFFFF",
    buttonColor: BAZAR.cream,
    buttonTextColor: BAZAR.navy,
  }),
  P("quote-client", "quote", "Client's words", "A testimonial with a name under it.", {
    quote: "Bazar found us the right home in a fortnight, and stayed with us through handover.",
    author: "A Bazar client",
    role: "Al Reem Island",
  }),
  P("quote-advisor", "quote", "Advisor's view", "A pull quote from your advisor, on cream.", {
    quote: "Waterfront launches on the island rarely come twice. This is the one to watch.",
    author: "Bazar advisory team",
    background: BAZAR.cream,
  }),

  // Images
  P("image-bleed", "image", "Photograph, edge to edge", "A full-width picture between sections."),
  P("image-inset", "image", "Photograph with margins", "A picture with a margin, rounded corners and a caption.", {
    fullBleed: false,
    rounded: true,
    padding: "s",
    caption: "",
  }),
  P("image-text-left", "image_text", "Photo, text beside it", "Picture at the start, words at the end."),
  P("image-text-right", "image_text", "Text, photo beside it", "Words at the start, picture at the end.", { side: "end" }),
  P("gallery-two", "gallery", "Two photos", "Two pictures side by side."),
  P("gallery-three", "gallery", "Three photos", "Three pictures side by side.", {
    items: [
      { image: null, alt: "", link: "", caption: "" },
      { image: null, alt: "", link: "", caption: "" },
      { image: null, alt: "", link: "", caption: "" },
    ],
  }),

  P("gallery-strip", "gallery", "Four photos, edge to edge", "Four pictures meeting in one strip across the email, no gaps.", {
    fullBleed: true,
    shape: "landscape",
    padding: "none",
    items: [
      { image: null, alt: "", link: "", caption: "" },
      { image: null, alt: "", link: "", caption: "" },
      { image: null, alt: "", link: "", caption: "" },
      { image: null, alt: "", link: "", caption: "" },
    ],
  }),

  // Columns
  P("features-three", "features", "Three points with lines", "Three short points divided by thin lines.", {
    heading: "A new standard of waterfront living",
    items: [
      { icon: null, title: "Private beach", text: "Step from the lobby onto the sand" },
      { icon: null, title: "Five-star living", text: "Hotel service and concierge" },
      { icon: null, title: "Golf views", text: "Fairway and sea from home" },
    ],
  }),
  P("features-two", "features", "Two points", "Two short points side by side.", {
    items: [
      { icon: null, title: "First point", text: "A line about it" },
      { icon: null, title: "Second point", text: "A line about it" },
    ],
  }),
  P("features-photos", "features", "Three photos with titles", "A photograph above each point, no lines.", {
    dividers: false,
    items: [
      { icon: null, title: "Pool", text: "" },
      { icon: null, title: "Beach", text: "" },
      { icon: null, title: "Gardens", text: "" },
    ],
  }),
  P("cards-two", "cards", "Two cards", "Two cards on cream: photo, title, line, link."),
  P("cards-three", "cards", "Three cards", "Three cards on white.", {
    background: "",
    cardBackground: BAZAR.cream,
    items: [
      { image: null, title: "Card title", text: "A line about it.", linkLabel: "Find out more", url: "" },
      { image: null, title: "Card title", text: "A line about it.", linkLabel: "Find out more", url: "" },
      { image: null, title: "Card title", text: "A line about it.", linkLabel: "Find out more", url: "" },
    ],
  }),
  P("stats-three", "stats", "Three figures", "Yield, handover and payment plan as big numbers."),
  P("stats-navy", "stats", "Figures on navy", "Big cream numbers on a navy band.", {
    background: BAZAR.navy,
    textColor: "#FFFFFF",
    valueColor: BAZAR.cream,
  }),

  P("stats-divided", "stats", "Payment terms", "Large figures with lines between — down payment, plan, handover.", {
    size: "l",
    dividers: true,
    items: [
      { value: "5%", label: "Down payment" },
      { value: "55/45", label: "Payment plan" },
    ],
    background: BAZAR.teal,
    textColor: "#FFFFFF",
    valueColor: "#FFFFFF",
  }),
  P("tiles-residences", "tiles", "Residences, on a fade", "Unit types as glass tiles on a band fading from navy to teal.", {
    items: [
      { value: "", label: "Studio" },
      { value: "1", label: "Bedroom" },
      { value: "2", label: "Bedroom" },
      { value: "2", label: "Bedroom + maid" },
      { value: "3", label: "Bedroom + maid + study" },
    ],
    tileColor: "#FFFFFF",
    textColor: "#FFFFFF",
    background: BAZAR.navy,
    backgroundTo: BAZAR.teal,
  }),
  P("tiles-light", "tiles", "Unit tiles on cream", "Navy-outlined tiles on a cream band.", {
    tileColor: BAZAR.navy,
    tileFill: BAZAR.white,
    tileOpacity: 100,
    background: BAZAR.cream,
  }),
  P("price-starting", "price", "Starting price", "“Starting price · AED 1.66 Million”, large and white on teal.", {
    background: BAZAR.teal,
    textColor: "#FFFFFF",
    valueColor: "#FFFFFF",
  }),
  P("price-light", "price", "Price on white", "The same in navy on white.", { size: "m" }),

  // Lists & details
  P("chips-units", "chips", "Unit types", "“1–4 bedroom apartments · Duplexes · Penthouses” as tags.", {
    intro: "Choose from a collection of residences.",
  }),
  P("chips-pills", "chips", "Rounded tags on white", "Pill-shaped tags on white.", { shape: "pill", background: "", heading: "" }),
  P("list-amenities", "list", "Amenities, two columns", "Two columns of amenities with a rule under each.", {
    intro: "Residents-only amenities designed for every part of your day.",
    items: [
      { text: "Fitness centre" },
      { text: "Steam and sauna" },
      { text: "Treatment rooms" },
      { text: "Golf simulator" },
      { text: "Children's activity areas" },
      { text: "Media room" },
      { text: "Guest suites" },
      { text: "Residents' lounge" },
    ],
  }),
  P("amenities-outdoor", "amenities", "Amenity icons, outdoor", "White line icons on a band fading from deep taupe to navy.", {
    heading: "Designed for modern living",
    intro: "An extensive collection of indoor and outdoor amenities, crafted for every lifestyle.",
    textColor: "#FFFFFF",
    iconColor: "#FFFFFF",
    background: BAZAR.taupeDeep,
    backgroundTo: BAZAR.navy,
  }),
  P("amenities-indoor", "amenities", "Amenity icons, indoor", "Navy icons in three columns on cream.", {
    group: "Indoor wellness & productivity",
    columns: "3",
    items: [
      { icon: "coworking", image: null, label: "Residents' co-working lounge" },
      { icon: "gym", image: null, label: "Gym" },
      { icon: "play", image: null, label: "Indoor kids' play area" },
    ],
    iconColor: BAZAR.navy,
    background: BAZAR.cream,
  }),
  P("list-ticks", "list", "Ticked list", "One column with ticks.", { columns: "1", marker: "check", align: "start", background: "" }),
  P("kv-glance", "key_values", "At a glance", "Developer, location, setting, unit types.", {
    items: [
      { label: "Developer", value: "" },
      { label: "Location", value: "" },
      { label: "Setting", value: "" },
      { label: "Unit types", value: "" },
      { label: "Handover", value: "" },
    ],
  }),
  P("kv-event", "key_values", "Event details", "Date, time and venue.", {
    heading: "The details",
    background: "",
    items: [
      { label: "Date", value: "" },
      { label: "Time", value: "" },
      { label: "Venue", value: "" },
    ],
  }),
  P("person-advisor", "person", "Your advisor", "A photo, name and how to reach them."),

  // Calls to action
  P("button-solid", "button", "Solid button", "A navy button, centred."),
  P("button-outline", "button", "Outline button", "An outlined button.", { buttonStyle: "outline" }),
  P("button-wide", "button", "Full-width button", "A button across the column.", { fullWidth: true }),
  P("cta-navy", "cta_band", "Closing band, navy", "Heading, line and two buttons on navy."),
  P("cta-taupe", "cta_band", "Closing band, taupe", "The same on deep taupe.", {
    background: BAZAR.taupeDeep,
    primaryColor: BAZAR.cream,
    primaryTextColor: BAZAR.ink,
    secondaryColor: BAZAR.ink,
  }),
  P("cta-single", "cta_band", "One button on cream", "A single ask on a cream band.", {
    background: BAZAR.cream,
    textColor: BAZAR.navy,
    primaryColor: BAZAR.navy,
    primaryTextColor: "#FFFFFF",
    secondaryLabel: "",
  }),

  // From the site
  P("records-projects", "records", "Projects", "Live cards for projects you pick.", { heading: "New launches" }),
  P("records-listings", "records", "Listings in a grid", "Live listing cards, two to a row.", { heading: "Just listed" }),
  P("records-articles", "records", "Articles", "Latest articles from Insights.", { heading: "From Insights" }),

  // Footer
  P("social-dark", "social", "Social icons", "Dark icons, centred."),
  P("social-light", "social", "Social icons on navy", "Light icons on a navy band.", { tone: "light", background: BAZAR.navy }),
  P("contact-footer", "contact", "Contact and links", "Company, address, phone, links and licence line."),
  P("contact-taupe", "contact", "Contact on taupe", "The same on a deep taupe band.", { background: BAZAR.taupeDeep, textColor: "#FFFFFF" }),

  // Spacing
  P("divider", "divider", "Line", "A thin line."),
  P("divider-short", "divider", "Short line", "A short centred line.", { width: 20 }),
  P("spacer", "spacer", "Space", "32px of space."),
  P("spacer-cream", "spacer", "Cream space", "A cream gap between bands.", { background: BAZAR.cream, height: 24 }),
];
