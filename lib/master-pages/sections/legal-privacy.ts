import type { MasterPageDef } from "../types";
import { text, area } from "../fields";

/**
 * The privacy policy, as an editable document.
 *
 * It was the last piece of public copy on the site the client could not
 * change: 268 lines of hardcoded JSX in English, plus a second 243-line file
 * holding the Arabic. Terms and the cookie policy became master pages in
 * Sprint 14 (`./legal.ts`); this brings the third one level, on the same
 * `LegalDocument` renderer and the same clause shape.
 *
 * ## Why the Arabic is hand-declared here and not in the store
 *
 * Every other Arabic string on the site arrives from
 * `lib/master-pages/arabic/master.json`, keyed by its English and marked
 * `by: "machine"` — a first draft the client edits (ADR-0008). This document
 * is the one place where that is the wrong mechanism twice over.
 *
 * The Arabic below is not a draft: it is the client's own half of a signed
 * bilingual PDF, transcribed glyph-by-glyph (see the git history of the file
 * this replaced for why a plain text extract of that PDF is wrong). Putting it
 * in the machine store would mislabel its provenance, and would expose it to
 * being rewritten by the next `scripts/i18n/translate-content.ts` run.
 *
 * Declaring the twins as defaults instead means `mergeValues` reads them
 * straight out of this file, `fillArabic` leaves them alone because they are
 * not blank, and a reviewer sees each clause beside its translation in one
 * diff. `sections/contact-qr.ts` set the precedent for hand-declared `_ar`.
 *
 * The known cost, and it is the same one every hand-declared twin carries: an
 * editor who rewrites an English clause keeps the Arabic of the clause they
 * replaced until they edit the twin too. The editor shows both side by side,
 * which is what makes that visible rather than silent.
 *
 * ## What is NOT editable here
 *
 * Nothing. The two sibling documents keep their `dpo@` mailbox and "Effective"
 * date wording as `LegalDocFrame` defaults; privacy overrides both from the
 * CMS, because the client's text routes rights requests to `info@` and says
 * "Last updated" — §11 of the policy refers back to that exact wording.
 */

export const LEGAL_PRIVACY_PAGE: MasterPageDef = {
  key: "legal-privacy",
  label: "Privacy policy",
  description: "How Bazar collects, uses and protects personal data, under UAE PDPL.",
  path: "/legal/privacy",
  sections: [
    {
      key: "doc",
      label: "Document",
      description:
        "The document heading, its date, the mailbox rights requests go to, and every clause in order.",
      fields: [
        text("title", "Title", { max: 120 }),
        text("date_label", "Date label", {
          max: 40,
          help: 'Sits before the date — "Last updated" or "Effective".',
        }),
        text("effective", "Date", { max: 40 }),
        text("contact_email", "Contact mailbox", {
          max: 160,
          // A mailbox, not prose: folded into Arabic it would stop being an
          // address, and the footer renders it as a mailto link.
          i18n: false,
          help: "Printed under the document as the route for PDPL requests.",
        }),
        {
          key: "clauses",
          label: "Clauses",
          kind: "list",
          itemLabel: "clause",
          max: 40,
          help: "Numbered in the order shown. Leave a blank line between paragraphs; a line starting with • becomes a bullet, and **text** renders bold.",
          fields: [
            text("heading", "Heading", { max: 200 }),
            area("body", "Body", { max: 4000 }),
          ],
        },
      ],
      defaults: {
        title: "Privacy policy",
        title_ar: "سياسة الخصوصية",
        date_label: "Last updated",
        date_label_ar: "آخر تحديث",
        effective: "6 August 2026",
        effective_ar: "٦ أغسطس ٢٠٢٦",
        contact_email: "info@bazarrealestate.ae",
        clauses: [
          {
            heading: "1. Introduction",
            heading_ar: "١. مقدمة",
            body: "Bazar Real Estate L.L.C. is a real estate brokerage licensed and regulated in the Emirate of Abu Dhabi, United Arab Emirates, headquartered in Al Bateen, Abu Dhabi, and regulated by the Abu Dhabi Real Estate Centre (ADREC) and, where applicable, the Dubai Land Department (DLD). This Privacy Policy explains how we collect, use, store, disclose, and protect personal data when you visit our website(s), submit an inquiry, contact us through WhatsApp or phone, or otherwise interact with our services.\n\nThis Policy is issued in accordance with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (the \"PDPL\") and its implementing regulations.",
            body_ar: "شركة بازار العقارية ذ.م.م. هي شركة وساطة عقارية تم تأسيسها وترخيصها في إمارة أبوظبي، الإمارات العربية المتحدة، ويقع مقرها الرئيسي في البطين، أبوظبي، وتخضع لتنظيم مركز أبوظبي العقاري، ودائرة الأراضي والأملاك في دبي، حينما ينطبق ذلك. توضح سياسة الخصوصية هذه كيفية قيامنا بجمع البيانات الشخصية واستخدامها وتخزينها والإفصاح عنها وحمايتها عند زيارتكم لموقعنا الإلكتروني، أو مواقعنا الإلكترونية، أو تقديم استفسار، أو التواصل معنا عبر تطبيق واتساب أو الهاتف، أو التفاعل بأي صورة أخرى مع خدماتنا.\n\nصدرت هذه السياسة وفقًا للمرسوم بقانون اتحادي لدولة الإمارات العربية المتحدة رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية («قانون حماية البيانات الشخصية») ولائحته التنفيذية.",
          },
          {
            heading: "2. What Personal Data We Collect",
            heading_ar: "٢. البيانات الشخصية التي بجمعها",
            body: "We collect personal data through the following channels:\n\n• **Website contact and inquiry forms** — full name, phone number, email address, and details of the property or service you are interested in.\n• **WhatsApp integration** — your name, phone number, and the content of messages exchanged with our team.\n• **Call integration** — your phone number, call metadata (date, time, duration), and, where legally permitted and disclosed to you, call recordings for quality and training purposes.\n• **Third-party advertising and listing platforms** — when you engage with our adverts or listings on Meta (Facebook/Instagram), Google, LinkedIn, Property Finder, Bayut, Dubizzle, or similar platforms, and submit an inquiry through them, your name, contact details, and inquiry details are passed to us and stored in our CRM.\n• **Cookies and similar tracking technologies** deployed via our website and advertising pixels (see Section 6).\n• **Documents you voluntarily provide** during a transaction (e.g. Emirates ID, passport, income documentation), whether submitted via the website, email, or in person.",
            body_ar: "نجمع البيانات الشخصية من خلال القنوات التالية:\n\n• **نماذج التواصل والاستفسار عبر الموقع الإلكتروني**: الاسم بالكامل، ورقم الهاتف، وعنوان البريد الإلكتروني، وتفاصيل العقار أو الخدمة التي تهتمون بها.\n• **التكامل مع تطبيق واتساب**: اسمكم، ورقم هاتفكم، ومحتوى الرسائل المتبادلة مع فريقنا.\n• **التكامل مع المكالمات**: رقم هاتفكم، والبيانات الوصفية للمكالمة، بما في ذلك التاريخ والوقت والمدة، وكذلك تسجيلات المكالمات لأغراض الجودة والتدريب، متى كان ذلك مسموحًا به قانونًا وتم الإفصاح عنه لكم.\n• **منصات الإعلانات والإدراج التابعة للغير**: عند تفاعلكم مع إعلاناتنا أو قوائمنا المنشورة على منصات ميتا (فيسبوك/إنستغرام)، أو جوجل، أو لينكدإن، أو بروبرتي فايندر، أو بيوت، أو دوبيزل، أو غيرها من المنصات المماثلة، وتقديم استفسار من خلالها، يتم تزويدنا باسمكم، وبيانات الاتصال بكم وتفاصيل استفساركم، وتُخزن هذه البيانات في نظام إدارة علاقات العملاء الخاص بنا.\n• **ملفات تعريف الارتباط (الكوكيز) وتقنيات التتبع المماثلة** المستخدمة من خلال موقعنا الإلكتروني ووحدات البكسل الإعلانية (يرجى الاطلاع على البند رقم ٦).\n• **أي مستندات تقدمونها طوعًا** أثناء إجراء أي معاملة، مثل بطاقة الهوية الإماراتية أو جواز السفر أو المستندات المثبتة للدخل، سواء تم تقديمها عبر الموقع الإلكتروني أو البريد الإلكتروني أو شخصيًا.",
          },
          {
            heading: "3. How We Use Your Data",
            heading_ar: "٣. كيفية استخدامنا لبياناتكم:",
            body: "We process personal data for the following purposes, each with a corresponding legal basis under the PDPL:\n\n• To respond to your inquiry and connect you with the relevant property consultant — basis: performance of a contract / pre-contractual steps taken at your request.\n• To pass your inquiry to the property consultant responsible for the relevant listing, location, or service area — basis: legitimate interest in fulfilling your request efficiently.\n• To maintain records of client and lead interactions in our CRM system (Salesforce) — basis: legitimate interest and, in relevant cases, legal obligation (e.g. ADREC/DLD record-keeping requirements).\n• To send you marketing communications about properties or services that may interest you — basis: your consent, which you may withdraw at any time (see Section 8).\n• To comply with applicable UAE laws and regulatory requirements, including those of ADREC and DLD.",
            body_ar: "نعالج البيانات الشخصية للأغراض التالية، ولكل غرض منها أساس قانوني مقابل بموجب قانون حماية البيانات الشخصية:\n\n• للرد على استفساركم وربطكم بالمستشار العقاري المختص — الأساس القانوني: تنفيذ عقد/ اتخاذ خطوات سابقة على التعاقد بناءً على طلبكم.\n• لإحالة استفساركم إلى المستشار العقاري المسؤول عن القائمة العقارية أو الموقع أو نطاق الخدمة ذي الصلة — الأساس القانوني: المصلحة المشروعة في تلبية طلبكم بكفاءة.\n• للاحتفاظ بسجلات تفاعلات العملاء والعملاء المحتملين في نظام إدارة علاقات العملاء الخاص بنا (سيلزفورس) — الأساس القانوني: المصلحة المشروعة، وفي الحالات ذات الصلة، الالتزام القانوني، مثل متطلبات حفظ السجلات الخاصة بمركز أبوظبي العقاري/ دائرة الأراضي والأملاك في دبي.\n• لإرسال مراسلات تسويقية إليكم بشأن العقارات أو الخدمات التي قد تهمكم — الأساس القانوني: موافقتكم، التي يجوز لكم سحبها في أي وقت (يرجى الاطلاع على البند رقم ٨).\n• للامتثال للقوانين السارية والمتطلبات التنظيمية المعمول بها في دولة الإمارات العربية المتحدة، بما في ذلك متطلبات مركز أبوظبي العقاري ودائرة الأراضي والأملاك في دبي.",
          },
          {
            heading: "4. Who We Share Your Data With",
            heading_ar: "٤. الجهات التي نشارك بياناتكم معها:",
            body: "Access to your personal data within Bazar is restricted to authorized personnel — namely, the property consultant(s) assigned to your inquiry and relevant supervisory or administrative staff — on a need-to-know basis.\n\nWe share personal data with the following categories of third parties:\n\n• Salesforce (our Customer Relationship Management platform), which stores and processes inquiry and client data on our behalf under a data processing agreement.\n• Advertising and listing platforms (Meta, Google, LinkedIn, Property Finder, Bayut, Dubizzle) to the extent necessary to run campaigns and receive inquiries generated through them — governed also by those platforms' own privacy policies.\n• Developers or landlords, where necessary to progress a specific transaction you have inquired about, and only with your knowledge as part of that transaction.\n• Regulatory authorities (including ADREC and DLD), law enforcement, or courts, where required by law.\n\nWe do not sell, rent, or lease your personal data to any third party.",
            body_ar: "يقتصر الوصول إلى بياناتكم الشخصية داخل شركة بازار على الموظفين المصرح لهم، وهم المستشار العقاري أو المستشارون العقاريون المكلفون بمتابعة استفساركم، وموظفو الإشراف أو الإداريون المعنيون، وذلك على أساس الحاجة إلى الاطلاع.\n\nنشارك البيانات الشخصية مع الفئات التالية من الأطراف الثالثة:\n\n• سيلزفورس (منصة إدارة علاقات العملاء الخاصة بنا)، التي تقوم بتخزين بيانات الاستفسارات والعملاء ومعالجتها نيابةً عنا بموجب اتفاقية لمعالجة البيانات.\n• منصات الإعلانات والإدراج العقاري، وهي ميتا وجوجل ولينكدإن وبروبرتي فايندر وبيوت ودوبيزل، بالقدر اللازم لإدارة الحملات وتلقي الاستفسارات الواردة من خلالها، كما تخضع هذه العمليات لسياسات الخصوصية الخاصة بتلك المنصات.\n• المطورون أو الملاك، متى كان ذلك ضروريًا للمضي قدمًا في معاملة محددة سبق لكم الاستفسار عنها، وبعلمكم فقط باعتبار ذلك جزءًا من تلك المعاملة.\n• الجهات التنظيمية، بما في ذلك مركز أبوظبي العقاري ودائرة الأراضي والأملاك في دبي، أو جهات إنفاذ القانون، أو المحاكم، متى كان ذلك مطلوبًا بموجب القانون.\n\nإننا لا نبيع بياناتكم الشخصية لأي طرف ثالث، ولا نؤجرها أو نمنح حق الانتفاع بها لأي طرف ثالث.",
          },
          {
            heading: "5. Data Retention",
            heading_ar: "٥. الاحتفاظ بالبيانات",
            body: "We retain personal data collected through inquiries for a period of 12 months from the date of your last interaction with us, or for the duration of an active transaction plus any period required by ADREC/DLD record-keeping obligations, whichever is longer.",
            body_ar: "نحتفظ بالبيانات الشخصية التي يتم جمعها من خلال الاستفسارات لمدة ١٢ شهرًا اعتبارًا من تاريخ آخر تفاعل لكم معنا، أو طوال مدة أي معاملة قائمة، بالإضافة إلى أي مدة تقتضيها التزامات حفظ السجلات المفروضة من مركز أبوظبي العقاري/دائرة الأراضي والأملاك في دبي، أيهما أطول.",
          },
          {
            heading: "6. Cookies and Tracking Technologies",
            heading_ar: "٦. ملفات تعريف الارتباط وتقنيات التتبع:",
            body: "Our website uses cookies and similar technologies, including advertising pixels from Meta, Google, and LinkedIn, to operate the site, analyze traffic, and measure the performance of our advertising campaigns.",
            body_ar: "يستخدم موقعنا الإلكتروني ملفات تعريف الارتباط وتقنيات مماثلة، بما في ذلك وحدات البكسل الإعلانية التابعة لميتا وجوجل ولينكدإن، لتشغيل الموقع وتحليل حركة الزيارات وقياس أداء حملاتنا الإعلانية.",
          },
          {
            heading: "7. Data Security",
            heading_ar: "٧. أمن البيانات",
            body: "We implement appropriate technical and organizational measures designed to protect personal data against unauthorized access, loss, misuse, or alteration, including restricted internal access, secure storage within our CRM, and confidentiality obligations on staff who handle client data. No method of transmission or storage over the internet is entirely secure, and we cannot guarantee absolute security of information transmitted to us online.",
            body_ar: "إننا نطبق تدابير تقنية وتنظيمية مناسبة مصممة لحماية البيانات الشخصية من الوصول غير المصرح به أو الفقدان أو إساءة الاستخدام أو التغيير، بما في ذلك تقييد الوصول الداخلي، والتخزين الآمن داخل نظام إدارة علاقات العملاء الخاص بنا، وفرض التزامات السرية على الموظفين الذين يتعاملون مع بيانات العملاء. ولا توجد وسيلة لنقل البيانات أو تخزينها عبر الإنترنت آمنة تمامًا، ولا يمكننا ضمان الأمن المطلق للمعلومات التي يتم إرسالها إلينا عبر الإنترنت.",
          },
          {
            heading: "8. Your Rights",
            heading_ar: "٨. حقوقكم",
            body: "Subject to the PDPL, you have the right to:\n\n• Request access to the personal data we hold about you.\n• Request correction of inaccurate or incomplete data.\n• Request deletion of your data, subject to our legal and regulatory retention obligations.\n• Withdraw consent to marketing communications at any time, without affecting the lawfulness of processing carried out before withdrawal.\n• Object to certain processing carried out on the basis of legitimate interest.\n\nTo exercise any of these rights, please contact us using the details in Section 10.",
            body_ar: "مع مراعاة أحكام قانون حماية البيانات الشخصية، يحق لكم ما يلي:\n\n• طلب الاطلاع على البيانات الشخصية التي نحتفظ بها عنكم.\n• طلب تصحيح البيانات غير الدقيقة أو غير المكتملة.\n• طلب حذف بياناتكم، مع مراعاة التزاماتنا القانونية والتنظيمية المتعلقة بالاحتفاظ بالبيانات.\n• سحب موافقتكم على تلقي المراسلات التسويقية في أي وقت، دون أن يؤثر ذلك في مشروعية المعالجة التي تمت قبل سحب الموافقة.\n• الاعتراض على بعض عمليات المعالجة التي تتم استنادًا إلى المصلحة المشروعة.\n\nلممارسة أي من هذه الحقوق، يرجى التواصل معنا باستخدام البيانات الواردة في البند رقم ١٠.",
          },
          {
            heading: "9. International Transfers",
            heading_ar: "٩. عمليات النقل الدولية:",
            body: "If you interact with us from outside the UAE, or if we run marketing campaigns directed at audiences in other countries, your personal data may be transferred to and processed in the UAE.",
            body_ar: "في حال تفاعلكم معنا من خارج دولة الإمارات العربية المتحدة، أو إذا قمنا بإدارة حملات تسويقية موجهة إلى جمهور في دول أخرى، فقد يتم نقل بياناتكم الشخصية إلى دولة الإمارات العربية المتحدة ومعالجتها فيها.",
          },
          {
            heading: "10. Contact Us",
            heading_ar: "١٠. تواصل معنا",
            body: "If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact:\n\n• Email: info@bazarrealestate.ae\n• Address: Sheikha Salama Building, Office 4, Zayed The First Street, Al Bateen, Abu Dhabi, United Arab Emirates",
            body_ar: "إذا كانت لديكم أي أسئلة أو مخاوف أو طلبات تتعلق بسياسة الخصوصية هذه أو ببياناتكم الشخصية، يرجى التواصل معنا عبر:\n\n• البريد الإلكتروني: info@bazarrealestate.ae\n• العنوان: مبنى الشيخة سلامة، مكتب رقم ٤، شارع زايد الأول، البطين، أبوظبي، الإمارات العربية المتحدة.",
          },
          {
            heading: "11. Changes to This Policy",
            heading_ar: "١١. التغييرات على هذه السياسة",
            body: "We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. The \"Last updated\" date at the top of this Policy indicates when it was last revised. Material changes will be notified via our website.",
            body_ar: "يجوز لنا تحديث سياسة الخصوصية هذه من وقت إلى آخر بما يعكس التغييرات التي تطرأ على ممارساتنا أو المتطلبات القانونية. ويبين تاريخ «آخر تحديث» الوارد في أعلى هذه السياسة تاريخ آخر مراجعة لها. وسيتم الإخطار بأي تغييرات جوهرية من خلال موقعنا الإلكتروني.",
          },
        ],
      },
    },
  ],
};
