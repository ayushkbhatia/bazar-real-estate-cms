import { describe, expect, it } from "vitest";
import { answersFor } from "./notify";
import { formSubmissionTemplate } from "@/lib/email-templates";

describe("answersFor", () => {
  it("reads answers back in the form's own field order", () => {
    // The stored object is key-ordered by whatever wrote it; the email should
    // read top-to-bottom the way the visitor filled it in.
    const rows = answersFor("contact_enquiry", {
      message: "Looking on Reem.",
      name: "Ali",
      email: "ali@example.com",
      _labels: {
        name: "Name",
        email: "Email",
        message: "Tell us more",
      },
    });
    expect(rows.map(([label]) => label)).toEqual([
      "Name",
      "Email",
      "Tell us more",
    ]);
  });

  it("uses the label the visitor saw, not today's", () => {
    // A question renamed since must not relabel an answer already given.
    const rows = answersFor("contact_enquiry", {
      message: "Hi",
      _labels: { message: "What can we help with?" },
    });
    expect(rows).toEqual([["What can we help with?", "Hi"]]);
  });

  it("resolves an option value back to its label", () => {
    const rows = answersFor("home_list_property", {
      purpose: "rent",
      _labels: { purpose: "Property purpose" },
    });
    expect(rows).toEqual([["Property purpose", "Rent Your Property"]]);
  });

  it("keeps an answer to a question the form no longer has", () => {
    const rows = answersFor("contact_enquiry", {
      name: "Ali",
      floor: "12th",
      _labels: { name: "Name", floor: "Which floor?" },
    });
    expect(rows).toContainEqual(["Which floor?", "12th"]);
  });

  it("skips the blanks and renders booleans as words", () => {
    const rows = answersFor("contact_enquiry", {
      name: "Ali",
      phone: "",
      email: null,
      consent: true,
      _labels: { name: "Name", phone: "Phone", consent: "Consent" },
    });
    expect(rows).toEqual([
      ["Name", "Ali"],
      ["Consent", "Yes"],
    ]);
  });

  it("survives a row with no label snapshot at all", () => {
    const rows = answersFor("contact_enquiry", { name: "Ali" });
    expect(rows).toEqual([["Name", "Ali"]]);
  });
});

describe("formSubmissionTemplate", () => {
  const base = {
    formName: "Submit your enquiry",
    surface: "Contact",
    formKey: "contact_enquiry",
    answers: [["Name", "Ali"]] as [string, string][],
    sourcePath: "/contact",
    enquiryId: "11111111-2222-3333-4444-555555555555",
  };

  it("names the form and the page in the subject", () => {
    const tpl = formSubmissionTemplate(base);
    expect(tpl.subject).toBe("New Submit your enquiry submission · Contact");
  });

  it("links the enquiry and the responses list", () => {
    const tpl = formSubmissionTemplate(base);
    expect(tpl.html).toContain("/admin/enquiries/11111111-2222-3333-4444-555555555555");
    expect(tpl.html).toContain("/admin/forms/contact_enquiry");
    expect(tpl.text).toContain("/admin/forms/contact_enquiry");
  });

  it("drops the enquiry link when the form makes no enquiry", () => {
    const tpl = formSubmissionTemplate({ ...base, enquiryId: null });
    expect(tpl.html).not.toContain("/admin/enquiries/");
    expect(tpl.text).not.toContain("Open the enquiry");
  });

  it("escapes an answer rather than rendering it as markup", () => {
    const tpl = formSubmissionTemplate({
      ...base,
      answers: [["Name", "<script>alert(1)</script>"]],
    });
    expect(tpl.html).not.toContain("<script>");
    expect(tpl.html).toContain("&lt;script&gt;");
  });

  it("still sends something when every field came back blank", () => {
    const tpl = formSubmissionTemplate({ ...base, answers: [] });
    expect(tpl.html).toContain("(no answers)");
  });
});
