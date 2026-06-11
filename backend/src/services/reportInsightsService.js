const REPORT_CATALOG = {
  // SehatSaathi uses one internal reference model for cross-lab continuity.
  // These are adult app-standard ranges chosen to stay close to common Indian
  // lab reporting practice, while the original lab unit/range is preserved
  // separately for transparency.
  multi_panel: {
    label: "Comprehensive lab panel",
    keywords: [],
    metrics: [],
  },
  hba1c: {
    label: "HbA1c",
    keywords: ["hba1c", "hbalc", "hbatc", "hbate", "glycated hemoglobin", "glycosylated hemoglobin"],
    metrics: [
      { key: "hba1c", label: "HbA1c", unit: "%", low: 4.0, high: 5.6, trend: "lower_better" },
      { key: "estimated_average_glucose", label: "Estimated Average Glucose", unit: "mg/dL", low: 70, high: 140, trend: "lower_better" },
    ],
  },
  crp: {
    label: "CRP",
    keywords: ["crp", "c-reactive protein", "reactive protein"],
    metrics: [
      { key: "crp_quantitative", label: "CRP Quantitative", unit: "mg/L", low: 0, high: 6, trend: "lower_better" },
    ],
  },
  allergy: {
    label: "Allergy / IgE",
    keywords: ["ige", "serum ige", "immunoglobulin e"],
    metrics: [
      { key: "serum_ige", label: "Serum IgE", unit: "IU/mL", low: 0, high: 150, trend: "lower_better" },
    ],
  },
  glucose: {
    label: "Blood Sugar",
    keywords: ["glucose", "blood sugar", "fbs", "ppbs", "rbs", "fasting sugar", "post prandial"],
    metrics: [
      { key: "fbs", label: "Fasting Blood Sugar", unit: "mg/dL", low: 70, high: 99, trend: "lower_better" },
      { key: "ppbs", label: "Post Prandial Blood Sugar", unit: "mg/dL", low: 70, high: 140, trend: "lower_better" },
      { key: "rbs", label: "Random Blood Sugar", unit: "mg/dL", low: 70, high: 140, trend: "lower_better" },
    ],
  },
  cbc: {
    label: "CBC",
    keywords: ["cbc", "complete blood count", "hemoglobin", "hb", "wbc", "platelet", "platelets"],
    metrics: [
      { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", low: 12, high: 17.5, trend: "higher_better" },
      { key: "rbc_count", label: "RBC Count", unit: "mill/cmm", low: 4.2, high: 5.9, trend: "range" },
      { key: "pcv", label: "PCV", unit: "%", low: 36, high: 52, trend: "range" },
      { key: "mcv", label: "MCV", unit: "fL", low: 80, high: 96, trend: "range" },
      { key: "mch", label: "MCH", unit: "pg", low: 27, high: 32, trend: "range" },
      { key: "mchc", label: "MCHC", unit: "%", low: 32, high: 36, trend: "range" },
      { key: "rdw", label: "RDW", unit: "fL", low: 11.5, high: 14.5, trend: "range" },
      { key: "wbc", label: "WBC", unit: "10^3/uL", low: 4, high: 11, trend: "range" },
      { key: "esr", label: "ESR", unit: "mm/hr", low: 0, high: 20, trend: "range" },
      { key: "platelets", label: "Platelets", unit: "10^3/uL", low: 150, high: 450, trend: "range" },
    ],
  },
  anthropometry: {
    label: "Anthropometry",
    keywords: ["bmi", "body mass index", "weight", "height"],
    metrics: [
      { key: "weight", label: "Weight", unit: "kg", low: 0, high: 200, trend: "range" },
      { key: "bmi", label: "BMI", unit: "kg/m²", low: 18.5, high: 24.9, trend: "range" },
    ],
  },
  lipid: {
    label: "Lipid Profile",
    keywords: ["lipid", "cholesterol", "ldl", "hdl", "triglycerides", "triglyceride"],
    metrics: [
      { key: "total_cholesterol", label: "Total Cholesterol", unit: "mg/dL", low: 0, high: 200, trend: "lower_better" },
      { key: "ldl", label: "LDL", unit: "mg/dL", low: 0, high: 100, trend: "lower_better" },
      { key: "hdl", label: "HDL", unit: "mg/dL", low: 40, high: 100, trend: "higher_better" },
      { key: "triglycerides", label: "Triglycerides", unit: "mg/dL", low: 0, high: 150, trend: "lower_better" },
    ],
  },
  thyroid: {
    label: "Thyroid Profile",
    keywords: ["thyroid", "tsh", "t3", "t4", "ft3", "ft4"],
    metrics: [
      { key: "tsh", label: "TSH", unit: "uIU/mL", low: 0.4, high: 4.5, trend: "range" },
      { key: "t3", label: "T3", unit: "ng/dL", low: 80, high: 200, trend: "range" },
      { key: "t4", label: "T4", unit: "ug/dL", low: 5.1, high: 14.1, trend: "range" },
    ],
  },
  renal: {
    label: "Kidney / Renal Function",
    keywords: ["renal", "kidney", "creatinine", "urea", "uric acid", "kft", "rft"],
    metrics: [
      { key: "creatinine", label: "Creatinine", unit: "mg/dL", low: 0.7, high: 1.3, trend: "lower_better" },
      { key: "urea", label: "Urea", unit: "mg/dL", low: 15, high: 45, trend: "range" },
      { key: "uric_acid", label: "Uric Acid", unit: "mg/dL", low: 3.5, high: 7.2, trend: "range" },
    ],
  },
  liver: {
    label: "Liver Function",
    keywords: ["liver", "bilirubin", "sgpt", "sgot", "alt", "ast", "lft"],
    metrics: [
      { key: "bilirubin_total", label: "Total Bilirubin", unit: "mg/dL", low: 0.3, high: 1.2, trend: "lower_better" },
      { key: "sgpt_alt", label: "SGPT / ALT", unit: "U/L", low: 10, high: 40, trend: "lower_better" },
      { key: "sgot_ast", label: "SGOT / AST", unit: "U/L", low: 10, high: 40, trend: "lower_better" },
    ],
  },
  urine: {
    label: "Urine Analysis",
    keywords: ["urine analysis", "chemical examination", "urobilinogen", "ketones", "bilirubin", "protein", "blood"],
    metrics: [
      { key: "urine_protein", label: "Urine Protein", unit: "", low: 0, high: 0, trend: "lower_better" },
      { key: "urine_glucose", label: "Urine Glucose", unit: "", low: 0, high: 0, trend: "lower_better" },
      { key: "urine_ketones", label: "Urine Ketones", unit: "", low: 0, high: 0, trend: "lower_better" },
      { key: "urine_bilirubin", label: "Urine Bilirubin", unit: "", low: 0, high: 0, trend: "lower_better" },
      { key: "urine_blood", label: "Urine Blood", unit: "", low: 0, high: 0, trend: "lower_better" },
      { key: "urine_urobilinogen", label: "Urine Urobilinogen", unit: "", low: 0, high: 0, trend: "lower_better" },
    ],
  },
};

REPORT_CATALOG.multi_panel.metrics = Object.values(REPORT_CATALOG)
  .filter((item) => item !== REPORT_CATALOG.multi_panel)
  .flatMap((item) => item.metrics || [])
  .filter((metric, index, list) => list.findIndex((candidate) => candidate.key === metric.key) === index);

const EXTRACTION_PATTERNS = {
  hba1c: [
    /\bhba1c\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\bhb[a4](?:1|l)[c0]\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\bhbat[ce]\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /glyc(?:ated|osylated) hemoglobin[^\d]{0,12}(\d+(?:\.\d+)?)/i,
  ],
  estimated_average_glucose: [
    /estimated(?:\s+\w+){0,2}\s+average blood glucose[^\d]{0,20}(\d+(?:\.\d+)?)/i,
    /\beag\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
  ],
  crp_quantitative: [/\bcrp(?: quantitative)?\b[^\d]{0,16}(\d+(?:\.\d+)?)/i, /c-reactive protein[^\d]{0,16}(\d+(?:\.\d+)?)/i],
  serum_ige: [/serum\s+ige[^\d]{0,16}(\d+(?:\.\d+)?)/i, /\bige\b[^\d]{0,16}(\d+(?:\.\d+)?)/i],
  fbs: [/\bfbs\b[^\d]{0,12}(\d+(?:\.\d+)?)/i, /fasting (?:blood )?(?:glucose|sugar)[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  ppbs: [
    /\bppbs\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /post[ -]?prandial (?:blood )?(?:glucose|sugar)[^\d]{0,18}(\d+(?:\.\d+)?)/i,
    /\bbees\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\bpp\b[^\d]{0,8}(\d+(?:\.\d+)?)/i,
  ],
  rbs: [
    /\brbs\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /random (?:blood )?(?:glucose|sugar)[^\d]{0,18}(\d+(?:\.\d+)?)/i,
  ],
  hemoglobin: [
    /\bhemoglobin(?!\s*a1c)\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\bhaemoglobin\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\baemog(?:t|l)obin\b[^\d]{0,12}(\d+(?:\.\d+)?)/i,
    /\bhb\b[^\d]{0,8}(\d+(?:\.\d+)?)/i,
  ],
  rbc_count: [
    /r[\W_]*b(?:[\W_]*c)?[\W_,-]*count[^\d]{0,12}(\d+(?:\.\d+)?)/i,
  ],
  pcv: [/p\.?c\.?v[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  mcv: [/m\.?c\.?v[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  mch: [/m\.?c\.?h[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  mchc: [/m\.?c\.?h\.?c[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  rdw: [/r\.?d\.?w[^\d]{0,12}(\d+(?:\.\d+)?)/i, /\brow\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  wbc: [/\bwbc(?: count)?\b[^\d]{0,12}(\d+(?:\.\d+)?)/i, /total leukocyte count[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  esr: [
    /\besr[^\n]{0,80}?(\d+(?:\.\d+)?)\s*mm\s*\/?\s*hr/i,
    /\besr[^\n]{0,80}?(\d+(?:\.\d+)?)\s*mm/i,
    /\besr[^\n]{0,80}?(\d+(?:\.\d+)?)/i,
  ],
  platelets: [/\bplatelets?\b[^\d]{0,12}(\d+(?:\.\d+)?)/i, /platelet count[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  weight: [/\bweight\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  bmi: [/\bbmi\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  total_cholesterol: [/total cholesterol[^\d]{0,18}(\d+(?:\.\d+)?)/i, /[tf\[]etal cholesterol[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  ldl: [/\bldl\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  hdl: [/\bhdl\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  triglycerides: [/triglycerides?[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  tsh: [/\btsh\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  t3: [/\bt3\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  t4: [/\bt4\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  creatinine: [/creatinine[^\d]{0,18}(\d+(?:\.\d+)?)/i, /peatinine[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  urea: [/\burea\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
  uric_acid: [/uric acid[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  bilirubin_total: [/bilirubin(?: total)?[^\d]{0,18}(\d+(?:\.\d+)?)/i],
  sgpt_alt: [
    /\bsgpt\b[^\d]{0,24}(\d+(?:\.\d+)?)/i,
    /\balt\b[^\d]{0,24}(\d+(?:\.\d+)?)/i,
    /\baltu?[\W_]*sgpt[^\n]{0,80}/i,
  ],
  sgot_ast: [/\bsgot\b[^\d]{0,12}(\d+(?:\.\d+)?)/i, /\bast\b[^\d]{0,12}(\d+(?:\.\d+)?)/i],
};

const QUALITATIVE_PATTERNS = {
  urine_protein: /(?:\bprot(?:e)?i?n\b|\bprotien\b)\s*:?\s*(nil|negative|normal|trace|absent|[1-4]\+)/i,
  urine_glucose: /\bglucose\b\s*:?\s*(nil|negative|normal|trace|absent|[1-4]\+)/i,
  urine_ketones: /\bketones\b\s*:?\s*(nil|negative|normal|trace|absent|[1-4]\+)/i,
  urine_bilirubin: /\bbill?irubin\b\s*:?\s*(nil|negative|normal|trace|absent|[1-4]\+)/i,
  urine_blood: /\bblood\b\s*:?\s*(nil|negative|normal|trace|absent|[1-4]\+)/i,
  urine_urobilinogen: /\burobilinogen\b\s*:?\s*(normal|nil|negative|trace|absent|[1-4]\+)/i,
};

const QUALITATIVE_RESULT_MAP = {
  nil: { numeric: 0, text: "Nil", band: "normal" },
  negative: { numeric: 0, text: "Negative", band: "normal" },
  absent: { numeric: 0, text: "Absent", band: "normal" },
  normal: { numeric: 0, text: "Normal", band: "normal" },
  trace: { numeric: 1, text: "Trace", band: "high" },
  "1+": { numeric: 1, text: "1+", band: "high" },
  "2+": { numeric: 2, text: "2+", band: "high" },
  "3+": { numeric: 3, text: "3+", band: "high" },
  "4+": { numeric: 4, text: "4+", band: "high" },
};

const LAB_SOURCE_PATTERNS = [
  { key: "thyrocare", label: "Thyrocare", pattern: /\bthyrocare\b/i },
  { key: "drlal", label: "Dr Lal PathLabs", pattern: /\bdr\.?\s*lal\b|\blal pathlabs\b/i },
  { key: "metropolis", label: "Metropolis", pattern: /\bmetropolis\b/i },
  { key: "srl", label: "SRL", pattern: /\bsrl\b|\bsrl diagnostics\b/i },
];

const NORMALIZATION_REPLACEMENTS = [
  [/\bdr\.?\s*lal\s*pathlabs\b/gi, "dr lal pathlabs"],
  [/\bfasting blood sugar\b/gi, "fbs"],
  [/\bfasting plasma glucose\b/gi, "fbs"],
  [/\bpost[ -]?prandial blood sugar\b/gi, "ppbs"],
  [/\bpost[ -]?prandial plasma glucose\b/gi, "ppbs"],
  [/\brandom blood sugar\b/gi, "rbs"],
  [/\bglycosylated hemoglobin\b/gi, "hba1c"],
  [/\bglycated hemoglobin\b/gi, "hba1c"],
  [/\bhemoglobin\s*a1c\b/gi, "hba1c"],
  [/\bhaemoglobin\s*a1c\b/gi, "hba1c"],
  [/\bhbalc\b/gi, "hba1c"],
  [/\bfstimated\b/gi, "estimated"],
  [/\bestimated\s+\d+\s+average\b/gi, "estimated average"],
  [/\bhbatc\b/gi, "hba1c"],
  [/\bhbate\b/gi, "hba1c"],
  [/\bhbaic\b/gi, "hba1c"],
  [/\bhaemoglobin\b/gi, "hemoglobin"],
  [/\baemog(?:t|l)obin\b/gi, "hemoglobin"],
  [/\bsr\.?\s*creatinine\b/gi, "creatinine"],
  [/\breactive protein\b/gi, "crp"],
  [/\bplatelet count\b/gi, "platelets"],
  [/\btotal leukocyte count\b/gi, "wbc"],
  [/\bserum creatinine\b/gi, "creatinine"],
  [/\bpeatinine\b/gi, "creatinine"],
  [/\btotal bilirubin\b/gi, "bilirubin total"],
  [/[tf\[]etal cholesterol/gi, "total cholesterol"],
  [/\brow\b/gi, "rdw"],
  [/\bsgpt\b/gi, "alt"],
  [/\bsgot\b/gi, "ast"],
  [/\bµiu\/ml\b/gi, "uiu/ml"],
  [/\bμiu\/ml\b/gi, "uiu/ml"],
  [/\bmg\/dl\b/gi, "mg/dl"],
  [/°/g, "."],
];

const METRIC_VALIDATION_RULES = {
  hba1c: { plausibleMin: 3, plausibleMax: 20, expectedUnits: ["%", "percent"], critical: true, fractionalExpected: true },
  estimated_average_glucose: { plausibleMin: 40, plausibleMax: 500, expectedUnits: ["mg/dl"], critical: false },
  crp_quantitative: { plausibleMin: 0, plausibleMax: 400, expectedUnits: ["mg/l"], critical: false },
  serum_ige: { plausibleMin: 0, plausibleMax: 10000, expectedUnits: ["iu/ml"], critical: false, fractionalExpected: true },
  fbs: { plausibleMin: 40, plausibleMax: 600, expectedUnits: ["mg/dl"], critical: true },
  ppbs: { plausibleMin: 40, plausibleMax: 700, expectedUnits: ["mg/dl"], critical: true },
  rbs: { plausibleMin: 40, plausibleMax: 700, expectedUnits: ["mg/dl"], critical: true },
  hemoglobin: { plausibleMin: 3, plausibleMax: 25, expectedUnits: ["g/dl", "g/l"], critical: true, fractionalExpected: true },
  rbc_count: { plausibleMin: 1, plausibleMax: 10, expectedUnits: ["mill/cmm", "million/cmm", "10^6"], critical: false, fractionalExpected: true },
  pcv: { plausibleMin: 10, plausibleMax: 70, expectedUnits: ["%"], critical: false, fractionalExpected: true },
  mcv: { plausibleMin: 40, plausibleMax: 150, expectedUnits: ["fl"], critical: false, fractionalExpected: true },
  mch: { plausibleMin: 10, plausibleMax: 60, expectedUnits: ["pg"], critical: false, fractionalExpected: true },
  mchc: { plausibleMin: 15, plausibleMax: 45, expectedUnits: ["%", "g/dl"], critical: false, fractionalExpected: true },
  rdw: { plausibleMin: 8, plausibleMax: 25, expectedUnits: ["%", "fl"], critical: false, fractionalExpected: true },
  wbc: { plausibleMin: 0.5, plausibleMax: 80, expectedUnits: ["10^3/ul", "10^3/u", "thou/cmm", "/cmm", "/cumm"], critical: true, fractionalExpected: true },
  esr: { plausibleMin: 0, plausibleMax: 150, expectedUnits: ["mm/hr", "mm"], critical: false },
  platelets: { plausibleMin: 10, plausibleMax: 1500, expectedUnits: ["10^3/ul", "10^3/u", "lakhs", "/cmm", "/cumm"], critical: true },
  weight: { plausibleMin: 1, plausibleMax: 300, expectedUnits: ["kg"], critical: false, fractionalExpected: true },
  bmi: { plausibleMin: 8, plausibleMax: 80, expectedUnits: ["kg/m", "bmi"], critical: false, fractionalExpected: true },
  total_cholesterol: { plausibleMin: 40, plausibleMax: 500, expectedUnits: ["mg/dl"], critical: true },
  ldl: { plausibleMin: 10, plausibleMax: 400, expectedUnits: ["mg/dl"], critical: true },
  hdl: { plausibleMin: 5, plausibleMax: 150, expectedUnits: ["mg/dl"], critical: true },
  triglycerides: { plausibleMin: 10, plausibleMax: 1000, expectedUnits: ["mg/dl"], critical: true },
  tsh: { plausibleMin: 0.01, plausibleMax: 100, expectedUnits: ["uiu/ml", "miu/l"], critical: true, fractionalExpected: true },
  t3: { plausibleMin: 10, plausibleMax: 600, expectedUnits: ["ng/dl", "pg/ml"], critical: false, fractionalExpected: true },
  t4: { plausibleMin: 0.5, plausibleMax: 30, expectedUnits: ["ug/dl", "ng/dl"], critical: false, fractionalExpected: true },
  creatinine: { plausibleMin: 0.1, plausibleMax: 20, expectedUnits: ["mg/dl"], critical: true, fractionalExpected: true },
  urea: { plausibleMin: 2, plausibleMax: 300, expectedUnits: ["mg/dl"], critical: false, fractionalExpected: true },
  uric_acid: { plausibleMin: 1, plausibleMax: 20, expectedUnits: ["mg/dl"], critical: false, fractionalExpected: true },
  bilirubin_total: { plausibleMin: 0.05, plausibleMax: 40, expectedUnits: ["mg/dl"], critical: true, fractionalExpected: true },
  sgpt_alt: { plausibleMin: 1, plausibleMax: 2000, expectedUnits: ["u/l"], critical: true },
  sgot_ast: { plausibleMin: 1, plausibleMax: 2000, expectedUnits: ["u/l"], critical: true },
  urine_protein: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
  urine_glucose: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
  urine_ketones: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
  urine_bilirubin: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
  urine_blood: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
  urine_urobilinogen: { plausibleMin: 0, plausibleMax: 4, expectedUnits: [], critical: false },
};

const UNIT_SYNONYMS = {
  "%": "%",
  percent: "%",
  "mg/dl": "mg/dL",
  "mg %": "mg/dL",
  mgdl: "mg/dL",
  "mg/l": "mg/L",
  "iu/ml": "IU/mL",
  "g/dl": "g/dL",
  "gm/dl": "g/dL",
  "g/l": "g/L",
  "uiu/ml": "uIU/mL",
  "μiu/ml": "uIU/mL",
  "µiu/ml": "uIU/mL",
  "miu/l": "mIU/L",
  "ng/dl": "ng/dL",
  "pg/ml": "pg/mL",
  "ug/dl": "ug/dL",
  "mcg/dl": "ug/dL",
  "u/l": "U/L",
  "iu/l": "U/L",
  "fl": "fL",
  pg: "pg",
  "mm/hr": "mm/hr",
  mm: "mm/hr",
  "10^3/ul": "10^3/uL",
  "10^3/u": "10^3/uL",
  thoucmm: "10^3/uL",
  "/cmm": "/cmm",
  "/cumm": "/cmm",
  "lakhs/cmm": "lakhs/cmm",
  "lakhs/cu.mm": "lakhs/cmm",
  "mill/cmm": "mill/cmm",
  "million/cmm": "mill/cmm",
  "10^6/ul": "mill/cmm",
  "10^6/cmm": "mill/cmm",
  kg: "kg",
  "kg/m²": "kg/m²",
  "kg/m2": "kg/m²",
};

const METRIC_UNIT_PATTERNS = {
  default: [
    /(?:μiu\/ml|µiu\/ml|uiu\/ml|miu\/l|mg\/dl|mg\/l|g\/dl|gm\/dl|g\/l|ng\/dl|pg\/ml|ug\/dl|mcg\/dl|u\/l|iu\/l|fL|pg|mm\/hr|kg\/m²|kg\/m2|kg|lakhs\/cmm|lakhs\/cu\.mm|mill\/cmm|million\/cmm|10\^3\/uL|10\^3\/ul|10\^6\/uL|10\^6\/ul|10\^6\/cmm|%)/i,
  ],
  platelets: [/(?:lakhs\/cmm|lakhs\/cu\.mm|10\^3\/uL|10\^3\/ul|\/cmm|\/cumm)/i],
  wbc: [/(?:10\^3\/uL|10\^3\/ul|thou\/cmm|\/cmm|\/cumm)/i],
  tsh: [/(?:μiu\/ml|µiu\/ml|uiu\/ml|miu\/l)/i],
  t3: [/(?:ng\/dl|pg\/ml)/i],
  t4: [/(?:ug\/dl|mcg\/dl|ng\/dl)/i],
};

const METRIC_UNIT_CONVERSIONS = {
  hemoglobin: {
    "g/L->g/dL": (value) => value / 10,
  },
  wbc: {
    "/cmm->10^3/uL": (value) => value / 1000,
  },
  platelets: {
    "lakhs/cmm->10^3/uL": (value) => value * 100,
    "/cmm->10^3/uL": (value) => value / 1000,
  },
  tsh: {
    "mIU/L->uIU/mL": (value) => value,
  },
};

function listReportCatalog() {
  return Object.entries(REPORT_CATALOG).map(([key, item]) => ({
    key,
    label: item.label,
    metrics: item.metrics,
  }));
}

function detectLabSource(text = "") {
  const haystack = String(text || "");
  const match = LAB_SOURCE_PATTERNS.find((item) => item.pattern.test(haystack));
  return match || null;
}

function buildSectionExcerpt(text = "", patterns = []) {
  const lines = String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (patterns.some((pattern) => pattern.test(lines[index]))) {
      return lines.slice(index, Math.min(lines.length, index + 4)).join(" ");
    }
  }
  return lines.slice(0, 4).join(" ");
}

function normalizeExtractedReportText(text = "") {
  let normalized = String(text || "");
  NORMALIZATION_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  normalized = normalized
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+:\s+/g, ": ")
    .replace(/test method.*$/gim, "")
    .replace(/sample collected.*$/gim, "")
    .replace(/authori[sz]ed signatory.*$/gim, "")
    .replace(/end of report.*$/gim, "")
    .trim();

  return normalized;
}

function evaluateMetric(metric, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return { zone: "neutral", label: "No reading" };
  if (metric.low != null && number < metric.low) return { zone: "low", label: "Below range" };
  if (metric.high != null && number > metric.high) return { zone: "high", label: "Above range" };
  return { zone: "normal", label: "Within range" };
}

function normalizeContextList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePatientContext(patientContext = {}) {
  const ageYears = Number(patientContext.ageYears ?? patientContext.age ?? null);
  const sexRaw = String(patientContext.sex || "").trim();
  const sexNormalized = sexRaw.toLowerCase();
  const chronicConditions = normalizeContextList(patientContext.chronicConditions || patientContext.conditions);
  const allergies = normalizeContextList(patientContext.allergies);
  const medications = normalizeContextList(patientContext.medications || patientContext.currentMedications);
  const lowerConditions = chronicConditions.map((item) => item.toLowerCase());
  const lowerAllergies = allergies.map((item) => item.toLowerCase());
  const hasCondition = (pattern) => lowerConditions.some((item) => pattern.test(item));
  const hasAllergy = (pattern) => lowerAllergies.some((item) => pattern.test(item));
  return {
    ageYears: Number.isFinite(ageYears) ? ageYears : null,
    sex: sexRaw,
    sexNormalized,
    chronicConditions,
    allergies,
    medications,
    flags: {
      pediatric: Number.isFinite(ageYears) && ageYears < 18,
      olderAdult: Number.isFinite(ageYears) && ageYears >= 65,
      diabetes: hasCondition(/\bdiabetes\b|\bprediabetes\b|blood sugar|\bdm\b|\bt1dm\b|\bt2dm\b|type\s*1\s*dm|type\s*2\s*dm/),
      thyroid: hasCondition(/thyroid|hypothy|hyperthy/),
      kidney: hasCondition(/kidney|renal|ckd/),
      liver: hasCondition(/liver|hepat/),
      allergy:
        hasCondition(/allerg|asthma|eczema|sinus|rhinitis|urticaria|hives|hay fever/) ||
        hasAllergy(/allerg|dust|pollen|food|drug|penicillin|peanut|shellfish|milk|egg|soy|wheat/),
      inflammatorySkin: hasCondition(/\bhs\b|hidradenitis|psoriasis|chronic inflammation|inflammatory skin/),
      heartMetabolic: hasCondition(/hypertension|bp|cholesterol|heart|cardiac|metabolic/),
      anemiaHistory: hasCondition(/anemia|iron|b12/),
    },
  };
}

function buildPatientContextLines(patientContext = {}) {
  const context = normalizePatientContext(patientContext);
  return dedupeLines([
    Number.isFinite(context.ageYears) ? `Age: ${context.ageYears} years` : "",
    context.sex ? `Sex: ${context.sex}` : "",
    context.chronicConditions.length ? `Known conditions: ${context.chronicConditions.join(", ")}` : "",
    context.allergies.length ? `Allergies: ${context.allergies.join(", ")}` : "",
    context.medications.length ? `Current medicines: ${context.medications.join(", ")}` : "",
  ], 5);
}

function getContextualMetricDefinition(metricDef = {}, patientContext = {}) {
  const context = normalizePatientContext(patientContext);
  const sex = context.sexNormalized;
  if (context.flags.pediatric) return { ...metricDef };
  const overrides = {
    hemoglobin:
      sex === "male"
        ? { low: 13, high: 17.5 }
        : sex === "female"
          ? { low: 12, high: 15.5 }
          : null,
    rbc_count:
      sex === "male"
        ? { low: 4.5, high: 5.9 }
        : sex === "female"
          ? { low: 4.1, high: 5.1 }
          : null,
    pcv:
      sex === "male"
        ? { low: 40, high: 52 }
        : sex === "female"
          ? { low: 36, high: 46 }
          : null,
    esr:
      sex === "male"
        ? { low: 0, high: 15 }
        : sex === "female"
          ? { low: 0, high: 20 }
          : null,
    creatinine:
      sex === "male"
        ? { low: 0.7, high: 1.3 }
        : sex === "female"
          ? { low: 0.6, high: 1.1 }
          : null,
    hdl:
      sex === "female"
        ? { low: 50, high: 100 }
        : sex === "male"
          ? { low: 40, high: 100 }
          : null,
  }[metricDef.key];
  return overrides ? { ...metricDef, ...overrides } : { ...metricDef };
}

function buildContextFollowUpNote({ priorities = [], canWait = [], patientContext = {} } = {}) {
  const context = normalizePatientContext(patientContext);
  const sex = context.sexNormalized;
  const visibleAreas = new Set(
    priorities.concat(canWait).map((item) => String(item.conditionArea || "").trim()).filter(Boolean),
  );
  if (context.flags.diabetes && visibleAreas.has("diabetes")) {
    return "Existing sugar history was kept in view while organizing this follow-up.";
  }
  if (context.flags.kidney && visibleAreas.has("ckd")) {
    return "Existing kidney history was kept in view while organizing this follow-up.";
  }
  if (context.flags.thyroid && visibleAreas.has("thyroid")) {
    return "Existing thyroid history was kept in view while organizing this follow-up.";
  }
  if (context.flags.allergy && visibleAreas.has("allergy")) {
    return "Known allergy context was kept in view while organizing this follow-up.";
  }
  if (context.flags.pediatric) {
    return "Age-specific interpretation can matter for some lab ranges.";
  }
  if (context.flags.olderAdult) {
    return "Age can change how some lab ranges are interpreted.";
  }
  if ((sex === "male" || sex === "female") && visibleAreas.has("anemia")) {
    return "Sex-specific blood-count ranges were kept in view where relevant.";
  }
  return "";
}

function buildVisibleContextLine(patientContext = {}) {
  const context = normalizePatientContext(patientContext);
  const sex = context.sexNormalized;
  if (context.flags.diabetes) {
    return "Existing sugar history was kept in view.";
  }
  if (context.flags.allergy) {
    return "Known allergy history was kept in view.";
  }
  if (context.flags.kidney) {
    return "Existing kidney history was kept in view.";
  }
  if (context.flags.thyroid) {
    return "Existing thyroid history was kept in view.";
  }
  if (context.flags.pediatric) {
    return "Age-specific interpretation was kept in view.";
  }
  if (context.flags.olderAdult) {
    return "Age-related interpretation was kept in view.";
  }
  if ((sex === "male" || sex === "female") && Number.isFinite(context.ageYears)) {
    return "Age and sex were kept in view where ranges can differ.";
  }
  if (sex === "male" || sex === "female") {
    return "Sex-specific ranges were kept in view where relevant.";
  }
  return "";
}

function buildPersonalizedPriorityTitle(primary = {}, patientContext = {}, healthIssues = {}) {
  const context = normalizePatientContext(patientContext);
  const title = String(primary.title || primary.findingLabel || "").trim();
  if (primary.conditionArea === "diabetes") {
    if (context.flags.inflammatorySkin) return "Sugar control & inflammation balance";
    if (context.flags.diabetes) return "Sugar control follow-up";
  }
  if (primary.conditionArea === "allergy") {
    return "Allergy / immune activity pattern";
  }
  if (primary.conditionArea === "anemia") {
    return "Blood index follow-up";
  }
  if (primary.conditionArea === "anthropometry") {
    return "Weight / metabolic context";
  }
  if (primary.conditionArea === "ckd") {
    return "Kidney follow-up context";
  }
  if (primary.conditionArea === "thyroid") {
    return "Thyroid follow-up context";
  }
  return title || (healthIssues?.topIssue?.focusLabel ? `${healthIssues.topIssue.focusLabel} follow-up` : "Priority follow-up area");
}

function buildPersonalizedWhyThisMatters({ primary = {}, patientContext = {}, healthIssues = {} } = {}) {
  const context = normalizePatientContext(patientContext);
  const lines = [];
  const title = String(primary.title || primary.findingLabel || "").toLowerCase();
  const hasHighBmi = (healthIssues.abnormal || []).some((issue) => issue.key === "bmi");
  if (primary.conditionArea === "diabetes" || title.includes("sugar")) {
    if (context.flags.inflammatorySkin) {
      lines.push("Steadier glucose can matter more when inflammatory skin flare patterns are already part of your health history.");
    }
    lines.push("Higher glucose can affect long-term metabolic strain and day-to-day energy.");
    if (hasHighBmi) {
      lines.push("Weight or metabolic context may make this follow-up area more important to review over time.");
    }
  }
  if (primary.conditionArea === "allergy") {
    lines.push("Immune or allergy findings usually become more meaningful when compared with symptoms, triggers, and repeated patterns.");
    if (context.flags.inflammatorySkin) {
      lines.push("Inflammatory skin history can make allergy or immune context more useful to track over time.");
    }
  }
  if (primary.conditionArea === "anemia") {
    lines.push("These blood-index changes may affect energy, recovery, or how other symptoms are interpreted.");
    if (context.flags.inflammatorySkin) {
      lines.push("Chronic inflammatory conditions can make mild blood-index changes more useful to review in context.");
    }
  }
  if (context.medications.length) {
    lines.push("Your current medicine list should be kept visible during review; do not change a dose based on this summary.");
  }
  if (!lines.length) {
    lines.push("This is the part of the report that may be most useful to review first in your broader health context.");
  }
  return dedupeLines(lines, 4);
}

function buildPersonalizedStableAreas({ conditionSummaries = [], healthIssues = {} } = {}) {
  const stable = [];
  const stableSummaryMap = new Map(
    (conditionSummaries || [])
      .filter((item) => item.zone === "normal")
      .map((item) => [item.key, item]),
  );
  if (stableSummaryMap.has("liver")) stable.push("Liver function stable");
  if (stableSummaryMap.has("ckd")) stable.push("Kidney function preserved");
  if (stableSummaryMap.has("thyroid")) stable.push("Thyroid within range");
  if (stableSummaryMap.has("anthropometry")) stable.push("Weight context is recorded for follow-up");
  if (stableSummaryMap.has("anemia")) stable.push("Broader blood-count pattern is mostly steady");
  if (stableSummaryMap.has("diabetes") && !(healthIssues.abnormal || []).some((issue) => ISSUE_FOCUS_MAP[issue.key] === "diabetes")) {
    stable.push("Sugar markers broadly steady");
  }
  return stable.slice(0, 5);
}

function buildPersonalizedFollowUp({
  guidedFollowUp = {},
  healthIssues = {},
  conditionSummaries = [],
  patientContext = {},
} = {}) {
  const context = normalizePatientContext(patientContext);
  const priorities = Array.isArray(guidedFollowUp.priorities) ? guidedFollowUp.priorities : [];
  const canWait = Array.isArray(guidedFollowUp.canWait) ? guidedFollowUp.canWait : [];
  const primary = priorities[0] || null;
  const firstIncluded = primary?.includedFindings?.[0] || null;
  const personalFactors = [
    ...context.chronicConditions.slice(0, 3),
    ...(healthIssues.abnormal || [])
      .filter((issue) => issue.key === "bmi")
      .slice(0, 1)
      .map((issue) => `${issue.parameter}: ${formatIssueValue(issue)}`),
  ];
  const secondaryAreas = priorities
    .slice(1)
    .concat(canWait.slice(0, 2))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      title: buildPersonalizedPriorityTitle(item, context, healthIssues),
      findings: (item.includedFindings || []).map((finding) => finding.label).slice(0, 4),
      summary: item.summary,
    }));
  const stableAreas = buildPersonalizedStableAreas({ conditionSummaries, healthIssues });
  const oneClearFocus =
    primary?.conditionArea === "diabetes" && context.flags.inflammatorySkin
      ? "Improve sugar consistency while reducing inflammatory triggers."
      : primary?.conditionArea === "diabetes"
        ? "Improve sugar consistency first."
        : primary?.conditionArea === "allergy"
          ? "Track immune or allergy context without overreacting to one report."
          : primary?.conditionArea === "anemia"
            ? "Keep blood-index follow-up practical and symptom-linked."
            : primary?.title
              ? `Start with ${String(primary.title).toLowerCase()}.`
              : "Start with one clear follow-up area.";
  const actionCheckInOptions =
    primary?.conditionArea === "diabetes" && context.flags.inflammatorySkin
      ? ["HS flare active today", "Mild pain or swelling today", "Fatigue higher than usual", "Feeling stable overall", "No major symptoms today"]
      : primary?.conditionArea === "diabetes"
        ? ["Recent sugar felt high", "Feeling more tired than usual", "Meal timing was off today", "Feeling stable overall", "No major symptoms today"]
        : primary?.conditionArea === "allergy"
          ? ["Sneezing or sinus symptoms today", "Skin symptoms today", "Breathing symptoms today", "Feeling stable overall", "No major symptoms today"]
          : ["Symptoms active today", "Energy lower than usual", "Feeling stable overall", "No major symptoms today"];
  const followUpPlan =
    primary?.conditionArea === "diabetes" && context.flags.inflammatorySkin
      ? {
          today: ["Log skin activity if relevant.", "Log fatigue or energy if relevant.", "Keep hydration and sleep quality visible."],
          thisWeek: ["Reduce sugar spikes where realistic.", "Keep sleep timing more consistent.", "Track flare patterns or trigger-linked changes only if useful."],
          beforeNextReview: ["Keep glucose consistency visible.", "Keep skin flare frequency visible.", "Keep trigger or symptom patterns visible if they help the next review."],
        }
      : primary?.conditionArea === "diabetes"
        ? {
            today: ["Keep one recent sugar reading visible if available.", "Log appetite, thirst, sleep, or energy only if relevant."],
            thisWeek: ["Reduce sugar spikes where realistic.", "Keep meal timing or medicine timing visible if useful.", "Track one symptom or routine pattern only if it helps."],
            beforeNextReview: ["Bring prior HbA1c or glucose reports if available.", "Keep glucose consistency visible.", "Keep one useful symptom or routine note ready."],
          }
        : primary?.conditionArea === "allergy"
          ? {
              today: ["Log allergy, skin, sinus, or breathing symptoms only if relevant."],
              thisWeek: ["Track whether symptoms are repeated, seasonal, or trigger-linked.", "Keep medicines or triggers visible only if useful."],
              beforeNextReview: ["Keep symptom patterns ready for review.", "Bring prior reports if available."],
            }
          : {
              today: ["Keep one useful symptom or report note visible."],
              thisWeek: ["Track the clearest follow-up area without overloading the week."],
              beforeNextReview: ["Bring prior reports if available.", "Keep one short note ready for discussion."],
            };
  const doctorQuestions = dedupeLines(
    (guidedFollowUp.doctorQuestions || []).concat(
      primary?.conditionArea === "diabetes" && context.flags.inflammatorySkin
        ? ["Could higher sugar levels be worsening inflammation or flare patterns in my existing condition?"]
        : [],
      secondaryAreas.some((item) => /allergy|immune/i.test(item.title))
        ? ["Should allergy evaluation be considered for the elevated immune-related markers?"]
        : [],
        secondaryAreas.some((item) => /blood index|red-cell|cbc/i.test(item.title))
          ? ["Do these blood-index changes need iron, B12, or nutrition review?"]
          : [],
    ),
    5,
  );
  const doctorHandoff = {
    mainAreas: dedupeLines(
      [
        firstIncluded ? `${firstIncluded.label}: ${firstIncluded.value || ""}` : "",
        ...context.chronicConditions.slice(0, 2),
        ...secondaryAreas.slice(0, 2).map((item) => item.title),
        ...(healthIssues.abnormal || [])
          .filter((issue) => issue.key === "bmi")
          .slice(0, 1)
          .map((issue) => `${issue.parameter}: ${formatIssueValue(issue)}`),
      ],
      6,
    ),
    suggestedFocus:
      primary?.conditionArea === "diabetes" && context.flags.inflammatorySkin
        ? "Metabolic follow-up with inflammation-aware continuity tracking."
        : primary?.conditionArea === "diabetes"
          ? "Metabolic follow-up with continuity tracking."
          : primary?.conditionArea === "allergy"
            ? "Immune or symptom-context follow-up with continuity tracking."
            : "Structured follow-up with continuity tracking.",
  };

  return {
    priorityArea: primary
      ? {
          title: buildPersonalizedPriorityTitle(primary, context, healthIssues),
          findingLabel: firstIncluded?.label || primary.title,
          findingValue: firstIncluded?.value || "",
          whatThisMeans: primary.summary,
          personalFactors,
          whyThisMatters: buildPersonalizedWhyThisMatters({ primary, patientContext: context, healthIssues }),
          urgencyNote: primary.attentionLabel === "Worth timely follow-up"
            ? "This does not suggest an emergency, but it does deserve structured follow-up."
            : "This does not look like an emergency, but it is worth reviewing in context.",
        }
      : null,
    secondaryAreas,
    stableAreas,
    oneClearFocus,
    actionCheckInOptions,
    followUpPlan,
    doctorQuestions,
    doctorHandoff,
  };
}

function buildNarrative(metric, latest, previous) {
  const evaluation = evaluateMetric(metric, latest?.value);
  const latestText = `${metric.label} is ${latest?.value}${metric.unit ? ` ${metric.unit}` : ""}`;
  if (!previous) {
    return `${latestText}, ${evaluation.label.toLowerCase()}.`;
  }
  const delta = Number(latest.value) - Number(previous.value);
  const direction = delta === 0 ? "stable" : delta > 0 ? "up" : "down";
  const trendWords =
    metric.trend === "higher_better"
      ? direction === "up"
        ? "improved upward"
        : direction === "down"
          ? "fallen"
          : "remained stable"
      : metric.trend === "lower_better"
        ? direction === "down"
          ? "improved downward"
          : direction === "up"
            ? "risen"
            : "remained stable"
        : direction === "up"
          ? "risen"
          : direction === "down"
            ? "fallen"
            : "remained stable";
  return `${latestText}, ${evaluation.label.toLowerCase()}, and has ${trendWords} compared with the previous reading.`;
}

function buildDateLabel(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toISOString().slice(0, 10);
}

function inferReportType(text = "", hintedReportType = "") {
  if (hintedReportType && REPORT_CATALOG[hintedReportType]) return hintedReportType;
  const haystack = String(text || "").toLowerCase();
  let best = { key: "", score: 0 };
  Object.entries(REPORT_CATALOG).forEach(([key, config]) => {
    const score = (config.keywords || []).reduce((sum, keyword) => sum + (haystack.includes(keyword.toLowerCase()) ? 2 : 0), 0)
      + config.metrics.reduce((sum, metric) => sum + (haystack.includes(metric.label.toLowerCase()) ? 1 : 0), 0);
    if (score > best.score) best = { key, score };
  });
  return best.key || "";
}

function findMetricDefinition(metricKey) {
  for (const config of Object.values(REPORT_CATALOG)) {
    const metric = (config.metrics || []).find((item) => item.key === metricKey);
    if (metric) return metric;
  }
  return null;
}

function parsePatientAgeYears(text = "") {
  const haystack = String(text || "");
  const match = haystack.match(/age\s*\/?\s*sex\s*:\s*(\d+)\s*years?/i) || haystack.match(/\b(\d+)\s*years?\s*\/\s*(male|female)\b/i);
  if (!match) return null;
  const age = Number(match[1]);
  return Number.isFinite(age) ? age : null;
}

function extractIgeReferenceBand(text = "", ageYears = null) {
  const haystack = String(text || "");
  if (!Number.isFinite(ageYears)) return null;
  const patterns = [
    { min: 8, max: Infinity, regex: /8\s*years?\s*&\s*above\s*:\s*upto\s*([\d.]+)/i },
    { min: 6, max: 8, regex: /6\s*-\s*8\s*years?\s*:\s*upto\s*([\d.]+)/i },
    { min: 4, max: 6, regex: /4\s*-\s*6\s*years?\s*:\s*upto\s*([\d.]+)/i },
    { min: 2, max: 4, regex: /2\s*-\s*4\s*years?\s*:\s*upto\s*([\d.]+)/i },
    { min: 1, max: 2, regex: /1\s*-\s*2\s*years?\s*:\s*upto\s*([\d.]+)/i },
    { min: 0.5, max: 1, regex: /6\s*-\s*12\s*month\s*:\s*upto\s*([\d.]+)/i },
    { min: 0, max: 0.5, regex: /1\s*-\s*6\s*month\s*:\s*upto\s*([\d.]+)/i },
  ];
  const band = patterns.find((item) => ageYears >= item.min && ageYears < item.max);
  if (!band) return null;
  const match = haystack.match(band.regex);
  if (!match) return null;
  return {
    high: Number(match[1]),
    text: match[0].trim(),
  };
}

function extractQualitativeReferenceText(metricKey, text = "") {
  const haystack = String(text || "");
  const linePatterns = {
    urine_protein: /negative\s*:\s*.*$/im,
    urine_glucose: /negative\s*:\s*.*$/im,
    urine_ketones: /negative\s*:\s*.*$/im,
    urine_bilirubin: /negative\s*:\s*.*$/im,
    urine_blood: /negative\s*:\s*.*$/im,
    urine_urobilinogen: /normal\s*:\s*.*$/im,
  };
  const match = haystack.match(linePatterns[metricKey]);
  return match ? match[0].trim() : "";
}

function canonicalizeUnit(unit = "") {
  const normalized = String(unit || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[μµ]/g, "u");
  const compact = normalized.toLowerCase().replace(/\s+/g, "");
  return UNIT_SYNONYMS[compact] || UNIT_SYNONYMS[normalized.toLowerCase()] || normalized || "";
}

function getUnitPatternsForMetric(metricKey) {
  return METRIC_UNIT_PATTERNS[metricKey] || METRIC_UNIT_PATTERNS.default;
}

function buildLineContext(text = "", start = 0, end = 0) {
  const source = String(text || "");
  const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let lineEnd = source.indexOf("\n", Math.max(end, start));
  if (lineEnd < 0) lineEnd = source.length;
  const line = source.slice(lineStart, lineEnd).trim();
  const matchStart = Math.max(0, start - lineStart);
  const matchEnd = Math.max(matchStart, Math.min(line.length, end - lineStart));
  return {
    line,
    before: line.slice(0, matchStart).trim(),
    after: line.slice(matchEnd).trim(),
  };
}

function detectOriginalUnit(metricKey, context = "", metricDef = null) {
  const haystack = `${context} ${metricDef?.unit || ""}`;
  const match = getUnitPatternsForMetric(metricKey).map((pattern) => haystack.match(pattern)).find(Boolean);
  if (!match?.[0]) return canonicalizeUnit(metricDef?.unit || "");
  return canonicalizeUnit(match[0]);
}

function extractReferenceRangeFromText(text = "") {
  const haystack = String(text || "");
  const parseRangeNumber = (value = "") => Number(String(value || "").replace(/,/g, ""));
  const isDateLikeRange = (rawText = "", low = null, high = null) => {
    const normalized = String(rawText || "").toLowerCase();
    if (!normalized) return false;
    if (/\b(?:report|sample|collected|dob|date)\b/.test(normalized)) return true;
    if (/\b\d{1,4}[\/-]\d{1,2}(?:[\/-]\d{1,4})?\b/.test(normalized)) return true;
    if (Number.isFinite(low) && Number.isFinite(high) && low > high) return true;
    return false;
  };
  const upperBoundMatch = haystack.match(/(?:<|upto|up to|less than)\s*(\d+(?:\.\d+)?)/i);
  if (upperBoundMatch) {
    return {
      low: null,
      high: parseRangeNumber(upperBoundMatch[1]),
      text: upperBoundMatch[0].trim(),
    };
  }
  const lowerBoundMatch = haystack.match(/(?:>|more than|greater than)\s*(\d+(?:\.\d+)?)/i);
  if (lowerBoundMatch) {
    return {
      low: parseRangeNumber(lowerBoundMatch[1]),
      high: null,
      text: lowerBoundMatch[0].trim(),
    };
  }
  const patterns = [
    /(?:reference range|reference interval|biological reference interval|bio reference interval|normal range)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*(?:to|[-–—])\s*([\d,]+(?:\.\d+)?)/i,
    /\(([\d,]+(?:\.\d+)?)\s*(?:to|[-–—])\s*([\d,]+(?:\.\d+)?)\)/i,
    /\b([\d,]+(?:\.\d+)?)\s*(?:to|[-–—])\s*([\d,]+(?:\.\d+)?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match) {
      const low = parseRangeNumber(match[1]);
      const high = parseRangeNumber(match[2]);
      if (isDateLikeRange(match[0], low, high)) {
        continue;
      }
      return {
        low,
        high,
        text: match[0].trim(),
      };
    }
  }
  return null;
}

function convertMetricValue(metricKey, value, fromUnit = "", toUnit = "") {
  const source = canonicalizeUnit(fromUnit);
  const target = canonicalizeUnit(toUnit);
  if (!Number.isFinite(Number(value))) return { value: Number(value), converted: false };
  if (!source || !target || source === target) {
    return { value: Number(value), converted: source === target && Boolean(source) };
  }
  const ruleSet = METRIC_UNIT_CONVERSIONS[metricKey] || {};
  const converter = ruleSet[`${source}->${target}`];
  if (!converter) {
    return { value: Number(value), converted: false };
  }
  return { value: converter(Number(value)), converted: true };
}

function deriveInterpretationBand(value, low, high) {
  const numericValue = Number(value);
  const lowValue = Number(low);
  const highValue = Number(high);
  if (!Number.isFinite(numericValue)) return "unknown";
  if (Number.isFinite(lowValue) && numericValue < lowValue) return "low";
  if (Number.isFinite(highValue) && numericValue > highValue) return "high";
  return "normal";
}

function mapQualitativeValue(rawValue = "") {
  const normalized = String(rawValue || "").trim().toLowerCase();
  return QUALITATIVE_RESULT_MAP[normalized] || null;
}

function normalizeMetricMeasurement({ metricKey, metricDef, value, originalUnit = "", originalReferenceLow = null, originalReferenceHigh = null, patientAgeYears = null, fullText = "" }) {
  const canonicalUnit = canonicalizeUnit(metricDef?.unit || "");
  const sourceUnit = canonicalizeUnit(originalUnit || canonicalUnit);
  const normalizedValue = convertMetricValue(metricKey, value, sourceUnit, canonicalUnit).value;
  const hasOriginalReferenceLow = originalReferenceLow !== null && originalReferenceLow !== undefined && originalReferenceLow !== "" && Number.isFinite(Number(originalReferenceLow));
  const hasOriginalReferenceHigh = originalReferenceHigh !== null && originalReferenceHigh !== undefined && originalReferenceHigh !== "" && Number.isFinite(Number(originalReferenceHigh));
  const normalizedReferenceLow = hasOriginalReferenceLow
    ? convertMetricValue(metricKey, Number(originalReferenceLow), sourceUnit, canonicalUnit).value
    : metricDef?.low ?? null;
  let normalizedReferenceHigh = hasOriginalReferenceHigh
    ? convertMetricValue(metricKey, Number(originalReferenceHigh), sourceUnit, canonicalUnit).value
    : metricDef?.high ?? null;
  let effectiveOriginalReferenceHigh = originalReferenceHigh;
  let effectiveOriginalReferenceText = "";
  if (metricKey === "serum_ige") {
    const ageBand = extractIgeReferenceBand(fullText, patientAgeYears);
    if (Number.isFinite(ageBand?.high)) {
      effectiveOriginalReferenceHigh = ageBand.high;
      effectiveOriginalReferenceText = ageBand.text || "";
      normalizedReferenceHigh = ageBand.high;
    }
  }
  return {
    normalizedValue,
    normalizedUnit: canonicalUnit,
    normalizedReferenceLow,
    normalizedReferenceHigh,
    interpretationBand: deriveInterpretationBand(normalizedValue, normalizedReferenceLow, normalizedReferenceHigh),
    originalReferenceHigh: effectiveOriginalReferenceHigh,
    originalReferenceText: effectiveOriginalReferenceText,
  };
}

function extractQualitativeMetricCandidate(metricKey, text = "") {
  const pattern = QUALITATIVE_PATTERNS[metricKey];
  if (!pattern) return null;
  const match = String(text || "").match(pattern);
  if (!match) return null;
  const mapped = mapQualitativeValue(match[1]);
  if (!mapped) return null;
  const excerpt = buildCandidateExcerpt(String(text || ""), match.index || 0, (match.index || 0) + String(match[0] || "").length);
  return {
    value: mapped.numeric,
    confidence: 0.96,
    confidenceBreakdown: { pattern: 0.96, value: 0.96, unit: 1, overall: 0.96 },
    reviewStatus: "trusted",
    accepted: true,
    reviewReasons: [],
    rawValue: match[1],
    excerpt,
    originalUnit: "",
    originalReferenceLow: 0,
    originalReferenceHigh: 0,
    originalReferenceText: extractQualitativeReferenceText(metricKey, text),
    normalizedUnit: "",
    normalizedReferenceLow: 0,
    normalizedReferenceHigh: 0,
    interpretationBand: mapped.band,
    originalValueText: mapped.text,
    normalizedValueText: mapped.text,
  };
}

function normalizeCandidateNumber(rawValue = "") {
  return String(rawValue || "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/,/g, ".")
    .replace(/°/g, ".")
    .replace(/[^\d.]/g, "");
}

function buildCandidateExcerpt(text = "", start = 0, end = 0) {
  const source = String(text || "");
  const left = Math.max(0, start - 60);
  const right = Math.min(source.length, end + 60);
  return source.slice(left, right).replace(/\s+/g, " ").trim();
}

function inferUnitConfidence(metricKey, excerpt = "", metricDef = null) {
  const rule = METRIC_VALIDATION_RULES[metricKey] || {};
  const expectedUnits = rule.expectedUnits || [];
  if (!expectedUnits.length) return { unitConfidence: 0.8, unitMatched: false, reasons: [] };
  const haystack = String(excerpt || "").toLowerCase();
  const unitMatched = expectedUnits.some((token) => haystack.includes(String(token).toLowerCase()));
  if (unitMatched) {
    return { unitConfidence: 0.97, unitMatched: true, reasons: [] };
  }
  const genericMetricUnit = String(metricDef?.unit || "").toLowerCase().replace(/\s+/g, "");
  if (genericMetricUnit && haystack.includes(genericMetricUnit.replace(/²/g, ""))) {
    return { unitConfidence: 0.9, unitMatched: true, reasons: [] };
  }
  return {
    unitConfidence: 0.62,
    unitMatched: false,
    reasons: ["expected unit not clearly present near the extracted value"],
  };
}

function applyMetricScaleNormalization(metricKey, rawValue, numericValue, originalUnit = "") {
  let value = numericValue;
  let normalizationReason = "";
  const sourceUnit = canonicalizeUnit(originalUnit);
  if (metricKey === "hemoglobin" && sourceUnit !== "g/L" && value > 30 && value < 250) {
    value = value / 10;
    normalizationReason = "scaled down hemoglobin by 10 from OCR-style integer";
  }
  if (metricKey === "hba1c" && value >= 20 && value < 200 && !String(rawValue || "").includes(".")) {
    value = value / 10;
    normalizationReason = "scaled down HbA1c by 10 from OCR-style integer";
  }
  if ((metricKey === "mch" || metricKey === "mchc") && value >= 100 && value < 1000 && !String(rawValue || "").includes(".")) {
    value = value / 10;
    normalizationReason = `scaled down ${metricKey} by 10 from OCR-style integer`;
  }
  if ((metricKey === "wbc" || metricKey === "platelets") && !["/cmm", "lakhs/cmm"].includes(sourceUnit) && value > 1000) {
    value = value / 1000;
    normalizationReason = `scaled down ${metricKey} by 1000 based on count unit convention`;
  }
  if (metricKey === "tsh" && value >= 100 && !String(rawValue || "").includes(".")) {
    value = value / 100;
    normalizationReason = "scaled down TSH by 100 from OCR-style integer";
  }
  if (metricKey === "creatinine" && value >= 10 && String(rawValue || "").length === 3 && String(rawValue || "").startsWith("0")) {
    value = Number(`0.${String(rawValue).slice(1)}`);
    normalizationReason = "reformatted creatinine leading-zero OCR token";
  }
  if (metricKey === "rbc_count" && value >= 100 && value < 10000) {
    value = value / 1000;
    normalizationReason = "scaled down RBC count by 1000 based on count unit convention";
  }
  return { value, normalizationReason };
}

function validateExtractedMetric(metricKey, rawValue, value, excerpt = "", patternIndex = 0, metricDef = null) {
  const rule = METRIC_VALIDATION_RULES[metricKey] || {};
  const reasons = [];
  let hardReject = false;

  if (!Number.isFinite(value)) {
    return {
      accepted: false,
      reviewStatus: "rejected",
      confidence: 0,
      confidenceBreakdown: { pattern: 0, value: 0, unit: 0, overall: 0 },
      reviewReasons: ["no numeric value could be parsed"],
    };
  }

  if (rule.plausibleMin != null && value < rule.plausibleMin) {
    reasons.push(`value ${value} is below plausible ${metricKey} range`);
    hardReject = true;
  }
  if (rule.plausibleMax != null && value > rule.plausibleMax) {
    reasons.push(`value ${value} is above plausible ${metricKey} range`);
    hardReject = true;
  }

  const excerptLower = String(excerpt || "").toLowerCase();
  const isWholeNumberWithConvertibleUnit =
    (metricKey === "hemoglobin" && (excerptLower.includes("g/l") || excerptLower.includes("gm/l"))) ||
    ((metricKey === "wbc" || metricKey === "platelets") &&
      (excerptLower.includes("/cmm") || excerptLower.includes("/cumm") || excerptLower.includes("lakhs/cmm")));
  if (rule.fractionalExpected && !isWholeNumberWithConvertibleUnit && !String(rawValue || "").includes(".") && value < 15) {
    reasons.push("fractional metric was extracted without a decimal point");
  }

  const patternConfidence = Math.max(0.52, 0.97 - patternIndex * 0.08);
  let valueConfidence = hardReject ? 0.1 : 0.9;
  if (reasons.some((reason) => reason.includes("fractional metric"))) {
    valueConfidence -= 0.16;
  }

  const { unitConfidence, unitMatched, reasons: unitReasons } = inferUnitConfidence(metricKey, excerpt, metricDef);
  reasons.push(...unitReasons);
  if (!unitMatched && (METRIC_VALIDATION_RULES[metricKey]?.critical || false)) {
    valueConfidence -= 0.08;
  }

  const overall = Math.max(
    0,
    Math.min(0.99, Math.round(((patternConfidence * 0.3 + valueConfidence * 0.45 + unitConfidence * 0.25)) * 100) / 100),
  );
  const reviewStatus = hardReject ? "rejected" : overall < 0.88 ? "needs_review" : "trusted";

  return {
    accepted: !hardReject,
    reviewStatus,
    confidence: overall,
    confidenceBreakdown: {
      pattern: Math.round(patternConfidence * 100) / 100,
      value: Math.max(0, Math.round(valueConfidence * 100) / 100),
      unit: Math.round(unitConfidence * 100) / 100,
      overall,
    },
    reviewReasons: reasons,
  };
}

function extractMetricCandidate(metricKey, text, options = {}) {
  const qualitativeCandidate = extractQualitativeMetricCandidate(metricKey, text);
  if (qualitativeCandidate) return qualitativeCandidate;
  const patterns = EXTRACTION_PATTERNS[metricKey] || [];
  for (const [index, pattern] of patterns.entries()) {
    const match = pattern.exec(String(text || ""));
    let rawValue = normalizeCandidateNumber(String(match?.[1] || ""));
    if (!rawValue && metricKey === "sgpt_alt" && match?.[0]) {
      const lineNumbers = String(match[0]).match(/\d+(?:\.\d+)?/g) || [];
      rawValue = lineNumbers[lineNumbers.length - 1] || "";
    }
    let value = Number(rawValue);
    if (Number.isFinite(value)) {
      if (value === 0) {
        continue;
      }
      const excerpt = buildCandidateExcerpt(String(text || ""), match?.index || 0, (match?.index || 0) + String(match?.[0] || "").length);
      const context = buildLineContext(String(text || ""), match?.index || 0, (match?.index || 0) + String(match?.[0] || "").length);
      const metricDef = findMetricDefinition(metricKey);
      const originalUnit = detectOriginalUnit(metricKey, `${context.line} ${excerpt}`, metricDef);
      const { value: scaledValue, normalizationReason } = applyMetricScaleNormalization(metricKey, rawValue, value, originalUnit);
      value = scaledValue;
      const extractedRange =
        extractReferenceRangeFromText(context.after) ||
        extractReferenceRangeFromText(context.line) ||
        extractReferenceRangeFromText(excerpt);
      const normalizedMeasurement = normalizeMetricMeasurement({
        metricKey,
        metricDef,
        value,
        originalUnit,
        originalReferenceLow: extractedRange?.low ?? null,
        originalReferenceHigh: extractedRange?.high ?? null,
        patientAgeYears: options.patientAgeYears ?? null,
        fullText: String(text || ""),
      });
      const validation = validateExtractedMetric(
        metricKey,
        rawValue,
        normalizedMeasurement.normalizedValue,
        `${excerpt} ${originalUnit}`.trim(),
        index,
        metricDef,
      );
      const reviewReasons = normalizationReason ? [...validation.reviewReasons, normalizationReason] : validation.reviewReasons;
      return {
        value: normalizedMeasurement.normalizedValue,
        confidence: validation.confidence,
        confidenceBreakdown: validation.confidenceBreakdown,
        reviewStatus: validation.reviewStatus,
        accepted: validation.accepted,
        reviewReasons,
        rawValue,
        excerpt,
        originalUnit,
        originalReferenceLow: extractedRange?.low ?? null,
        originalReferenceHigh: normalizedMeasurement.originalReferenceHigh ?? extractedRange?.high ?? null,
        originalReferenceText: normalizedMeasurement.originalReferenceText || extractedRange?.text || "",
        normalizedUnit: normalizedMeasurement.normalizedUnit,
        normalizedReferenceLow: normalizedMeasurement.normalizedReferenceLow,
        normalizedReferenceHigh: normalizedMeasurement.normalizedReferenceHigh,
        interpretationBand: normalizedMeasurement.interpretationBand,
        originalValueText: String(rawValue || ""),
        normalizedValueText: String(normalizedMeasurement.normalizedValue),
        patternIndex: index,
      };
    }
  }
  return null;
}

function parseReportText({ text = "", hintedReportType = "", reportDate = "" } = {}) {
  const sourceText = String(text || "").trim();
  if (!sourceText) {
    return {
      reportType: hintedReportType && REPORT_CATALOG[hintedReportType] ? hintedReportType : "",
      metrics: [],
      rejectedMetrics: [],
      reportDate: reportDate || new Date().toISOString().slice(0, 10),
      source: "parsed_text",
      detectedLabSource: null,
      qualityGate: "rejected",
      overallConfidence: 0,
      needsReview: true,
      summary: "Paste extracted report text to auto-suggest values.",
    };
  }

  const normalizedText = normalizeExtractedReportText(sourceText);
  const patientAgeYears = parsePatientAgeYears(sourceText);
  const detectedLabSource = detectLabSource(normalizedText);
  const reportTypeMetrics = Object.entries(REPORT_CATALOG)
    .filter(([key]) => key !== "multi_panel")
    .map(([key, config]) => ({
      key,
      label: config.label,
      keywords: config.keywords || [],
      metrics: (config.metrics || [])
        .map((metric) => {
          const candidate = extractMetricCandidate(metric.key, normalizedText, { patientAgeYears });
          if (!candidate) return null;
          const valueNum = candidate?.value;
          if (!Number.isFinite(valueNum)) return null;
          return {
            metricKey: metric.key,
            metricLabel: metric.label,
            valueNum,
            unit: candidate?.normalizedUnit || metric.unit || "",
            referenceLow: candidate?.normalizedReferenceLow ?? metric.low ?? null,
            referenceHigh: candidate?.normalizedReferenceHigh ?? metric.high ?? null,
            originalMetricLabel: metric.label,
            originalUnit: candidate?.originalUnit || metric.unit || "",
            originalReferenceLow: candidate?.originalReferenceLow ?? null,
            originalReferenceHigh: candidate?.originalReferenceHigh ?? null,
            originalReferenceText: candidate?.originalReferenceText || "",
            interpretationBand: candidate?.interpretationBand || deriveInterpretationBand(valueNum, candidate?.normalizedReferenceLow ?? metric.low, candidate?.normalizedReferenceHigh ?? metric.high),
            originalValueText: candidate?.originalValueText || String(valueNum),
            normalizedValueText: candidate?.normalizedValueText || String(valueNum),
            confidence: candidate?.confidence ?? 0.75,
            confidenceBreakdown: candidate?.confidenceBreakdown || null,
            reviewStatus: candidate?.reviewStatus || "needs_review",
            reviewReasons: candidate?.reviewReasons || [],
            excerpt: candidate?.excerpt || "",
            rawValue: candidate?.rawValue || "",
            accepted: candidate?.accepted !== false,
          };
        })
        .filter(Boolean),
    }))
    .filter((entry) => entry.metrics.length);

  const allCandidates = reportTypeMetrics.flatMap((entry) => entry.metrics);
  const allMetrics = allCandidates.filter((metric) => metric.accepted !== false);
  const rejectedMetrics = allCandidates
    .filter((metric) => metric.accepted === false)
    .map((metric) => ({
      metricKey: metric.metricKey,
      metricLabel: metric.metricLabel,
      attemptedValue: metric.valueNum,
      unit: metric.unit || "",
      reviewStatus: metric.reviewStatus || "rejected",
      reviewReasons: metric.reviewReasons || [],
      excerpt: metric.excerpt || "",
      rawValue: metric.rawValue || "",
    }));
  if (!allMetrics.length) {
    const hintedCatalog = hintedReportType ? REPORT_CATALOG[hintedReportType] : null;
    return {
      reportType: hintedCatalog ? hintedReportType : "",
      metrics: [],
      rejectedMetrics,
      reportDate: reportDate || new Date().toISOString().slice(0, 10),
      source: "parsed_text",
      detectedLabSource,
      qualityGate: "rejected",
      summary: hintedCatalog
        ? `Detected ${hintedCatalog.label}, but no supported numeric values could be extracted confidently.`
        : "Could not confidently identify any supported report values from the extracted report text.",
    };
  }

  const uniqueMetrics = Array.from(
    new Map(allMetrics.map((metric) => [metric.metricKey, metric])).values(),
  );
  const explicitHint = hintedReportType && REPORT_CATALOG[hintedReportType] ? hintedReportType : "";
  const inferredPrimaryType = inferReportType(normalizedText, "");
  const matchedTypes = reportTypeMetrics.map((entry) => entry.key);
  const detectedSections = reportTypeMetrics.map((entry) => {
    const keywordPatterns = entry.keywords.map((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
    const metricPatterns = entry.metrics.map((metric) => new RegExp(`\\b${metric.metricLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
    return {
      key: entry.key,
      label: entry.label,
      metricCount: entry.metrics.length,
      matchedMetrics: entry.metrics.map((metric) => metric.metricLabel),
      excerpt: buildSectionExcerpt(normalizedText, [...keywordPatterns, ...metricPatterns]),
    };
  });
  const reportType =
    explicitHint ||
    (matchedTypes.length > 1 ? "multi_panel" : matchedTypes[0] || inferredPrimaryType || "multi_panel");

  const overallConfidence = uniqueMetrics.length
    ? Math.round(
        (uniqueMetrics.reduce((sum, metric) => sum + Number(metric.confidence || 0), 0) / uniqueMetrics.length) * 100,
      ) / 100
    : 0;
  const needsReview =
    overallConfidence < 0.9 ||
    uniqueMetrics.some((metric) => Number(metric.confidence || 0) < 0.88 || metric.reviewStatus === "needs_review") ||
    rejectedMetrics.some((metric) => (METRIC_VALIDATION_RULES[metric.metricKey]?.critical || false));
  const qualityGate = !uniqueMetrics.length
    ? "rejected"
    : rejectedMetrics.some((metric) => (METRIC_VALIDATION_RULES[metric.metricKey]?.critical || false))
      ? "partial_review"
      : needsReview
        ? "review"
        : "trusted";
  const matchedLabels = reportTypeMetrics.map((entry) => entry.label);

  return {
    reportType,
    metrics: uniqueMetrics,
    rejectedMetrics,
    reportDate: reportDate || new Date().toISOString().slice(0, 10),
    source: "parsed_text",
    detectedLabSource,
    detectedSections,
    overallConfidence,
    needsReview,
    qualityGate,
    summary:
      reportType === "multi_panel"
        ? `Auto-suggested ${uniqueMetrics.length} values across ${matchedLabels.join(", ")} from the extracted report text${detectedLabSource ? ` (${detectedLabSource.label} style detected)` : ""}.`
        : `Auto-suggested ${uniqueMetrics.length} value${uniqueMetrics.length === 1 ? "" : "s"} from the extracted report text${detectedLabSource ? ` (${detectedLabSource.label} style detected)` : ""}.`,
  };
}

function dedupeMetrics(metrics = []) {
  return Array.from(
    new Map(
      (metrics || []).map((metric) => [
        `${metric.metricKey}:${metric.metricLabel}:${metric.unit || ""}`,
        metric,
      ]),
    ).values(),
  );
}

function buildSectionLabel(reportType, pageNumber) {
  const label = REPORT_CATALOG[reportType]?.label || "Detected section";
  return pageNumber ? `${label} (Page ${pageNumber})` : label;
}

function buildMergedSectionLabel(reportType, pageNumbers = []) {
  const label = REPORT_CATALOG[reportType]?.label || "Detected section";
  const cleanPages = [...new Set((pageNumbers || []).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!cleanPages.length) return label;
  if (cleanPages.length === 1) return `${label} (Page ${cleanPages[0]})`;
  const first = cleanPages[0];
  const last = cleanPages[cleanPages.length - 1];
  return `${label} (Pages ${first}-${last})`;
}

function groupMetricsIntoLogicalSections(metrics = []) {
  const grouped = new Map();
  for (const metric of metrics || []) {
    const owner = Object.entries(REPORT_CATALOG)
      .filter(([key]) => key !== "multi_panel")
      .find(([, config]) => (config.metrics || []).some((candidate) => candidate.key === metric.metricKey));
    const reportType = owner?.[0] || "multi_panel";
    if (!grouped.has(reportType)) grouped.set(reportType, []);
    grouped.get(reportType).push(metric);
  }
  return grouped;
}

function parseReportSections({ text = "", pages = [], hintedReportType = "", reportDate = "" } = {}) {
  const normalizedPages = Array.isArray(pages) && pages.length
    ? pages
    : [{ pageNumber: 1, text: String(text || "") }];

  const pageSections = normalizedPages
    .map((page) => {
      const parsed = parseReportText({
        text: page.text,
        hintedReportType,
        reportDate,
      });
      if (!parsed.metrics?.length) return null;
      return {
        pageNumber: page.pageNumber || null,
        reportType: parsed.reportType || "",
        label: buildSectionLabel(parsed.reportType, page.pageNumber),
        reportDate: parsed.reportDate || reportDate || new Date().toISOString().slice(0, 10),
        metrics: parsed.metrics || [],
        rejectedMetrics: parsed.rejectedMetrics || [],
        summary: parsed.summary || "",
        overallConfidence: parsed.overallConfidence ?? null,
        needsReview: parsed.needsReview ?? true,
        qualityGate: parsed.qualityGate || "review",
        detectedLabSource: parsed.detectedLabSource || null,
        excerpt: buildSectionExcerpt(page.text, []),
      };
    })
    .filter(Boolean);

  const aggregated = parseReportText({ text, hintedReportType, reportDate });
  const rawSections = pageSections.length
    ? pageSections
    : aggregated.metrics?.length
      ? [{
          pageNumber: 1,
          reportType: aggregated.reportType || "",
          label: buildSectionLabel(aggregated.reportType, 1),
          reportDate: aggregated.reportDate || reportDate || new Date().toISOString().slice(0, 10),
          metrics: aggregated.metrics || [],
          rejectedMetrics: aggregated.rejectedMetrics || [],
          summary: aggregated.summary || "",
          overallConfidence: aggregated.overallConfidence ?? null,
          needsReview: aggregated.needsReview ?? true,
          qualityGate: aggregated.qualityGate || "review",
          detectedLabSource: aggregated.detectedLabSource || null,
          excerpt: buildSectionExcerpt(text, []),
        }]
      : [];

  let mergedSections = Array.from(
    rawSections.reduce((map, section) => {
      const groupKey = section.reportType || section.label || "unknown";
      const existing = map.get(groupKey);
      if (!existing) {
        map.set(groupKey, {
          sectionKey: groupKey,
          reportType: section.reportType || "",
          label: section.label || buildMergedSectionLabel(section.reportType, [section.pageNumber]),
          reportDate: section.reportDate,
          metrics: [...(section.metrics || [])],
          rejectedMetrics: [...(section.rejectedMetrics || [])],
          summary: section.summary || "",
          overallConfidence: section.overallConfidence ?? null,
          needsReview: Boolean(section.needsReview),
          qualityGate: section.qualityGate || "review",
          detectedLabSource: section.detectedLabSource || null,
          excerpt: section.excerpt || "",
          pageNumbers: section.pageNumber ? [section.pageNumber] : [],
        });
        return map;
      }

      existing.metrics = dedupeMetrics([...(existing.metrics || []), ...(section.metrics || [])]);
      existing.rejectedMetrics = [...(existing.rejectedMetrics || []), ...(section.rejectedMetrics || [])];
      existing.pageNumbers = [...new Set([...(existing.pageNumbers || []), ...(section.pageNumber ? [section.pageNumber] : [])])].sort((a, b) => a - b);
      existing.reportDate = existing.reportDate || section.reportDate;
      existing.summary = existing.summary || section.summary || "";
      existing.excerpt = [existing.excerpt, section.excerpt].filter(Boolean).join(" ").trim();
      existing.overallConfidence =
        existing.overallConfidence == null
          ? section.overallConfidence ?? null
          : section.overallConfidence == null
            ? existing.overallConfidence
            : Math.round(((Number(existing.overallConfidence) + Number(section.overallConfidence)) / 2) * 100) / 100;
      existing.needsReview = Boolean(existing.needsReview || section.needsReview);
      existing.qualityGate =
        existing.qualityGate === "rejected" || section.qualityGate === "rejected"
          ? "rejected"
          : existing.qualityGate === "partial_review" || section.qualityGate === "partial_review"
            ? "partial_review"
            : existing.qualityGate === "review" || section.qualityGate === "review"
              ? "review"
              : "trusted";
      if (!existing.detectedLabSource && section.detectedLabSource) {
        existing.detectedLabSource = section.detectedLabSource;
      }
      return map;
    }, new Map()).values(),
  ).map((section) => ({
    ...section,
    label: buildMergedSectionLabel(section.reportType, section.pageNumbers),
    metricCount: (section.metrics || []).length,
    matchedMetrics: (section.metrics || []).map((metric) => metric.metricLabel),
  }));

  if (mergedSections.length === 1 && mergedSections[0].reportType === "multi_panel") {
    const seed = mergedSections[0];
    const logicalGroups = groupMetricsIntoLogicalSections(seed.metrics || []);
    if (logicalGroups.size > 1) {
      mergedSections = Array.from(logicalGroups.entries()).map(([reportType, metrics]) => ({
        sectionKey: reportType,
        reportType,
        label: buildMergedSectionLabel(reportType, seed.pageNumbers),
        reportDate: seed.reportDate,
        metrics: dedupeMetrics(metrics),
        rejectedMetrics: seed.rejectedMetrics || [],
        summary: `${REPORT_CATALOG[reportType]?.label || "Detected section"} extracted from a bundled report upload.`,
        overallConfidence: seed.overallConfidence,
        needsReview: seed.needsReview,
        qualityGate: seed.qualityGate || "review",
        detectedLabSource: seed.detectedLabSource,
        excerpt: seed.excerpt,
        pageNumbers: seed.pageNumbers,
        metricCount: metrics.length,
        matchedMetrics: metrics.map((metric) => metric.metricLabel),
      }));
    }
  }

  const uniqueMetrics = dedupeMetrics(mergedSections.flatMap((section) => section.metrics || []));
  const matchedTypes = [...new Set(mergedSections.map((section) => section.reportType).filter(Boolean))];

  return {
    reportType: matchedTypes.length > 1 ? "multi_panel" : matchedTypes[0] || aggregated.reportType || "",
    reportDate: aggregated.reportDate || reportDate || new Date().toISOString().slice(0, 10),
    metrics: uniqueMetrics,
    summary: aggregated.summary || "",
    detectedLabSource: aggregated.detectedLabSource || null,
    overallConfidence: aggregated.overallConfidence ?? null,
    needsReview: aggregated.needsReview ?? true,
    qualityGate: aggregated.qualityGate || "review",
    rejectedMetrics: aggregated.rejectedMetrics || [],
    detectedSections: mergedSections.map((section) => ({
      key: section.sectionKey,
      label: section.label,
      metricCount: section.metricCount,
      matchedMetrics: section.matchedMetrics,
      excerpt: section.excerpt,
      pageNumbers: section.pageNumbers,
      reportType: section.reportType,
      qualityGate: section.qualityGate || "review",
      rejectedMetricCount: (section.rejectedMetrics || []).length,
    })),
    sections: mergedSections,
  };
}

function buildConditionSummaries(trends, patientContext = {}) {
  const byKey = new Map(trends.map((trend) => [trend.metricKey, trend]));
  const summaries = [];
  const context = normalizePatientContext(patientContext);

  const hba1c = byKey.get("hba1c");
  const fbs = byKey.get("fbs");
  const ppbs = byKey.get("ppbs");
  const hemoglobin = byKey.get("hemoglobin");
  const tsh = byKey.get("tsh");
  const creatinine = byKey.get("creatinine");
  const ldl = byKey.get("ldl");
  const triglycerides = byKey.get("triglycerides");
  const hdl = byKey.get("hdl");
  const bilirubin = byKey.get("bilirubin_total");
  const alt = byKey.get("sgpt_alt");
  const ast = byKey.get("sgot_ast");

  if (hba1c || fbs || ppbs) {
    const latestHba1c = Number(hba1c?.latestValue);
    const latestFbs = Number(fbs?.latestValue);
    const latestPpbs = Number(ppbs?.latestValue);
    let zone = "normal";
    let summary = "Sugar markers look steady in the latest report window.";
    if ((Number.isFinite(latestHba1c) && latestHba1c >= 6.5) || (Number.isFinite(latestFbs) && latestFbs >= 126) || (Number.isFinite(latestPpbs) && latestPpbs >= 200)) {
      zone = "high";
      summary = "One or more sugar markers are still high, so this needs closer review.";
    } else if ((Number.isFinite(latestHba1c) && latestHba1c >= 5.7) || (Number.isFinite(latestFbs) && latestFbs >= 100) || (Number.isFinite(latestPpbs) && latestPpbs >= 140)) {
      zone = "low";
      summary = "Sugar markers are a little above the ideal range, so this is worth tracking.";
    }
    if (context.flags.diabetes && zone !== "normal") {
      summary = "Sugar-related markers still deserve follow-up in the context of an existing sugar condition.";
    }
    summaries.push({ key: "diabetes", title: "Sugar/metabolic focus", zone, summary });
  }

  if (hemoglobin) {
    const latest = Number(hemoglobin.latestValue);
    summaries.push({
      key: "anemia",
      title: "Red-cell focus",
      zone: Number.isFinite(latest) && latest < 12 ? "high" : "normal",
      summary:
        Number.isFinite(latest) && latest < 12
          ? "Hemoglobin is below range, so red-cell follow-up may be worth considering."
          : "Hemoglobin is in range in the latest reading.",
    });
  }

  if (tsh) {
    const latest = Number(tsh.latestValue);
    let zone = "normal";
    let summary = "Thyroid markers look steady in the latest reading.";
    if (Number.isFinite(latest) && latest > 4.5) {
      zone = "high";
      summary = "TSH is above range, so thyroid follow-up may be worth discussing.";
    } else if (Number.isFinite(latest) && latest < 0.4) {
      zone = "low";
      summary = "TSH is below range, so thyroid review may be worth tracking.";
    }
    if (context.flags.thyroid && zone !== "normal") {
      summary = "Thyroid-related markers may be worth reviewing alongside existing thyroid history.";
    }
    summaries.push({ key: "thyroid", title: "Thyroid focus", zone, summary });
  }

  if (creatinine) {
    const latest = Number(creatinine.latestValue);
    summaries.push({
      key: "ckd",
      title: "Kidney / renal focus",
      zone: Number.isFinite(latest) && latest > 1.2 ? "high" : "normal",
      summary:
        Number.isFinite(latest) && latest > 1.2
          ? "Creatinine is above range, so kidney-related follow-up is worth reviewing."
          : "Creatinine is in range in the latest reading.",
    });
  }

  if (ldl || triglycerides || hdl) {
    const latestLdl = Number(ldl?.latestValue);
    const latestTriglycerides = Number(triglycerides?.latestValue);
    const latestHdl = Number(hdl?.latestValue);
    let zone = "normal";
    let summary = "Cholesterol markers do not show a strong risk pattern right now.";
    if ((Number.isFinite(latestLdl) && latestLdl >= 130) || (Number.isFinite(latestTriglycerides) && latestTriglycerides >= 200) || (Number.isFinite(latestHdl) && latestHdl < 40)) {
      zone = "high";
      summary = "Cholesterol markers need attention because LDL or triglycerides are high, or HDL is low.";
    } else if ((Number.isFinite(latestLdl) && latestLdl >= 100) || (Number.isFinite(latestTriglycerides) && latestTriglycerides >= 150)) {
      zone = "low";
      summary = "Cholesterol markers are slightly off target, so keep an eye on the trend.";
    }
    summaries.push({ key: "lipid", title: "Lipid risk focus", zone, summary });
  }

  if (bilirubin || alt || ast) {
    const latestBilirubin = Number(bilirubin?.latestValue);
    const latestAlt = Number(alt?.latestValue);
    const latestAst = Number(ast?.latestValue);
    let zone = "normal";
    let summary = "Liver markers look steady in the latest reading.";
    if ((Number.isFinite(latestBilirubin) && latestBilirubin > 1.2) || (Number.isFinite(latestAlt) && latestAlt > 45) || (Number.isFinite(latestAst) && latestAst > 40)) {
      zone = "high";
      summary = "One or more liver markers are above range, so this is worth reviewing.";
    }
    summaries.push({ key: "liver", title: "Liver pattern focus", zone, summary });
  }

  return summaries;
}

function buildBadges(trends, conditionSummaries) {
  const badges = [];
  trends.forEach((trend) => {
    if (trend.zone === "high") badges.push({ key: `${trend.metricKey}-high`, label: `${trend.metricLabel} high`, zone: "high" });
    if (trend.zone === "low") badges.push({ key: `${trend.metricKey}-low`, label: `${trend.metricLabel} low`, zone: "low" });
    if (trend.needsReview) badges.push({ key: `${trend.metricKey}-review`, label: `${trend.metricLabel} OCR review`, zone: "low" });
  });
  conditionSummaries.forEach((item) => {
    if (item.zone !== "normal") {
      badges.push({ key: `${item.key}-${item.zone}`, label: item.title, zone: item.zone });
    }
  });
  return badges.slice(0, 8);
}

function sanitizePatientFacingText(text = "") {
  return String(text || "")
    .replace(/\bdiagnos(?:e|es|ed|is)\b/gi, "review")
    .replace(/\bdefinitely\b/gi, "may")
    .replace(/\balways\b/gi, "often")
    .replace(/\bmust\b/gi, "should")
    .replace(/\bcure(?:d)?\b/gi, "improve");
}

const LAB_SAFETY_THRESHOLDS = {
  fbs: { urgentHigh: 300, emergencyHigh: 450, urgentLow: 54, emergencyLow: 40 },
  ppbs: { urgentHigh: 300, emergencyHigh: 450, urgentLow: 54, emergencyLow: 40 },
  rbs: { urgentHigh: 300, emergencyHigh: 450, urgentLow: 54, emergencyLow: 40 },
  estimated_average_glucose: { urgentHigh: 300, emergencyHigh: 450, urgentLow: 54, emergencyLow: 40 },
  hemoglobin: { urgentLow: 8, emergencyLow: 7, emergencyHigh: 20 },
  wbc: { urgentLow: 2.5, emergencyLow: 1, urgentHigh: 30, emergencyHigh: 50 },
  platelets: { urgentLow: 50, emergencyLow: 20, urgentHigh: 1000 },
  creatinine: { urgentHigh: 2.5, emergencyHigh: 5 },
  urea: { urgentHigh: 80 },
  bilirubin_total: { urgentHigh: 3, emergencyHigh: 6 },
  sgpt_alt: { urgentHigh: 250, emergencyHigh: 500 },
  sgot_ast: { urgentHigh: 250, emergencyHigh: 500 },
};

const METRIC_SEVERITY_RULES = {
  hba1c: { high: [{ at: 9, severity: "CRITICAL" }, { at: 6.5, severity: "MODERATE" }, { at: 5.7, severity: "LOW" }] },
  estimated_average_glucose: { high: [{ at: 240, severity: "CRITICAL" }, { at: 180, severity: "MODERATE" }, { at: 141, severity: "LOW" }] },
  fbs: { high: [{ at: 240, severity: "CRITICAL" }, { at: 126, severity: "MODERATE" }, { at: 100, severity: "LOW" }], low: [{ at: 54, severity: "CRITICAL" }, { at: 70, severity: "MODERATE" }] },
  ppbs: { high: [{ at: 240, severity: "CRITICAL" }, { at: 200, severity: "MODERATE" }, { at: 141, severity: "LOW" }], low: [{ at: 54, severity: "CRITICAL" }, { at: 70, severity: "MODERATE" }] },
  rbs: { high: [{ at: 240, severity: "CRITICAL" }, { at: 200, severity: "MODERATE" }, { at: 141, severity: "LOW" }], low: [{ at: 54, severity: "CRITICAL" }, { at: 70, severity: "MODERATE" }] },
  total_cholesterol: { high: [{ at: 300, severity: "CRITICAL" }, { at: 240, severity: "MODERATE" }, { at: 201, severity: "LOW" }] },
  ldl: { high: [{ at: 190, severity: "CRITICAL" }, { at: 160, severity: "MODERATE" }, { at: 101, severity: "LOW" }] },
  hdl: { low: [{ at: 25, severity: "CRITICAL" }, { at: 40, severity: "MODERATE" }] },
  triglycerides: { high: [{ at: 500, severity: "CRITICAL" }, { at: 200, severity: "MODERATE" }, { at: 151, severity: "LOW" }] },
  hemoglobin: { low: [{ at: 8, severity: "CRITICAL" }, { at: 10, severity: "MODERATE" }, { at: 12, severity: "LOW" }], high: [{ at: 20, severity: "CRITICAL" }, { at: 18, severity: "MODERATE" }] },
  wbc: { low: [{ at: 2.5, severity: "CRITICAL" }, { at: 3.5, severity: "MODERATE" }], high: [{ at: 30, severity: "CRITICAL" }, { at: 15, severity: "MODERATE" }, { at: 11.1, severity: "LOW" }] },
  platelets: { low: [{ at: 50, severity: "CRITICAL" }, { at: 100, severity: "MODERATE" }, { at: 150, severity: "LOW" }], high: [{ at: 1000, severity: "CRITICAL" }, { at: 600, severity: "MODERATE" }, { at: 451, severity: "LOW" }] },
  tsh: { low: [{ at: 0.1, severity: "MODERATE" }, { at: 0.4, severity: "LOW" }], high: [{ at: 20, severity: "CRITICAL" }, { at: 10, severity: "MODERATE" }, { at: 4.6, severity: "LOW" }] },
  creatinine: { high: [{ at: 2.5, severity: "CRITICAL" }, { at: 1.5, severity: "MODERATE" }, { at: 1.21, severity: "LOW" }] },
  urea: { high: [{ at: 80, severity: "CRITICAL" }, { at: 60, severity: "MODERATE" }, { at: 41, severity: "LOW" }] },
  bilirubin_total: { high: [{ at: 6, severity: "CRITICAL" }, { at: 3, severity: "MODERATE" }, { at: 1.21, severity: "LOW" }] },
  sgpt_alt: { highMultiplier: [{ at: 10, severity: "CRITICAL" }, { at: 3, severity: "MODERATE" }, { at: 1.01, severity: "LOW" }] },
  sgot_ast: { highMultiplier: [{ at: 10, severity: "CRITICAL" }, { at: 3, severity: "MODERATE" }, { at: 1.01, severity: "LOW" }] },
  crp_quantitative: { high: [{ at: 100, severity: "CRITICAL" }, { at: 10, severity: "MODERATE" }, { at: 6.1, severity: "LOW" }] },
};

const SEVERITY_SCORE = {
  NORMAL: 0,
  LOW: 1,
  MODERATE: 2,
  CRITICAL: 3,
};

function getRuleSeverity(value, direction, trend = {}) {
  const rules = METRIC_SEVERITY_RULES[trend.metricKey];
  if (!rules) return null;
  if (direction === "high" && Array.isArray(rules.high)) {
    const match = rules.high.find((rule) => value >= rule.at);
    return match?.severity || null;
  }
  if (direction === "low" && Array.isArray(rules.low)) {
    const match = rules.low.find((rule) => value <= rule.at);
    return match?.severity || null;
  }
  if (direction === "high" && Array.isArray(rules.highMultiplier)) {
    const high = Number(trend.high);
    if (!Number.isFinite(high) || high <= 0) return null;
    const multiplier = value / high;
    const match = rules.highMultiplier.find((rule) => multiplier >= rule.at);
    return match?.severity || null;
  }
  return null;
}

function getGenericRangeSeverity(value, direction, low, high) {
  if (direction === "high") {
    const ratio = Number.isFinite(high) && high > 0 ? value / high : null;
    if (ratio != null && ratio > 1.5) return "CRITICAL";
    if (ratio != null && ratio > 1.2) return "MODERATE";
    if (ratio != null && ratio > 1) return "LOW";
  }
  if (direction === "low") {
    const ratio = Number.isFinite(low) && low > 0 ? value / low : null;
    if (ratio != null && ratio < 0.65) return "CRITICAL";
    if (ratio != null && ratio < 0.85) return "MODERATE";
    if (ratio != null && ratio < 1) return "LOW";
  }
  return "LOW";
}

function buildReportSafety(trends = [], overallConfidence = 0, reviewHeavy = 0) {
  const trustedTrends = (trends || []).filter((trend) => !trend.needsReview && Number(trend.latestConfidence || 0) >= 0.9);
  const emergencySignals = [];
  const urgentSignals = [];

  trustedTrends.forEach((trend) => {
    const threshold = LAB_SAFETY_THRESHOLDS[trend.metricKey];
    if (!threshold) return;
    const value = Number(trend.latestValue);
    if (!Number.isFinite(value)) return;
    if (threshold.emergencyHigh != null && value >= threshold.emergencyHigh) {
      emergencySignals.push(trend);
      return;
    }
    if (threshold.emergencyLow != null && value <= threshold.emergencyLow) {
      emergencySignals.push(trend);
      return;
    }
    if (threshold.urgentHigh != null && value >= threshold.urgentHigh) {
      urgentSignals.push(trend);
      return;
    }
    if (threshold.urgentLow != null && value <= threshold.urgentLow) {
      urgentSignals.push(trend);
    }
  });

  const lowConfidence = reviewHeavy > 0 || Number(overallConfidence || 0) < 0.9;
  const status = emergencySignals.length
    ? "emergency"
    : urgentSignals.length
      ? "urgent_review"
      : lowConfidence
        ? "review_required"
        : "routine";

  const headline =
    status === "emergency"
      ? "Contact a doctor or clinic without delay"
      : status === "urgent_review"
        ? "Arrange prompt clinician review"
        : status === "review_required"
          ? "Use a manual review before relying on this summary"
          : "Use this summary as guided follow-up support";

  const detail =
    status === "emergency"
      ? "One or more trusted report values are in a very high or very low range. Please contact a doctor or clinic to discuss this result, especially if you are feeling unwell."
      : status === "urgent_review"
        ? "A trusted report value looks significantly outside range. Please contact a clinician soon rather than waiting for the next routine review."
        : status === "review_required"
          ? "Some extracted values are low-confidence or still need review, so the app is showing a cautious summary."
          : "This summary is designed to help you prepare for follow-up, not replace a clinician.";

  const actionLabel =
    status === "emergency"
      ? "Contact a doctor"
      : status === "urgent_review"
        ? "Book follow-up soon"
        : status === "review_required"
          ? "Review values first"
          : "Continue with your plan";

  return {
    status,
    emergency: status === "emergency",
    urgentReview: status === "urgent_review",
    requiresManualReview: status === "review_required",
    headline,
    detail,
    actionLabel,
    disclaimer:
      "SehatSaathi highlights report patterns and safe next steps. It does not diagnose disease or replace emergency or clinician-led care.",
    affectedMetrics: [...emergencySignals, ...urgentSignals].slice(0, 3).map((trend) => trend.metricLabel),
  };
}

function inferAnalysisQualityGate(analysis = {}) {
  const explicitGate = String(analysis?.qualityGate || "").trim().toLowerCase();
  if (["trusted", "review", "partial_review", "rejected"].includes(explicitGate)) {
    return explicitGate;
  }

  const metrics = Array.isArray(analysis?.metrics) ? analysis.metrics : [];
  const rejectedMetrics = Array.isArray(analysis?.rejectedMetrics) ? analysis.rejectedMetrics : [];
  if (!metrics.length) return "rejected";
  if (rejectedMetrics.length) return "partial_review";

  const confidences = metrics
    .map((metric) => Number(metric?.confidence))
    .filter((value) => Number.isFinite(value));
  const averageConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;
  const needsReview =
    Boolean(analysis?.needsReview) ||
    averageConfidence < 0.9 ||
    metrics.some((metric) => Number(metric?.confidence ?? 1) < 0.88 || metric?.reviewStatus === "needs_review");

  return needsReview ? "review" : "trusted";
}

function buildExtractionQualityGuard({ analyses = [], latestReports = [], overallConfidence = 0, reviewHeavy = 0 } = {}) {
  const latestAnalysis = latestReports[0] || analyses[0] || null;
  const latestQualityGate = inferAnalysisQualityGate(latestAnalysis);
  const latestConfidence = Number(latestAnalysis?.overallConfidence);
  const hasLowLatestConfidence = Number.isFinite(latestConfidence) ? latestConfidence < 0.9 : Number(overallConfidence || 0) < 0.9;
  const requiresCautiousPlan =
    latestQualityGate === "rejected" ||
    latestQualityGate === "partial_review" ||
    latestQualityGate === "review" ||
    reviewHeavy > 0 ||
    hasLowLatestConfidence;

  const fallbackReason =
    latestQualityGate === "rejected"
      ? "unclear_extraction"
      : latestQualityGate === "partial_review"
        ? "partial_report"
        : requiresCautiousPlan
          ? "low_confidence"
          : null;

  const message =
    fallbackReason === "unclear_extraction"
      ? "We could not confidently read the uploaded report. Please review the original report manually or consult a doctor before acting on this summary."
      : fallbackReason === "partial_report"
        ? "Only part of the uploaded report could be read confidently. Please review the original report or consult a doctor before relying on a strong plan."
        : fallbackReason === "low_confidence"
          ? "Some extracted values still need review, so this summary stays cautious until the report is clearer."
          : "";

  return {
    latestQualityGate,
    requiresCautiousPlan,
    fallbackReason,
    message,
    latestReportId: latestAnalysis?.recordId ?? null,
  };
}

const ISSUE_FOCUS_MAP = {
  hba1c: "diabetes",
  estimated_average_glucose: "diabetes",
  fbs: "diabetes",
  ppbs: "diabetes",
  rbs: "diabetes",
  total_cholesterol: "lipid",
  ldl: "lipid",
  hdl: "lipid",
  triglycerides: "lipid",
  hemoglobin: "anemia",
  rbc_count: "anemia",
  pcv: "anemia",
  mcv: "anemia",
  mch: "anemia",
  mchc: "anemia",
  rdw: "anemia",
  wbc: "anemia",
  esr: "anemia",
  platelets: "anemia",
  tsh: "thyroid",
  t3: "thyroid",
  t4: "thyroid",
  creatinine: "ckd",
  urea: "ckd",
  uric_acid: "ckd",
  bilirubin_total: "liver",
  sgpt_alt: "liver",
  sgot_ast: "liver",
  serum_ige: "allergy",
  weight: "anthropometry",
  bmi: "anthropometry",
  urine_protein: "urine",
  urine_glucose: "urine",
  urine_ketones: "urine",
  urine_bilirubin: "urine",
  urine_blood: "urine",
  urine_urobilinogen: "urine",
};

const ISSUE_FOCUS_LABELS = {
  diabetes: "Sugar",
  lipid: "Cholesterol",
  anemia: "Energy / CBC",
  thyroid: "Thyroid",
  ckd: "Kidney",
  liver: "Liver",
  allergy: "Allergy",
  urine: "Urine",
  general: "Health",
};

const CONDITION_AREA_LABELS = {
  diabetes: "Diabetes",
  cardiovascular: "Blood pressure / cardiovascular risk",
  lipid: "Cholesterol / lipid risk",
  thyroid: "Thyroid",
  vitamin_deficiency: "Vitamin deficiency",
  kidney: "Kidney markers",
  liver: "Liver markers",
  anemia: "Anemia / hemoglobin",
  inflammation: "General inflammation or infection markers",
  allergy: "Allergy / immune markers",
  urine: "Urine markers",
  obesity: "Obesity / weight risk",
  general: "General health",
};

const FOCUS_TO_CONDITION_AREA = {
  diabetes: "diabetes",
  lipid: "lipid",
  thyroid: "thyroid",
  ckd: "kidney",
  liver: "liver",
  anemia: "anemia",
  allergy: "allergy",
  urine: "urine",
  anthropometry: "obesity",
  general: "general",
};

const METRIC_TO_CONDITION_AREA = {
  serum_ige: "allergy",
  hba1c: "diabetes",
  estimated_average_glucose: "diabetes",
  fbs: "diabetes",
  ppbs: "diabetes",
  rbs: "diabetes",
  total_cholesterol: "lipid",
  ldl: "lipid",
  hdl: "lipid",
  triglycerides: "lipid",
  tsh: "thyroid",
  t3: "thyroid",
  t4: "thyroid",
  creatinine: "kidney",
  urea: "kidney",
  uric_acid: "kidney",
  bilirubin_total: "liver",
  sgpt_alt: "liver",
  sgot_ast: "liver",
  hemoglobin: "anemia",
  rbc_count: "anemia",
  pcv: "anemia",
  mcv: "anemia",
  mch: "anemia",
  mchc: "anemia",
  rdw: "anemia",
  wbc: "inflammation",
  esr: "inflammation",
  crp_quantitative: "inflammation",
  platelets: "inflammation",
  weight: "obesity",
  bmi: "obesity",
  urine_protein: "urine",
  urine_glucose: "urine",
  urine_ketones: "urine",
  urine_bilirubin: "urine",
  urine_blood: "urine",
  urine_urobilinogen: "urine",
};

const AREA_ACTION_LIBRARY = {
  diabetes: {
    diet: [
      "Keep meals lower in sugar and refined carbs today.",
      "Do not skip meals and avoid very heavy sweets or sweet drinks.",
    ],
    exercise: [
      "Take a 15-30 minute walk, especially after your heaviest meal if you feel well enough.",
    ],
    monitoring: [
      "Log one sugar reading or one short note about thirst, fatigue, or meals.",
    ],
    doctor: [
      "This may require medical review. Please consult your doctor if sugar markers stay high or symptoms worsen.",
    ],
  },
  cardiovascular: {
    diet: [
      "Keep salt, packaged foods, and very oily meals lighter this week.",
    ],
    exercise: [
      "Use steady walking or another light activity instead of intense exercise if the report feels concerning.",
    ],
    monitoring: [
      "Track one BP reading if you already monitor it at home.",
    ],
    doctor: [
      "Please consult your doctor if BP is high, dizziness is new, or you already take BP medicine.",
    ],
  },
  lipid: {
    diet: [
      "Reduce fried, bakery, and repeated-oil foods for the week.",
      "Use one heart-friendly plate swap you can repeat, not a strict diet reset.",
    ],
    exercise: [
      "Aim for a steady walk on most days this week.",
    ],
    monitoring: [
      "Log weight, waist-direction, or one note about consistency with meals and movement.",
    ],
    doctor: [
      "Please consult your doctor if cholesterol is very high or you may need medicine review.",
    ],
  },
  thyroid: {
    diet: [],
    exercise: [
      "Keep activity light and regular rather than chasing a perfect workout week.",
    ],
    monitoring: [
      "Log one short note about energy, sleep, mood, or appetite.",
    ],
    doctor: [
      "Please consult your doctor before changing any thyroid medicine or timing.",
    ],
  },
  vitamin_deficiency: {
    diet: [
      "Keep one nutrition-supportive meal visible this week and avoid guessing supplements on your own.",
    ],
    exercise: [],
    monitoring: [
      "Note fatigue, cramps, hair fall, or low energy if present.",
    ],
    doctor: [
      "This may require medical review. Please consult your doctor if deficiency markers are significant or symptoms are ongoing.",
    ],
  },
  kidney: {
    diet: [
      "Keep hydration steady unless a doctor has told you to restrict fluids.",
    ],
    exercise: [],
    monitoring: [
      "Track BP, swelling, urine change, or one symptom note if relevant.",
    ],
    doctor: [
      "Please consult your doctor if creatinine or kidney markers are clearly above range.",
    ],
  },
  liver: {
    diet: [
      "Avoid alcohol and very heavy meals until this is reviewed.",
    ],
    exercise: [],
    monitoring: [
      "Note nausea, abdominal pain, dark urine, or yellowing if anything changes.",
    ],
    doctor: [
      "This may require medical review. Please consult your doctor if liver markers are clearly high.",
    ],
  },
  anemia: {
    diet: [
      "Keep one iron- or protein-supportive meal visible this week if you can tolerate it.",
    ],
    exercise: [
      "Use light activity only if you feel well enough. Do not push through dizziness or breathlessness.",
    ],
    monitoring: [
      "Track fatigue, dizziness, or breathlessness once.",
    ],
    doctor: [
      "Please consult your doctor if hemoglobin is low or symptoms are affecting daily life.",
    ],
  },
  inflammation: {
    diet: [],
    exercise: [],
    monitoring: [
      "Note fever, body pain, swelling, cough, or any infection-like symptom if present.",
    ],
    doctor: [
      "Please consult your doctor if inflammatory or infection markers are high or symptoms are active.",
    ],
  },
  allergy: {
    diet: [],
    exercise: [],
    monitoring: [
      "Note one trigger or symptom such as rash, itching, wheeze, sneezing, or no symptoms.",
    ],
    doctor: [
      "Please consult your doctor if symptoms are active, recurring, or you feel unsure about allergy treatment.",
    ],
  },
  urine: {
    diet: [
      "Keep hydration steady and avoid ignoring burning, frequency, or visible urine changes.",
    ],
    exercise: [],
    monitoring: [
      "Track one urine symptom or hydration note only if it helps show the pattern more clearly.",
    ],
    doctor: [
      "Please consult your doctor if urine markers stay abnormal or symptoms are present.",
    ],
  },
  obesity: {
    diet: [
      "Keep one meal lighter and more repeatable instead of trying to change everything at once.",
    ],
    exercise: [
      "Use one realistic walking routine that fits a normal day.",
    ],
    monitoring: [
      "Log weight once or save one note about consistency with food and movement.",
    ],
    doctor: [],
  },
  general: {
    diet: [
      "Use one repeatable food choice instead of trying to fix everything this week.",
    ],
    exercise: [
      "Keep movement light and realistic.",
    ],
    monitoring: [
      "Save one useful note so the next review has context.",
    ],
    doctor: [
      "Please consult your doctor if symptoms are present, the report feels severe, or the values seem unclear.",
    ],
  },
};

const ISSUE_ACTIONS = {
  diabetes: [
    "Keep meals lighter on sugar and refined carbs today.",
    "Walk for 20-30 minutes if you feel well enough.",
    "Carry this report summary when you discuss sugar control with a clinician.",
  ],
  lipid: [
    "Keep fried, packaged, and high-fat foods lighter this week.",
    "Add a steady walking routine on most days.",
    "Ask a clinician if lipid medication review is needed based on your risk profile.",
  ],
  anemia: [
    "Do not ignore tiredness, breathlessness, dizziness, or paleness.",
    "Keep iron/B12/folate questions ready for a clinician review.",
    "Avoid self-starting supplements if the cause of low hemoglobin is unclear.",
  ],
  thyroid: [
    "Take any existing thyroid medicine exactly as prescribed.",
    "Do not change thyroid medicine dose without clinician advice.",
    "Ask whether repeat TSH or medication adjustment is needed.",
  ],
  ckd: [
    "Avoid self-medicating with painkillers unless a clinician says it is safe.",
    "Stay hydrated unless you have been told to restrict fluids.",
    "Discuss kidney markers with a clinician if creatinine is clearly high.",
  ],
  liver: [
    "Avoid alcohol and unnecessary medicines until this is reviewed.",
    "Watch for yellow eyes, dark urine, severe weakness, or abdominal pain.",
    "Discuss whether repeat liver tests or medication review is needed.",
  ],
  general: [
    "Focusing on the most meaningful findings first can make follow-up easier.",
    "Use the summary to prepare a focused doctor conversation.",
    "Track one useful action today so the next review has context.",
  ],
};

const ATTENTION_LEVEL_LABELS = {
  needs_prompt_medical_review: "Needs prompt medical review",
  worth_timely_follow_up: "Worth timely follow-up",
  discuss_in_next_appointment: "Discuss in next appointment",
  monitor_over_time: "Monitor over time",
  usually_non_urgent: "Usually non-urgent",
  lifestyle_focused: "Lifestyle-focused",
};

const TIMEFRAME_LABELS = {
  emergency_now: "Emergency now",
  same_day: "Same day",
  within_a_few_days: "Within a few days",
  within_1_2_weeks: "Within 1-2 weeks",
  next_routine_appointment: "At the next routine appointment",
  future_reports: "Monitor on future reports",
};

const CONFIDENCE_LABELS = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Limited confidence",
};

const GUIDED_CONTEXT_LABELS = {
  diabetes: "Sugar/metabolic markers",
  cardiovascular: "Heart and circulation markers",
  lipid: "Sugar/metabolic markers",
  thyroid: "Thyroid markers",
  vitamin_deficiency: "Nutrition markers",
  kidney: "Kidney markers",
  liver: "Liver markers",
  anemia: "Red-cell indices",
  inflammation: "Inflammation markers",
  allergy: "Allergy/immune context",
  urine: "Urine markers",
  obesity: "Weight/metabolic context",
  general: "General health markers",
};

const TREND_STATE_LABELS = {
  improving: "Improving",
  stable: "Stable",
  worsening: "Higher than prior report",
  mixed: "Mixed",
  not_enough_data: "Not enough data",
  higher_than_prior: "Higher than prior report",
  lower_than_prior: "Lower than prior report",
  needs_recheck: "Needs recheck",
};

function classifyMetricSeverity(trend = {}) {
  const value = Number(trend.latestValue);
  const low = Number(trend.low);
  const high = Number(trend.high);
  const zone = trend.zone || "normal";
  if (!Number.isFinite(value)) {
    return { status: "UNKNOWN", severity: "LOW", severityScore: 1, direction: "unknown", ratio: null };
  }
  if (zone === "normal" || zone === "neutral") {
    return { status: "NORMAL", severity: "NORMAL", severityScore: 0, direction: "normal", ratio: 1 };
  }
  if (zone === "high") {
    const ratio = Number.isFinite(high) && high > 0 ? value / high : null;
    const severity = getRuleSeverity(value, "high", trend) || getGenericRangeSeverity(value, "high", low, high);
    return { status: "HIGH", severity, severityScore: SEVERITY_SCORE[severity] ?? 1, direction: "high", ratio };
  }
  if (zone === "low") {
    const ratio = Number.isFinite(low) && low > 0 ? value / low : null;
    const severity = getRuleSeverity(value, "low", trend) || getGenericRangeSeverity(value, "low", low, high);
    return { status: "LOW", severity, severityScore: SEVERITY_SCORE[severity] ?? 1, direction: "low", ratio };
  }
  return { status: String(zone || "UNKNOWN").toUpperCase(), severity: "LOW", severityScore: 1, direction: zone, ratio: null };
}

function buildChangeOverTime(trend = {}) {
  const latest = Number(trend.latestValue);
  const previous = Number(trend.previousValue);
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) {
    return {
      label: "First tracked reading",
      detail: `${trend.metricLabel || "This value"} is now saved as the baseline for future comparison.`,
      percentChange: null,
      direction: "baseline",
    };
  }
  const percentChange = Math.round(((latest - previous) / Math.abs(previous)) * 100);
  const absPercent = Math.abs(percentChange);
  const direction = percentChange > 0 ? "increased" : percentChange < 0 ? "decreased" : "stayed about the same";
  return {
    label: `${trend.metricLabel || "This value"} ${direction}`,
    detail: percentChange === 0
      ? `${trend.metricLabel || "This value"} is about the same as the previous report.`
      : `${trend.metricLabel || "This value"} ${direction} by ${absPercent}% since the previous report.`,
    percentChange,
    direction,
  };
}

function buildDoctorQuestions(issue = {}, patientContext = {}) {
  const context = normalizePatientContext(patientContext);
  const focus = issue.focusKey || "general";
  const base = [
    `How should ${issue.parameter || "this value"} be interpreted in my clinical context?`,
    "Should this be reviewed with repeat testing, symptoms, or existing health history?",
  ];
  const focusQuestion = {
    diabetes: context.flags.diabetes
      ? "Do these sugar-related markers fit with my existing sugar condition or current routine?"
      : "Do these sugar-related markers need repeat testing or closer follow-up?",
    lipid: "How should these cholesterol markers be reviewed in the context of my overall risk?",
    anemia: "Do these blood-count changes need comparison with symptoms, iron status, or prior CBC results?",
    thyroid: context.flags.thyroid
      ? "How should these thyroid markers be reviewed alongside my existing thyroid history?"
      : "Do these thyroid markers need repeat review or additional context?",
    ckd: context.flags.kidney
      ? "How should these kidney-related values be reviewed alongside my existing kidney history?"
      : "Do these kidney-related values need repeat review or closer follow-up?",
    liver: "Could medicines, infection, alcohol, or another cause explain this liver marker?",
    general: "Which finding matters most in the context of my age, sex, and health history?",
  }[focus] || "What is the safest next step from this report?";
  return [...base, focusQuestion].slice(0, 3);
}

function classifyConfidenceLevel(value) {
  if (!Number.isFinite(Number(value))) return "moderate";
  if (Number(value) >= 0.94) return "high";
  if (Number(value) >= 0.8) return "moderate";
  return "low";
}

function buildMetricTrendState(trend = {}) {
  const latest = Number(trend.latestValue);
  const previous = Number(trend.previousValue);
  const latestConfidence = Number(trend.latestConfidence ?? 1);
  const comparisonCount = Array.isArray(trend.points) ? trend.points.filter((point) => Number.isFinite(Number(point.value))).length : 0;
  if (!Number.isFinite(latest) || !Number.isFinite(previous)) {
    return {
      state: "not_enough_data",
      label: TREND_STATE_LABELS.not_enough_data,
      summary: "More reports are needed before calling this a trend.",
    };
  }
  if (trend.needsReview || latestConfidence < 0.88) {
    return {
      state: "not_enough_data",
      label: TREND_STATE_LABELS.not_enough_data,
      summary: "Trend comparison is limited because the extracted values still need review.",
    };
  }
  if (previous === 0) {
    return {
      state: "not_enough_data",
      label: TREND_STATE_LABELS.not_enough_data,
      summary: "More reports are needed before calling this a trend.",
    };
  }
  const changeRatio = Math.abs((latest - previous) / Math.abs(previous));
  if (changeRatio < 0.05) {
    return {
      state: "stable",
      label: TREND_STATE_LABELS.stable,
      summary: `${trend.metricLabel || "This value"} looks broadly stable compared with the prior report.`,
    };
  }
  const worseningForHigh = trend.zone === "high" && latest > previous;
  const worseningForLow = trend.zone === "low" && latest < previous;
  if (comparisonCount < 3) {
    if (worseningForHigh || worseningForLow) {
      return {
        state: "needs_recheck",
        label: TREND_STATE_LABELS.needs_recheck,
        summary: `${trend.metricLabel || "This value"} is higher than the prior report and may need rechecking for confirmation.`,
      };
    }
    return {
      state: "lower_than_prior",
      label: TREND_STATE_LABELS.lower_than_prior,
      summary: `${trend.metricLabel || "This value"} is lower than the prior report, but more trend data would help confirm the direction.`,
    };
  }
  const state = worseningForHigh || worseningForLow ? "worsening" : "improving";
  return {
    state,
    label: TREND_STATE_LABELS[state],
    summary:
      state === "worsening"
        ? `${trend.metricLabel || "This value"} appears to have moved further away from the comparison range.`
        : `${trend.metricLabel || "This value"} appears slightly closer to the comparison range than before.`,
  };
}

function mapAttentionMeta({
  issue = {},
  issueCounts = {},
  symptomCount = 0,
  safety = {},
  patientContext = {},
} = {}) {
  const context = normalizePatientContext(patientContext);
  const areaKey = issue.conditionArea || "general";
  const areaCount = Number(issueCounts[areaKey] || 0);
  const trendState = issue.changeOverTime?.state || "not_enough_data";
  const highConfidence = Number(issue.confidence ?? 0) >= 0.9;
  const strongDeviation = Number(issue.severityScore || 0) >= 3;
  const hasCluster = areaCount > 1;
  const hasSymptoms = symptomCount > 0;
  const worsening = trendState === "worsening";
  const safetyLinked = safety.status === "emergency";
  const alignedSignals = [strongDeviation, hasCluster, worsening, hasSymptoms, highConfidence, safetyLinked].filter(Boolean).length;

  if (issue.key === "serum_ige" && !hasSymptoms && areaCount <= 1 && !context.flags.allergy) {
    return {
      attentionLevel: "discuss_in_next_appointment",
      followUpImportance: "routine",
      confidenceLevel: "moderate",
      suggestedTimeframe: "next_routine_appointment",
    };
  }

  if (safety.status === "emergency" && alignedSignals >= 2) {
    return {
      attentionLevel: "needs_prompt_medical_review",
      followUpImportance: "prompt",
      confidenceLevel: highConfidence ? "high" : "moderate",
      suggestedTimeframe: "same_day",
    };
  }

  if ((strongDeviation && alignedSignals >= 2) || (issue.severity === "CRITICAL" && hasCluster)) {
    return {
      attentionLevel: "needs_prompt_medical_review",
      followUpImportance: "prompt",
      confidenceLevel: highConfidence ? "high" : "moderate",
      suggestedTimeframe: "within_a_few_days",
    };
  }

  if (issue.severity === "CRITICAL" || issue.severity === "MODERATE" || worsening || hasCluster || (context.flags.kidney && areaKey === "ckd")) {
    return {
      attentionLevel: "worth_timely_follow_up",
      followUpImportance: "timely",
      confidenceLevel: classifyConfidenceLevel(issue.confidence),
      suggestedTimeframe: "within_1_2_weeks",
    };
  }

  if (areaKey === "obesity" || areaKey === "diabetes" || areaKey === "lipid") {
    return {
      attentionLevel: "lifestyle_focused",
      followUpImportance: "lifestyle",
      confidenceLevel: classifyConfidenceLevel(issue.confidence),
      suggestedTimeframe: "future_reports",
    };
  }

  if (issue.status === "LOW" || issue.status === "HIGH") {
    return {
      attentionLevel: "monitor_over_time",
      followUpImportance: "watch",
      confidenceLevel: classifyConfidenceLevel(issue.confidence),
      suggestedTimeframe: "future_reports",
    };
  }

  return {
    attentionLevel: "usually_non_urgent",
    followUpImportance: "routine",
    confidenceLevel: classifyConfidenceLevel(issue.confidence),
    suggestedTimeframe: "next_routine_appointment",
  };
}

function formatIssueValue(issue = {}) {
  if (!issue) return "Not available";
  const value = issue.value === null || issue.value === undefined || issue.value === "" ? "Not available" : issue.value;
  const unit = issue.unit ? ` ${issue.unit}` : "";
  return `${value}${unit}`;
}

function buildDoctorHandoff(healthIssues = {}, safety = {}, trends = []) {
  const topIssue = healthIssues.topIssue || null;
  const priorityIssues = (healthIssues.abnormal?.length ? healthIssues.abnormal : healthIssues.all || [])
    .slice(0, 4)
    .map((issue) => ({
      parameter: issue.parameter,
      value: formatIssueValue(issue),
      range: issue.range || "Not available",
      status: issue.status || "UNKNOWN",
      severity: issue.severity || "LOW",
      change: issue.changeOverTime?.detail || "Use this as the baseline for future comparison.",
    }));
  const doctorQuestions = healthIssues.fixThisFirst?.doctorQuestions?.length
    ? healthIssues.fixThisFirst.doctorQuestions
    : topIssue?.doctorQuestions || [];
  const medicationReviewCue =
    safety.status === "emergency" ||
    safety.status === "urgent_review" ||
    ["CRITICAL", "MODERATE"].includes(topIssue?.severity);
  const summaryText = !trends.length
    ? "No structured lab values are ready yet. Please review the original report before clinical decisions."
    : topIssue?.status === "NORMAL"
      ? `${topIssue.parameter} looks steady in this report. Use this as a baseline and compare with future reports.`
      : `${topIssue?.parameter || "The top value"} is ${String(topIssue?.status || "abnormal").toLowerCase()} with ${String(topIssue?.severity || "review").toLowerCase()} priority. Please review this first, then check the remaining abnormal values.`;

  return {
    title: "Show this to your doctor",
    status: healthIssues.status || "No report yet",
    topIssue: topIssue
      ? {
          parameter: topIssue.parameter,
          value: formatIssueValue(topIssue),
          range: topIssue.range || "Not available",
          status: topIssue.status,
          severity: topIssue.severity,
          focusLabel: topIssue.focusLabel,
          change: topIssue.changeOverTime?.detail || "Use this as the baseline for future comparison.",
        }
      : null,
    priorityIssues,
    recommendedAction: healthIssues.recommendedAction || "Upload a clear report",
    medicationReviewCue,
    doctorQuestions,
    summaryText,
    disclaimer: "This is not a medical diagnosis. Use it as a conversation aid with a licensed clinician.",
  };
}

function buildGuidedFollowUp({ healthIssues = {}, safety = {}, trends = [], overallConfidence = 0, extractionGuard = {}, patientContext = {} } = {}) {
  const issues = Array.isArray(healthIssues.all) ? healthIssues.all : [];
  const abnormalIssues = Array.isArray(healthIssues.abnormal) ? healthIssues.abnormal : [];
  const context = normalizePatientContext(patientContext);
  const symptomContext = buildPatientContextLines(context);
  if (extractionGuard?.requiresCautiousPlan) {
    return {
      overview: {
        status: "review_required",
        headline: "Use a manual review before relying on this summary",
        summary: extractionGuard.message || "Some extracted values still need review, so the app is holding back stronger follow-up guidance.",
        confidenceLevel: "low",
        confidenceLabel: CONFIDENCE_LABELS.low,
        limitations: [
          "Based on uploaded report values only",
          "Some extracted values still need human review",
          context.flags.pediatric ? "Age-specific lab interpretation may differ" : "",
          "Not a diagnosis",
        ].filter(Boolean),
      },
      priorities: [],
      canWait: [],
      nextSteps: {
        summary: "Review the uploaded report before relying on stronger follow-up guidance.",
        actions: [
          "Review the uploaded report.",
          "Check whether the important values were read correctly.",
          "Consult a doctor if the report still feels unclear.",
        ],
      },
      doctorQuestions: [
        "Were the important values read correctly from the report?",
        "Which findings need repeat review before clinical interpretation?",
        "What should I keep visible for the next follow-up review?",
      ],
      trends: {
        status: "not_enough_data",
        label: TREND_STATE_LABELS.not_enough_data,
        summary: "A clearer extraction or more reliable report history is needed before calling this a trend.",
        items: [],
      },
      doctorHandoff: {
        extractedData: issues.slice(0, 8).map((issue) => ({
          label: issue.parameter,
          value: issue.value,
          unit: issue.unit || "",
          formattedValue: `${formatIssueValue(issue)}${issue.range && issue.range !== "Not available" ? ` • Range ${issue.range}` : ""}`,
          originalRange: issue.range || "Not available",
          status: issue.status,
        })),
        aiObservations: [
          extractionGuard.message || "Some extracted values still need manual review before stronger follow-up guidance is used.",
        ],
        patientContext: symptomContext.length ? symptomContext : ["No symptoms or home readings logged yet."],
        trendNotes: ["A clearer extraction or more reliable report history is needed before calling this a trend."],
        discussionIdeas: [
          "Were the important values read correctly from the report?",
          "Which findings need repeat review before clinical interpretation?",
          "What should I keep visible for the next follow-up review?",
        ],
      },
      safety: {
        emergencyFlag: false,
        promptReviewFlag: false,
        medicalFollowUpFlag: true,
        message: "This summary is for follow-up planning, not diagnosis. Original lab ranges stay visible, and SehatSaathi uses standardized comparison ranges to support cleaner trends.",
      },
    };
  }
  const issueCounts = abnormalIssues.reduce((acc, issue) => {
    const key = issue.conditionArea || "general";
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  const buildGroupFromIssues = ({
    id,
    title,
    conditionArea,
    groupedIssues = [],
    forcedAttentionLevel = null,
    forcedSummary = "",
    doctorQuestions = [],
    suggestedTimeframe = null,
  }) => {
    const strongestIssue = groupedIssues
      .slice()
      .sort((a, b) => Number(b.severityScore || 0) - Number(a.severityScore || 0))[0] || null;
    const baseMeta = strongestIssue
      ? mapAttentionMeta({
          issue: strongestIssue,
          issueCounts,
          symptomCount: symptomContext.length,
          safety,
          patientContext: context,
        })
      : {
          attentionLevel: "usually_non_urgent",
          followUpImportance: "routine",
          confidenceLevel: "moderate",
          suggestedTimeframe: "next_routine_appointment",
        };
    const attentionLevel = forcedAttentionLevel || baseMeta.attentionLevel;
    const timeframe = suggestedTimeframe || baseMeta.suggestedTimeframe;
    const confidenceLevel =
      groupedIssues.some((issue) => classifyConfidenceLevel(issue.confidence) === "low")
        ? "low"
        : groupedIssues.some((issue) => classifyConfidenceLevel(issue.confidence) === "moderate")
          ? "moderate"
          : baseMeta.confidenceLevel;
    const visibleIssues = groupedIssues.map((issue) => ({
      key: issue.key,
      label: issue.parameter,
      value: formatIssueValue(issue),
      unit: issue.unit || "",
      status: issue.status,
      originalRange: issue.range || "Not available",
      trendState: issue.changeOverTime?.state || "not_enough_data",
    }));
    return {
      id,
      title,
      findingLabel: title,
      conditionArea,
      conditionLabel: CONDITION_AREA_LABELS[conditionArea] || CONDITION_AREA_LABELS.general,
      includedFindings: visibleIssues,
      metricKeys: visibleIssues.map((item) => item.key),
      attentionLevel,
      attentionLabel: ATTENTION_LEVEL_LABELS[attentionLevel],
      followUpImportance: baseMeta.followUpImportance,
      confidenceLevel,
      confidenceLabel: CONFIDENCE_LABELS[confidenceLevel],
      suggestedTimeframe: timeframe,
      suggestedTimeframeLabel: TIMEFRAME_LABELS[timeframe],
      whyHighlighted: dedupeLines([
        groupedIssues.length > 1 ? "Related findings in the same health area are easier to review together." : "",
        groupedIssues.some((issue) => issue.changeOverTime?.state === "worsening") ? "At least one included value appears to be moving further away from the comparison range." : "",
        groupedIssues.some((issue) => issue.needsReview) ? "Some extracted values still need human review." : "",
      ], 3),
      summary: forcedSummary || "This group is worth reviewing in the context of the rest of the report.",
      doctorQuestions,
    };
  };

  const groupedPriorityItems = [];
  const groupedCanWaitItems = [];
  const usedIssueKeys = new Set();

  const sugarIssues = abnormalIssues.filter((issue) => ["hba1c", "estimated_average_glucose", "fbs", "ppbs", "rbs"].includes(issue.key));
  if (sugarIssues.length >= 2) {
    sugarIssues.forEach((issue) => usedIssueKeys.add(issue.key));
    groupedPriorityItems.push(
      buildGroupFromIssues({
        id: "priority-sugar",
        title: "Sugar-related markers",
        conditionArea: "diabetes",
        groupedIssues: sugarIssues,
        forcedAttentionLevel: "worth_timely_follow_up",
        forcedSummary: context.flags.diabetes
          ? "Sugar-related markers are above the app's comparison range and may be worth reviewing together in the context of an existing sugar condition."
          : "Sugar-related markers are above the app's comparison range and may be worth reviewing together.",
        doctorQuestions: [
          context.flags.diabetes
            ? "Do these sugar-related markers fit with my existing sugar condition or current routine?"
            : "Do these sugar-related markers suggest my current routine or treatment plan needs review?",
          "When should HbA1c or glucose-related testing be repeated?",
        ],
        suggestedTimeframe: "within_1_2_weeks",
      }),
    );
  }

  const cbcIndexIssues = abnormalIssues.filter((issue) => ["mcv", "mch", "mchc"].includes(issue.key));
  if (cbcIndexIssues.length >= 2) {
    cbcIndexIssues.forEach((issue) => usedIssueKeys.add(issue.key));
    groupedPriorityItems.push(
      buildGroupFromIssues({
        id: "priority-cbc-indices",
        title: "CBC red-cell indices",
        conditionArea: "anemia",
        groupedIssues: cbcIndexIssues,
        forcedAttentionLevel: "discuss_in_next_appointment",
        forcedSummary: "Some red-cell indices are outside range and may be easier to interpret together.",
        doctorQuestions: [
          "Do these red-cell index changes need iron, B12, or further CBC review?",
          "Should these CBC findings be repeated or compared with symptoms?",
        ],
        suggestedTimeframe: "next_routine_appointment",
      }),
    );
  }

  const isolatedIge = abnormalIssues.find((issue) => issue.key === "serum_ige");
  if (isolatedIge && !usedIssueKeys.has(isolatedIge.key) && Number(issueCounts.allergy || 0) <= 1 && !context.flags.allergy) {
    usedIssueKeys.add(isolatedIge.key);
    groupedCanWaitItems.push(
      buildGroupFromIssues({
        id: "wait-ige",
        title: "Serum IgE",
        conditionArea: "allergy",
        groupedIssues: [isolatedIge],
        forcedAttentionLevel: "discuss_in_next_appointment",
        forcedSummary: context.flags.allergy
          ? "Serum IgE is above range, and known allergy history may help your clinician decide how much it matters."
          : "Serum IgE is above range, but on its own it usually needs symptom context before stronger interpretation.",
        doctorQuestions: [
          "Does this IgE result matter in the context of allergies, asthma, skin symptoms, or infections?",
        ],
        suggestedTimeframe: "next_routine_appointment",
      }),
    );
  }

  const remainingIssues = abnormalIssues.filter((issue) => !usedIssueKeys.has(issue.key));
  const decoratedIssues = remainingIssues.map((issue) => {
    const meta = mapAttentionMeta({
      issue,
      issueCounts,
      symptomCount: symptomContext.length,
      safety,
      patientContext: context,
    });
    const isBmi = issue.key === "bmi";
    return {
      id: `priority-${issue.key}`,
      title: issue.parameter,
      findingLabel: issue.parameter,
      conditionArea: issue.conditionArea || "general",
      conditionLabel: CONDITION_AREA_LABELS[issue.conditionArea] || CONDITION_AREA_LABELS.general,
      includedFindings: [{
        key: issue.key,
        label: issue.parameter,
        value: formatIssueValue(issue),
        unit: issue.unit || "",
        status: issue.status,
        originalRange: issue.range || "Not available",
        trendState: issue.changeOverTime?.state || "not_enough_data",
      }],
      metricKeys: [issue.key],
      attentionLevel: isBmi && groupedPriorityItems.length ? "lifestyle_focused" : meta.attentionLevel,
      attentionLabel: ATTENTION_LEVEL_LABELS[isBmi && groupedPriorityItems.length ? "lifestyle_focused" : meta.attentionLevel],
      followUpImportance: meta.followUpImportance,
      confidenceLevel: meta.confidenceLevel,
      confidenceLabel: CONFIDENCE_LABELS[meta.confidenceLevel],
      suggestedTimeframe: meta.suggestedTimeframe,
      suggestedTimeframeLabel: TIMEFRAME_LABELS[meta.suggestedTimeframe],
      whyHighlighted: dedupeLines([
        issue.range && issue.range !== "Not available" ? `${issue.parameter} sits outside the app's comparison range of ${issue.range}.` : "",
        issue.changeOverTime?.state === "worsening" ? "This value appears to be moving further away from the comparison range." : "",
        Number(issueCounts[issue.conditionArea || "general"] || 0) > 1 ? "Related markers in the same health area also look abnormal." : "",
        issue.needsReview ? "Some extracted values still need human review." : "",
      ], 3),
      summary:
        isBmi && groupedPriorityItems.length
          ? "BMI is easier to interpret as metabolic context rather than the main finding on its own."
          : meta.attentionLevel === "needs_prompt_medical_review"
            ? "This result may deserve a closer medical review."
            : meta.attentionLevel === "worth_timely_follow_up"
              ? "A medical follow-up may help clarify this result."
              : meta.attentionLevel === "lifestyle_focused"
                ? "This is often followed over time alongside daily routines."
                : "This result is worth keeping in view as part of the bigger picture.",
      doctorQuestions:
        issue.key === "bmi"
          ? ["Does my BMI affect how we should interpret my sugar or metabolic risk?"]
          : issue.doctorQuestions || [],
    };
  });

  const attentionRank = {
    needs_prompt_medical_review: 0,
    worth_timely_follow_up: 1,
    discuss_in_next_appointment: 2,
    monitor_over_time: 3,
    lifestyle_focused: 4,
    usually_non_urgent: 5,
  };

  const priorityGroups = groupedPriorityItems.concat(
    decoratedIssues
    .slice()
    .sort((a, b) => {
      const rankDiff = (attentionRank[a.attentionLevel] ?? 9) - (attentionRank[b.attentionLevel] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      return String(a.findingLabel || "").localeCompare(String(b.findingLabel || ""));
    }),
  );
  const priorities = priorityGroups.slice(0, 3);
  const priorityIds = new Set(priorities.map((item) => item.id));
  const canWait = groupedCanWaitItems.concat(
    priorityGroups.filter((item) => !priorityIds.has(item.id)).map((item) => ({
      ...item,
      attentionLabel:
        item.attentionLabel === ATTENTION_LEVEL_LABELS.needs_prompt_medical_review
          ? ATTENTION_LEVEL_LABELS.discuss_in_next_appointment
          : item.attentionLabel,
      summary:
        item.id === "wait-ige"
          ? item.summary
          : item.attentionLevel === "lifestyle_focused"
            ? "This usually becomes more useful when compared with future reports and routines."
            : "This can usually be reviewed with context rather than treated as urgent on its own.",
    })),
  ).slice(0, 6);

  const priorityConditionLabels = dedupeLines(priorities.map((item) => item.conditionLabel), 3);
  const guidedContextLabels = dedupeLines(
    priorities.map((item) => GUIDED_CONTEXT_LABELS[item.conditionArea] || item.conditionLabel),
    3,
  );
  const visibleMetricKeys = new Set(
    priorities.concat(canWait).flatMap((item) => item.metricKeys || []),
  );
  const trendItems = (trends || [])
    .filter((trend) => visibleMetricKeys.has(trend.metricKey))
    .slice(0, 6)
    .map((trend) => {
    const trendState = buildMetricTrendState(trend);
    return {
      metricKey: trend.metricKey,
      metric: trend.metricLabel,
      state: trendState.state,
      label: trendState.label,
      confidenceLevel: classifyConfidenceLevel(trend.latestConfidence),
      summary: trendState.summary,
    };
  });

  const trendStates = new Set(trendItems.map((item) => item.state));
  const trendsStatus = !trendItems.length || trendStates.size === 1 && trendStates.has("not_enough_data")
    ? "not_enough_data"
    : trendStates.size === 1 && trendStates.has("needs_recheck")
      ? "needs_recheck"
    : trendStates.size > 1
      ? "mixed"
      : trendItems[0]?.state || "not_enough_data";

  const overviewStatus =
    priorities.some((item) => item.attentionLevel === "needs_prompt_medical_review")
      ? "needs_prompt_review"
      : priorities.length
        ? "worth_reviewing"
        : "usually_non_urgent";

  const overviewHeadline =
    overviewStatus === "needs_prompt_review"
      ? "A few results may deserve closer follow-up"
      : priorities.length
        ? "A few results may deserve follow-up"
        : "This report looks mostly steady";

  const nextActions = dedupeLines([
    priorities[0] ? "Focus on the grouped findings first." : "",
    "Bring prior reports if available.",
    "Keep recent sugar, BP, symptom, or routine notes visible during follow-up.",
    "Use the doctor questions to guide your next review.",
  ], 4);
  const contextFollowUpNote = buildContextFollowUpNote({ priorities, canWait, patientContext: context });
  const visibleContextLine = buildVisibleContextLine(context);
  const overviewLimitations = [
    "Based on uploaded report values only",
    "Does not include full clinical context",
    context.flags.pediatric ? "Age-specific lab interpretation may differ" : "",
    "Not a diagnosis",
  ].filter(Boolean);

  return {
    overview: {
      status: overviewStatus,
      headline: overviewHeadline,
      summary: priorities.length
        ? ["We highlighted what may be most useful to review first.", visibleContextLine].filter(Boolean).join(" ")
        : `No strong follow-up signal is ready yet. Once more structured values are available, this view becomes clearer.${contextFollowUpNote ? ` ${contextFollowUpNote}` : ""}`,
      confidenceLevel: classifyConfidenceLevel(overallConfidence),
      confidenceLabel: CONFIDENCE_LABELS[classifyConfidenceLevel(overallConfidence)],
      limitations: overviewLimitations,
    },
    priorities,
    canWait,
    nextSteps: {
      summary: "Focus on the grouped findings first.",
      actions: nextActions,
    },
    doctorQuestions: dedupeLines(
      priorities.flatMap((item) => item.doctorQuestions || []).concat([
        "Which findings matter most in my clinical context?",
        "Should any repeat testing be timed sooner?",
        "What should I monitor before the next review?",
      ]),
      5,
    ),
    trends: {
      status: trendsStatus,
      label: TREND_STATE_LABELS[trendsStatus],
      summary:
        trendsStatus === "mixed"
          ? "Some values look similar to prior reports, while others may need rechecking for confirmation."
          : trendsStatus === "needs_recheck"
            ? "Some values are higher than prior reports, but may need rechecking for confirmation."
          : trendsStatus === "worsening"
            ? "Some values may be moving further away from the comparison range and may be worth confirming with repeat context."
            : trendsStatus === "improving"
              ? "Some values appear a little closer to the comparison range than before."
              : trendsStatus === "stable"
                ? "Recent values look broadly steady."
                : "More reports are needed before calling this a trend.",
      items: trendItems,
    },
    doctorHandoff: {
      extractedData: issues.slice(0, 8).map((issue) => ({
        label: issue.parameter,
        value: issue.value,
        unit: issue.unit || "",
        formattedValue: `${formatIssueValue(issue)} • ${issue.status === "HIGH" ? "High" : issue.status === "LOW" ? "Low" : issue.status === "NORMAL" ? "Normal" : issue.status}${issue.range && issue.range !== "Not available" ? ` • Range ${issue.range}` : ""}`,
        originalRange: issue.range || "Not available",
        status: issue.status,
      })),
      aiObservations: dedupeLines([
        priorities[0] ? `${priorities[0].findingLabel} look like the clearest group to review first.` : "",
        guidedContextLabels.length > 1 ? `${guidedContextLabels.join(", ")} may be easier to review together.` : "",
        contextFollowUpNote,
        canWait.length ? "Some findings are better treated as context or future follow-up rather than urgent action." : "",
      ], 3),
      patientContext: symptomContext.length ? symptomContext : ["No symptoms or home readings logged yet."],
      trendNotes: trendItems.length ? trendItems.slice(0, 4).map((item) => `${item.metric}: ${item.label}`) : ["More reports are needed before calling this a trend."],
      discussionIdeas: [
        "Which findings matter most in my clinical context?",
        "Should any repeat testing be timed sooner?",
        "What should I monitor before the next review?",
      ],
    },
    safety: {
      emergencyFlag: safety.status === "emergency",
      promptReviewFlag: priorities.some((item) => item.attentionLevel === "needs_prompt_medical_review"),
      medicalFollowUpFlag: priorities.length > 0,
      message: "This summary is for follow-up planning, not diagnosis. Original lab ranges stay visible, and SehatSaathi uses standardized comparison ranges to support cleaner trends.",
    },
  };
}

function dedupeLines(items = [], limit = 3) {
  const seen = new Set();
  const output = [];
  items.forEach((item) => {
    const text = String(item || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(text);
  });
  return output.slice(0, limit);
}

function inferConditionArea(issue = {}) {
  if (issue.conditionArea && CONDITION_AREA_LABELS[issue.conditionArea]) return issue.conditionArea;
  if (METRIC_TO_CONDITION_AREA[issue.key]) return METRIC_TO_CONDITION_AREA[issue.key];
  if (FOCUS_TO_CONDITION_AREA[issue.focusKey]) return FOCUS_TO_CONDITION_AREA[issue.focusKey];
  const text = `${issue.parameter || ""} ${issue.focusLabel || ""}`.toLowerCase();
  if (/vitamin|b12|folate|ferritin|iron/.test(text)) return "vitamin_deficiency";
  if (/blood pressure|bp|hypertension|cardio|heart/.test(text)) return "cardiovascular";
  if (/infection|inflammation|crp|esr|wbc|platelet/.test(text)) return "inflammation";
  return "general";
}

function buildConditionAreas(healthIssues = {}) {
  const abnormalIssues = Array.isArray(healthIssues.abnormal) ? healthIssues.abnormal : [];
  const grouped = abnormalIssues.reduce((map, issue) => {
    const areaKey = inferConditionArea(issue);
    const existing = map.get(areaKey) || {
      key: areaKey,
      condition: CONDITION_AREA_LABELS[areaKey] || CONDITION_AREA_LABELS.general,
      issues: [],
      severityScore: 0,
      severity: "LOW",
      needsDoctorReview: false,
    };
    existing.issues.push(issue);
    const score = Number(issue.severityScore || 0);
    if (score > existing.severityScore) {
      existing.severityScore = score;
      existing.severity = issue.severity || "LOW";
    }
    if (["CRITICAL", "MODERATE"].includes(String(issue.severity || "").toUpperCase())) {
      existing.needsDoctorReview = true;
    }
    map.set(areaKey, existing);
    return map;
  }, new Map());

  const areas = Array.from(grouped.values())
    .map((group, index) => {
      const strongestIssue = group.issues
        .slice()
        .sort((a, b) => {
          const diff = Number(b.severityScore || 0) - Number(a.severityScore || 0);
          if (diff !== 0) return diff;
          return String(a.parameter || "").localeCompare(String(b.parameter || ""));
        })[0] || null;
      const metricList = dedupeLines(group.issues.map((issue) => issue.parameter), 3);
      return {
        key: group.key,
        condition: group.condition,
        severity: group.severity,
        severityScore: group.severityScore,
        reason: strongestIssue
          ? `${strongestIssue.parameter} is ${String(strongestIssue.status || "abnormal").toLowerCase()}${strongestIssue.range && strongestIssue.range !== "Not available" ? ` against range ${strongestIssue.range}` : ""}.`
          : `${group.condition} needs review in the latest report.`,
        metrics: metricList,
        needsDoctorReview: group.needsDoctorReview,
        strongestIssue,
        rankIndex: index,
      };
    })
    .sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      if (a.needsDoctorReview !== b.needsDoctorReview) return a.needsDoctorReview ? -1 : 1;
      return a.rankIndex - b.rankIndex;
    })
    .map((area, index) => ({
      ...area,
      fixFirst: index === 0,
    }));

  return areas;
}

function mergeCareActions(conditionAreas = []) {
  const selectedAreas = conditionAreas.slice(0, 3);
  const diet = [];
  const exercise = [];
  const monitoring = [];
  const doctor = [];

  selectedAreas.forEach((area) => {
    const library = AREA_ACTION_LIBRARY[area.key] || AREA_ACTION_LIBRARY.general;
    diet.push(...(library.diet || []));
    exercise.push(...(library.exercise || []));
    monitoring.push(...(library.monitoring || []));
    if (area.needsDoctorReview) {
      doctor.push(...(library.doctor || []));
    }
  });

  const hasCardioMetabolicBlend =
    selectedAreas.some((area) => area.key === "diabetes") &&
    selectedAreas.some((area) => area.key === "lipid" || area.key === "cardiovascular" || area.key === "obesity");
  if (hasCardioMetabolicBlend) {
    diet.unshift("Keep sugar, salt, and fried food lower together instead of treating them as separate problems.");
    exercise.unshift("Use one repeatable daily walk to support sugar, weight, and heart risk together.");
    monitoring.unshift("Save one note about meals, movement, BP, or sugar so the next review shows the full pattern.");
  }

  return {
    diet: dedupeLines(diet),
    exercise: dedupeLines(exercise),
    monitoring: dedupeLines(monitoring),
    doctor: dedupeLines(doctor),
  };
}

function buildCarePlan(healthIssues = {}, safety = {}, overallConfidence = 0, extractionGuard = {}) {
  const conditionAreas = buildConditionAreas(healthIssues);
  const reviewHeavy = extractionGuard.requiresCautiousPlan || Number(overallConfidence || 0) < 0.88 || safety.requiresManualReview;
  if (reviewHeavy) {
    return {
      overallStatus: "Needs Attention",
      priorityIssues: conditionAreas,
      dailyPlan: [
        {
          category: "Manual Review",
          actions: [extractionGuard.message || "We could not confidently read all report values. Please review manually or consult a doctor."],
        },
      ],
      safetyMessage:
        `${extractionGuard.message || "We could not confidently read all report values. Please review manually or consult a doctor."} This plan does not replace medical advice.`,
      doctorReviewRecommended: true,
      fallbackReason: extractionGuard.fallbackReason || "low_confidence",
    };
  }

  const mergedActions = mergeCareActions(conditionAreas);
  const doctorReviewRecommended =
    safety.status === "emergency" ||
    safety.status === "urgent_review" ||
    conditionAreas.some((area) => area.needsDoctorReview);
  const overallStatus =
    safety.status === "emergency" || doctorReviewRecommended
      ? "Doctor Review Recommended"
      : conditionAreas.length
        ? "Needs Attention"
        : "Normal";

  return {
    overallStatus,
    priorityIssues: conditionAreas.map((area) => ({
      condition: area.condition,
      severity: area.severity,
      reason: area.reason,
      fixFirst: area.fixFirst,
      conditionKey: area.key,
      metrics: area.metrics,
    })),
    dailyPlan: [
      { category: "Diet", actions: mergedActions.diet },
      { category: "Exercise", actions: mergedActions.exercise },
      { category: "Monitoring", actions: mergedActions.monitoring },
      { category: "Doctor Review", actions: doctorReviewRecommended ? dedupeLines([
        ...mergedActions.doctor,
        safety.actionLabel === "Contact a doctor" ? "Contact a doctor or clinic without delay if you also feel unwell." : "",
      ]) : [] },
    ].filter((section) => section.actions.length),
    safetyMessage:
      doctorReviewRecommended
        ? "This may require medical review. Please consult your doctor. This plan does not replace medical advice or medication guidance."
        : "This plan does not replace medical advice. Please consult a doctor for diagnosis, medicines, or if symptoms worsen.",
    doctorReviewRecommended,
    fallbackReason: null,
  };
}

function buildHealthIssues(trends = [], safety = {}, patientContext = {}) {
  const issues = (trends || []).map((trend) => {
    const severity = classifyMetricSeverity(trend);
    const focusKey = ISSUE_FOCUS_MAP[trend.metricKey] || "general";
    const rangeText = [
      Number.isFinite(Number(trend.low)) ? trend.low : null,
      Number.isFinite(Number(trend.high)) ? trend.high : null,
    ].filter((value) => value !== null).join("-");
    const issue = {
      key: trend.metricKey,
      focusKey,
      focusLabel: ISSUE_FOCUS_LABELS[focusKey] || ISSUE_FOCUS_LABELS.general,
      conditionArea: METRIC_TO_CONDITION_AREA[trend.metricKey] || FOCUS_TO_CONDITION_AREA[focusKey] || "general",
      parameter: trend.metricLabel,
      value: trend.latestValue,
      unit: trend.unit || "",
      range: rangeText || "Not available",
      status: severity.status,
      severity: severity.severity,
      severityScore: severity.severityScore,
      zone: trend.zone || "normal",
      needsReview: Boolean(trend.needsReview),
      confidence: trend.latestConfidence ?? null,
      summary: trend.summary || "",
      changeOverTime: buildChangeOverTime(trend),
    };
    const trendState = buildMetricTrendState(trend);
    issue.changeOverTime = {
      ...issue.changeOverTime,
      state: trendState.state,
      trendLabel: trendState.label,
      trendSummary: trendState.summary,
    };
    issue.doctorQuestions = buildDoctorQuestions(issue, patientContext);
    return issue;
  });

  const sorted = issues.slice().sort((a, b) => {
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    if (a.needsReview !== b.needsReview) return a.needsReview ? 1 : -1;
    return String(a.parameter).localeCompare(String(b.parameter));
  });
  const abnormal = sorted.filter((issue) => issue.status !== "NORMAL");
  const topIssue = abnormal[0] || sorted[0] || null;
  const highestSeverity = abnormal[0]?.severity || "NORMAL";
  const status = safety.status === "emergency"
    ? "Contact doctor"
    : safety.status === "urgent_review" || highestSeverity === "CRITICAL"
      ? "Needs doctor review"
      : abnormal.length
        ? "Needs attention"
        : sorted.length
          ? "Looks steady"
          : "No report yet";
  const recommendedAction = safety.status === "emergency"
    ? "A medical follow-up is needed without waiting."
    : highestSeverity === "CRITICAL"
      ? "A medical follow-up may help clarify this result soon."
      : highestSeverity === "MODERATE"
        ? "Discuss this with your doctor in the next routine follow-up."
        : abnormal.length
          ? "Focusing on the most meaningful findings first can make follow-up easier."
          : sorted.length
            ? "Keep routine checks and compare the next report"
            : "Upload a clear report";
  const focusKey = topIssue?.focusKey || "general";
  const fixThisFirst = topIssue
    ? {
        title: topIssue.status === "NORMAL" ? "Keep this steady" : `${topIssue.parameter} - ${topIssue.status}`,
        focusKey,
        focusLabel: topIssue.focusLabel,
        severity: topIssue.severity,
        status: topIssue.status,
        body: topIssue.status === "NORMAL"
          ? `${topIssue.parameter} looks steady. Use this as your baseline for future reports.`
          : `This result may deserve a closer review first, especially before lower-context findings.`,
        actions: ISSUE_ACTIONS[focusKey] || ISSUE_ACTIONS.general,
        doctorQuestions: topIssue.doctorQuestions,
      }
    : {
        title: "Upload one report",
        focusKey: "general",
        focusLabel: "Health",
        severity: "NORMAL",
        status: "NO_REPORT",
        body: "A clear report will show what needs attention first.",
        actions: ["Upload a clear PDF or sharp report image.", "Review extracted values before acting on the summary."],
        doctorQuestions: [],
      };

  return {
    overallStatus:
      safety.status === "emergency" || safety.status === "urgent_review" || highestSeverity === "CRITICAL"
        ? "Doctor Review Recommended"
        : abnormal.length
          ? "Needs Attention"
          : sorted.length
            ? "Normal"
            : "Normal",
    status,
    recommendedAction,
    totalIssues: sorted.length,
    abnormalCount: abnormal.length,
    topIssue,
    all: sorted,
    abnormal: abnormal.slice(0, 6),
    normal: sorted.filter((issue) => issue.status === "NORMAL").slice(0, 6),
    fixThisFirst,
    changeOverTime: topIssue?.changeOverTime || null,
  };
}

function buildReportInsights({ analyses = [], months = 6, referenceDate = new Date().toISOString(), patientContext = {} } = {}) {
  const cutoff = new Date(referenceDate);
  cutoff.setMonth(cutoff.getMonth() - Number(months || 6));
  const filteredAnalyses = analyses.filter((item) => {
    const ts = Date.parse(item.reportDate || item.createdAt || "");
    return Number.isNaN(ts) ? true : ts >= cutoff.getTime();
  });

  const context = normalizePatientContext(patientContext);
  const metricBuckets = new Map();
  filteredAnalyses.forEach((analysis) => {
    (analysis.metrics || []).forEach((metric) => {
      if (!metricBuckets.has(metric.metricKey)) {
        metricBuckets.set(metric.metricKey, []);
      }
      metricBuckets.get(metric.metricKey).push({
        reportId: analysis.recordId,
        reportType: analysis.reportType,
        reportDate: analysis.reportDate,
        value: Number(metric.valueNum),
        unit: metric.unit,
        referenceLow: metric.referenceLow,
        referenceHigh: metric.referenceHigh,
        confidence: metric.confidence ?? null,
      });
    });
  });

  const trends = Array.from(metricBuckets.entries())
    .map(([metricKey, points]) => {
      const sorted = [...points]
        .filter((point) => Number.isFinite(point.value))
        .sort((a, b) => new Date(a.reportDate || 0) - new Date(b.reportDate || 0));
      if (!sorted.length) return null;
      const reportType = sorted[sorted.length - 1].reportType;
      const baseMetricDef =
        findMetricDefinition(metricKey) || {
          key: metricKey,
          label: metricKey,
          unit: sorted[sorted.length - 1].unit || "",
        };
      const metricDef = getContextualMetricDefinition(baseMetricDef, context);
      const latest = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      return {
        metricKey,
        metricLabel: metricDef.label,
        reportType,
        unit: metricDef.unit || latest.unit || "",
        low: metricDef.low ?? latest.referenceLow ?? null,
        high: metricDef.high ?? latest.referenceHigh ?? null,
        latestValue: latest.value,
        previousValue: previous?.value ?? null,
        latestConfidence: latest.confidence ?? null,
        needsReview: sorted.some((point) => Number(point.confidence || 1) < 0.88),
        zone: evaluateMetric(metricDef, latest.value).zone,
        summary: buildNarrative(metricDef, latest, previous),
        points: sorted.map((point) => ({
          label: buildDateLabel(point.reportDate),
          value: point.value,
          confidence: point.confidence ?? null,
        })),
      };
    })
    .filter(Boolean);

  const latestReports = filteredAnalyses
    .slice()
    .sort((a, b) => new Date(b.reportDate || 0) - new Date(a.reportDate || 0))
    .slice(0, 12);

  const reviewHeavy = trends.filter((trend) => trend.needsReview).length;
  const trustedTrendCount = trends.length - reviewHeavy;
  const overallConfidence =
    trends.length
      ? Math.round(
          (trends.reduce((sum, trend) => sum + Number(trend.latestConfidence ?? 0), 0) / trends.length) * 100,
        ) / 100
      : 0;
  const extractionGuard = buildExtractionQualityGuard({
    analyses: filteredAnalyses,
    latestReports,
    overallConfidence,
    reviewHeavy,
  });

  const conditionSummaries = buildConditionSummaries(trends, context).map((item) => ({
    ...item,
    title: sanitizePatientFacingText(item.title),
    summary: sanitizePatientFacingText(item.summary),
  }));
  const badges = buildBadges(trends, conditionSummaries);
  const safety = buildReportSafety(trends, overallConfidence, reviewHeavy);
  const healthIssues = buildHealthIssues(trends, safety, context);
  const guidedFollowUp = buildGuidedFollowUp({ healthIssues, safety, trends, overallConfidence, extractionGuard, patientContext: context });
  const doctorHandoff = buildDoctorHandoff(healthIssues, safety, trends);
  const carePlan = buildCarePlan(healthIssues, safety, overallConfidence, extractionGuard);
  const personalizedFollowUp = buildPersonalizedFollowUp({
    guidedFollowUp,
    healthIssues,
    conditionSummaries,
    patientContext: context,
  });

  const doctorSummary = !trends.length
    ? "No structured report values are available in the selected time window yet."
    : reviewHeavy
      ? `Extraction quality review is still needed for ${reviewHeavy} of ${trends.length} tracked metric trend${trends.length === 1 ? "" : "s"}. Trusted trends: ${trustedTrendCount}. ${trends
          .filter((item) => !item.needsReview)
          .slice(0, 3)
          .map((item) => item.summary)
          .join(" ")}`.trim()
      : `${trends.slice(0, 4).map((item) => item.summary).join(" ")} ${conditionSummaries
          .slice(0, 2)
          .map((item) => item.summary)
          .join(" ")}`.trim();
  const patientSummary = carePlan.fallbackReason
    ? extractionGuard.message || "We could not confidently read all report values. Please review manually or consult a doctor."
    : !trends.length
      ? "No report summary is ready yet. Upload a clear report to see what matters and what to do next."
      : reviewHeavy
        ? `${reviewHeavy} extracted value${reviewHeavy === 1 ? "" : "s"} still need a quick review, so use this summary with caution.`
      : healthIssues.topIssue
        ? `${guidedFollowUp.overview.headline}. ${guidedFollowUp.overview.summary}`
        : `${conditionSummaries[0]?.summary || "Your latest report has been organized into a simple summary."} ${conditionSummaries[1]?.zone && conditionSummaries[1].zone !== "normal" ? conditionSummaries[1].summary : ""}`.trim();

  return {
    months: Number(months || 6),
    trends,
    latestReports,
    badges,
    conditionSummaries,
    patientContext: {
      ageYears: context.ageYears,
      sex: context.sex || "",
      chronicConditions: context.chronicConditions,
      allergies: context.allergies,
      medications: context.medications,
      contextNotes: buildPatientContextLines(context),
      usedInInterpretation: Boolean(
        Number.isFinite(context.ageYears) || context.sex || context.chronicConditions.length || context.allergies.length || context.medications.length,
      ),
    },
    patientSummary: sanitizePatientFacingText(patientSummary),
    doctorSummary,
    doctorHandoff,
    safety,
    healthIssues,
    carePlan,
    extractionSafety: extractionGuard,
    overview: guidedFollowUp.overview,
    priorities: guidedFollowUp.priorities,
    canWait: guidedFollowUp.canWait,
    nextSteps: guidedFollowUp.nextSteps,
    doctorQuestions: guidedFollowUp.doctorQuestions,
    guidedTrends: guidedFollowUp.trends,
    guidedFollowUp,
    personalizedFollowUp,
    safetyLayer: guidedFollowUp.safety,
    decision: {
      overallStatus: carePlan.overallStatus || healthIssues.overallStatus || "Normal",
      healthStatus: healthIssues.status,
      recommendedAction: healthIssues.recommendedAction,
      abnormalCount: healthIssues.abnormalCount,
      topIssue: healthIssues.topIssue,
      fixThisFirst: healthIssues.fixThisFirst,
      changeOverTime: healthIssues.changeOverTime,
      priorityIssues: carePlan.priorityIssues || [],
      carePlan,
      doctorHandoff,
      disclaimer: "This is not a medical diagnosis. Consult a doctor for clinical decisions.",
    },
  };
}

module.exports = {
  REPORT_CATALOG,
  listReportCatalog,
  buildReportInsights,
  parseReportText,
  parseReportSections,
  deriveInterpretationBand,
};
