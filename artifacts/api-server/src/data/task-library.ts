import type { TaskFeedCategory } from "../lib/task-feed";

export type TaskLibraryTemplate = {
  id: string;
  title: string;
  category: TaskFeedCategory;
  description: string;
  instructions: string;
  reviewGuide: string;
  estimatedMinutes: number;
  assetUrl: string | null;
};

export const TASK_LIBRARY: TaskLibraryTemplate[] = [
  {
    id: "academic-abstract-clarity-v1",
    title: "Edit a research abstract without changing its findings",
    category: "Academic Writing",
    description: "Improve the clarity and structure of a short, fictional research abstract while preserving every reported fact.",
    estimatedMinutes: 20,
    assetUrl: null,
    instructions: `This is an original Lipwa writing task using fictional research text. It is not a graded school assignment.

SOURCE DRAFT
"We looked at whether reminders and people coming to coding workshops in four community centers went together. People could sign up themselves and the workshops happened for 8 weeks. There were 240 registered people. The group that got two text reminders had attendance of 61 percent and the group that got one reminder had attendance of 49 percent. The difference is 12 percent, and we think more reminders caused the better attendance. The study did not follow people who never registered. Staff said sending messages was easy but sometimes the phone numbers were old."

YOUR WORK
1. Rewrite the draft as a clear 110–150 word abstract with a purpose, method, results, and limitation.
2. Preserve the sample size, duration, groups, attendance figures, and the 12 percentage-point difference.
3. Do not claim the reminders caused the difference: participants chose to register and the groups were not randomly assigned.
4. End with one practical implication and one limitation.
5. Add a short change note naming three important edits.

Submit the revised abstract and change note as text or a document. Do not add facts or citations that were not provided.`,
    reviewGuide: `Check that the response is 110–150 words and includes the eight-week period, four centers, 240 registered people, two reminders at 61%, one reminder at 49%, and a 12 percentage-point difference. It must describe an association rather than claim causation, mention self-selection or outdated phone numbers as a limitation, and include three useful edit notes. Reject invented results, unprovided citations, or a causal claim.`,
  },
  {
    id: "academic-evidence-audit-v1",
    title: "Audit claims against a small evidence table",
    category: "Academic Writing",
    description: "Separate supported findings from overstatements and produce a concise evidence-grounded correction.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `This is an original Lipwa evidence-review task using fictional data. It is not a graded school assignment.

STUDY NOTES
- A pilot compared two reminder formats at one community library.
- 40 volunteers chose to join; they were not randomly assigned.
- 22 of 40 volunteers opened the plain-text reminder.
- 27 of 40 volunteers opened the illustrated reminder.
- The pilot measured message opens only, not event attendance or learning.

CLAIMS TO REVIEW
A. "The illustrated reminder had more opens in this pilot."
B. "Illustrations cause people to attend more events."
C. "Most participants opened the illustrated reminder."
D. "The results prove that illustrated messages work for every age group."

YOUR WORK
1. Return a four-row table with the claim, status (supported / partly supported / unsupported), and the exact study note that matters.
2. Rewrite each unsupported claim into the strongest accurate wording the evidence permits.
3. Add a 2–3 sentence summary that states one limitation and one next study step.
4. Do not add external facts or treat this small volunteer pilot as a representative sample.

Submit the table and summary as text or a file.`,
    reviewGuide: `Expected: A is supported for this pilot only (27 vs 22 opens); B is unsupported because attendance was not measured and assignment was not random; C is supported (27/40 is a majority); D is unsupported because the pilot has 40 self-selected volunteers at one library and no age-group analysis. Strong rewrites must retain the pilot scope and avoid causal/general claims. Full credit also notes the small, self-selected sample and proposes a larger randomized test that measures attendance.`,
  },
  {
    id: "academic-reference-cleanup-v1",
    title: "Standardize references and flag missing citation details",
    category: "Academic Writing",
    description: "Clean a short reference list, preserve supplied facts, and identify information that cannot safely be guessed.",
    estimatedMinutes: 18,
    assetUrl: null,
    instructions: `This is an original Lipwa editing task. All publications below are fictional examples for formatting practice.

SUPPLIED SOURCE DETAILS
1. 2022, Nia Otieno, "Small Data, Better Decisions", East Africa Methods Review, volume 4, issue 2, pages 15–28, DOI 10.5555/eamr.2022.004.
2. "Practical Data Quality", authors Sam K. Mensah and Imani Noor, 2021, Journal of Applied Records, volume 9, pages 70–81. No issue, DOI, or URL was supplied.
3. L. Chen, 2023, "Transcription Checks in Noisy Rooms", Open Research Notes. The publisher, volume, pages, and identifier were not supplied.

YOUR WORK
1. Format each entry consistently in APA-style order using only the facts shown.
2. Alphabetize the entries by the first author's surname.
3. Add a separate "Needs source verification" list for fields that are missing.
4. Do not invent journal issues, publishers, page numbers, DOIs, or URLs.
5. Include a one-sentence note explaining why missing details should not be guessed.

Submit the formatted list and verification notes as text or a document.`,
    reviewGuide: `The list should be alphabetized Chen, Mensah, Otieno. Preserve all supplied authors, years, titles, journals, volume/issue/pages and the one supplied DOI. Chen's publisher/volume/pages/identifier are unknown; Mensah and Noor's issue/DOI/URL are unknown. No invented citation details. Accept reasonable APA-style punctuation differences if facts and ordering are correct.`,
  },
  {
    id: "data-entry-inventory-normalization-v1",
    title: "Normalize a synthetic inventory ledger and flag duplicates",
    category: "Data Entry",
    description: "Convert inconsistent product rows into a clean table and separate exact duplicates from records that need review.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `This is an original Lipwa data-quality task. The sample inventory is synthetic and contains no real customer data.

RAW ROWS
1) sku mug-01 | Harbor Mug | 12 pcs | KES 850.00 | receipt R-101
2) SKU: MUG-01 | harbor mug | 12 pieces | 850 KES | R-101
3) pen-4 | Blue Pen | 3 boxes x 10 | KES 120 per box | R-102
4) NOTE-2 | Grid Notebook | 7 ea | KES 210 | R-103
5) cable-9 | USB-C Cable | 5 units | KES 450 | R-104
6) BOX-3 | Storage Box | 2 cartons x 6 | KES 300 per carton | R-105
7) clip-8 | Binder Clip | 48 pcs | KES 15 each | R-106
8) MUG-01 | Harbor Mug | 4 pcs | KES 850.00 | receipt R-108
9) PEN-4 | Blue Pen | 30 pcs | KES 120.00 | receipt R-102

YOUR WORK
1. Return a CSV with columns: sku, item_name, sellable_units, unit_price_kes, receipt_id.
2. Normalize SKUs to uppercase and item names to title case.
3. Convert boxes/cartons to total individual units; keep unit_price_kes as the price per sellable unit.
4. Mark exact duplicate rows separately. Rows with the same SKU but a different receipt are not duplicates.
5. Add an exceptions list for any assumption you could not resolve.

Submit valid CSV text or attach a CSV file. Do not delete distinct receipts.`,
    reviewGuide: `Canonical rows: MUG-01 / Harbor Mug / 12 / 850 / R-101 (row 2 is exact duplicate); PEN-4 / Blue Pen / 30 / 12 / R-102 (rows 3 and 9 describe the same receipt and are a duplicate after normalization); NOTE-2 / Grid Notebook / 7 / 210 / R-103; CABLE-9 / USB-C Cable / 5 / 450 / R-104; BOX-3 / Storage Box / 12 / 50 / R-105; CLIP-8 / Binder Clip / 48 / 15 / R-106; MUG-01 / Harbor Mug / 4 / 850 / R-108. The two distinct MUG-01 receipts must remain separate. Award for correct unit conversion, clean CSV, and a clear duplicate log.`,
  },
  {
    id: "data-entry-order-reconciliation-v1",
    title: "Reconcile order totals and isolate mismatched lines",
    category: "Data Entry",
    description: "Check arithmetic, standardize order rows, and explain which records need correction.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `This is an original Lipwa data-entry task. Order numbers and products below are fictional.

ORDER LINES (quantity x unit price; expected line total shown)
ORD-201, Desk Lamp, 3 x KES 1,250, expected KES 3,750
ORD-202, Cable Tie Pack, 8 x KES 95, expected KES 760
ORD-203, Notebook Set, 4 x KES 430, expected KES 1,620
ORD-204, Storage Tray, 5 x KES 540, expected KES 2,700
ORD-205, Label Roll, 6 x KES 180, expected KES 1,080
ORD-206, USB Hub, 2 x KES 2,400, expected KES 4,800
ORD-207, File Folder, 12 x KES 75, expected KES 900
ORD-208, Marker Set, 3 x KES 360, expected KES 1,080

YOUR WORK
1. Recalculate every line total.
2. Return a clean CSV with order_id, item, quantity, unit_price_kes, supplied_total_kes, calculated_total_kes, and status.
3. Mark each line "match" or "mismatch"; do not silently change a supplied value.
4. Provide the corrected totals only for mismatched rows and the combined corrected order total.
5. Show your arithmetic for each mismatch.

Submit CSV text or a spreadsheet. No external software or account is needed.`,
    reviewGuide: `ORD-203 is the sole mismatch: 4 x 430 = KES 1,720, not 1,620. Every other supplied total matches. Corrected combined total is KES 16,790. Check that the worker preserves the original supplied total alongside the calculated total, marks only ORD-203 as mismatch, and does not overwrite source data without an audit trail.`,
  },
  {
    id: "data-entry-schedule-validation-v1",
    title: "Validate a project schedule and return a clean CSV",
    category: "Data Entry",
    description: "Standardize dates and time formats, preserve source records, and identify conflicting bookings.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `This is an original Lipwa scheduling task. Names and booking details are synthetic.

RAW BOOKINGS (all times are East Africa Time)
1) 2026-12-02 | Room A | 09:00–10:00 | Team Cedar | confirmed
2) 2 Dec 2026 | room a | 9.30am–10.30am | Team Cedar | confirmed
3) 2026/12/02 | Room B | 09:00–09:45 | Team Juniper | confirmed
4) 2026-12-02 | Room A | 10:30–11:00 | Team Cedar | tentative
5) 2026-12-03 | Room A | 09:00–10:00 | Team Cedar | confirmed
6) 2026-12-03 | Room B | 09:15–10:00 | Team Juniper | confirmed
7) 2026-12-03 | Room B | 09:45–10:30 | Team Juniper | tentative

YOUR WORK
1. Return ISO dates and 24-hour HH:MM start/end times in a CSV.
2. Keep each original booking as its own row.
3. Flag room overlaps only when two bookings in the same room overlap in time; touching at the boundary is not an overlap.
4. Flag duplicate-looking records separately from genuine conflicts. Do not merge rows without evidence.
5. Include an exceptions note for any ambiguous source format.

Submit the clean table and flags as text or a CSV file.`,
    reviewGuide: `Row 2 overlaps row 1 in Room A on Dec 2 (09:30–10:00). Row 7 overlaps row 6 in Room B on Dec 3 (09:45–10:00). Row 4 begins at 10:30 after row 2 ends at 10:30, so it only touches the boundary and is not an overlap. Keep all seven records, normalize dates/times, and do not call the near-duplicate Team Cedar entries duplicates because their time ranges differ.`,
  },
  {
    id: "transcription-inventory-handoff-v1",
    title: "Transcribe an inventory handoff with exact quantities",
    category: "Transcription",
    description: "Create a verbatim transcript with speaker labels, punctuation, and carefully checked item codes and numbers.",
    estimatedMinutes: 18,
    assetUrl: "/task-assets/transcription/inventory-handoff.mp3",
    instructions: `This original synthetic speech clip was created for Lipwa Tasks and contains no customer data.

YOUR WORK
1. Listen to the full clip and transcribe it verbatim.
2. Label speakers as Speaker 1 and Speaker 2 when the voice changes.
3. Preserve item codes, quantities, times, and the distinction between damaged and sellable stock.
4. Use punctuation and paragraph breaks to make the handoff easy to review.
5. If a word is genuinely unclear, mark it [unclear] rather than guessing.

Submit the transcript as text or a file. You do not need to create timestamps for this short clip.`,
    reviewGuide: `Reference transcript:
Speaker 1: Good morning. Please confirm the count for item KX-48.
Speaker 2: We received one hundred twenty-four units. Two boxes were damaged in transit.
Speaker 1: Enter one hundred twenty-two as sellable, and log the two damaged boxes separately.
Speaker 2: Done. The delivery reference is seven three one nine, and the carrier is Northstar.
Speaker 1: Thanks. Flag KX-48 for a second count tomorrow morning.

Review exact quantities (124 received, 122 sellable, 2 damaged), item code KX-48, reference 7319, speaker turns, and no invented facts. Accept number words or numerals if the meaning is exact.`,
  },
  {
    id: "transcription-project-review-v1",
    title: "Transcribe a project review and preserve version details",
    category: "Transcription",
    description: "Capture a two-speaker review accurately, including approved sections, footnote numbers, and a document version.",
    estimatedMinutes: 20,
    assetUrl: "/task-assets/transcription/project-review.mp3",
    instructions: `This original synthetic speech clip was created for Lipwa Tasks and contains no client or personal data.

YOUR WORK
1. Transcribe every spoken word in order.
2. Label the two voices Speaker 1 and Speaker 2.
3. Preserve page ranges, note numbers, the deadline, and version number exactly.
4. Keep hesitations only when they change the meaning; do not rewrite the speakers' words.
5. Use paragraph breaks at speaker changes.

Submit the transcript as text or a file. This short clip does not require timestamps.`,
    reviewGuide: `Reference transcript:
Speaker 1: The client approved the revised draft, but only pages three through six.
Speaker 2: Did they approve the footnotes as well?
Speaker 1: They approved notes one, two, and five. Notes three and four still need sources.
Speaker 2: I will add the source links before two p.m. and send version two point one.
Speaker 1: Please keep the headings unchanged and mark the document final.

Review the page range (3–6), approved notes (1, 2, 5), missing notes (3, 4), deadline (2 p.m.), and version (2.1). Accept word or numeric forms when exact.`,
  },
  {
    id: "transcription-scheduling-call-v1",
    title: "Transcribe a scheduling call with speaker labels",
    category: "Transcription",
    description: "Transcribe a short coordination call and distinguish confirmed times from a proposed backup.",
    estimatedMinutes: 18,
    assetUrl: "/task-assets/transcription/scheduling-call.mp3",
    instructions: `This original synthetic speech clip was created for Lipwa Tasks and contains no real booking details.

YOUR WORK
1. Produce a verbatim transcript with Speaker 1 and Speaker 2 labels.
2. Preserve the date, start time, duration, room name, and proposed backup time.
3. Keep the final agreed time distinct from the earlier suggestion.
4. Use clear punctuation and mark any genuinely unclear word as [unclear].

Submit the transcript as text or a file. No external account or transcription software is required.`,
    reviewGuide: `Reference transcript:
Speaker 1: Can we move the review to Friday, the ninth, at eleven thirty?
Speaker 2: Eleven thirty works. The room is Cedar Two, and we need forty-five minutes.
Speaker 1: Great. I had suggested ten o'clock, but Friday at eleven thirty is confirmed.
Speaker 2: If the room is unavailable, use the backup at one fifteen. Please send the calendar update today.

Check Friday the 9th, 11:30 confirmed, Cedar Two, 45 minutes, 10:00 as the rejected earlier suggestion, and 1:15 as the backup. Accept equivalent number formats.`,
  },
  {
    id: "ai-training-evidence-ranking-v1",
    title: "Rank AI summaries against the source facts",
    category: "AI Training",
    description: "Compare two model summaries for factual accuracy, instruction following, and unsupported claims.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `This original Lipwa AI-evaluation task uses fictional source material and candidate responses.

SOURCE
The Riverbend pilot ran for six weeks at two community centers. Thirty-six volunteers used a paper checklist and 39 used a mobile checklist. Staff recorded an average of 4.2 completed fields for paper and 4.6 for mobile. The groups were not randomly assigned, and the pilot did not measure long-term retention.

MODEL RESPONSE A
"In a randomized six-week study of 75 people, the mobile checklist caused a 9.5% increase in long-term retention. The mobile group completed 4.6 fields on average, compared with 4.2 for paper."

MODEL RESPONSE B
"In a six-week pilot at two community centers, 39 mobile-checklist volunteers completed an average of 4.6 fields, while 36 paper-checklist volunteers completed 4.2. The groups were not randomly assigned, and retention was not measured."

YOUR WORK
1. Rank A and B from better to worse.
2. List every factual error or unsupported claim in A.
3. Explain why B is stronger and identify one limitation B correctly preserves.
4. Give each response a 1–5 accuracy score and a 1–5 instruction-following score.
5. Do not use outside information.`,
    reviewGuide: `B ranks above A. A falsely claims random assignment and causation, invents a 9.5% increase, and says long-term retention was measured; it confuses a difference in average fields with a percentage change. B accurately preserves the sample counts, averages, non-random assignment, and unmeasured retention. Accept justified numeric scores; prioritize factual reasoning over a single scoring convention.`,
  },
  {
    id: "ai-training-invoice-extraction-v1",
    title: "Review AI extraction of a synthetic invoice",
    category: "AI Training",
    description: "Evaluate two structured outputs against a fictional invoice and identify field-level errors.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `This original Lipwa AI-evaluation task uses a synthetic invoice. No real company or payment details are included.

SOURCE INVOICE
Supplier: Cedar Office Supply
Invoice: COS-8841
Issue date: 2026-11-04
Due date: 2026-11-18
Line 1: Archive box, quantity 6, unit price KES 320, line total KES 1,920
Line 2: Label roll, quantity 4, unit price KES 180, line total KES 720
Subtotal: KES 2,640
Tax: KES 0
Total due: KES 2,640

MODEL OUTPUT A
{"supplier":"Cedar Office Supply","invoice":"COS-8841","issueDate":"2026-11-04","dueDate":"2026-11-18","currency":"KES","subtotal":2640,"tax":0,"total":2640,"items":[{"name":"Archive box","quantity":6,"unitPrice":320,"lineTotal":1920},{"name":"Label roll","quantity":4,"unitPrice":180,"lineTotal":720}]}

MODEL OUTPUT B
{"supplier":"Cedar Office Supply","invoice":"COS-8841","issueDate":"2026-11-04","dueDate":"2026-11-14","currency":"KES","subtotal":2640,"tax":264,"total":2904,"items":[{"name":"Archive box","quantity":6,"unitPrice":320,"lineTotal":1920},{"name":"Label roll","quantity":4,"unitPrice":180,"lineTotal":720}]}

YOUR WORK
1. Choose the more accurate output.
2. List every field in the weaker output that disagrees with the invoice.
3. Return a corrected JSON object for the weaker output.
4. State one validation rule that would catch the errors.
5. Do not invent fields absent from the source.`,
    reviewGuide: `A is accurate. B has the wrong due date (2026-11-14 instead of 2026-11-18), invents tax of KES 264 instead of zero, and has an incorrect total of KES 2,904 instead of KES 2,640. Corrected JSON should preserve supplier, invoice, dates, KES, items, subtotal 2640, tax 0, total 2640. Good validation: sum line totals equals subtotal; subtotal + tax equals total; date fields must match source.`,
  },
  {
    id: "ai-training-policy-following-v1",
    title: "Score AI replies against a customer return policy",
    category: "AI Training",
    description: "Identify which response follows a fictional policy, stays within scope, and communicates the next step clearly.",
    estimatedMinutes: 21,
    assetUrl: null,
    instructions: `This original Lipwa AI-training task uses a fictional store policy and synthetic customer request.

POLICY
- Unused items may be returned within 14 calendar days of delivery.
- The customer must provide the order number.
- Opened software and customized items are not returnable.
- If an item arrived damaged, the customer should send a photo within 48 hours; support will review it.
- Do not promise a refund before the return is checked.

CUSTOMER
"My desk lamp arrived cracked yesterday. I do not have the order number in this chat. Can you refund me today?"

RESPONSE A
"I have processed a full refund. You do not need to send a photo or order number."

RESPONSE B
"I'm sorry the lamp arrived cracked. Please share the order number and a photo within 48 hours of delivery so support can review it. I can't promise a refund before that review, but I can help you submit the details."

YOUR WORK
1. Choose the better response and score both from 1–5 for policy accuracy, helpfulness, and clarity.
2. Identify each policy violation in the weaker response.
3. Suggest one improvement to the stronger response without adding a new policy.
4. Keep your evaluation grounded only in the text above.`,
    reviewGuide: `B is clearly stronger. A promises a refund before review and incorrectly waives the order number and damage photo. B requests the order number and photo and avoids promising a refund. A good improvement is to state the 48-hour window begins from delivery and offer a concise next step. Accept reasonable 1–5 scores if the written justification matches these facts.`,
  },
];

export function getTaskLibraryTemplate(id: string): TaskLibraryTemplate | undefined {
  return TASK_LIBRARY.find((template) => template.id === id);
}
