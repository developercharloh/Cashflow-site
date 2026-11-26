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
  {
    id: "academic-engineering-materials-summary-v1",
    title: "Engineering: revise a materials test summary",
    category: "Academic Writing",
    description: "Check a fictional materials report’s calculations, comparison, and limits before rewriting its summary.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `This is an original practice task using fictional laboratory data, not a graded assignment.

SOURCE NOTES
Three fictional specimens were tested using the same procedure:
- Specimen A: 18.4 MPa
- Specimen B: 21.1 MPa
- Specimen C: 19.5 MPa
- Reference value from a separate baseline set: 20.0 MPa
The report does not state that the specimens were randomly selected or that the baseline was tested on the same day.

DRAFT SUMMARY
"All three specimens exceeded the 20.0 MPa baseline. Their average strength was 19.7 MPa, proving that the new process consistently improves material performance."

YOUR WORK
1. Recalculate the mean and state which specimens are above or below the reference.
2. Identify every unsupported or contradictory claim in the draft.
3. Rewrite the summary in 80–120 words, preserving the data and its limitations.
4. List two details that a follow-up study should report.
5. Use only the supplied notes.`,
    reviewGuide: `Mean = (18.4 + 21.1 + 19.5) / 3 = 19.666..., normally reported as 19.7 MPa. Only B is above 20.0; A and C are below. The draft falsely says all three exceeded the baseline, and “proving,” “consistently,” and causal improvement are unsupported because sampling and same-day comparison are not established. Good rewrites preserve the small sample, distinguish the separate baseline, and avoid causal claims. Follow-up details may include selection method, repeat tests, uncertainty/variation, and comparable baseline conditions.`,
  },
  {
    id: "academic-engineering-energy-audit-v1",
    title: "Engineering: qualify an energy-audit conclusion",
    category: "Academic Writing",
    description: "Calculate a measured change and rewrite a fictional building-energy conclusion without overstating causation.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `This original practice task uses synthetic building-meter readings.

SOURCE
The same office recorded:
- Week 1 electricity use: 840 kWh
- Week 2 electricity use: 714 kWh
Week 2 also had milder weather and fewer occupied hours. No adjustment for weather or occupancy was performed.

DRAFT
"The new lighting system cut electricity use by 18% and will save every office the same amount."

YOUR WORK
1. Calculate the absolute and percentage change from Week 1 to Week 2.
2. Identify the draft’s calculation and inference problems.
3. Rewrite it in 70–110 words for a technical report.
4. Name three additional measurements or controls needed before attributing the change to lighting.
5. Do not introduce outside assumptions.`,
    reviewGuide: `Absolute decrease = 126 kWh. Percentage decrease = 126/840 = 15%, not 18%. The weeks differ in weather and occupied hours, and no controls were made, so the lighting system cannot be credited as the cause from these observations alone. The universal “every office” claim is unsupported. Strong rewrites call this an observed week-to-week decrease and state the confounders. Useful additions: occupancy hours, weather/cooling load, lighting operating hours, a longer baseline, or a comparison site.`,
  },
  {
    id: "academic-engineering-pump-efficiency-v1",
    title: "Engineering: correct a pump-test abstract",
    category: "Academic Writing",
    description: "Verify efficiency figures from a fictional pump test and edit claims to match the evidence.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `This task concerns a fictional bench test and is for technical-writing practice only.

TEST NOTES
Three runs recorded electrical input and useful hydraulic output:
- Run 1: input 1.20 kW; output 0.84 kW
- Run 2: input 1.18 kW; output 0.82 kW
- Run 3: input 1.22 kW; output 0.85 kW
Efficiency = output ÷ input × 100. No uncertainty interval or long-duration test was reported.

DRAFT ABSTRACT
"The pump achieved 75% efficiency in all runs and is proven to maintain this efficiency in continuous service."

YOUR WORK
1. Calculate each run’s efficiency to one decimal place and the mean.
2. Identify claims the notes do not support.
3. Rewrite the abstract in 80–120 words.
4. State two limitations that belong in the report.
5. Show enough arithmetic for an editor to verify your result.`,
    reviewGuide: `Run 1 = 70.0%; Run 2 = 69.5% (0.82/1.18 = 69.4915%); Run 3 = 69.7% (0.85/1.22 = 69.6721%). Mean is about 69.7%. The draft’s 75% is wrong, “all runs” is inaccurate, and continuous-service performance is not tested. Accept rounding to one decimal and a rewrite that limits conclusions to three bench runs. Limitations include small run count, no uncertainty, no continuous-duration test, and unspecified conditions.`,
  },
  {
    id: "academic-engineering-electrical-lab-v1",
    title: "Engineering: audit a low-voltage lab report",
    category: "Academic Writing",
    description: "Reconcile a fictional circuit’s stated voltage, resistance, current, and power before editing the results.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `This is a paper-based writing and calculation exercise using a fictional low-voltage setup.

OBSERVATIONS
- Supply: 12.0 V
- Resistor: 6.0 Ω
- Measured current: 1.96 A
- Measured resistor voltage: 11.8 V
For an ideal single resistor, use I = V/R and P = V×I. The measurements include ordinary rounding and instrument tolerance.

DRAFT
"The expected current was 1.5 A and the measured power was 18 W, confirming that the circuit exactly followed the ideal model."

YOUR WORK
1. Calculate ideal current and power using the supply voltage.
2. Calculate measured power using the measured resistor voltage and current.
3. Explain whether the measurement is reasonably close to the ideal calculation.
4. Rewrite the draft in 70–100 words without saying the model was followed exactly.
5. Identify one additional instrument detail needed for a stronger report.`,
    reviewGuide: `Ideal current = 12/6 = 2.0 A. Ideal power = 12×2 = 24 W. Measured power = 11.8×1.96 = 23.128 W, about 23.1 W. The draft’s 1.5 A and 18 W are incorrect; measured current is close to 2.0 A, but “exactly” ignores tolerances. A stronger report names meter resolution/accuracy or calibration and notes voltage measurement conditions.`,
  },
  {
    id: "academic-engineering-thermal-study-v1",
    title: "Engineering: summarize a thermal-cycle comparison",
    category: "Academic Writing",
    description: "Compute an observed energy change and distinguish a measured association from a tested cause.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `Use only the synthetic study notes below.

NOTES
A test chamber completed four cycles under each setting:
- Setting A: 5.0, 5.2, 4.9, 5.1 kWh
- Setting B: 4.2, 4.4, 4.1, 4.3 kWh
The chamber load was the same in the log. Run order was not randomized, and sensor calibration records were not included.

DRAFT
"Setting B reduced energy by 20% in every run because its improved insulation prevents heat loss."

YOUR WORK
1. Calculate each setting’s mean and the percentage reduction from A’s mean to B’s mean.
2. Explain what “in every run” gets wrong or leaves unclear.
3. Identify which causal explanation is not demonstrated by the notes.
4. Rewrite the result in 80–120 words, including at least two limitations.
5. Show your calculations.`,
    reviewGuide: `A mean = 5.05 kWh. B mean = 4.25 kWh. Reduction = 0.80/5.05 = about 15.8%, not 20%. “In every run” is unclear because the notes provide sets of cycles but do not pair or randomize runs; it should not imply each comparison showed exactly 20%. The insulation explanation is not established. Good answers report an observed average difference, mention four cycles per setting, non-random run order, and absent calibration records.`,
  },
  {
    id: "academic-engineering-quality-control-v1",
    title: "Engineering: edit a manufacturing quality note",
    category: "Academic Writing",
    description: "Check defect-rate arithmetic and revise a fictional process-improvement claim with appropriate caution.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `This original practice task uses a fictional production-line sample.

INSPECTION LOG
- Before adjustment: 18 nonconforming items among 240 inspected
- After adjustment: 11 nonconforming items among 220 inspected
- The samples came from different shifts; no random assignment or repeat period is documented.

DRAFT
"The adjustment eliminated 39% of defects and guarantees the line now meets specification."

YOUR WORK
1. Calculate each sample’s defect rate to one decimal place.
2. Calculate the relative decrease in the observed defect rate.
3. Explain why “eliminated” and “guarantees” are not accurate.
4. Rewrite the note in 80–110 words.
5. Recommend two pieces of evidence needed before a durable process claim.`,
    reviewGuide: `Before = 18/240 = 7.5%. After = 11/220 = 5.0%. Relative decrease = (7.5−5.0)/7.5 = 33.3%, not 39%. Defects remain, so “eliminated” is false. Different shifts and no repeat/randomized period mean causation and a guarantee of ongoing compliance are unsupported. Strong notes distinguish the observed rates from a process-wide conclusion. Evidence could include repeated samples across shifts, a longer observation window, sampling procedure, and specification limits.`,
  },
  {
    id: "academic-engineering-water-pilot-v1",
    title: "Engineering: report a water-filter pilot accurately",
    category: "Academic Writing",
    description: "Compare fictional inlet and outlet measurements while separating the measured sample from broad safety claims.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `This task uses synthetic data for writing practice; it is not operational water-treatment advice.

PILOT NOTES
Three paired turbidity readings (NTU):
- Pair 1: inlet 8.0, outlet 2.4
- Pair 2: inlet 7.5, outlet 2.7
- Pair 3: inlet 9.0, outlet 3.0
The pilot measured turbidity only. It did not test pathogens, chemical contaminants, or long-term filter performance.

DRAFT
"The filter makes the water safe to drink and removes 70% of all contaminants."

YOUR WORK
1. Calculate the turbidity reduction for each pair and the mean percentage reduction.
2. Identify the scope error in the draft.
3. Write a 90–130 word pilot summary.
4. State three follow-up measurements the pilot would need before making broader claims.
5. Use no external safety standards.`,
    reviewGuide: `Pair reductions: 70%, 64%, and 66.7%. Mean reduction is about 66.9%. The data only concern turbidity; they do not support “safe to drink” or removal of all contaminants. A strong summary reports the three paired observations and explicitly says other contaminant types and long-term performance were not measured. Follow-ups may include additional water-quality measurements, more samples, longer operation, and controlled sampling; do not invent specific legal thresholds.`,
  },
  {
    id: "academic-engineering-transport-sensor-v1",
    title: "Engineering: review a transport-sensor results paragraph",
    category: "Academic Writing",
    description: "Reconcile a fictional traffic sensor summary and avoid turning one-day observations into a citywide conclusion.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `This is an original practice task with synthetic, non-operational traffic counts.

COUNTS
At one fictional junction on one Tuesday:
- 08:00–09:00: sensor 1 = 124 vehicles; manual tally = 120
- 12:00–13:00: sensor 1 = 88 vehicles; manual tally = 92
- 17:00–18:00: sensor 1 = 151 vehicles; manual tally = 146
No other dates or junctions were sampled.

DRAFT
"The sensor was always within 2% of the manual count and proves traffic is highest at 5 p.m. throughout the city."

YOUR WORK
1. Calculate absolute and percentage difference for each time block, using the manual tally as denominator.
2. Identify which statements are unsupported or numerically wrong.
3. Rewrite the results in 80–120 words.
4. Name two study-design changes needed to support a citywide or time-of-day claim.`,
    reviewGuide: `Differences: 4/120 = 3.3%; 4/92 = 4.35%; 5/146 = 3.42%. None is within 2%. The largest count among the three sampled windows is 17:00–18:00, but one day at one junction cannot prove a citywide pattern. A strong rewrite reports the observations and limits the conclusion to the sampled site/date/windows. More dates, junctions, and a prespecified sampling design would help.`,
  },
  {
    id: "academic-computer-science-benchmark-v1",
    title: "Computer science: audit an algorithm benchmark claim",
    category: "Academic Writing",
    description: "Interpret synthetic runtime data, calculate scaling ratios, and rewrite a complexity claim with evidence limits.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `This original practice task uses fictional benchmark results, not a coding assignment.

BENCHMARK
Input size n | Median runtime
1,000 | 10 ms
2,000 | 22 ms
4,000 | 48 ms
8,000 | 103 ms
The test used one machine and one recorded run per input size. No source code or hardware details are supplied.

DRAFT
"The algorithm is exactly O(n log n), and the result proves it will be fastest on every system."

YOUR WORK
1. Calculate the runtime multiplier each time input size doubles.
2. State whether these measurements prove an exact asymptotic complexity.
3. Identify the unsupported cross-system claim.
4. Rewrite the paragraph in 90–130 words for a research report.
5. List at least three reproducibility details to request.`,
    reviewGuide: `Doubling multipliers: 2.2, about 2.18, about 2.15. The data show roughly proportional-to-slightly-above-doubling growth over these measured sizes, but a small benchmark with one run cannot prove exact asymptotic complexity. “Fastest on every system” is unsupported. Good rewrites describe observed scaling without claiming proof. Reproducibility details can include hardware/OS, implementation and compiler/runtime version, warm-up and repetition method, input generation, and timing procedure.`,
  },
  {
    id: "academic-computer-science-coverage-claims-v1",
    title: "Computer science: correct a software-testing summary",
    category: "Academic Writing",
    description: "Check test metrics and rewrite a fictional report that confuses coverage with proof of correctness.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `Use only this fictional test report.

REPORT DATA
- 120 automated tests ran; 114 passed and 6 failed.
- Statement coverage: 84%
- Branch coverage: 52%
- The report lists no property-based tests or independent review.

DRAFT SUMMARY
"All tests passed, every execution path is verified, and the software is defect-free."

YOUR WORK
1. Identify each mismatch between the draft and the report.
2. Calculate the test pass rate.
3. Explain in plain language what the two coverage percentages do and do not establish.
4. Rewrite the summary in 80–120 words.
5. Suggest three follow-up checks without claiming they guarantee defect-free software.`,
    reviewGuide: `114/120 = 95% passed; six failed. The draft says all passed, overstates 84% statement coverage and 52% branch coverage as every path verified, and claims defect-free software without evidence. Coverage describes which measured code elements ran during tests, not whether all behavior is correct. Strong follow-ups include investigating failures, adding tests for uncovered branches, testing edge cases, independent review, and repeating checks in a documented environment.`,
  },
  {
    id: "academic-computer-science-classification-metrics-v1",
    title: "Computer science: verify a model-evaluation paragraph",
    category: "Academic Writing",
    description: "Calculate accuracy, precision, and recall from a fictional confusion matrix and correct a misleading summary.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `This is an original data-interpretation task using fictional model results.

CONFUSION MATRIX
- True positives: 72
- False positives: 18
- False negatives: 8
- True negatives: 102

DRAFT
"The classifier has 90% accuracy, 90% precision, and 80% recall, so it is equally reliable for every class."

YOUR WORK
1. Calculate accuracy, precision, and recall as percentages to one decimal place.
2. Identify every incorrect or unsupported statement.
3. Rewrite the result in 80–120 words, defining the metrics briefly.
4. Name two additional checks that would help assess performance across groups or data conditions.
5. Show formulas and calculations.`,
    reviewGuide: `Total = 200. Accuracy = (72+102)/200 = 87.0%. Precision = 72/(72+18) = 80.0%. Recall = 72/(72+8) = 90.0%. The draft’s first two numbers are wrong. Equal reliability across every class is not established by these aggregate counts; metrics shown are for the positive class and no subgroup or condition analysis is given. Additional checks may include class-specific metrics, subgroup breakdowns where appropriate, a held-out test set, and confusion matrices for relevant conditions.`,
  },
  {
    id: "academic-computer-science-database-normalization-v1",
    title: "Computer science: edit a data-modeling research note",
    category: "Academic Writing",
    description: "Find update anomalies in a fictional flat table and present a clearer relational design with assumptions.",
    estimatedMinutes: 26,
    assetUrl: null,
    instructions: `This task uses a fictional library-loan dataset and focuses on technical explanation, not database software.

FLAT TABLE FIELDS
LoanID, MemberID, MemberName, BookID, BookTitle, AuthorName, CheckoutDate, DueDate
Each row is one loan. A member may borrow many books; a book may be borrowed by many members over time. The same member and book names repeat in multiple rows.

DRAFT
"MemberID uniquely identifies each row, and book titles should be copied into every loan so updates stay consistent."

YOUR WORK
1. Explain why MemberID does not uniquely identify a loan row.
2. Propose a concise set of tables and primary/foreign keys.
3. Identify one update anomaly the flat table can cause.
4. Rewrite the draft in 100–150 words for an academic methods note.
5. State one assumption your design makes.`,
    reviewGuide: `LoanID is the row identifier as described; MemberID repeats when a member has multiple loans, so it cannot uniquely identify each loan. A reasonable design separates Members(MemberID, MemberName), Books(BookID, BookTitle, AuthorName) and Loans(LoanID, MemberID, BookID, CheckoutDate, DueDate), with foreign keys from Loans. Repeating names can create inconsistent updates, e.g. a title corrected in some rows but not others. Accept equivalent schemas that handle the many-to-many history. Assumptions may include one copy/loan item per loan row and stable identifiers.`,
  },
  {
    id: "academic-computer-science-api-docs-v1",
    title: "Computer science: reconcile API documentation with behavior",
    category: "Academic Writing",
    description: "Turn fictional endpoint notes into a precise, consistent API reference and flag missing contract details.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `This is a documentation-quality task; it does not ask you to probe or access any real service.

BEHAVIOR NOTES FOR A FICTIONAL SERVICE
- GET /reports accepts optional from and to dates in YYYY-MM-DD format.
- If both are present, from must be on or before to.
- A successful response returns { "items": [...], "nextCursor": string or null }.
- Invalid date format returns 400 with { "error": "invalid_date" }.
- The notes do not say whether the end date is inclusive, the timezone, or the maximum date range.

DRAFT DOC
"Call GET /reports?from=...&to=... to get a list. Dates are flexible. It always returns data."

YOUR WORK
1. Rewrite the doc in 100–150 words using only confirmed behavior.
2. Specify the success and error response shapes.
3. List the missing contract decisions that should be clarified.
4. Do not invent authentication, sorting, or pagination behavior beyond nextCursor.`,
    reviewGuide: `A correct rewrite names the optional YYYY-MM-DD parameters, ordering rule, success shape with items and nextCursor, and 400 invalid_date response. It must not say dates are flexible or that it always returns data. Missing details include inclusivity of to, timezone interpretation, maximum range, cursor continuation semantics, and whether an empty result returns an empty items array. Do not add undocumented authentication or ordering claims.`,
  },
  {
    id: "academic-computer-science-reproducibility-v1",
    title: "Computer science: strengthen an experiment’s reproducibility note",
    category: "Academic Writing",
    description: "Separate reported setup details from omissions in a fictional software experiment and rewrite its methods note.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `Use only the fictional experiment description below.

METHODS DRAFT
"We compared two text-processing libraries on the same dataset. Library A was faster, so it is recommended for all users."

KNOWN DETAILS
- Dataset: 10,000 synthetic records generated from a fixed seed of 17
- Each library was run once
- Machine model, operating system, library versions, warm-up procedure, and exact timing method are not recorded
- Only total elapsed time was saved; no memory use or error rate was measured

YOUR WORK
1. Identify what the known details do establish and what they do not.
2. Rewrite the methods/conclusion in 100–140 words.
3. List five concrete reproducibility or evaluation details to record next time.
4. Avoid recommending one library for all users based on this evidence.`,
    reviewGuide: `The dataset size and fixed seed are known, but single runs and missing environment/version/timing details limit reproducibility and comparison. No memory or error-rate evidence exists. The broad recommendation is unsupported. Strong rewrites describe a one-run elapsed-time comparison on synthetic data and state limits. Good follow-up details include hardware, OS, library versions, warm-up, repeated trials/statistics, exact timer, dataset generation, correctness checks, memory use, and representative workloads.`,
  },
  {
    id: "academic-computer-science-queue-latency-v1",
    title: "Computer science: interpret a queue-latency table",
    category: "Academic Writing",
    description: "Calculate summary statistics from a fictional service queue and revise a claim that confuses average and tail latency.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `This original task uses synthetic timings and does not involve a live service.

LATENCY SAMPLE (milliseconds)
18, 20, 21, 23, 24, 25, 28, 31, 34, 76

DRAFT
"The queue responds in 20 ms, and all requests finish in under 35 ms."

YOUR WORK
1. Calculate the mean and median.
2. Count observations over 35 ms and report the maximum.
3. Explain why the draft is misleading.
4. Rewrite the result in 80–120 words, including the sample size and a suitable limitation.
5. Do not infer production-wide performance from this sample.`,
    reviewGuide: `Sum is 300 ms, so mean = 30 ms. Median = (24+25)/2 = 24.5 ms. One observation is over 35 ms (76 ms), so “all under 35 ms” is false. The draft’s 20 ms does not match mean or median. Strong answers report n=10, both statistics, and maximum 76 ms; they note this small synthetic sample does not establish production-wide behavior or a percentile estimate.`,
  },
  {
    id: "academic-computer-science-algorithm-edge-cases-v1",
    title: "Computer science: review an algorithm explanation for edge cases",
    category: "Academic Writing",
    description: "Check a fictional median-finding pseudocode description against examples and rewrite its limitations clearly.",
    estimatedMinutes: 26,
    assetUrl: null,
    instructions: `This is a pseudocode explanation review, not a request to write a graded program.

PROPOSED METHOD
1. Sort the numeric list.
2. Return the item at index floor(n/2).

AUTHOR’S CLAIM
"This returns the median for every list, including even-length lists, empty lists, and lists with repeated values."

YOUR WORK
1. Test the method on [2, 8, 10] and [2, 8, 10, 12].
2. Explain the empty-list problem.
3. Explain whether repeated values create a problem for this method.
4. Write a corrected 90–130 word explanation of what the method returns and what must be added for the conventional median on even-length lists.
5. Do not assume a programming language’s indexing behavior beyond zero-based indexing stated here.`,
    reviewGuide: `For [2,8,10], n=3 and index floor(1.5)=1, returning 8, the median. For [2,8,10,12], n=4 and index 2 returns 10, the upper middle value; the conventional median is (8+10)/2=9. Empty input has no element to return and needs explicit handling. Repeated values are fine for sorting and median selection. Good explanations describe odd/even behavior and state that empty input needs a defined error or result.`,
  },
  {
    id: "data-entry-multi-invoice-reconciliation-v1",
    title: "Reconcile a multi-line synthetic invoice register",
    category: "Data Entry",
    description: "Normalize invoice rows, verify line arithmetic, and flag mismatched totals across a fictional register.",
    estimatedMinutes: 25,
    assetUrl: null,
    instructions: `Use the fictional invoice rows below. Create a clean table with Invoice ID, supplier, date, line total, and status.

SOURCE ROWS
INV-301 | North Paper | 2026-10-04 | 5 folders × $3.20 | listed total $16.00
INV-301 | North Paper | 2026-10-04 | 2 pens × $1.50 | listed total $3.00
INV-302 | Cedar Desk | 2026-10-05 | 3 lamps × $18.00 | listed total $54.00
INV-302 | Cedar Desk | 2026-10-05 | 1 cable × $7.25 | listed total $7.52
INV-303 | North Paper | 2026-10-06 | 4 pads × $2.10 | listed total $8.40

YOUR WORK
1. Preserve each source row and standardize money to two decimals.
2. Recalculate every line total.
3. Group the rows by invoice and calculate the corrected invoice totals.
4. Flag any source mismatch without silently overwriting it.
5. Return the table and a short exception note.`,
    reviewGuide: `INV-301 rows are correct; total $19.00. INV-302 cable is incorrect: 1×$7.25 = $7.25, not $7.52; corrected invoice total is $61.25. INV-303 total is $8.40. Strong output preserves the source value in the note or a separate listed-total column, shows the corrected value, and flags only the cable mismatch. Supplier/date should remain as supplied.`,
  },
  {
    id: "data-entry-inventory-unit-conversion-v1",
    title: "Normalize inventory records with mixed units",
    category: "Data Entry",
    description: "Standardize fictional stock records, convert compatible units, and retain traceable source values.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `Convert only the supplied compatible units and retain a source-value column.

RECORDS
P-14 | wire spool | 3.5 kg | unit cost $8.00/kg | reorder point 4,000 g
P-15 | resin pack | 2,400 g | unit cost $0.012/g | reorder point 3 kg
P-16 | bolt box | 6 boxes | unit cost $12.50/box | reorder point 5 boxes
P-17 | coating | 1.25 L | unit cost $4.40/L | reorder point 1,000 mL

YOUR WORK
1. Create a normalized table with item ID, item, quantity, normalized unit, unit cost, reorder threshold, and reorder flag.
2. Convert kg↔g and L↔mL where needed.
3. Calculate each extended stock value.
4. Flag items at or below reorder point.
5. Do not convert boxes into individual bolts; no pack size is supplied.`,
    reviewGuide: `P-14 = 3,500 g, threshold 4,000 g, value $28.00, reorder. P-15 = 2.4 kg, threshold 3 kg, value $28.80, reorder. P-16 = 6 boxes vs 5, value $75.00, no reorder. P-17 = 1,250 mL vs 1,000 mL, value $5.50, no reorder. Preserve units and do not infer bolts per box.`,
  },
  {
    id: "data-entry-schedule-conflict-audit-v1",
    title: "Audit a schedule register for duplicate bookings",
    category: "Data Entry",
    description: "Standardize fictional room bookings, identify overlaps, and distinguish conflicts from adjacent sessions.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `Use the booking register below. Times are local and same-day.

ROWS
R-11 | Cedar Room | 09:00–10:30 | Maya | Project review
R-12 | Cedar Room | 10:30–11:15 | Lee | Interview
R-13 | Cedar Room | 10:15–11:00 | Nia | Training
R-14 | Maple Room | 09:30–10:30 | Omar | Planning
R-15 | Maple Room | 10:30–11:00 | Priya | Follow-up
R-16 | Cedar Room | 09:00–10:30 | Maya | Project review

YOUR WORK
1. Return a clean table sorted by room and start time.
2. Identify exact duplicate rows.
3. Identify true same-room time overlaps; treat an end time equal to another start time as adjacent, not overlapping.
4. Suggest a correction queue without deleting or changing source records.
5. State the duplicate/overlap rules used.`,
    reviewGuide: `R-11 and R-16 are exact duplicates. R-12 and R-13 overlap in Cedar Room from 10:15 to 10:30. R-11 overlaps R-13 from 10:15 to 10:30 as well. R-11 ends at 10:30 and R-12 begins at 10:30, so those are adjacent. R-14/R-15 are adjacent, not overlapping. The correction queue should preserve IDs and flag duplicate/overlap rather than silently delete. Sorting may place Cedar rows first and then Maple.`,
  },
  {
    id: "data-entry-customer-record-dedup-v1",
    title: "Deduplicate a fictional customer contact list",
    category: "Data Entry",
    description: "Standardize names and email casing, distinguish exact duplicates from possible matches, and preserve audit notes.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `Prepare a cleaned review table. Do not merge records solely because names look similar.

SOURCE
C-101 | Amina Otieno | AMINA@EXAMPLE.TEST | 0712 345 678
C-102 | Amina Otieno | amina@example.test | 0712-345-678
C-103 | Amina O. | amina.o@example.test | 0712 345 678
C-104 | Brian Kamau | brian@example.test | 0700 111 222
C-105 | Brian Kamau | brian.k@example.test | 0700 111 222

YOUR WORK
1. Normalize email to lowercase and phone numbers to digits only in separate clean columns.
2. Identify exact duplicate contact signals and possible matches.
3. Recommend which pairs need human review, without asserting identity when evidence is incomplete.
4. Preserve every source ID and write a short audit note.
5. Return valid CSV with a header row.`,
    reviewGuide: `C-101/C-102 match on normalized name, email, and phone and are strong duplicate candidates; keep both source IDs and recommend a reviewed merge. C-103 shares phone and similar name but has a different email and abbreviated name, so it is a possible match requiring human review, not an automatic merge. C-104/C-105 share name/phone but differ in email, so flag for review. Clean phones: 0712345678 and 0700111222. Email lowercase. Valid CSV needs quoting if commas appear in notes.`,
  },
  {
    id: "ai-training-citation-evidence-check-v1",
    title: "Evaluate AI citations against a supplied source",
    category: "AI Training",
    description: "Check whether a fictional AI answer’s citations actually support each claim and score evidence use.",
    estimatedMinutes: 24,
    assetUrl: null,
    instructions: `This original evaluation task uses fictional sources and responses. Do not search the web.

SOURCE A
"In a four-week trial, 24 participants used the planner. The study recorded task completion, but did not measure stress."

SOURCE B
"A separate survey of 60 respondents asked whether they preferred paper or digital reminders. It did not track task completion."

AI ANSWER
"A four-week trial of 24 people found that digital planners reduced stress and improved task completion (Source A). A survey of 60 people confirmed that digital reminders increase completion (Source B)."

YOUR WORK
1. Mark each answer claim as supported, contradicted, or not measured.
2. Explain whether the cited source supports the wording attached to it.
3. Rewrite the answer using only supported statements.
4. Score citation accuracy and factual accuracy from 1–5 with reasons.`,
    reviewGuide: `Source A supports a four-week trial, 24 participants, and that task completion was recorded, but gives no result and does not measure stress. Source B supports a preference survey with 60 respondents, but not task completion or an increase. Claims that stress was reduced and completion improved/increased are unsupported; the answer overstates both sources. A careful rewrite says the trial tracked completion but the provided excerpt has no outcome, while the survey asked about preference only.`,
  },
  {
    id: "ai-training-contradiction-detection-v1",
    title: "Find contradictions in a fictional AI project summary",
    category: "AI Training",
    description: "Compare an AI-generated project recap with meeting notes and identify omissions, conflicts, and invented decisions.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `Use only these synthetic meeting notes.

MEETING NOTES
- Pilot starts 12 May and runs for three weeks.
- Team will review results on 4 June.
- The mobile version is optional; the paper form remains available.
- No budget decision was made.
- Priya will draft a participant checklist by 8 May.

AI SUMMARY
"The pilot starts on 12 May for four weeks. The team approved a $5,000 budget, will use only the mobile version, and will meet on 4 June. Priya will finish the checklist on 10 May."

YOUR WORK
1. Create a claim-by-claim table marked accurate, inaccurate, or invented.
2. Correct every inaccurate date or duration.
3. Identify omitted details needed to avoid changing the decision.
4. Write a corrected summary in 70–100 words.
5. Do not fill in decisions that the notes do not contain.`,
    reviewGuide: `12 May start and 4 June review are accurate. Four weeks is wrong; the pilot is three weeks. $5,000 budget is invented. “Only mobile” is wrong; mobile is optional and paper remains. Checklist due date is wrong: 8 May, not 10 May. The summary omits continued paper availability and the lack of a budget decision. Good corrected text preserves these points and avoids adding details.`,
  },
  {
    id: "ai-training-structured-data-validation-v1",
    title: "Validate AI extraction from a fictional shipping notice",
    category: "AI Training",
    description: "Compare two structured outputs with a synthetic source, repair field errors, and propose validation checks.",
    estimatedMinutes: 23,
    assetUrl: null,
    instructions: `SOURCE NOTICE
Reference: SH-702
Dispatch date: 2026-10-13
Carrier: Pine Route
Packages: 3
Destination: Dock 4
Status: Delayed — weather review

OUTPUT A
{"reference":"SH-702","dispatchDate":"2026-10-13","carrier":"Pine Route","packages":3,"destination":"Dock 4","status":"Delayed — weather review"}

OUTPUT B
{"reference":"SH-702","dispatchDate":"2026-10-14","carrier":"Pine Route Express","packages":"three","destination":"Dock 2","status":"Delivered"}

YOUR WORK
1. Rank the outputs for source fidelity.
2. List each field in B that is wrong or formatted inconsistently.
3. Return a corrected JSON object with the same field names.
4. Propose three validation checks that do not invent missing information.
5. Do not add recipient names or tracking numbers.`,
    reviewGuide: `A matches the source. B has the wrong date, carrier name, destination, and status; packages is a string rather than the numeric source count. Correct JSON: {"reference":"SH-702","dispatchDate":"2026-10-13","carrier":"Pine Route","packages":3,"destination":"Dock 4","status":"Delayed — weather review"}. Useful checks include date format and exact source match, numeric package count, required field set, and status enumeration grounded in the source.`,
  },
  {
    id: "ai-training-policy-scope-comparison-v1",
    title: "Score AI replies against a fictional service policy",
    category: "AI Training",
    description: "Evaluate policy accuracy, empathy, and next steps in two responses without rewarding unsupported promises.",
    estimatedMinutes: 22,
    assetUrl: null,
    instructions: `POLICY
- A replacement may be requested within 10 days of delivery.
- The customer must provide the order reference and a photo of the damaged item.
- Support reviews the request within two business days.
- Do not promise approval before review.

CUSTOMER
"My mug arrived chipped today. Can you send another one by tomorrow?"

RESPONSE A
"Your replacement is approved and will arrive tomorrow. No photo is needed."

RESPONSE B
"I’m sorry it arrived chipped. Please share your order reference and a photo. Support will review the request within two business days; I can’t confirm approval or delivery timing yet."

YOUR WORK
1. Score both replies from 1–5 for policy accuracy, clarity, and helpfulness.
2. Identify each policy violation or unsupported promise.
3. Suggest one concise improvement to the better reply without changing the policy.
4. Explain your scores using the supplied text only.`,
    reviewGuide: `B is stronger: it requests the required order reference and photo, gives the two-business-day review window, and does not guarantee approval or delivery. A promises approval and next-day delivery and waives the photo requirement. Scores may vary if the reasoning is consistent. A useful improvement can ask the customer to send the details in the support thread, without promising more.`,
  },
  {
    id: "ai-training-ambiguity-ranking-v1",
    title: "Rank AI answers for handling ambiguous instructions",
    category: "AI Training",
    description: "Compare fictional AI responses for accuracy, uncertainty handling, and whether they ask the right clarification.",
    estimatedMinutes: 21,
    assetUrl: null,
    instructions: `REQUEST
"Please schedule the review for next Friday afternoon and invite Jordan."

CONTEXT
The current date is not provided. There are two contacts named Jordan. No timezone or meeting duration is given.

RESPONSE A
"Scheduled for Friday at 3:00 p.m. with Jordan Lee for one hour."

RESPONSE B
"I need the date for ‘next Friday,’ which Jordan to invite, the timezone, and the meeting duration before I can schedule it."

YOUR WORK
1. Rank the responses for safe and accurate handling.
2. Identify every assumption in A.
3. Explain whether B asks for enough information and whether anything can be done before clarification.
4. Rewrite a concise response that is helpful but does not claim the meeting was scheduled.
5. Do not invent calendar details.`,
    reviewGuide: `B is better because the date reference, contact identity, timezone, and duration are unresolved. A invents 3 p.m., Jordan Lee, and one hour, and claims scheduling occurred. A good rewrite asks for missing details in plain language; it may offer to prepare the invitation after they are supplied but must not claim it is scheduled.`,
  },
];

export function getTaskLibraryTemplate(id: string): TaskLibraryTemplate | undefined {
  return TASK_LIBRARY.find((template) => template.id === id);
}
