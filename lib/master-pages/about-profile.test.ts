import { describe, expect, it } from "vitest";
import {
  getMasterPage,
  img,
  isFileField,
  isImageField,
  isMediaField,
  resolveSections,
  validateSections,
  type MasterPageDef,
} from "./index";

/**
 * The /about hero can carry a company-profile PDF: a `kind: "file"` field the
 * editor picks or uploads, rendered as a download button under the intro copy.
 *
 * The load-bearing property is that it is *absent* by default — /about shipped
 * without a profile button, and an untouched page must keep rendering exactly
 * that. The public page gates the button on a resolved `url`, which only ever
 * exists once someone picks an asset.
 */
const about = getMasterPage("about") as MasterPageDef;
const hero = about.sections.find((s) => s.key === "hero")!;
const profile = hero.fields.find((f) => f.key === "profile")!;

describe("the about hero profile PDF field", () => {
  it("is a file field, not an image", () => {
    expect(profile, "hero has no `profile` field").toBeDefined();
    expect(isFileField(profile)).toBe(true);
    expect(isImageField(profile)).toBe(false);
  });

  it("counts as a media field, which is what URL resolution keys on", () => {
    // attachImageUrls walks anything holding a media_id; without this the
    // public page would never see a `url` and the button could never render.
    expect(isMediaField(profile)).toBe(true);
  });

  it("comes with an editable button label", () => {
    const label = hero.fields.find((f) => f.key === "profile_label");
    expect(label).toBeDefined();
    expect(label!.kind).toBe("text");
  });

  it("stays in a locked section, so the button can't be orphaned", () => {
    expect(hero.locked).toBe(true);
  });
});

describe("an untouched /about", () => {
  it("defaults to no PDF, so no button renders", () => {
    const resolved = resolveSections(about, null).find(
      (s) => s.key === "hero",
    )!;
    const value = img(resolved.values, "profile");
    expect(value).not.toBeNull();
    expect(value!.media_id).toBeNull();
    // No resolved URL ⇒ the hero renders exactly as it did before this field.
    expect(value!.url ?? null).toBeNull();
    expect(resolved.values.profile_label ?? null).toBeNull();
  });

  it("survives a stored document written before the field existed", () => {
    // Every /about row saved so far has a `hero` with no `profile` key. The
    // registry default has to merge back in rather than throwing.
    const resolved = resolveSections(about, [
      { key: "hero", enabled: true, values: {} },
    ]).find((s) => s.key === "hero")!;
    expect(img(resolved.values, "profile")!.media_id).toBeNull();
  });

  it("leaves the rest of the hero defaults untouched", () => {
    const resolved = resolveSections(about, null).find(
      (s) => s.key === "hero",
    )!;
    expect(resolved.values.eyebrow).toBe("About Bazar Real Estate");
    expect(resolved.values.title).toBe("A trusted name in UAE\nreal estate");
    expect(img(resolved.values, "photo")!.label).toBe(
      "bazar office · al bateen · abu dhabi",
    );
  });
});

describe("saving a profile PDF", () => {
  const MEDIA_ID = "bbbbbbbb-0000-0000-0000-000000000002";

  it("keeps the media reference and the custom label", () => {
    const result = validateSections(about, [
      {
        key: "hero",
        enabled: true,
        values: {
          profile: { media_id: MEDIA_ID, alt: null, label: null },
          profile_label: "Download our 2026 profile",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    expect(img(stored.values, "profile")!.media_id).toBe(MEDIA_ID);
    expect(stored.values.profile_label).toBe("Download our 2026 profile");
  });

  it("never stores a resolved url — media_id is the source of truth", () => {
    const result = validateSections(about, [
      {
        key: "hero",
        enabled: true,
        values: {
          profile: {
            media_id: MEDIA_ID,
            alt: null,
            label: null,
            url: "https://example.com/stale.pdf",
          },
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    expect(img(stored.values, "profile")).not.toHaveProperty("url");
  });

  it("clears back to no PDF, which removes the button again", () => {
    const result = validateSections(about, [
      {
        key: "hero",
        enabled: true,
        values: { profile: { media_id: null, alt: null, label: null } },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    expect(img(stored.values, "profile")!.media_id).toBeNull();
  });

  it("does not treat a blank button label as a required-field error", () => {
    const result = validateSections(about, [
      { key: "hero", enabled: true, values: { profile_label: "" } },
    ]);
    expect(result.ok).toBe(true);
  });
});
