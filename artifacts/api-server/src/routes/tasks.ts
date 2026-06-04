import { Router } from "express";
import { db, usersTable, tasksTable, userTasksTable, transactionsTable, notificationsTable, taskAttemptsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";
import { getRandomQuestions, CATEGORY_DESCRIPTIONS, QUESTION_BANK } from "../lib/questionBank";

const router = Router();

// ─── Task generation (34 topics × 3 tiers × 9 categories = 918 tasks) ─────────

type TaskSeed = {
  title: string; description: string; category: string;
  reward: number; estimatedMinutes: number; timeLimitSeconds: number;
  difficulty: string; minLevel: number; questionCount: number; cooldownHours: number;
};

const TIERS = [
  { suffix: "Fundamentals", difficulty: "easy",   reward: 0.12, qCount: 10, timeLimit: 600, minLevel: 1, cooldown: 24 },
  { suffix: "Applied",      difficulty: "medium",  reward: 0.28, qCount: 10, timeLimit: 600, minLevel: 1, cooldown: 24 },
  { suffix: "Expert",       difficulty: "hard",    reward: 0.50, qCount: 10, timeLimit: 660, minLevel: 2, cooldown: 48 },
];

function mkTasks(category: string, topics: Array<[string, string]>): TaskSeed[] {
  return topics.flatMap(([title, desc]) =>
    TIERS.map(t => ({
      title: `${title}: ${t.suffix}`,
      description: desc,
      category,
      reward: t.reward,
      estimatedMinutes: Math.round(t.timeLimit / 60),
      timeLimitSeconds: t.timeLimit,
      difficulty: t.difficulty,
      minLevel: t.minLevel,
      questionCount: t.qCount,
      cooldownHours: t.cooldown,
    }))
  );
}

const TASK_SEEDS: TaskSeed[] = [
  ...mkTasks("Data Categorization", [
    ["Customer Record Sorting", "Sort customer records into correct data classifications."],
    ["Financial Data Classification", "Classify financial transactions and accounting records."],
    ["Medical Record Classification", "Categorize healthcare data into proper medical record types."],
    ["Legal Document Sorting", "Distinguish between types of legal and compliance documents."],
    ["E-commerce Product Classification", "Assign products to the correct retail category taxonomy."],
    ["Social Media Content Tagging", "Tag social posts by content type, topic, and format."],
    ["Email Classification", "Sort emails into organizational folders by type and urgency."],
    ["News Article Categorization", "Assign news articles to correct topic sections and tags."],
    ["Scientific Literature Sorting", "Classify research papers by domain, methodology, and type."],
    ["Geographic Data Classification", "Categorize geographic datasets by region and data type."],
    ["Time Series Data Labeling", "Identify and classify trends in structured time series data."],
    ["Multimedia Content Classification", "Categorize images, video, and audio by content type."],
    ["Employee Record Classification", "Sort HR records into correct personnel data categories."],
    ["Government Document Categorization", "Classify government and public sector documents by type."],
    ["Insurance Claim Classification", "Sort insurance claims by category, type, and risk level."],
    ["Educational Material Sorting", "Classify learning resources by subject, level, and format."],
    ["Inventory Data Classification", "Categorize inventory items into supply chain data segments."],
    ["Environmental Data Sorting", "Classify environmental sensor readings and measurements."],
    ["Customer Feedback Classification", "Sort customer feedback by topic, sentiment, and urgency."],
    ["Security Incident Classification", "Categorize cybersecurity incidents by type and severity."],
    ["Logistics Data Categorization", "Sort shipment and logistics data into operational classes."],
    ["Tax Document Sorting", "Classify tax documents by filing type and fiscal category."],
    ["Real Estate Data Classification", "Categorize property listings by type, location, and status."],
    ["Sports Statistics Classification", "Sort sports data records into correct statistical categories."],
    ["Agricultural Data Sorting", "Classify crop and farm data by type and growing condition."],
    ["Telecommunications Data Classification", "Sort telecom usage records into service categories."],
    ["Energy Consumption Classification", "Classify energy usage data by source and consumption type."],
    ["Transportation Data Sorting", "Categorize transport records by mode, route, and purpose."],
    ["Research Data Classification", "Sort academic research datasets by type and methodology."],
    ["Marketing Data Categorization", "Classify marketing campaign data by channel and objective."],
    ["Supply Chain Record Sorting", "Categorize procurement and supply chain transaction records."],
    ["Banking Transaction Classification", "Sort financial transactions into banking account categories."],
    ["Entertainment Content Classification", "Categorize media content by genre, format, and audience."],
    ["Healthcare Claims Classification", "Classify medical billing codes and insurance claim types."],
  ]),
  ...mkTasks("Text Annotation", [
    ["Sentiment Analysis", "Label text with correct positive, negative, or neutral sentiment."],
    ["Named Entity Recognition", "Identify people, organizations, and locations in text."],
    ["Intent Classification", "Annotate messages with their underlying user intent."],
    ["Emotion Detection", "Identify emotional states expressed in written customer feedback."],
    ["Toxic Content Labeling", "Flag harmful, offensive, or policy-violating text content."],
    ["Topic Tagging", "Assign correct topic tags to articles and written passages."],
    ["Language Identification", "Identify the language and dialect of written text samples."],
    ["Spam Detection", "Label messages as legitimate or spam based on text signals."],
    ["Readability Assessment", "Rate text passages on reading level and comprehension difficulty."],
    ["Coreference Resolution", "Identify which pronouns and phrases refer to the same entity."],
    ["Syntactic Parsing Labels", "Assign correct grammatical function labels to sentence components."],
    ["Discourse Relation Labeling", "Label the logical relationship between adjacent text segments."],
    ["Keyword Extraction", "Identify the most relevant keywords in a document passage."],
    ["Text Summarization Quality", "Evaluate whether a summary correctly captures source text."],
    ["Question-Answer Pair Validation", "Validate that Q&A pairs correctly match source passages."],
    ["Paraphrase Detection", "Determine whether two text passages express the same meaning."],
    ["Claim Verification Labeling", "Label factual claims as supported, refuted, or unverified."],
    ["Dialogue Act Classification", "Classify conversational turns by speech act and function."],
    ["Code-Switching Detection", "Identify language switching in multilingual text samples."],
    ["Irony and Sarcasm Detection", "Label text containing irony, sarcasm, or figurative language."],
    ["Relation Extraction", "Identify relationships between named entities in text passages."],
    ["Event Detection Labeling", "Identify and classify event mentions in news and reports."],
    ["Aspect-Based Sentiment", "Label sentiment toward specific product or service aspects."],
    ["Text Category Boundary", "Mark the boundaries of topic shifts in long-form documents."],
    ["Argument Structure Labeling", "Identify claims, premises, and conclusions in argumentative text."],
    ["Polarity Shift Annotation", "Identify where sentiment polarity changes within a passage."],
    ["Cross-Sentence Coherence", "Label whether consecutive sentences maintain logical coherence."],
    ["Abbreviation Expansion", "Match abbreviated terms with their full forms in context."],
    ["Temporal Expression Labeling", "Identify and classify time and date expressions in text."],
    ["Negation Scope Annotation", "Mark the scope of negation operators in written sentences."],
    ["Hedging Language Detection", "Identify speculative or uncertain language in scientific text."],
    ["Style and Register Labeling", "Classify text by formality, style, and intended audience."],
    ["Multiword Expression Labeling", "Identify fixed phrases, idioms, and multi-word expressions."],
    ["Semantic Role Labeling", "Assign correct semantic roles to sentence constituents."],
  ]),
  ...mkTasks("Questionnaires", [
    ["Survey Design Principles", "Apply questionnaire design principles to validate survey structures."],
    ["Bias Detection", "Identify leading, double-barreled, and loaded survey questions."],
    ["Scale Measurement Methods", "Select appropriate rating scales for survey measurement goals."],
    ["Sampling Strategy Selection", "Choose the correct sampling method for a given study design."],
    ["Validity Assessment", "Evaluate whether survey questions measure their intended constructs."],
    ["Reliability Concepts", "Apply test-retest, split-half, and internal consistency concepts."],
    ["Survey Flow Design", "Identify correct question ordering to minimize order bias."],
    ["Open vs Closed Questions", "Determine when to use open-ended vs closed-ended questions."],
    ["Response Rate Optimization", "Identify techniques to improve survey response rates."],
    ["Survey Ethics and Consent", "Apply ethical principles including informed consent in surveys."],
    ["Cross-Cultural Survey Adaptation", "Identify adjustments needed for culturally sensitive questions."],
    ["Likert Scale Interpretation", "Correctly interpret and use Likert scale response data."],
    ["Survey Pilot Testing", "Identify the purpose and correct process for survey piloting."],
    ["Item Non-Response Handling", "Apply strategies for managing missing data in surveys."],
    ["Mode Effect Analysis", "Assess how survey delivery mode affects response accuracy."],
    ["Interviewer Effect Mitigation", "Identify techniques to reduce interviewer-introduced bias."],
    ["Panel Survey Design", "Apply longitudinal panel design principles to repeated surveys."],
    ["Exit Survey Principles", "Design and evaluate exit surveys for accuracy and completeness."],
    ["Net Promoter Score Design", "Apply NPS methodology correctly to customer feedback surveys."],
    ["Conjoint Analysis Concepts", "Understand trade-off questions used in conjoint analysis surveys."],
    ["Randomized Response Technique", "Apply techniques for collecting sensitive survey information."],
    ["Survey Localization", "Adapt questionnaire language for regional and linguistic accuracy."],
    ["Question Branching Logic", "Evaluate whether skip logic is correctly applied in surveys."],
    ["Demographic Question Design", "Select appropriate demographic question formats and categories."],
    ["Health Survey Methodology", "Apply validated health survey instruments and scoring rules."],
    ["Political Survey Design", "Identify standards for unbiased political and opinion surveys."],
    ["Academic Research Surveys", "Apply IRB and academic ethics standards to research surveys."],
    ["Employee Engagement Surveys", "Design employee surveys with proper anonymity and clarity."],
    ["Customer Satisfaction Metrics", "Select correct CSAT, CES, and NPS measurement methods."],
    ["Survey Data Weighting", "Apply weighting methods to correct for non-representative samples."],
    ["Online Survey Platform Design", "Identify best practices for digital survey platform setup."],
    ["Survey Completion Rate Analysis", "Diagnose and address low completion rates in survey data."],
    ["Cognitive Interview Techniques", "Apply cognitive interviewing to pre-test survey questions."],
    ["Mixed Methods Survey Design", "Combine quantitative and qualitative approaches in surveys."],
  ]),
  ...mkTasks("AI Training Tasks", [
    ["Image Labeling Concepts", "Apply correct AI training data labeling for computer vision."],
    ["Machine Learning Data Quality", "Assess training data issues including label noise and bias."],
    ["NLP Model Training", "Demonstrate knowledge of NLP training data requirements."],
    ["RLHF Feedback Collection", "Apply reinforcement learning from human feedback principles."],
    ["Object Detection Labeling", "Identify correct bounding box and segmentation labeling standards."],
    ["Data Augmentation Methods", "Select appropriate augmentation strategies for training datasets."],
    ["Class Imbalance Handling", "Apply methods to handle imbalanced classes in training data."],
    ["Ground Truth Validation", "Validate ground truth labels for model training accuracy."],
    ["Active Learning Strategies", "Identify which data points to label in active learning setups."],
    ["Multi-Label Classification Data", "Create and validate data for multi-label ML problems."],
    ["Transfer Learning Data Prep", "Prepare fine-tuning datasets for pre-trained model adaptation."],
    ["Annotation Schema Design", "Design correct annotation schemas for training data projects."],
    ["Edge Case Data Collection", "Identify and collect edge cases critical for model robustness."],
    ["Bias Mitigation in Datasets", "Apply techniques to detect and reduce dataset bias."],
    ["Data Version Control", "Apply dataset versioning and provenance tracking best practices."],
    ["Benchmark Dataset Standards", "Understand the standards behind benchmark ML datasets."],
    ["Synthetic Data Generation", "Evaluate the correct use of synthetic data for model training."],
    ["Human-in-the-Loop Workflows", "Design human review workflows for AI prediction correction."],
    ["Speech Recognition Data Prep", "Prepare audio transcription data for ASR model training."],
    ["Autonomous Vehicle Perception", "Label sensor data for autonomous driving AI systems."],
    ["Medical AI Training Data", "Apply standards for medical imaging and clinical AI datasets."],
    ["Recommendation System Data", "Structure user interaction data for recommendation models."],
    ["Anomaly Detection Data Labeling", "Label normal and anomalous instances for detection models."],
    ["Multimodal AI Data Preparation", "Align image, text, and audio for multimodal model training."],
    ["Semantic Segmentation Labeling", "Apply pixel-level annotation for semantic segmentation tasks."],
    ["Pose Estimation Data Labeling", "Label human body keypoints for pose estimation models."],
    ["OCR Training Data Preparation", "Prepare text region annotations for OCR model training."],
    ["Chatbot Training Data Design", "Structure dialogue datasets for conversational AI training."],
    ["Federated Learning Data Privacy", "Apply privacy-preserving techniques in distributed AI training."],
    ["Model Evaluation Data Design", "Design held-out test sets for unbiased model evaluation."],
    ["Time Series Anomaly Labeling", "Label temporal sequences for time series anomaly detection."],
    ["Document AI Training Data", "Prepare layout and content annotations for document AI."],
    ["Geospatial AI Data Labeling", "Label satellite and map imagery for geospatial AI models."],
    ["Knowledge Graph Construction", "Structure entity and relation data for knowledge graph training."],
  ]),
  ...mkTasks("Sentence Arrangement", [
    ["Logical Text Ordering", "Arrange scrambled sentences into the correct logical sequence."],
    ["Paragraph Coherence", "Identify correct paragraph structures and transitional logic."],
    ["Cause and Effect Sequencing", "Order cause-and-effect statements into the correct flow."],
    ["Chronological Event Ordering", "Arrange historical and process events in correct time order."],
    ["Instructional Step Sequencing", "Order procedural instructions into their correct step sequence."],
    ["Argument Structure Ordering", "Arrange argumentative sentences into premise-conclusion order."],
    ["Scientific Process Sequencing", "Order the steps of a scientific method or experiment."],
    ["Story Narrative Ordering", "Arrange narrative sentences into a coherent story sequence."],
    ["News Report Structure", "Order journalism sentences from headline to supporting details."],
    ["Business Report Organization", "Arrange business writing components in professional order."],
    ["Recipe and Procedure Ordering", "Place procedural steps in the correct sequential order."],
    ["Technical Manual Sequencing", "Order technical instructions for correct task completion."],
    ["Legal Argument Ordering", "Arrange legal reasoning from fact to conclusion correctly."],
    ["Medical Procedure Sequencing", "Order clinical procedure steps in their correct sequence."],
    ["Mathematical Proof Ordering", "Arrange mathematical steps in the correct logical order."],
    ["Historical Timeline Ordering", "Place historical events in correct chronological sequence."],
    ["Policy Document Structure", "Arrange policy sections in the correct official document order."],
    ["Email Thread Sequencing", "Order email exchanges into the correct conversational flow."],
    ["Problem-Solution Text Ordering", "Arrange sentences presenting a problem and its solution."],
    ["Comparison Text Structure", "Order comparison sentences into a balanced parallel structure."],
    ["Definition and Example Ordering", "Arrange concept definitions followed by correct examples."],
    ["Introduction-Body-Conclusion", "Identify correct essay structure and paragraph placement."],
    ["Grant Proposal Sequencing", "Order grant proposal sections in their required sequence."],
    ["Meeting Minutes Ordering", "Arrange meeting record sections in official document order."],
    ["Research Paper Structure", "Order IMRaD research paper sections in correct sequence."],
    ["Interview Response Ordering", "Arrange STAR method interview response components."],
    ["Contract Clause Ordering", "Sequence legal contract clauses in standard document order."],
    ["Tutorial Content Sequencing", "Order educational tutorial content from basics to advanced."],
    ["Press Release Structure", "Arrange press release components in standard journalism order."],
    ["Hypothesis Testing Sequence", "Order statistical hypothesis testing steps correctly."],
    ["Software Development Lifecycle", "Arrange SDLC phase descriptions in the correct order."],
    ["Negotiation Stage Ordering", "Order negotiation phase descriptions in the correct sequence."],
    ["Project Plan Sequencing", "Arrange project management phases in correct execution order."],
    ["Diagnostic Process Ordering", "Order fault-diagnosis steps from symptom to resolution."],
  ]),
  ...mkTasks("Product Review Analysis", [
    ["Review Authenticity Detection", "Distinguish genuine product reviews from fake ones."],
    ["Sentiment and Rating Alignment", "Check if written sentiment matches the given star rating."],
    ["Fraud Pattern Recognition", "Identify coordinated review attacks and rating manipulation."],
    ["Review Usefulness Scoring", "Rate reviews for informational value to prospective buyers."],
    ["Spam Review Detection", "Flag repetitive, keyword-stuffed, or promotional review text."],
    ["Review Bias Detection", "Identify reviewer bias including overpraise and unwarranted criticism."],
    ["Comparative Review Accuracy", "Evaluate accuracy of feature comparisons in product reviews."],
    ["Technical Review Correctness", "Verify technical claims made in electronics and software reviews."],
    ["Review Grammar and Clarity", "Assess readability, grammar, and clarity of review text."],
    ["Review Relevance Assessment", "Determine whether reviews address the actual product listed."],
    ["Verified Purchase Review Check", "Assess whether review content is consistent with verified use."],
    ["Review Recency Relevance", "Evaluate whether older reviews remain relevant to current products."],
    ["Platform Policy Compliance", "Check reviews against platform content and conduct guidelines."],
    ["Cultural Sensitivity Review", "Flag culturally insensitive or regionally inappropriate reviews."],
    ["Competitor Mention Detection", "Identify inappropriate competitor comparisons in review text."],
    ["Incentivized Review Detection", "Identify reviews written in exchange for compensation."],
    ["Review Image Description Match", "Check whether image descriptions match uploaded review photos."],
    ["Professional vs Consumer Review", "Distinguish expert professional reviews from consumer opinions."],
    ["First-Time Buyer Review Patterns", "Identify patterns in reviews from first-time product purchasers."],
    ["Defect Report Identification", "Identify product defect reports embedded in customer reviews."],
    ["Service vs Product Feedback", "Separate service quality feedback from product quality feedback."],
    ["Size and Fit Review Accuracy", "Evaluate accuracy of sizing and fit claims in clothing reviews."],
    ["Food and Beverage Review Analysis", "Assess taste, quality, and description accuracy in food reviews."],
    ["Safety Concern Detection", "Flag safety-related issues or hazards mentioned in reviews."],
    ["Review Length and Depth Analysis", "Evaluate whether review depth is proportionate to its rating."],
    ["Subscription Product Review", "Analyze review patterns for subscription and recurring products."],
    ["Cross-Platform Review Consistency", "Check consistency of same-product reviews across platforms."],
    ["High-Value Item Review Scrutiny", "Apply stricter validation to reviews of premium-priced items."],
    ["Return-Based Review Patterns", "Identify reviews written after product returns or refunds."],
    ["Review Translation Quality", "Assess quality and accuracy of machine-translated reviews."],
    ["Crowdsourced Review Aggregation", "Validate the integrity of aggregated review score summaries."],
    ["Children's Product Review Safety", "Apply extra scrutiny to safety claims in children's product reviews."],
    ["Medical Device Review Accuracy", "Verify factual claims in reviews of medical and health devices."],
    ["Eco-Claim Review Verification", "Check the accuracy of sustainability and eco-friendly review claims."],
  ]),
  ...mkTasks("Data Annotation", [
    ["Image Annotation Principles", "Apply correct annotation techniques for machine learning images."],
    ["Bounding Box Annotation", "Draw and validate object bounding boxes in image datasets."],
    ["Semantic Segmentation", "Apply pixel-level labels for semantic segmentation tasks."],
    ["Text Span Annotation", "Label text spans for named entities and relation extraction."],
    ["Video Temporal Annotation", "Apply temporal labels to video frames for action recognition."],
    ["Audio Transcription Annotation", "Transcribe and label audio segments for speech models."],
    ["Keypoint Annotation", "Mark anatomical and structural keypoints in human images."],
    ["3D Point Cloud Labeling", "Label objects in 3D point cloud data for LiDAR perception."],
    ["Medical Image Annotation", "Apply annotation standards for radiology and pathology images."],
    ["Document Layout Annotation", "Label document structure zones for document AI models."],
    ["OCR Ground Truth Creation", "Create text annotations for optical character recognition models."],
    ["Satellite Image Labeling", "Annotate land use and objects in satellite and aerial imagery."],
    ["Instance Segmentation", "Distinguish and label individual object instances in images."],
    ["Relationship Annotation", "Label directional relationships between annotated entities."],
    ["Coreference Chain Annotation", "Link coreferent mentions across a document."],
    ["Emotion Annotation in Speech", "Label emotional states in spoken audio segments."],
    ["Pose and Gesture Annotation", "Label body poses and hand gestures in image and video data."],
    ["Handwriting Annotation", "Label and transcribe handwritten text for recognition models."],
    ["Chart and Graph Annotation", "Extract and label data elements from chart images."],
    ["Scene Understanding Labels", "Annotate scene context and spatial relationships in images."],
    ["Cross-Modal Annotation Alignment", "Align text descriptions with corresponding image content."],
    ["Annotation Quality Review", "Apply inter-annotator agreement metrics to validate labels."],
    ["Edge Case Annotation", "Identify and correctly label ambiguous or borderline instances."],
    ["Multi-Label Annotation", "Assign multiple correct labels to complex data instances."],
    ["Temporal Grounding Annotation", "Link text descriptions to specific video timestamps."],
    ["Contrastive Annotation", "Label subtle distinctions between similar-looking instances."],
    ["Class Hierarchy Annotation", "Label instances with correct hierarchical category assignments."],
    ["Annotation Calibration", "Align personal annotation standards with project guidelines."],
    ["Metadata Annotation", "Attach correct metadata fields to annotated data records."],
    ["Active Annotation Strategy", "Select the most informative samples to prioritize for labeling."],
    ["Synthetic vs Real Annotation", "Distinguish annotation requirements for real vs synthetic data."],
    ["Annotation Efficiency Methods", "Apply time-saving techniques without sacrificing label quality."],
    ["Low-Resource Language Annotation", "Apply annotation standards for under-resourced languages."],
    ["Domain Adaptation Annotation", "Adjust annotation standards when moving between data domains."],
  ]),
  ...mkTasks("Surveys", [
    ["Survey Sampling Concepts", "Demonstrate knowledge of correct sampling techniques."],
    ["Survey Bias Identification", "Identify types of bias that affect survey data quality."],
    ["Statistical Significance in Surveys", "Apply significance testing concepts to survey results."],
    ["Survey Instrument Validation", "Evaluate validity and reliability of survey instruments."],
    ["Likert Scale Best Practices", "Apply best practices for Likert scale construction and use."],
    ["Survey Mode Effects", "Assess how survey delivery mode affects data quality."],
    ["Response Scale Design", "Select appropriate response scales for different survey goals."],
    ["Survey Question Clarity", "Evaluate whether survey questions are clear and unambiguous."],
    ["Stratified Sampling Design", "Apply stratified sampling to achieve representative results."],
    ["Survey Data Cleaning", "Identify and handle inconsistent or invalid survey responses."],
    ["Longitudinal Survey Design", "Design repeated-measures surveys for tracking change over time."],
    ["Survey Report Writing", "Structure and present survey findings in a correct report format."],
    ["Probability vs Nonprobability Sampling", "Choose the right sampling strategy for a study objective."],
    ["Survey Respondent Motivation", "Identify factors that influence respondent engagement and honesty."],
    ["Cross-Sectional Survey Design", "Apply cross-sectional study design principles to surveys."],
    ["Survey Question Types", "Match question types to measurement goals in survey design."],
    ["Survey Data Analysis Methods", "Select correct analysis methods for survey response data."],
    ["Attitude Measurement in Surveys", "Apply psychometric principles to measure attitudes accurately."],
    ["Survey Pretesting Methods", "Design and implement a pretest for a new survey instrument."],
    ["Online Survey Design Principles", "Apply UX and design principles to online survey creation."],
    ["Survey Ethics Standards", "Apply ethical standards including anonymity and consent."],
    ["Health Survey Applications", "Apply validated instruments for health and well-being surveys."],
    ["Political Polling Standards", "Identify standards for fair and accurate political surveys."],
    ["Customer Experience Measurement", "Design customer experience surveys using validated metrics."],
    ["Academic Survey Standards", "Apply university IRB and research ethics to academic surveys."],
    ["Employee Engagement Measurement", "Design accurate employee engagement survey instruments."],
    ["Market Sizing Surveys", "Apply survey methods for market size and segment estimation."],
    ["Conjoint and Trade-off Surveys", "Understand conjoint methodology for preference measurement."],
    ["Diary and Experience Sampling", "Apply experience sampling methods for longitudinal surveys."],
    ["Survey Translation Equivalence", "Ensure translation equivalence in multilingual surveys."],
    ["Mixed Methods Integration", "Combine quantitative survey data with qualitative findings."],
    ["Big Data Survey Integration", "Combine traditional survey data with administrative datasets."],
    ["Survey Incentive Design", "Evaluate the effect of incentives on survey participation."],
    ["Survey Panel Management", "Apply best practices for managing online survey panel quality."],
  ]),
  ...mkTasks("Video Analysis", [
    ["Video Content Classification", "Classify video content by genre, purpose, and topic."],
    ["Video Quality Assessment", "Evaluate video quality metrics including resolution and encoding."],
    ["Misinformation Detection", "Identify misinformation and manipulative content in videos."],
    ["Educational Video Evaluation", "Assess instructional design quality in educational videos."],
    ["Video Content Moderation", "Apply community standards to classify video content appropriateness."],
    ["Scene Transition Detection", "Identify shot boundaries and scene transitions in video sequences."],
    ["Video Metadata Accuracy", "Validate accuracy of video titles, tags, and descriptions."],
    ["Advertisement Detection", "Identify and classify paid promotional content in videos."],
    ["Deepfake Identification", "Recognize synthetic and AI-generated video content markers."],
    ["Accessibility Assessment", "Evaluate caption quality and accessibility features in videos."],
    ["Video Engagement Prediction", "Identify content signals that predict viewer engagement."],
    ["Copyright Content Detection", "Flag potentially copyright-protected material in video content."],
    ["Thumbnail Accuracy Review", "Assess whether video thumbnails accurately represent content."],
    ["Audience Age Suitability", "Classify video content by appropriate audience age rating."],
    ["Technical Production Quality", "Evaluate lighting, audio quality, and production standards."],
    ["Video Transcript Accuracy", "Verify accuracy of auto-generated video transcripts."],
    ["Brand Safety Assessment", "Evaluate videos for brand safety and advertising suitability."],
    ["Violence and Harm Detection", "Identify levels of violence or harmful content in videos."],
    ["Music and Audio Rights", "Identify background music that may trigger copyright claims."],
    ["Tutorial Completeness Review", "Assess whether tutorial videos cover all necessary steps."],
    ["News Video Accuracy", "Evaluate factual accuracy of claims made in news video content."],
    ["Product Demo Accuracy", "Verify that product demonstration videos accurately show features."],
    ["Social Media Video Analysis", "Apply platform-specific standards to short-form video content."],
    ["Lecture Video Assessment", "Evaluate academic lecture video structure and content accuracy."],
    ["Documentary Bias Detection", "Identify one-sided framing and bias in documentary content."],
    ["Live Stream Content Review", "Apply real-time moderation standards to live video content."],
    ["Animation Content Classification", "Classify animated video content by type, age, and purpose."],
    ["Sports Highlight Analysis", "Verify accuracy and fairness of sports highlight compilations."],
    ["User-Generated Content Review", "Evaluate UGC videos for policy compliance and quality."],
    ["Video SEO Compliance", "Assess videos for SEO metadata accuracy and tag compliance."],
    ["Cultural Sensitivity Review", "Flag culturally insensitive or regionally inappropriate video content."],
    ["Video Comparison Analysis", "Compare multiple videos on content accuracy and quality."],
    ["Health and Safety Video Review", "Evaluate safety instruction videos for accuracy and completeness."],
    ["Influencer Content Standards", "Apply FTC disclosure and transparency standards to influencer videos."],
  ]),
];

const TARGET_TASK_COUNT = TASK_SEEDS.length; // 918

async function seedTasksIfNeeded() {
  try {
    const existing = await db.select({ id: tasksTable.id }).from(tasksTable);
    if (existing.length >= TARGET_TASK_COUNT) return;
    // Re-seed: clear old tasks and insert the full set
    await db.delete(tasksTable);
    for (const seed of TASK_SEEDS) {
      await db.insert(tasksTable).values({
        ...seed,
        taskType: "standard",
        instructions: CATEGORY_DESCRIPTIONS[seed.category] ?? seed.description,
        isActive: true,
      });
    }
  } catch (_) { /* silently skip if table doesn't exist yet */ }
}
seedTasksIfNeeded();

// ─── GET /tasks/categories ────────────────────────────────────────────────────

router.get("/tasks/categories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));
    const map: Record<string, { count: number; totalReward: number; maxReward: number }> = {};
    for (const t of tasks) {
      if (!map[t.category]) map[t.category] = { count: 0, totalReward: 0, maxReward: 0 };
      map[t.category].count++;
      map[t.category].totalReward += t.reward;
      if (t.reward > map[t.category].maxReward) map[t.category].maxReward = t.reward;
    }
    const totalInBank = Object.fromEntries(
      Object.keys(QUESTION_BANK).map(k => [k, QUESTION_BANK[k].length])
    );
    res.json(Object.entries(map).map(([name, v]) => ({
      name,
      count: v.count,
      totalReward: v.totalReward,
      maxReward: v.maxReward,
      description: CATEGORY_DESCRIPTIONS[name] ?? "",
      questionPoolSize: totalInBank[name] ?? 0,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Daily seeded shuffle ─────────────────────────────────────────────────────

// Deterministic Fisher-Yates shuffle seeded from a string (today's UTC date).
// Same seed = same order every time, different date = different order.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i) * (i + 1);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) | 0) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DAILY_PER_CATEGORY = 12; // tasks shown per category per day

// ─── GET /tasks ───────────────────────────────────────────────────────────────

router.get("/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category } = req.query as { category?: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));

    // Fetch all user attempts: passed = cooldown, failed = task disappears permanently
    const userAttempts = await db.select().from(taskAttemptsTable)
      .where(eq(taskAttemptsTable.userId, req.userId!));

    const lastPassedAt: Record<number, Date> = {};
    const failedTaskIds = new Set<number>();

    for (const a of userAttempts) {
      if (a.status === "failed") failedTaskIds.add(a.taskId);
      if (a.status === "passed") {
        const prev = lastPassedAt[a.taskId];
        const ts = a.completedAt ? new Date(a.completedAt) : new Date(a.startedAt);
        if (!prev || ts > prev) lastPassedAt[a.taskId] = ts;
      }
    }

    // Filter: correct level + never failed
    let eligible = allTasks.filter(t => t.minLevel <= user.level && !failedTaskIds.has(t.id));
    if (category) eligible = eligible.filter(t => t.category === category);

    // Daily rotation: deterministic shuffle per category, pick DAILY_PER_CATEGORY per day
    const todaySeed = new Date().toISOString().slice(0, 10); // "2026-06-04"
    const byCategory: Record<string, typeof eligible> = {};
    for (const t of eligible) (byCategory[t.category] ??= []).push(t);

    const dailyPool: typeof eligible = [];
    for (const catTasks of Object.values(byCategory)) {
      const shuffled = seededShuffle(catTasks, todaySeed + catTasks[0]?.category);
      dailyPool.push(...shuffled.slice(0, DAILY_PER_CATEGORY));
    }

    const now = Date.now();
    res.json(dailyPool.map(t => {
      const lastPassed = lastPassedAt[t.id];
      const cooldownMs = (t.cooldownHours ?? 24) * 3600_000;
      const onCooldown = lastPassed ? (now - lastPassed.getTime()) < cooldownMs : false;
      const cooldownEndsAt = lastPassed && onCooldown ? new Date(lastPassed.getTime() + cooldownMs).toISOString() : null;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        instructions: t.instructions,
        category: t.category,
        reward: t.reward,
        estimatedMinutes: t.estimatedMinutes,
        timeLimitSeconds: t.timeLimitSeconds,
        difficulty: t.difficulty,
        minLevel: t.minLevel,
        questionCount: t.questionCount,
        cooldownHours: t.cooldownHours,
        completionCount: t.completionCount,
        isActive: t.isActive,
        onCooldown,
        cooldownEndsAt,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /tasks/history ───────────────────────────────────────────────────────

router.get("/tasks/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const attempts = await db.select().from(taskAttemptsTable)
      .where(eq(taskAttemptsTable.userId, req.userId!))
      .orderBy(desc(taskAttemptsTable.startedAt))
      .limit(50);

    const taskIds = [...new Set(attempts.map(a => a.taskId))];
    const taskMap: Record<number, { title: string; category: string; reward: number }> = {};
    if (taskIds.length > 0) {
      const taskRows = await db.select().from(tasksTable)
        .where(eq(tasksTable.id, taskIds[0])); // simplified — get all
      for (const row of await db.select().from(tasksTable)) {
        taskMap[row.id] = { title: row.title, category: row.category, reward: row.reward };
      }
    }

    res.json(attempts.map(a => ({
      id: a.id,
      taskId: a.taskId,
      taskTitle: taskMap[a.taskId]?.title ?? "Unknown Task",
      taskCategory: taskMap[a.taskId]?.category ?? "",
      status: a.status,
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctAnswers: a.correctAnswers,
      rewardEarned: a.status === "passed" ? (taskMap[a.taskId]?.reward ?? 0) : 0,
      timeSpent: a.timeSpent,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /tasks/:id ───────────────────────────────────────────────────────────

router.get("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/start ────────────────────────────────────────────────────

router.post("/tasks/:id/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task || !task.isActive) { res.status(404).json({ error: "Task not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

    // Starter (level 1) cap: $200 total earned maximum
    if (user.level === 1 && user.totalEarned >= 200) {
      res.status(403).json({
        error: "You've reached the $200 Starter limit. Upgrade your membership to keep earning unlimited rewards.",
        starterLimitReached: true,
      }); return;
    }

    if (task.minLevel > user.level) {
      res.status(403).json({ error: `This task requires ${getLevelName(task.minLevel)} level or above.` }); return;
    }

    // No-retry check: once failed, task is permanently locked
    const failedAttempt = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.taskId, id), eq(taskAttemptsTable.status, "failed")))
      .limit(1);
    if (failedAttempt.length > 0) {
      res.status(403).json({ error: "You have already failed this task. No retries are allowed.", noRetry: true }); return;
    }

    // Cooldown check
    const lastPassed = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.taskId, id), eq(taskAttemptsTable.status, "passed")))
      .orderBy(desc(taskAttemptsTable.completedAt))
      .limit(1);
    if (lastPassed.length > 0) {
      const passedAt = lastPassed[0].completedAt ? new Date(lastPassed[0].completedAt) : new Date(lastPassed[0].startedAt);
      const cooldownMs = (task.cooldownHours ?? 24) * 3600_000;
      if (Date.now() - passedAt.getTime() < cooldownMs) {
        const endsAt = new Date(passedAt.getTime() + cooldownMs);
        res.status(400).json({ error: `Task on cooldown. Available again at ${endsAt.toLocaleString()}.`, onCooldown: true, cooldownEndsAt: endsAt.toISOString() }); return;
      }
    }

    // Cancel any in-progress attempt for this task
    await db.update(taskAttemptsTable).set({ status: "failed" })
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.taskId, id), eq(taskAttemptsTable.status, "in_progress")));

    // Pick random questions from question bank
    const questionCount = task.questionCount ?? 5;
    const rawQuestions = getRandomQuestions(task.category, questionCount);
    if (rawQuestions.length === 0) {
      res.status(500).json({ error: "No questions available for this task category." }); return;
    }

    // Shuffle each question's options using a cryptographically-seeded random so
    // the correct answer is never predictably at position A.
    const questions = rawQuestions.map(q => {
      const shuffled = [...q.options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...q, options: shuffled };
    });

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const ua = req.headers["user-agent"] ?? "";

    // Store attempt with full question data (including correct answers) server-side
    // questionsSnapshot holds shuffled options + correctAnswer string for grading
    const [attempt] = await db.insert(taskAttemptsTable).values({
      userId: req.userId!,
      taskId: id,
      status: "in_progress",
      totalQuestions: questions.length,
      questionsSnapshot: questions as any,
      ipAddress: ip,
      userAgent: ua,
    }).returning();

    // Return questions WITHOUT correct answers
    const clientQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,   // already shuffled — correct answer is at a random position
      difficulty: q.difficulty,
    }));

    res.json({
      attemptId: attempt.id,
      timeLimitSeconds: task.timeLimitSeconds,
      questions: clientQuestions,
      totalQuestions: questions.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/submit ───────────────────────────────────────────────────

router.post("/tasks/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const { attemptId, answers, timeSpent } = req.body as {
      attemptId: number;
      answers: Array<{ questionId: string; answer: string }>;
      timeSpent?: number;
    };

    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    // Load the attempt — must belong to this user
    const [attempt] = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.id, attemptId), eq(taskAttemptsTable.userId, req.userId!)));
    if (!attempt) { res.status(404).json({ error: "Attempt not found" }); return; }
    if (attempt.status !== "in_progress") { res.status(400).json({ error: "Attempt already completed" }); return; }

    // Validate time limit
    if (task.timeLimitSeconds) {
      const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000;
      if (elapsed > task.timeLimitSeconds + 60) {
        await db.update(taskAttemptsTable).set({ status: "timed_out", completedAt: new Date(), timeSpent: Math.round(elapsed) })
          .where(eq(taskAttemptsTable.id, attemptId));
        res.status(400).json({ error: "Time limit exceeded. Task expired.", timedOut: true }); return;
      }
    }

    // Anti-cheat: minimum time check (too fast = suspicious)
    const spentMs = Date.now() - new Date(attempt.startedAt).getTime();
    const minMs = (attempt.totalQuestions ?? 1) * 3000; // at least 3s per question
    const flagged = spentMs < minMs;
    const flagReason = flagged ? `Submitted too quickly (${Math.round(spentMs / 1000)}s for ${attempt.totalQuestions} questions)` : null;

    // Score the answers against stored correct answers
    const snapshot = (attempt.questionsSnapshot as any[]) ?? [];
    const answerMap: Record<string, string> = {};
    for (const a of answers) answerMap[a.questionId] = a.answer;

    let correctCount = 0;
    const gradedAnswers = snapshot.map((q: any) => {
      const submitted = answerMap[q.id] ?? "";
      const correct = submitted === q.correctAnswer;
      if (correct) correctCount++;
      return { questionId: q.id, answer: submitted, correct };
    });

    const score = snapshot.length > 0 ? Math.round((correctCount / snapshot.length) * 100) : 0;
    const passed = score === 100; // 100% accuracy required

    await db.update(taskAttemptsTable).set({
      status: passed ? "passed" : "failed",
      score,
      correctAnswers: correctCount,
      submittedAnswers: gradedAnswers as any,
      timeSpent: timeSpent ?? Math.round(spentMs / 1000),
      completedAt: new Date(),
      flagged,
      flagReason,
    }).where(eq(taskAttemptsTable.id, attemptId));

    if (!passed) {
      res.json({
        passed: false,
        score,
        correctAnswers: correctCount,
        totalQuestions: snapshot.length,
        message: `You got ${correctCount}/${snapshot.length} correct. All questions must be answered correctly to earn a reward.`,
        rewardEarned: 0,
      });
      return;
    }

    // Award reward
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const reward = task.reward;
    const newBalance = user.balance + reward;
    const newTotalEarned = user.totalEarned + reward;
    const newTaskEarnings = user.totalTaskEarnings + reward;
    const newCompleted = user.tasksCompleted + 1;

    let newLevel = user.level;
    if (newTotalEarned >= 5000) newLevel = 7;
    else if (newTotalEarned >= 2000) newLevel = 6;
    else if (newTotalEarned >= 1000) newLevel = 5;
    else if (newTotalEarned >= 500) newLevel = 4;
    else if (newTotalEarned >= 200) newLevel = 3;
    else if (newTotalEarned >= 50) newLevel = 2;

    await db.update(usersTable).set({
      balance: newBalance,
      tasksCompleted: newCompleted,
      totalEarned: newTotalEarned,
      totalTaskEarnings: newTaskEarnings,
      level: newLevel,
    }).where(eq(usersTable.id, req.userId!));

    await db.update(tasksTable).set({ completionCount: task.completionCount + 1 }).where(eq(tasksTable.id, id));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "earning",
      amount: reward,
      status: "completed",
      description: `Completed: ${task.title}`,
    });

    if (newLevel > user.level) {
      await db.insert(notificationsTable).values({
        userId: req.userId!,
        type: "level_up",
        title: "Level Up!",
        message: `Congratulations! You've reached ${getLevelName(newLevel)} level.`,
      });
    }

    // Also mark in legacy userTasksTable for backward compat
    const [existing] = await db.select().from(userTasksTable)
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    if (!existing) {
      await db.insert(userTasksTable).values({ userId: req.userId!, taskId: id, status: "completed", completedAt: new Date() });
    } else {
      await db.update(userTasksTable).set({ status: "completed", completedAt: new Date() })
        .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    }

    res.json({
      passed: true,
      score: 100,
      correctAnswers: correctCount,
      totalQuestions: snapshot.length,
      message: `Perfect score! You earned $${reward.toFixed(2)} for completing ${task.title}!`,
      rewardEarned: reward,
      newBalance,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/complete (legacy – kept for backward compat) ─────────────

router.post("/tasks/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  res.status(400).json({ error: "Please use the new task submission flow (POST /tasks/:id/submit)." });
});

// ─── POST /tasks/daily-checkin (UNCHANGED) ────────────────────────────────────

router.post("/tasks/daily-checkin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const now = new Date();
    if (user.lastCheckIn) {
      const lastDate = new Date(user.lastCheckIn);
      const sameDay = lastDate.toDateString() === now.toDateString();
      if (sameDay) { res.status(400).json({ error: "Already checked in today" }); return; }
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = user.lastCheckIn && new Date(user.lastCheckIn).toDateString() === yesterday.toDateString();
    const streak = wasYesterday ? user.streakDays + 1 : 1;
    const reward = user.level === 1 ? 0.15 : Math.min(0.5 + (streak - 1) * 0.1, 2.0);

    await db.update(usersTable).set({
      balance: user.balance + reward,
      totalBonusEarnings: user.totalBonusEarnings + reward,
      totalEarned: user.totalEarned + reward,
      lastCheckIn: now,
      streakDays: streak,
    }).where(eq(usersTable.id, req.userId!));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "bonus",
      amount: reward,
      status: "completed",
      description: `Daily check-in (Day ${streak} streak)`,
    });

    res.json({ success: true, rewardEarned: reward, streakDays: streak, message: `Day ${streak} streak! Earned $${reward.toFixed(2)}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
