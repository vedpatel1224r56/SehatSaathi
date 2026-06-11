// Generates a personalized action block tied to the most important abnormal metric.
// Pure lookup — no API calls, no latency.
// Supports lang: "en" | "gu" | "hi"

// ─── tiny helper ──────────────────────────────────────────────────────────────
function s(obj, lang) { return obj[lang] || obj.en; }

// ─── Shared retest period strings ─────────────────────────────────────────────
const RETEST = {
  "1_2w":  { en: "1–2 weeks",   gu: "1–2 અઠવાડિયા",  hi: "1–2 हफ़्ते"    },
  "2w":    { en: "2 weeks",     gu: "2 અઠવાડિયા",     hi: "2 हफ़्ते"      },
  "2_4w":  { en: "2–4 weeks",   gu: "2–4 અઠવાડિયા",  hi: "2–4 हफ़्ते"   },
  "4w":    { en: "4 weeks",     gu: "4 અઠવાડિયા",     hi: "4 हफ़्ते"      },
  "4_6w":  { en: "4–6 weeks",   gu: "4–6 અઠવાડિયા",  hi: "4–6 हफ़्ते"   },
  "6w":    { en: "6 weeks",     gu: "6 અઠવાડિયા",     hi: "6 हफ़्ते"      },
  "6_8w":  { en: "6–8 weeks",   gu: "6–8 અઠવાડિયા",  hi: "6–8 हफ़्ते"   },
  "3m":    { en: "3 months",    gu: "3 મહિના",         hi: "3 महीने"       },
};

const SAFE_AREA_ACTIONS = {
  sugar: [
    "Keep meal timing and any home glucose readings visible this week.",
    "Prefer water over sweet drinks and keep portions of refined carbohydrates modest.",
    "Record symptoms such as unusual thirst, frequent urination, shakiness, or fatigue.",
  ],
  inflammation: [
    "Record fever, pain, swelling, rash, breathing symptoms, or any recent infection.",
    "Keep hydration, sleep, and recovery steady while the result is being reviewed.",
    "Do not start antibiotics, steroids, or supplements from this result alone.",
  ],
  allergy: [
    "Note any rash, itching, wheeze, sinus symptoms, food reaction, or recent exposure.",
    "Avoid only triggers that you already know affect you; do not remove major food groups from this result alone.",
    "Keep current allergy medicines unchanged unless your clinician advises otherwise.",
  ],
  red_cells: [
    "Keep fatigue, breathlessness, dizziness, bleeding, menstrual history, and diet context ready for review.",
    "Include varied protein, pulses, vegetables, and vitamin-C-rich foods as part of a balanced diet.",
    "Do not start iron, folate, or vitamin B12 supplements until the pattern is reviewed.",
  ],
  thyroid: [
    "Take prescribed thyroid medicine exactly as directed and record missed or delayed doses.",
    "Note fatigue, weight change, heat or cold intolerance, bowel changes, or palpitations.",
    "Do not change thyroid medicine or iodine supplements from this result alone.",
  ],
  kidney: [
    "Keep hydration steady unless a clinician has given you a fluid restriction.",
    "Record swelling, urine changes, vomiting, diarrhoea, or recent illness.",
    "Do not stop prescribed medicines or take painkillers repeatedly without clinical advice.",
  ],
  liver: [
    "Avoid alcohol while the result is being reviewed.",
    "Keep a list of prescribed medicines, supplements, and recent over-the-counter products.",
    "Record jaundice, dark urine, pale stools, abdominal discomfort, nausea, or itching.",
  ],
  urine: [
    "Record burning, urgency, fever, back pain, visible blood, swelling, or changes in urine output.",
    "Use a clean-catch sample if your clinician or lab asks for a repeat urine test.",
    "Do not start antibiotics or urinary medicines from this report alone.",
  ],
  weight: [
    "Save one weight reading under similar conditions each week.",
    "Choose balanced meals with vegetables, pulses or protein, and fewer ultra-processed foods.",
    "Use a comfortable activity goal that fits your mobility and existing conditions.",
  ],
};

function makeReviewPlaybook({
  label,
  area,
  retestKey = "4w",
  retestDays = 28,
  linkedTrackers = ["symptoms"],
  highQuestion,
  lowQuestion,
  highActions = null,
  lowActions = null,
}) {
  const build = (direction) => ({ value, unit, low, high }, lang) => {
    const isHigh = direction === "high";
    const boundary = isHigh ? high : low;
    const comparison = boundary == null
      ? (isHigh ? "above the report range" : "below the report range")
      : `${isHigh ? "above" : "below"} the report limit of ${boundary}${unit ? ` ${unit}` : ""}`;
    const actions = (isHigh ? highActions : lowActions) || SAFE_AREA_ACTIONS[area] || SAFE_AREA_ACTIONS.inflammation;
    const question = (isHigh ? highQuestion : lowQuestion) ||
      `Ask what may explain this ${label} result and whether it should be repeated with symptoms or prior reports in view.`;
    return {
      headline: s({
        en: `Your ${label} is ${value}${unit ? ` ${unit}` : ""} — ${comparison}.`,
        gu: `${label} ${value}${unit ? ` ${unit}` : ""} છે — રિપોર્ટની સરખામણી રેન્જની બહાર છે.`,
        hi: `${label} ${value}${unit ? ` ${unit}` : ""} है — रिपोर्ट की तुलना सीमा से बाहर है।`,
      }, lang),
      thisWeek: s({
        en: actions,
        gu: actions,
        hi: actions,
      }, lang),
      checkIns: [
        { id: `${area}_context`, label: actions[0], icon: "📝", linkedTracker: linkedTrackers[0] || "symptoms" },
        { id: `${area}_routine`, label: actions[1], icon: "✓" },
        { id: `${area}_safety`, label: actions[2], icon: "🩺" },
      ],
      linkedTrackers,
      retestDays,
      retest: s(RETEST[retestKey] || RETEST["4w"], lang),
      bringToDoctor: s({ en: question, gu: question, hi: question }, lang),
    };
  };
  return { high: build("high"), low: build("low") };
}

// ─── Playbooks ─────────────────────────────────────────────────────────────────
const METRIC_PLAYBOOKS = {

  hemoglobin: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your haemoglobin is ${value} ${unit} — lower than the ${low}+ normal range.`,
        gu: `તમારો haemoglobin ${value} ${unit} છે — ${low}+ normal range કરતાં ઓછો.`,
        hi: `आपका हीमोग्लोबिन ${value} ${unit} है — ${low}+ सामान्य range से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Eat spinach, methi, or beetroot daily — even a small portion counts.",
          "Skip tea or coffee for at least 1 hour after meals (they block iron).",
          "Add a vitamin-C source at lunch or dinner (lemon juice, amla, tomato).",
        ],
        gu: [
          "દરરોજ પાલક, મેથી, અથવા બીટ ખાઓ — નાની માત્રા પણ ચાલે.",
          "ભોજન પછી ઓછામાં ઓછો 1 કલાક ચા/કૉફી ન પીઓ (iron block થાય).",
          "લંચ અથવા ડિનરમાં vitamin-C ઉમેરો (lime, amla, tomato).",
        ],
        hi: [
          "रोज़ पालक, मेथी, या चुकंदर खाएं — थोड़ी मात्रा भी काम आती है।",
          "खाने के कम से कम 1 घंटे बाद तक चाय/कॉफी न पिएं (iron absorb होने से रोकती है)।",
          "दोपहर या रात के खाने में vitamin-C शामिल करें (नींबू, आंवला, टमाटर)।",
        ],
      }, lang),
      checkIns: [
        { id: "iron_food",  label: s({ en: "Ate spinach, methi, or beetroot today",       gu: "આજે પાલક, મેથી, અથવા બીટ ખાધા",             hi: "आज पालक, मेथी, या चुकंदर खाया"          }, lang), icon: "🥬" },
        { id: "no_tea",     label: s({ en: "Avoided tea/coffee for 1 hr after a meal",    gu: "ભોજન પછી 1 કલાક ચા/કૉફી ન પીધી",           hi: "खाने के बाद 1 घंटे तक चाय/कॉफी नहीं ली" }, lang), icon: "🚫☕" },
        { id: "vitamin_c",  label: s({ en: "Had a vitamin-C source at lunch or dinner",   gu: "લંચ/ડિનરમાં vitamin-C સ્ત્રોત ખાધો",        hi: "लंच/डिनर में vitamin-C लिया"             }, lang), icon: "🍋" },
      ],
      linkedTrackers: ["symptoms", "weight"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask your doctor whether you need an iron supplement and for how long.",
        gu: "ડૉક્ટરને પૂછો iron supplement ની જરૂર છે કે નહીં અને કેટલા સમય સુધી.",
        hi: "डॉक्टर से पूछें कि iron supplement की ज़रूरत है या नहीं और कब तक।",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your haemoglobin is ${value} ${unit} — above the ${high} upper limit.`,
        gu: `તમારો haemoglobin ${value} ${unit} છે — ${high} upper limit કરતાં વધારે.`,
        hi: `आपका हीमोग्लोबिन ${value} ${unit} है — ${high} की ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Drink at least 2.5 litres of water daily.",
          "Avoid iron supplements unless specifically prescribed.",
          "Reduce red meat to once a week until reviewed.",
        ],
        gu: [
          "દરરોજ ઓછામાં ઓછું 2.5 litre પાણી પીઓ.",
          "Doctor ના prescription વગર iron supplements ન લો.",
          "Review ના ત્યાં સુધી red meat અઠવાડિયામાં એકવાર જ ખાઓ.",
        ],
        hi: [
          "रोज़ कम से कम 2.5 लीटर पानी पिएं।",
          "जब तक डॉक्टर न कहें, iron supplement न लें।",
          "जब तक review न हो, red meat हफ़्ते में एक बार तक सीमित करें।",
        ],
      }, lang),
      checkIns: [
        { id: "water",       label: s({ en: "Drank 2.5 litres of water today",     gu: "આજે 2.5 litre પાણી પીધું",          hi: "आज 2.5 लीटर पानी पिया"           }, lang), icon: "💧" },
        { id: "no_iron_sup", label: s({ en: "Skipped iron supplements today",      gu: "આજે iron supplements ન લીધી",       hi: "आज iron supplement नहीं ली"       }, lang), icon: "🚫💊" },
        { id: "no_red_meat", label: s({ en: "No red meat today",                   gu: "આજે red meat ન ખાધું",              hi: "आज red meat नहीं खाया"            }, lang), icon: "🥗" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask your doctor why your haemoglobin is high and whether you need any tests.",
        gu: "ડૉક્ટરને પૂછો haemoglobin high કેમ છે અને કોઈ test ની જરૂર છે?",
        hi: "डॉक्टर से पूछें कि हीमोग्लोबिन ज़्यादा क्यों है और कोई test ज़रूरी है क्या।",
      }, lang),
    }),
  },

  hba1c: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your HbA1c is ${value}${unit} — above the ${high}% target for blood sugar control.`,
        gu: `તમારો HbA1c ${value}${unit} છે — blood sugar control માટે ${high}% target કરતાં વધારે.`,
        hi: `आपका HbA1c ${value}${unit} है — blood sugar control के ${high}% लक्ष्य से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Replace white rice or maida at one meal per day with whole grain or millet.",
          "Walk for 30 minutes after your largest meal.",
          "Log your fasting sugar one morning this week.",
        ],
        gu: [
          "દરરોજ એક ભોજનમાં સફેદ ચોખા અથવા મેંદો બદલે whole grain અથવા millet લો.",
          "સૌથી મોટા ભોજન પછી 30 મિનિટ ચાલો.",
          "આ અઠવાડિયે એક સવારે fasting sugar log કરો.",
        ],
        hi: [
          "रोज़ एक भोजन में सफ़ेद चावल या मैदा की जगह whole grain या बाजरा लें।",
          "सबसे बड़े भोजन के बाद 30 मिनट चलें।",
          "इस हफ़्ते एक सुबह अपना fasting sugar log करें।",
        ],
      }, lang),
      checkIns: [
        { id: "grain_swap",  label: s({ en: "Replaced rice/maida at one meal today",          gu: "આજે એક ભોજનમાં ચોખા/મેંદો બદલ્યા",            hi: "आज एक भोजन में चावल/मैदा बदला"          }, lang), icon: "🌾" },
        { id: "walk_meal",   label: s({ en: "Walked 30 min after a meal today",                gu: "આજે ભોજન પછી 30 min ચાલ્યા",                   hi: "आज खाने के बाद 30 मिनट चले"             }, lang), icon: "🚶" },
        { id: "fasting_log", label: s({ en: "Logged fasting blood sugar this morning",         gu: "આ સવારે fasting blood sugar log કર્યો",          hi: "आज सुबह fasting blood sugar log किया"   }, lang), icon: "🩸", linkedTracker: "bloodSugar" },
      ],
      linkedTrackers: ["bloodSugar", "weight", "walking"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask what your personal blood sugar target should be and whether your medicines need any change.",
        gu: "પૂછો કે તમારો personal blood sugar target શું છે અને medicines માં ફેરફારની જરૂર છે?",
        hi: "पूछें कि आपका personal blood sugar target क्या होना चाहिए और medicines में बदलाव की ज़रूरत है क्या।",
      }, lang),
    }),
  },

  fbs: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your fasting blood sugar is ${value} ${unit} — above the ${high} mg/dL normal range.`,
        gu: `તમારિ fasting blood sugar ${value} ${unit} છે — ${high} mg/dL normal range કરતાં વધારે.`,
        hi: `आपकी fasting blood sugar ${value} ${unit} है — ${high} mg/dL सामान्य range से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Avoid eating anything after 9 PM.",
          "Replace one refined-carb item daily with vegetables or dal.",
          "Walk for at least 20 minutes in the morning.",
        ],
        gu: [
          "રાત્રે 9 વાગ્યા પછી કંઈ ન ખાઓ.",
          "દરરોજ એક refined carb ખોરાક બદલે શાકભાજી અથવા dal ખાઓ.",
          "સવારે ઓછામાં ઓછા 20 મિનિટ ચાલો.",
        ],
        hi: [
          "रात 9 बजे के बाद कुछ न खाएं।",
          "रोज़ एक refined carb की जगह सब्ज़ियां या दाल लें।",
          "सुबह कम से कम 20 मिनट चलें।",
        ],
      }, lang),
      checkIns: [
        { id: "no_late_eat",  label: s({ en: "Did not eat after 9 PM last night",          gu: "ગઈ રાત્રે 9 પછી ન ખાધું",                 hi: "कल रात 9 बजे के बाद नहीं खाया"       }, lang), icon: "🌙" },
        { id: "carb_swap",    label: s({ en: "Replaced one refined carb with veg or dal",  gu: "એક refined carb ની જગ્યે shak/dal ખાધું",  hi: "एक refined carb की जगह सब्ज़ी/दाल ली"}, lang), icon: "🥗" },
        { id: "morning_walk", label: s({ en: "Walked 20 min this morning",                 gu: "આ સવારે 20 min ચાલ્યા",                   hi: "आज सुबह 20 मिनट चले"                 }, lang), icon: "🚶", linkedTracker: "bloodSugar" },
      ],
      linkedTrackers: ["bloodSugar", "walking"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask what your fasting sugar result means for you and what number to aim for going forward.",
        gu: "ડૉક્ટરને પૂછો fasting sugar નું શું અર્થ છે અને target number શું હોવો જોઈએ.",
        hi: "डॉक्टर से पूछें कि आपकी fasting sugar का मतलब क्या है और आगे कौन सा number target रखना चाहिए।",
      }, lang),
    }),
  },

  ppbs: {
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your post-meal blood sugar is ${value} ${unit} — higher than normal after eating.`,
        gu: `તમારિ post-meal blood sugar ${value} ${unit} છે — ખાવા પછી normal કરતાં વધારે.`,
        hi: `आपकी post-meal blood sugar ${value} ${unit} है — खाने के बाद सामान्य से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Take a 15-minute walk after each main meal.",
          "Halve your portion of rice or roti at lunch and dinner.",
          "Avoid fruit juices — eat whole fruit instead.",
        ],
        gu: [
          "દરેક મુખ્ય ભોજન પછી 15 મિનિટ ચાલો.",
          "લંચ અને ડિનરમાં ચોખા અથવા રોટી ની quantity ઘટાડો.",
          "Fruit juice ટાળો — whole fruit ખાઓ.",
        ],
        hi: [
          "हर मुख्य भोजन के बाद 15 मिनट चलें।",
          "दोपहर और रात के खाने में चावल या रोटी की मात्रा आधी करें।",
          "Fruit juice न पिएं — साबुत फल खाएं।",
        ],
      }, lang),
      checkIns: [
        { id: "post_meal_walk", label: s({ en: "Walked after a main meal today",          gu: "આજે ભોજન પછી ચાલ્યા",                 hi: "आज खाने के बाद चले"              }, lang), icon: "🚶", linkedTracker: "bloodSugar" },
        { id: "portion_cut",    label: s({ en: "Halved rice/roti portion at a meal",      gu: "ભોજનમાં ચોખા/રોટીની quantity ઘટાડી",  hi: "एक भोजन में चावल/रोटी आधी की"   }, lang), icon: "🍚" },
        { id: "no_juice",       label: s({ en: "Had whole fruit instead of juice today",  gu: "Juice ની જગ્યે whole fruit ખાધું",     hi: "Juice की जगह साबुत फल खाया"      }, lang), icon: "🍊" },
      ],
      linkedTrackers: ["bloodSugar", "walking"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask whether your sugar after meals is a concern and if food changes alone are enough.",
        gu: "પૂછો ભોજન પછીની sugar ચિંતાજનક છે અને ખોરાક ફેરફારથી જ ઠીક થશે?",
        hi: "पूछें कि खाने के बाद की sugar चिंताजनक है और क्या सिर्फ़ खाने में बदलाव से काम चलेगा।",
      }, lang),
    }),
  },

  total_cholesterol: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your total cholesterol is ${value} ${unit} — above the ${high} mg/dL ideal range.`,
        gu: `તમારો total cholesterol ${value} ${unit} છે — ${high} mg/dL ideal range કરતાં વધારે.`,
        hi: `आपका total cholesterol ${value} ${unit} है — ${high} mg/dL की आदर्श range से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Switch to mustard or olive oil for cooking this week.",
          "Eat one handful of walnuts or flaxseeds daily.",
          "Cut fried snacks to once this week.",
        ],
        gu: [
          "આ અઠવાડિયે રસોઈ માટે mustard અથવા olive oil વાપરો.",
          "દરરોજ એક મૂઠ walnuts અથવા flaxseeds ખાઓ.",
          "Fried snacks આ અઠવાડિયે ફક્ત એકવાર ખાઓ.",
        ],
        hi: [
          "इस हफ़्ते खाना बनाने के लिए सरसों या olive oil इस्तेमाल करें।",
          "रोज़ एक मुट्ठी अखरोट या अलसी खाएं।",
          "इस हफ़्ते तले हुए snacks सिर्फ़ एक बार खाएं।",
        ],
      }, lang),
      checkIns: [
        { id: "good_oil",   label: s({ en: "Cooked with mustard or olive oil today",      gu: "આજે mustard/olive oil માં રાંધ્યું",        hi: "आज सरसों/olive oil में पकाया"     }, lang), icon: "🫙" },
        { id: "nuts",       label: s({ en: "Had a handful of walnuts or flaxseeds today", gu: "આજે walnuts/flaxseeds ખાધા",               hi: "आज अखरोट/अलसी खाई"              }, lang), icon: "🥜" },
        { id: "no_fried",   label: s({ en: "Avoided fried snacks today",                  gu: "આજે fried snacks ટાળ્યા",                  hi: "आज तले हुए snacks से बचे"        }, lang), icon: "🚫🍟" },
      ],
      linkedTrackers: ["weight", "symptoms", "walking"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask whether your bad cholesterol level needs a medicine or if eating better and walking is enough.",
        gu: "પૂછો cholesterol level ને medicine ની જરૂર છે અથવા ખોરાક અને ચાલવાથી ઠીક થશે?",
        hi: "पूछें कि cholesterol के लिए दवाई ज़रूरी है या खाने में सुधार और चलने से काम चलेगा।",
      }, lang),
    }),
  },

  ldl: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your LDL cholesterol is ${value} ${unit} — above the ${high} mg/dL limit.`,
        gu: `તમારો LDL cholesterol ${value} ${unit} છે — ${high} mg/dL limit કરતાં વધારે.`,
        hi: `आपका LDL cholesterol ${value} ${unit} है — ${high} mg/dL की सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Avoid ghee, butter, and full-fat dairy for one week.",
          "Add oats or barley to one breakfast — soluble fibre lowers LDL.",
          "Walk or cycle for 30 minutes on at least 4 days.",
        ],
        gu: [
          "એક અઠવાડિયા માટે ઘી, butter, અને full-fat dairy ટાળો.",
          "એક breakfast માં oats અથવા barley ઉમેરો — soluble fibre LDL ઘટાડે.",
          "ઓછામાં ઓછા 4 દિવસ 30 મિનિટ ચાલો અથવા cycling કરો.",
        ],
        hi: [
          "एक हफ़्ते के लिए घी, मक्खन, और full-fat dairy से बचें।",
          "एक नाश्ते में oats या जौ शामिल करें — इसका soluble fibre LDL घटाता है।",
          "कम से कम 4 दिन 30 मिनट चलें या cycling करें।",
        ],
      }, lang),
      checkIns: [
        { id: "no_sat_fat",  label: s({ en: "Avoided ghee/butter/full-fat dairy today",  gu: "આजE ghee/butter/full-fat dairy ટાળ્યા",   hi: "आज घी/मक्खन/full-fat dairy से बचे"  }, lang), icon: "🚫🧈" },
        { id: "fibre_meal",  label: s({ en: "Had oats or barley at breakfast today",      gu: "આjE breakfast માં oats/barley ખાધા",       hi: "आज नाश्ते में oats/जौ खाया"         }, lang), icon: "🌾" },
        { id: "cardio",      label: s({ en: "Walked or cycled 30 min today",              gu: "આjE 30 min ચાલ્યા અથવા cycling કરી",      hi: "आज 30 मिनट चले या cycling की"        }, lang), icon: "🚴" },
      ],
      linkedTrackers: ["weight", "walking"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask whether you need a cholesterol medicine given your heart health overall.",
        gu: "heart health ને ધ્યાનમાં રાખીને cholesterol medicine ની જરૂર છે?",
        hi: "पूछें कि आपकी दिल की सेहत को देखते हुए cholesterol की दवाई ज़रूरी है क्या।",
      }, lang),
    }),
  },

  hdl: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your HDL (good cholesterol) is ${value} ${unit} — below the ${low} mg/dL healthy level.`,
        gu: `તમારો HDL (good cholesterol) ${value} ${unit} છે — ${low} mg/dL healthy level કરતાં ઓછો.`,
        hi: `आपका HDL (good cholesterol) ${value} ${unit} है — ${low} mg/dL की स्वस्थ सीमा से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Add a 30-minute brisk walk or any aerobic activity on at least 3 days.",
          "Eat a handful of nuts (almonds, walnuts) daily.",
          "If you smoke, this is the single highest-impact change you can make.",
        ],
        gu: [
          "ઓછામાં ઓછા 3 દિવસ 30 મિનિટ brisk walking અથવા aerobic exercise કરો.",
          "દરરોજ એક મૂઠ nuts (badam, walnuts) ખાઓ.",
          "જો smoking કરો છો, તો આ સૌથી મહત્ત્વનો ફેરફાર છે.",
        ],
        hi: [
          "कम से कम 3 दिन 30 मिनट तेज़ चलें या aerobic exercise करें।",
          "रोज़ एक मुट्ठी nuts (बादाम, अखरोट) खाएं।",
          "अगर धूम्रपान करते हैं, तो यह सबसे असरदार बदलाव होगा।",
        ],
      }, lang),
      checkIns: [
        { id: "aerobic",   label: s({ en: "Did 30 min brisk walk or aerobic exercise",  gu: "30 min brisk walk / aerobic exercise કી",  hi: "30 मिनट तेज़ चले या aerobic exercise किया" }, lang), icon: "🏃" },
        { id: "nuts",      label: s({ en: "Ate a handful of almonds or walnuts today",   gu: "આjE badam/walnuts ખાધા",                  hi: "आज बादाम/अखरोट खाए"                        }, lang), icon: "🥜" },
        { id: "no_smoke",  label: s({ en: "Did not smoke today",                         gu: "આjE smoking ન કrI",                       hi: "आज धूम्रपान नहीं किया"                     }, lang), icon: "🚭" },
      ],
      linkedTrackers: ["weight", "symptoms", "walking"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask how your low good-cholesterol affects your heart health and what to do about it.",
        gu: "ઓછો HDL heart health ને કેવી અસર કરે છે અને શું કરવું જોઈએ?",
        hi: "पूछें कि कम HDL आपके दिल की सेहत को कैसे प्रभावित करता है और क्या करना चाहिए।",
      }, lang),
    }),
  },

  triglycerides: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your triglycerides are ${value} ${unit} — above the ${high} mg/dL normal limit.`,
        gu: `તમારા triglycerides ${value} ${unit} છે — ${high} mg/dL normal limit ઉપર.`,
        hi: `आपके triglycerides ${value} ${unit} हैं — ${high} mg/dL की सामान्य सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Cut out sugar, sweets, and fruit juice entirely for the next 2 weeks.",
          "Reduce alcohol to zero if you drink.",
          "Replace one refined-carb meal with a protein + vegetable plate.",
        ],
        gu: [
          "આગળના 2 અઠવાડિયા sugar, mithai, અને fruit juice સંપૂર્ણ બંધ કરો.",
          "Alcohol બિલકુલ ઘટાડો.",
          "એક refined carb ભોજન protein + vegetable plate સાથે બdalo.",
        ],
        hi: [
          "अगले 2 हफ़्ते चीनी, मिठाई, और fruit juice पूरी तरह बंद करें।",
          "शराब बिल्कुल न पिएं।",
          "एक refined carb भोजन को protein + सब्ज़ी की थाली से बदलें।",
        ],
      }, lang),
      checkIns: [
        { id: "no_sugar",     label: s({ en: "Avoided sugar, sweets, and juice today",     gu: "आजE sugar, mithai, juice ટALyA",         hi: "आज चीनी, मिठाई, juice से बचे"         }, lang), icon: "🚫🍭" },
        { id: "no_alcohol",   label: s({ en: "Did not drink alcohol today",                gu: "आjE alcohol ন pIDhuM",                    hi: "आज शराब नहीं पी"                        }, lang), icon: "🚭" },
        { id: "protein_meal", label: s({ en: "Had a protein + vegetable meal today",       gu: "आjE protein + vegetable ভোjaN KhADhuM",  hi: "आज protein + सब्ज़ी का खाना खाया"      }, lang), icon: "🥗" },
      ],
      linkedTrackers: ["weight", "bloodSugar", "walking"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether your fat-in-blood level is a concern for your heart or other organs.",
        gu: "પૂछo blood fat level heart અথvA bIjA organs mATe chIntAjanak che?",
        hi: "पूछें कि खून में fat का स्तर दिल या अन्य अंगों के लिए चिंताजनक है क्या।",
      }, lang),
    }),
  },

  tsh: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your TSH is ${value} ${unit} — above the ${high} upper limit of the reference range.`,
        gu: `તમારો TSH ${value} ${unit} છે — ${high} reference range ની ઉપલી સીમા કરતાં વધારે.`,
        hi: `आपका TSH ${value} ${unit} है — ${high} की reference range की ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Take any prescribed thyroid medication at the same time each morning on an empty stomach.",
          "Avoid large amounts of soy or raw cruciferous vegetables.",
          "Note any new symptoms: fatigue, cold intolerance, hair fall.",
        ],
        gu: [
          "Prescribed thyroid medicine દરરોજ સવારે એક જ સમયે ખાલી પેટે લો.",
          "Soy અને કાચી cruciferous શાકભાજી (cauliflower, broccoli) ટાળો.",
          "નવા લક્ષણો નોંધો: થાક, ઠંડી સહન ન થાય, વાળ ઝડવા.",
        ],
        hi: [
          "prescribed thyroid medicine रोज़ सुबह एक ही समय खाली पेट लें।",
          "बड़ी मात्रा में soy या कच्ची cruciferous सब्ज़ियां (फूलगोभी, broccoli) से बचें।",
          "नए लक्षण नोट करें: थकान, ठंड बर्दाश्त न होना, बालों का झड़ना।",
        ],
      }, lang),
      checkIns: [
        { id: "thyroid_med",  label: s({ en: "Took thyroid medication on time this morning", gu: "આજે સવારે thyroid medicine સમય પર લીધી",  hi: "आज सुबह thyroid medicine समय पर ली"  }, lang), icon: "💊", linkedTracker: "medication" },
        { id: "no_soy",       label: s({ en: "Avoided large amounts of soy today",           gu: "આજે વધારે soy ટાળ્યું",            hi: "आज ज़्यादा soy से बचे"               }, lang), icon: "🚫" },
        { id: "symptom_log",  label: s({ en: "Noted any fatigue or new symptoms today",      gu: "AjE thAk yA nAvatA lakSHanO nOndyA",           hi: "आज थकान या नए लक्षण नोट किए"        }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["medication", "symptoms", "weight"],
      retestDays: 49,
      retest: s(RETEST["6_8w"], lang),
      bringToDoctor: s({
        en: "Ask whether you need a thyroid medicine and when to get your thyroid retested.",
        gu: "pUCHo thyroid medicine ની જરૂર છે? ફરી test ક્યારે કરાવવો?",
        hi: "पूछें कि thyroid की दवाई ज़रूरी है और दोबारा test कब करवाएं।",
      }, lang),
    }),
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your TSH is ${value} ${unit} — below the ${low} lower limit of the reference range.`,
        gu: `તમારો TSH ${value} ${unit} છે — ${low} reference range ની નીચલી સીમા કરતાં ઓછો.`,
        hi: `आपका TSH ${value} ${unit} है — ${low} की reference range की निचली सीमा से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Avoid iodine-heavy foods like seaweed or excess iodised salt.",
          "Reduce caffeine and monitor your heart rate.",
          "Rest and avoid strenuous exercise until reviewed.",
        ],
        gu: [
          "Seaweed જેવા iodine વાળા ખોરાક ટાળો.",
          "Caffeine ઘટાડો અને heartbeat પર ધ્યાન રાખો.",
          "Review ના ત્યાં સુધી આરામ કરો અને ભારી કસરત ટાળો.",
        ],
        hi: [
          "seaweed जैसे iodine युक्त खाद्य पदार्थों से बचें।",
          "caffeine कम करें और दिल की धड़कन पर ध्यान दें।",
          "review होने तक आराम करें और कठिन exercise न करें।",
        ],
      }, lang),
      checkIns: [
        { id: "no_iodine",   label: s({ en: "Avoided seaweed and excess iodised salt",    gu: "આjE seaweed ane vaDhArE iodine wALuM mIThuM aTALyuM", hi: "आज seaweed और ज़्यादा iodine नमक से बचे" }, lang), icon: "🚫" },
        { id: "no_caffeine", label: s({ en: "Reduced caffeine intake today",               gu: "આજે caffeine ઓછી લીધી",                             hi: "आज caffeine कम ली"                       }, lang), icon: "🚫☕" },
        { id: "heart_log",   label: s({ en: "Noted heart rate or palpitation symptoms",   gu: "આjE heartbeat yA palpitation nOndyuM",                  hi: "आज दिल की धड़कन या palpitation नोट किए"  }, lang), icon: "🫀", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms", "medication"],
      retestDays: 35,
      retest: s(RETEST["4_6w"], lang),
      bringToDoctor: s({
        en: "Ask why your thyroid is overactive and what your treatment options are.",
        gu: "pUCHo thyroid overactive કેમ છે અને treatment ના વિકલ્પ કયા છે?",
        hi: "पूछें कि thyroid overactive क्यों है और treatment के क्या विकल्प हैं।",
      }, lang),
    }),
  },

  creatinine: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your creatinine is ${value} ${unit} — above the ${high} normal limit, which relates to kidney function.`,
        gu: `તમારો creatinine ${value} ${unit} છે — ${high} normal limit ઉપર, kidney સાથે સંબંધિત.`,
        hi: `आपका creatinine ${value} ${unit} है — ${high} की सामान्य सीमा से अधिक, जो किडनी से जुड़ा है।`,
      }, lang),
      thisWeek: s({
        en: [
          "Drink 2.5–3 litres of water daily unless told otherwise by your doctor.",
          "Avoid NSAIDs like ibuprofen without medical advice.",
          "Reduce heavy protein (red meat, protein powder) to light amounts.",
        ],
        gu: [
          "ડૉક્ટર ની સૂચના વિના દરરોજ 2.5–3 litre પાણી પીઓ.",
          "ડૉક્ટર ની સલાહ વિના ibuprofen જેવી NSAID દવા ટાળો.",
          "Red meat ane protein powder જેવો ભારો protein ઓછો કરો.",
        ],
        hi: [
          "डॉक्टर की सलाह के बिना रोज़ 2.5–3 लीटर पानी पिएं।",
          "बिना सलाह के ibuprofen जैसी NSAID दवाएं न लें।",
          "red meat और protein powder जैसा भारी protein कम करें।",
        ],
      }, lang),
      checkIns: [
        { id: "water",       label: s({ en: "Drank 2.5+ litres of water today",       gu: "આjE 2.5+ litre pANI pIDhuM",          hi: "आज 2.5+ लीटर पानी पिया"        }, lang), icon: "💧" },
        { id: "no_nsaids",   label: s({ en: "Avoided ibuprofen and NSAIDs today",     gu: "આjE ibuprofen / NSAID aTALI",         hi: "आज ibuprofen/NSAID से बचे"      }, lang), icon: "🚫💊" },
        { id: "low_protein", label: s({ en: "Kept protein intake light today",        gu: "આjE prOTIn ochuM rAkhyuM",            hi: "आज protein intake कम रखा"       }, lang), icon: "🥗" },
      ],
      linkedTrackers: ["symptoms", "weight"],
      retestDays: 21,
      retest: s(RETEST["2_4w"], lang),
      bringToDoctor: s({
        en: "Ask your doctor to review your kidney health fully and what steps to take from here.",
        gu: "ડૉક્ટરને kidney health ની સંપૂર્ણ સમીક્ષા કરવા અને આગળ શું કરવું તે પૂછો.",
        hi: "डॉक्टर से kidney की पूरी समीक्षा करवाएं और पूछें कि आगे क्या कदम उठाने चाहिए।",
      }, lang),
    }),
  },

  uric_acid: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your uric acid is ${value} ${unit} — above the ${high} normal limit.`,
        gu: `તમારો uric acid ${value} ${unit} છે — ${high} normal limit ઉપર.`,
        hi: `आपका uric acid ${value} ${unit} है — ${high} की सामान्य सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Drink 3 litres of water daily — this is the single most important action.",
          "Cut out red meat, organ meats, and shellfish this week.",
          "Avoid alcohol, especially beer.",
        ],
        gu: [
          "દરરોજ 3 litre પાણી પીઓ — આ સૌથી મહત્ત્વનો સુધારો છે.",
          "આ અઠવાડિ red meat, organs અne shellfish બંધ કરો.",
          "Alcohol બિલકુલ ટાળો, ખાસ કરીને beer.",
        ],
        hi: [
          "रोज़ 3 लीटर पानी पिएं — यह सबसे ज़रूरी कदम है।",
          "इस हफ़्ते red meat, organ meats, और shellfish बंद करें।",
          "शराब से बचें, खासकर बीयर से।",
        ],
      }, lang),
      checkIns: [
        { id: "water",       label: s({ en: "Drank 3 litres of water today",              gu: "આjE 3 litre pANI pIDhuM",             hi: "आज 3 लीटर पानी पिया"              }, lang), icon: "💧" },
        { id: "no_red_meat", label: s({ en: "Avoided red meat and organ meats today",     gu: "આjE red meat ane organs aTALyA",      hi: "आज red meat और organ meats से बचे"}, lang), icon: "🥗" },
        { id: "no_alcohol",  label: s({ en: "Did not drink alcohol today",                gu: "આjE alcohol nA pIDhuM",               hi: "आज शराब नहीं पी"                  }, lang), icon: "🚭" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether your uric acid needs medicine or if changing your food is enough.",
        gu: "ડૉક્ટrne પૂrChO — uric acid mATe davA ke KhOrAk badalAthI?",
        hi: "पूछें कि uric acid के लिए दवाई ज़रूरी है या खाने में बदलाव से काम चलेगा।",
      }, lang),
    }),
  },

  sgpt_alt: {
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your liver enzyme (SGPT/ALT) is ${value} ${unit} — above the ${high} normal limit.`,
        gu: `તમારો liver enzyme (SGPT/ALT) ${value} ${unit} છે — ${high} normal limit ઉપર.`,
        hi: `आपका liver enzyme (SGPT/ALT) ${value} ${unit} है — ${high} की सामान्य सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop alcohol completely — even small amounts stress the liver.",
          "Avoid paracetamol and over-the-counter medicines without checking first.",
          "Eat light: dal, vegetables, curd — avoid oily or fried food.",
        ],
        gu: [
          "Alcohol સંpUrN baMdh karo — thoDuM paN liver ne nuksAn kare.",
          "ડૉk tOrne sAlAh vinA paracetamol ane OTC davA aTALO.",
          "હल्कुं ખAo: dAl, ShAkbhAji, dahi — tElI yA talEluM nahi.",
        ],
        hi: [
          "शराब पूरी तरह बंद करें — थोड़ी सी भी liver पर दबाव डालती है।",
          "बिना जांचे paracetamol और OTC दवाएं न लें।",
          "हल्का खाएं: दाल, सब्ज़ियां, दही — तेलयुक्त या तला हुआ खाना नहीं।",
        ],
      }, lang),
      checkIns: [
        { id: "no_alcohol", label: s({ en: "Did not drink alcohol today",                       gu: "આjE alcohol nA pIDhuM",                    hi: "आज शराब नहीं पी"                       }, lang), icon: "🚭" },
        { id: "no_otc",     label: s({ en: "Checked with a pharmacist before any OTC med",      gu: "OTC dAvA lEtA pahElA pharmacist ne pUCHyuM", hi: "कोई OTC दवा लेने से पहले pharmacist से पूछा"}, lang), icon: "💊" },
        { id: "light_food", label: s({ en: "Ate light food (dal, veg, curd) today",             gu: "AjE halkuM KhANuM KhADhuM (dAl, ShAk, dahi)", hi: "आज हल्का खाना खाया (दाल, सब्ज़ी, दही)" }, lang), icon: "🥣" },
      ],
      linkedTrackers: ["symptoms", "weight"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask why your liver reading is high — it may be diet, medicine, or something that needs a check-up.",
        gu: "pUCHo liver reading kyAm vaDhI છે — KhOrAk, davA ke bIjuM kAI?",
        hi: "पूछें कि liver reading ज़्यादा क्यों है — खाना, दवाई, या कोई और कारण?",
      }, lang),
    }),
  },

  bmi: {
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your BMI is ${value} ${unit} — in the overweight range for South Asian guidelines.`,
        gu: `તમારો BMI ${value} ${unit} છે — South Asian guidelines અનુસાર overweight range માં.`,
        hi: `आपका BMI ${value} ${unit} है — South Asian guidelines के अनुसार overweight range में।`,
      }, lang),
      thisWeek: s({
        en: [
          "Replace one meal with a vegetable-heavy, lower-carb option.",
          "Walk for 30 minutes at a pace where you can hold a conversation.",
          "Write down what you eat for 3 days — awareness is step one.",
        ],
        gu: [
          "Ek bhOjaN ShAkbhAji vAlA, ochuM carb nA vipak sAthe badAlo.",
          "30 minute chAlo jyAM vAt karI Shako tEvI gatIe.",
          "3 divas shuM KhAo che te lakhO — jAnkArI pahElo kadam chhe.",
        ],
        hi: [
          "एक भोजन को सब्ज़ी-भरपूर, कम carb विकल्प से बदलें।",
          "30 मिनट उस गति से चलें जिसमें बातचीत हो सके।",
          "3 दिन क्या खाते हैं वो लिखें — जागरूकता पहला कदम है।",
        ],
      }, lang),
      checkIns: [
        { id: "light_meal", label: s({ en: "Had a vegetable-heavy, lower-carb meal today", gu: "AjE ShAkbhAji vALuM, ochuM carb nUM bhOjaN KhADhuM", hi: "आज सब्ज़ी-भरपूर, कम carb का खाना खाया" }, lang), icon: "🥗" },
        { id: "walk",       label: s({ en: "Walked 30 min at a comfortable pace today",    gu: "AjE ArAmathI 30 min chAlyA",                          hi: "आज आराम की गति से 30 मिनट चले"           }, lang), icon: "🚶", linkedTracker: "weight" },
        { id: "food_log",   label: s({ en: "Wrote down / noted what you ate today",        gu: "AjE shuM KhADhuM te lakhyuM",                         hi: "आज क्या खाया वो नोट किया"                 }, lang), icon: "📝" },
      ],
      linkedTrackers: ["weight", "bloodSugar", "walking"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask how your weight affects your heart and sugar risk — not just the BMI number.",
        gu: "ડkTOrne pUCHo vajan heart ane sugar risk ne kEvI asAr kare.",
        hi: "पूछें कि वज़न दिल और sugar के खतरे को कैसे प्रभावित करता है — सिर्फ BMI नंबर नहीं।",
      }, lang),
    }),
  },

  wbc: {
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your white blood cell count is ${value} ${unit} — elevated above normal.`,
        gu: `તમારો white blood cell count ${value} ${unit} છે — normal કરતાં વધારે.`,
        hi: `आपकी white blood cell count ${value} ${unit} है — सामान्य से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Rest and monitor for signs of infection: fever, sore throat, pain.",
          "Avoid crowded places and wash hands frequently.",
          "Stay well hydrated.",
        ],
        gu: [
          "ArAm karo ane infection nA lakSHanO juo: tAv, gAlAmAM dard.",
          "bhIDvALA sthAnO aTALO ane vAraM vAr hAth dho.",
          "sarAs rIte hAiDrETED raho.",
        ],
        hi: [
          "आराम करें और infection के संकेत देखें: बुखार, गले में दर्द।",
          "भीड़भाड़ वाली जगहों से बचें और बार-बार हाथ धोएं।",
          "अच्छी तरह hydrated रहें।",
        ],
      }, lang),
      checkIns: [
        { id: "no_fever",   label: s({ en: "No fever or infection symptoms today",     gu: "AjE tAv yA infection nA lakSHanO nahi", hi: "आज बुखार या infection के लक्षण नहीं" }, lang), icon: "🌡️", linkedTracker: "symptoms" },
        { id: "hand_wash",  label: s({ en: "Washed hands frequently today",            gu: "AjE vAraM vAr hAth DhoyA",             hi: "आज बार-बार हाथ धोए"                  }, lang), icon: "🧼" },
        { id: "water",      label: s({ en: "Stayed well hydrated today",               gu: "AjE pUrtu pANI pIDhuM",                hi: "आज पर्याप्त पानी पिया"                }, lang), icon: "💧" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["2_4w"], lang),
      bringToDoctor: s({
        en: "Ask your doctor why your infection-fighting cells are high — it is usually minor but worth checking.",
        gu: "pUCHo infection sAme laDatA cells kyAm vaDhyA છે — sAmAnya rIte nAnuM, pan tapAsavuM sAruM.",
        hi: "डॉक्टर से पूछें कि infection-fighting cells ज़्यादा क्यों हैं — अक्सर छोटी बात है लेकिन जांच ज़रूरी।",
      }, lang),
    }),
    low: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your white blood cell count is ${value} ${unit} — lower than the normal range.`,
        gu: `તમારો white blood cell count ${value} ${unit} છે — normal range કરતાં ઓછો.`,
        hi: `आपकी white blood cell count ${value} ${unit} है — सामान्य range से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Avoid crowded places and wash hands often to reduce infection risk.",
          "Eat well — include protein, iron-rich foods, and vitamins.",
          "Note any unusual fatigue, bruising, or infections.",
        ],
        gu: [
          "bhIDvALA sthAnO aTALO ane vAraM vAr hAth Dho.",
          "sarAs KhAo — prOTIn, iron vALA KhOrAk ane vitamins lO.",
          "asAmAnya thAk, nIL, yA infection nOndho.",
        ],
        hi: [
          "भीड़ से बचें और बार-बार हाथ धोएं।",
          "अच्छा खाएं — protein, iron युक्त खाना और vitamins शामिल करें।",
          "असामान्य थकान, नील, या infection नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "avoid_crowds",label: s({ en: "Avoided crowded spaces today",               gu: "AjE bhIDvALA sthAnO aTALyA",            hi: "आज भीड़ से बचे"                     }, lang), icon: "🏠" },
        { id: "nutritious",  label: s({ en: "Had a nutritious meal with protein today",   gu: "AjE prOTIn vALuM poSHTik KhANuM KhADhuM",hi: "आज protein युक्त पौष्टिक खाना खाया"}, lang), icon: "🥗" },
        { id: "symptom_log", label: s({ en: "Noted any unusual fatigue or bruising",      gu: "AjE asAmAnya thAk yA nIL nOndyuM",      hi: "आज असामान्य थकान या नील नोट किया"  }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["2w"], lang),
      bringToDoctor: s({
        en: "Ask why your white blood cells are low — it could be a vitamin gap or a medicine side effect.",
        gu: "pUCHo white blood cells kyAm ochA છે — vitamin nI kami yA davA nI asAr હોઈ શકે.",
        hi: "पूछें कि white blood cells कम क्यों हैं — vitamin की कमी या दवाई का side effect हो सकता है।",
      }, lang),
    }),
  },

  platelets: {
    low: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your platelet count is ${value} ${unit} — below the normal range.`,
        gu: `તમારો platelet count ${value} ${unit} છે — normal range કરતાં ઓછો.`,
        hi: `आपकी platelet count ${value} ${unit} है — सामान्य range से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Avoid aspirin, ibuprofen, and blood thinners unless prescribed.",
          "Be careful to avoid cuts or bruising.",
          "Report any unusual bleeding or bruising immediately.",
        ],
        gu: [
          "Aspirin, ibuprofen ane blood thinners prescription vinA aTALO.",
          "kApA yA nIL aTALvA kAlji rAkho.",
          "koi asAmAnya lohI yA nIL tatkaL doctor ne jaNAvo.",
        ],
        hi: [
          "prescription के बिना aspirin, ibuprofen और blood thinners न लें।",
          "कट या नील से बचने की कोशिश करें।",
          "कोई असामान्य खून या नील तुरंत डॉक्टर को बताएं।",
        ],
      }, lang),
      checkIns: [
        { id: "no_thinners", label: s({ en: "Avoided aspirin and ibuprofen today",       gu: "AjE aspirin ane ibuprofen aTALI",     hi: "आज aspirin और ibuprofen से बचे"   }, lang), icon: "🚫💊" },
        { id: "safe",        label: s({ en: "No cuts, bruising, or bleeding today",       gu: "AjE kApA, nIL yA lohI nahi",          hi: "आज कट, नील या खून नहीं"           }, lang), icon: "🩹", linkedTracker: "symptoms" },
        { id: "hydrated",    label: s({ en: "Stayed hydrated today",                      gu: "AjE hAiDrETED rahyA",                 hi: "आज hydrated रहे"                  }, lang), icon: "💧" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 10,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask whether your platelet count needs a repeat test and what might be causing it.",
        gu: "pUCHo platelet count mATe pheri test joIe ane shu kAran હોઈ શકે.",
        hi: "पूछें कि platelet count के लिए दोबारा test ज़रूरी है और कारण क्या हो सकता है।",
      }, lang),
    }),
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your platelet count is ${value} ${unit} — elevated above normal.`,
        gu: `તમારો platelet count ${value} ${unit} છે — normal કરતાં વધારે.`,
        hi: `आपकी platelet count ${value} ${unit} है — सामान्य से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stay well hydrated.",
          "Avoid smoking — it can raise platelet count.",
          "Note any pain, swelling, or headaches.",
        ],
        gu: [
          "sarAs hAiDrETED raho.",
          "Smoking aTALO — platelet count vaDhArI hKe.",
          "koi dard, soJo, yA mAThAnO dard nOndho.",
        ],
        hi: [
          "अच्छी तरह hydrated रहें।",
          "धूम्रपान से बचें — इससे platelet count बढ़ सकती है।",
          "कोई दर्द, सूजन, या सिरदर्द नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "water",       label: s({ en: "Drank 2.5+ litres of water today",       gu: "આjE 2.5+ litre pANI pIDhuM",           hi: "आज 2.5+ लीटर पानी पिया"           }, lang), icon: "💧" },
        { id: "no_smoke",    label: s({ en: "Did not smoke today",                    gu: "AjE smoking nA karI",                  hi: "आज धूम्रपान नहीं किया"             }, lang), icon: "🚭" },
        { id: "symptom_log", label: s({ en: "Noted any pain, swelling, or headaches", gu: "AjE dard, soJo yA mAThAnO dard nOndyuM",hi: "आज दर्द, सूजन या सिरदर्द नोट किया"}, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask whether your high platelet count is linked to inflammation or needs further tests.",
        gu: "pUCHo vaDhArI platelet count inflammation sAthe joDAyElI?",
        hi: "पूछें कि ज़्यादा platelet count inflammation से जुड़ी है या और tests ज़रूरी हैं।",
      }, lang),
    }),
  },

  estimated_average_glucose: makeReviewPlaybook({
    label: "estimated average glucose",
    area: "sugar",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["bloodSugar", "symptoms", "walking"],
    highQuestion: "Ask how this estimated average glucose relates to your HbA1c and personal glucose target.",
    lowQuestion: "Ask whether this estimated average glucose fits your home readings or suggests possible low-glucose episodes.",
  }),

  crp_quantitative: makeReviewPlaybook({
    label: "CRP",
    area: "inflammation",
    retestKey: "2_4w",
    retestDays: 21,
    highQuestion: "Ask whether recent infection, inflammation, injury, or a chronic condition could explain the CRP result.",
    lowQuestion: "Ask whether the CRP result needs any follow-up in the context of your symptoms.",
  }),

  serum_ige: makeReviewPlaybook({
    label: "serum IgE",
    area: "allergy",
    retestKey: "6_8w",
    retestDays: 56,
    highQuestion: "Ask whether your symptoms support allergy testing or whether IgE should simply be interpreted with clinical history.",
    lowQuestion: "Ask whether this IgE result has any meaning for your current symptoms or allergies.",
  }),

  rbs: makeReviewPlaybook({
    label: "random blood sugar",
    area: "sugar",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["bloodSugar", "symptoms", "walking"],
    highQuestion: "Ask whether this random sugar needs confirmation with fasting glucose, post-meal glucose, or HbA1c.",
    lowQuestion: "Ask whether this low random sugar could relate to meal timing, symptoms, or current diabetes medicines.",
  }),

  rbc_count: makeReviewPlaybook({
    label: "RBC count",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether hydration, smoking, altitude, breathing conditions, or another cause could explain the RBC count.",
    lowQuestion: "Ask whether the RBC count should be reviewed with haemoglobin, iron, vitamin B12, folate, and symptoms.",
  }),

  pcv: makeReviewPlaybook({
    label: "PCV",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether hydration or the broader blood-count pattern could explain the high PCV.",
    lowQuestion: "Ask whether the low PCV needs iron, vitamin B12, folate, bleeding, or inflammation review.",
  }),

  mcv: makeReviewPlaybook({
    label: "MCV",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether vitamin B12, folate, thyroid, liver, alcohol, or medicine context should be reviewed with the high MCV.",
    lowQuestion: "Ask whether iron studies or a haemoglobin-trait assessment may help explain the low MCV.",
  }),

  mch: makeReviewPlaybook({
    label: "MCH",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether the high MCH should be interpreted with MCV, vitamin B12, folate, thyroid, and liver results.",
    lowQuestion: "Ask whether iron studies or the complete red-cell pattern should be reviewed for the low MCH.",
  }),

  mchc: makeReviewPlaybook({
    label: "MCHC",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether this MCHC result needs confirmation on a repeat CBC or blood-film review.",
    lowQuestion: "Ask whether iron status, bleeding history, or the wider CBC pattern could explain the low MCHC.",
  }),

  rdw: makeReviewPlaybook({
    label: "RDW",
    area: "red_cells",
    retestKey: "4_6w",
    retestDays: 42,
    highQuestion: "Ask whether mixed iron, vitamin B12, folate, recovery, or inflammation patterns could explain the RDW.",
    lowQuestion: "Ask whether the RDW result needs any follow-up when the rest of the CBC is considered.",
  }),

  esr: makeReviewPlaybook({
    label: "ESR",
    area: "inflammation",
    retestKey: "2_4w",
    retestDays: 21,
    highQuestion: "Ask whether infection, inflammation, anaemia, age, or another condition could explain the ESR.",
    lowQuestion: "Ask whether this ESR result has any significance for your current symptoms.",
  }),

  weight: makeReviewPlaybook({
    label: "weight",
    area: "weight",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["weight", "walking", "symptoms"],
    highQuestion: "Ask what a realistic weight goal should be in the context of your waist, sugar, blood pressure, mobility, and medicines.",
    lowQuestion: "Ask whether recent weight loss is expected or needs review with appetite, digestion, thyroid, sugar, and other symptoms.",
  }),

  t3: makeReviewPlaybook({
    label: "T3",
    area: "thyroid",
    retestKey: "6_8w",
    retestDays: 56,
    linkedTrackers: ["medication", "symptoms", "weight"],
    highQuestion: "Ask how the T3 result fits with TSH, T4, symptoms, and any thyroid medicine.",
    lowQuestion: "Ask how the T3 result fits with TSH, T4, recent illness, symptoms, and any thyroid medicine.",
  }),

  t4: makeReviewPlaybook({
    label: "T4",
    area: "thyroid",
    retestKey: "6_8w",
    retestDays: 56,
    linkedTrackers: ["medication", "symptoms", "weight"],
    highQuestion: "Ask how the T4 result fits with TSH, symptoms, pregnancy status if relevant, and thyroid medicine timing.",
    lowQuestion: "Ask how the T4 result fits with TSH, symptoms, recent illness, and thyroid medicine timing.",
  }),

  urea: makeReviewPlaybook({
    label: "urea",
    area: "kidney",
    retestKey: "2_4w",
    retestDays: 21,
    highQuestion: "Ask whether hydration, recent illness, diet, medicines, or kidney function could explain the high urea.",
    lowQuestion: "Ask whether nutrition, hydration, liver context, or another factor could explain the low urea.",
  }),

  bilirubin_total: makeReviewPlaybook({
    label: "total bilirubin",
    area: "liver",
    retestKey: "2_4w",
    retestDays: 21,
    highQuestion: "Ask whether the bilirubin pattern needs review with liver enzymes, blood count, medicines, and any jaundice symptoms.",
    lowQuestion: "Ask whether the low bilirubin has any clinical significance in the context of the rest of the report.",
  }),

  sgot_ast: makeReviewPlaybook({
    label: "SGOT / AST",
    area: "liver",
    retestKey: "4w",
    retestDays: 28,
    highQuestion: "Ask whether liver, muscle, alcohol, exercise, infection, or medicine context could explain the SGOT / AST result.",
    lowQuestion: "Ask whether the low SGOT / AST needs any follow-up with the rest of the liver panel.",
  }),

  urine_protein: makeReviewPlaybook({
    label: "urine protein",
    area: "urine",
    retestKey: "1_2w",
    retestDays: 14,
    linkedTrackers: ["bloodPressure", "bloodSugar", "symptoms"],
    highQuestion: "Ask whether urine protein should be confirmed with a clean repeat sample or a urine albumin-to-creatinine ratio.",
  }),

  urine_glucose: makeReviewPlaybook({
    label: "urine glucose",
    area: "urine",
    retestKey: "1_2w",
    retestDays: 14,
    linkedTrackers: ["bloodSugar", "symptoms"],
    highQuestion: "Ask whether urine glucose should be reviewed with blood glucose, HbA1c, symptoms, and current medicines.",
  }),

  urine_ketones: makeReviewPlaybook({
    label: "urine ketones",
    area: "urine",
    retestKey: "1_2w",
    retestDays: 7,
    linkedTrackers: ["bloodSugar", "symptoms"],
    highQuestion: "Ask how urine ketones should be interpreted with blood sugar, food intake, vomiting, illness, pregnancy, or diabetes medicines.",
  }),

  urine_bilirubin: makeReviewPlaybook({
    label: "urine bilirubin",
    area: "urine",
    retestKey: "1_2w",
    retestDays: 14,
    linkedTrackers: ["symptoms"],
    highQuestion: "Ask whether urine bilirubin needs confirmation with liver tests and symptoms such as jaundice or dark urine.",
  }),

  urine_blood: makeReviewPlaybook({
    label: "urine blood",
    area: "urine",
    retestKey: "1_2w",
    retestDays: 14,
    linkedTrackers: ["symptoms"],
    highQuestion: "Ask whether urine blood should be repeated outside menstruation if relevant and reviewed for infection, stones, exercise, or another cause.",
  }),

  // ── INDIAN-MARKET EXPANDED PLAYBOOKS ─────────────────────────────────────

  vitamin_d: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your Vitamin D is ${value} ${unit} — below the ${low} ng/mL sufficient level.`,
        gu: `તમારું Vitamin D ${value} ${unit} છે — ${low} ng/mL સ્તર કરતાં ઓછું છે.`,
        hi: `आपका Vitamin D ${value} ${unit} है — ${low} ng/mL पर्याप्त स्तर से कम है।`,
      }, lang),
      thisWeek: s({
        en: [
          "Get 20–30 minutes of direct morning sunlight (before 10 am) on arms and legs — no sunscreen during this time.",
          "Add Vitamin D rich foods: eggs (especially yolk), fortified milk, fortified soya milk, and fatty fish if non-vegetarian.",
          "Ask your doctor whether a Vitamin D supplement is appropriate — do not self-start without knowing your exact level.",
        ],
        gu: [
          "સવારે 10 વાગ્યા પહેલા 20–30 મિનિટ સીધો તડકો (હાથ-પગ ઉઘાડા) — sunscreen વગર.",
          "Vitamin D ખોરાક: ઈંડા (ખાસ કરીને જરદી), fortified દૂધ, fortified સોયા મિલ્ક ઉમેરો.",
          "Doctor ને પૂછો — supplement ઘણીવાર ચોક્કસ dose ની જરૂર છે, જાતે ન લો.",
        ],
        hi: [
          "सुबह 10 बजे से पहले 20–30 मिनट सीधी धूप लें — हाथ-पैर खुले रखें, sunscreen न लगाएं।",
          "Vitamin D से भरपूर खाना: अंडे (खासकर जर्दी), fortified दूध, सोया मिल्क शामिल करें।",
          "Doctor से पूछें — supplement की सही dose जाने बिना खुद शुरू न करें।",
        ],
      }, lang),
      checkIns: [
        { id: "sunlight",     label: s({ en: "Got morning sunlight today (20+ min)",        gu: "આજે સવારનો તડકો લીધો (20+ min)",        hi: "आज सुबह धूप ली (20+ मिनट)"          }, lang), icon: "☀️" },
        { id: "vd_food",      label: s({ en: "Included Vitamin D rich food in meal",         gu: "ભોજનમાં Vitamin D ખોરાક ઉમેર્યો",       hi: "भोजन में Vitamin D युक्त खाना लिया"  }, lang), icon: "🥚" },
        { id: "vd_note",      label: s({ en: "Noted supplement question for doctor visit",   gu: "Doctor ને supplement પૂછવા note કર્યું", hi: "Doctor के लिए supplement प्रश्न नोट किया" }, lang), icon: "📝" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask what supplement dose is right for your level and how long you should take it before re-testing.",
        gu: "પૂછો કે તમારા સ્તર માટે કઈ supplement dose યોગ્ય છે અને re-test પહેલા કેટલો સમય લેવાની?",
        hi: "पूछें कि आपके स्तर के लिए कौन सी supplement dose सही है और दोबारा test से पहले कितने समय तक लेनी है।",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your Vitamin D is ${value} ${unit} — above the ${high} ng/mL upper reference.`,
        gu: `તમારું Vitamin D ${value} ${unit} છે — ${high} ng/mL ઉપલી સીમા કરતાં વધારે.`,
        hi: `आपका Vitamin D ${value} ${unit} है — ${high} ng/mL ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop any Vitamin D supplement you are currently taking and bring the label to your next visit.",
          "Reduce fortified foods if you are consuming very large amounts daily.",
          "Note any symptoms: nausea, excessive thirst, frequent urination, or muscle weakness.",
        ],
        gu: [
          "Vitamin D supplement તરત બંધ કરો અને label ડૉક્ટર ને બતાવો.",
          "Fortified ખોરાક ઓછા કરો જો ખૂબ વધારે લો છો.",
          "ઉલ્ટી, વધારે તરસ, વારંવાર urination, સ્નાયુ નબળાઈ note કરો.",
        ],
        hi: [
          "Vitamin D supplement तुरंत बंद करें और label doctor को दिखाएं।",
          "Fortified खाद्य पदार्थ कम करें यदि बहुत अधिक ले रहे हैं।",
          "मतली, अत्यधिक प्यास, बार-बार पेशाब, या मांसपेशियों की कमज़ोरी नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "stopped_supp", label: s({ en: "Stopped Vitamin D supplement today",   gu: "આજે Vitamin D supplement બંધ કર્યું", hi: "आज Vitamin D supplement बंद किया"  }, lang), icon: "🛑" },
        { id: "label_ready",  label: s({ en: "Supplement label noted for doctor",     gu: "Doctor ને label note કર્યો",           hi: "Doctor के लिए label नोट किया"       }, lang), icon: "📋" },
        { id: "symptom_log",  label: s({ en: "Noted any nausea or unusual symptoms",  gu: "ઉલ્ટી કે અસામાન્ય symptoms note કર્યા", hi: "मतली या असामान्य symptoms नोट किए" }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Bring your supplement label and ask whether the level needs to come down before you feel symptoms.",
        gu: "Supplement label લઈ જાઓ અને પૂછો — સ્તર ઘટાડવું જરૂરી છે?",
        hi: "Supplement label लेकर जाएं और पूछें — क्या लक्षण आने से पहले level कम करना ज़रूरी है?",
      }, lang),
    }),
  },

  vitamin_b12: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your Vitamin B12 is ${value} ${unit} — below the ${low} pg/mL reference, which is common in vegetarians.`,
        gu: `તમારું Vitamin B12 ${value} ${unit} છે — ${low} pg/mL reference કરતાં ઓછું. Vegetarian લોકોમાં આ ખૂબ સામાન્ય છે.`,
        hi: `आपका Vitamin B12 ${value} ${unit} है — ${low} pg/mL reference से कम। शाकाहारियों में यह बहुत आम है।`,
      }, lang),
      thisWeek: s({
        en: [
          "Add dairy daily: a glass of milk, curd (dahi), or paneer — these are the main B12 source for vegetarians.",
          "If non-vegetarian, include eggs, chicken, or fish 3–4 times this week.",
          "Ask your doctor about a B12 supplement or injection — deficiency often needs direct supplementation, not diet alone.",
        ],
        gu: [
          "રોજ dairy ઉમેરો: એક ગ્લાસ દૂધ, દહીં, અથવા paneer — vegetarian માટે B12 નો મુખ્ય સ્ત્રોત.",
          "Non-vegetarian હો તો આ અઠવાડિયે 3–4 વાર ઈંડા, chicken, અથવા માછલી લો.",
          "Doctor ને B12 supplement અથવા injection પૂછો — ઘણીવાર diet પૂરતું નથી.",
        ],
        hi: [
          "रोज़ dairy लें: एक गिलास दूध, दही, या paneer — शाकाहारियों के लिए B12 का मुख्य स्रोत।",
          "Non-vegetarian हैं तो इस हफ़्ते 3–4 बार अंडे, चिकन, या मछली खाएं।",
          "Doctor से B12 supplement या injection के बारे में पूछें — अक्सर diet काफ़ी नहीं होता।",
        ],
      }, lang),
      checkIns: [
        { id: "dairy_daily",  label: s({ en: "Had milk, curd, or paneer today",          gu: "આજે દૂધ, દહીં, અથવા paneer લીધું",   hi: "आज दूध, दही, या paneer लिया"         }, lang), icon: "🥛" },
        { id: "b12_question", label: s({ en: "Noted B12 supplement question for doctor",  gu: "Doctor ને B12 supplement પૂછવા note", hi: "Doctor के लिए B12 supplement नोट किया" }, lang), icon: "📝" },
        { id: "fatigue_log",  label: s({ en: "Noted tiredness, tingling, or mood changes",gu: "થાક, ઝણઝણાટ, mood changes note કર્યા", hi: "थकान, झुनझुनी, mood बदलाव नोट किए"  }, lang), icon: "🔋", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask whether an injection course is needed and whether your stomach or gut absorption may be causing this deficiency.",
        gu: "પૂછો — injection course જોઈએ? અને stomach absorption ની સમસ્યા તો નથી?",
        hi: "पूछें — क्या injection course ज़रूरी है? और क्या पेट की absorption में कोई समस्या है?",
      }, lang),
    }),
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your Vitamin B12 is ${value} ${unit} — above the usual reference range.`,
        gu: `તમારું Vitamin B12 ${value} ${unit} છે — સામાન્ય reference range કરતાં વધારે.`,
        hi: `आपका Vitamin B12 ${value} ${unit} है — सामान्य reference range से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop any B12 supplement or B-complex injection you are currently taking.",
          "Note: very high B12 without supplements can sometimes need a further review — mention it to your doctor.",
          "Continue your normal diet; no need to change eating habits.",
        ],
        gu: [
          "B12 supplement અથવા B-complex injection તરત બંધ કરો.",
          "Note: supplement વગર high B12 ક્યારેક review ની જરૂર — Doctor ને જણાવો.",
          "સામાન્ય ખોરાક ચાલુ રાખો; ખાવામાં ફેરફારની જરૂર નથી.",
        ],
        hi: [
          "B12 supplement या B-complex injection तुरंत बंद करें।",
          "Note: बिना supplement के high B12 कभी-कभी review की ज़रूरत — doctor को बताएं।",
          "सामान्य खान-पान जारी रखें; खाने में बदलाव की ज़रूरत नहीं।",
        ],
      }, lang),
      checkIns: [
        { id: "stopped_b12",  label: s({ en: "Stopped B12/B-complex supplement today", gu: "B12 supplement આજે બંધ કર્યું",      hi: "आज B12 supplement बंद किया"       }, lang), icon: "🛑" },
        { id: "label_ready",  label: s({ en: "Supplement label ready for doctor",       gu: "Doctor ને label તૈયાર",              hi: "Doctor के लिए label तैयार"         }, lang), icon: "📋" },
        { id: "symptom_ok",   label: s({ en: "No new symptoms to note",                 gu: "કોઈ નવા symptoms નથી",               hi: "कोई नए symptoms नहीं"              }, lang), icon: "✓" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Bring your supplement list and ask whether this level needs investigation or just a supplement pause.",
        gu: "Supplement list લઈ જાઓ — level ઘટાડો જ જોઈએ, કે supplement pause પૂરતું?",
        hi: "Supplement list लेकर जाएं — क्या level की जांच ज़रूरी है या सिर्फ़ supplement बंद करना काफ़ी है?",
      }, lang),
    }),
  },

  ferritin: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your ferritin is ${value} ${unit} — below the ${low} ng/mL range, suggesting low iron stores.`,
        gu: `તમારું ferritin ${value} ${unit} છે — ${low} ng/mL કરતાં ઓછું, iron stores ઓછા હોઈ શકે.`,
        hi: `आपका ferritin ${value} ${unit} है — ${low} ng/mL से कम, iron stores कम हो सकते हैं।`,
      }, lang),
      thisWeek: s({
        en: [
          "Eat iron-rich foods: rajma (kidney beans), masoor dal, chana, palak (spinach), ragi, dates, and jaggery daily.",
          "Pair iron-rich foods with Vitamin C: squeeze lemon on dal/sabzi, or eat amla or guava alongside meals — this doubles absorption.",
          "Avoid tea or coffee within 1 hour of meals — tannins block iron absorption significantly.",
        ],
        gu: [
          "Iron ભરપૂર ખોરાક: રોજ rajma, masoor dal, chana, palak, ragi, ખારેક, ગોળ ખાઓ.",
          "Iron ખોરાક સાથે Vitamin C: dal/sabzi પર લીંબુ નીંચો, અથવા ભોજન સાથે amla/જામફળ — absorption બમણો થાય.",
          "ભોજનના 1 કલાક સુધી ચા/coffee ટાળો — tannins iron absorption ઘટાડે.",
        ],
        hi: [
          "Iron से भरपूर खाना: रोज़ राजमा, मसूर दाल, चना, पालक, रागी, खजूर, और गुड़ खाएं।",
          "Iron के साथ Vitamin C: दाल/सब्ज़ी पर नींबू निचोड़ें, या साथ में आंवला/अमरूद खाएं — absorption दोगुना होता है।",
          "खाने के 1 घंटे तक चाय/coffee न पिएं — tannins iron absorption रोकते हैं।",
        ],
      }, lang),
      checkIns: [
        { id: "iron_food",    label: s({ en: "Ate iron-rich dal, palak, or rajma today",    gu: "આजે dal, palak, rajma ખાધું",           hi: "आज dal, palak, राजमा खाया"          }, lang), icon: "🫘" },
        { id: "vitc_pair",    label: s({ en: "Had lemon or amla with iron-rich meal",        gu: "Iron ભોજન સાથે lemon/amla લીધું",      hi: "Iron भोजन के साथ नींबू/आंवला लिया"  }, lang), icon: "🍋" },
        { id: "no_tea_meal",  label: s({ en: "Avoided tea/coffee within 1 hour of meals",   gu: "ભોજન પછી 1 કલાક ચા/coffee ટાળી",       hi: "खाने के 1 घंटे तक चाय/coffee से बचे" }, lang), icon: "🚫" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 90,
      retest: s(RETEST["3m"], lang),
      bringToDoctor: s({
        en: "Ask whether an iron supplement or injection is needed and whether the cause (heavy periods, poor absorption, diet) should be investigated.",
        gu: "Iron supplement/injection જોઈએ? અને કારણ (ભારે periods, absorption, ખોરાક) ની તપાસ ક?",
        hi: "Iron supplement/injection ज़रूरी है? और कारण (भारी periods, absorption, diet) की जांच होनी चाहिए?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your ferritin is ${value} ${unit} — above the ${high} ng/mL upper reference.`,
        gu: `તમારું ferritin ${value} ${unit} છે — ${high} ng/mL ઉપલી સીમા કરતાં વધારે.`,
        hi: `आपका ferritin ${value} ${unit} है — ${high} ng/mL ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop any iron supplement or multivitamin with iron immediately and bring the label to your doctor.",
          "Avoid red meat more than once this week — it is high in heme iron.",
          "Note any joint pain, fatigue, or skin colour changes and bring these to your next visit.",
        ],
        gu: [
          "Iron supplement અથવા iron વાળ multivitamin તરત બંધ કરો — label ડૉક્ટર ને બતાવો.",
          "આ અઠવાડિયે red meat 1 વારથી વધારે ન ખાઓ.",
          "સાંધાનો દુઃખાવો, થાક, skin colour change note કરો.",
        ],
        hi: [
          "Iron supplement या iron युक्त multivitamin तुरंत बंद करें — label doctor को दिखाएं।",
          "इस हफ़्ते red meat एक बार से ज़्यादा न खाएं।",
          "जोड़ों का दर्द, थकान, skin रंग में बदलाव नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "stop_iron",    label: s({ en: "Stopped iron supplement today",               gu: "Iron supplement આજ બંધ કર્યો",        hi: "Iron supplement आज बंद किया"       }, lang), icon: "🛑" },
        { id: "less_redmeat", label: s({ en: "Limited red meat today",                      gu: "આજ red meat ઓછું ખાધું",              hi: "आज red meat कम खाया"               }, lang), icon: "🥩" },
        { id: "symptom_log",  label: s({ en: "Noted any joint pain or fatigue",              gu: "સાંધા-દુઃખ અથવા થાક note કર્યો",      hi: "जोड़ों का दर्द या थकान नोट किया"   }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask what is causing the raised ferritin — it can reflect inflammation or an iron storage condition that needs review.",
        gu: "Ferritin ઊંચું હોવાનું કારણ શું? — inflammation અથવા iron storage condition ની review જોઈએ.",
        hi: "Ferritin बढ़ने का कारण क्या है? — inflammation या iron storage condition की review ज़रूरी हो सकती है।",
      }, lang),
    }),
  },

  serum_iron: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your serum iron is ${value} ${unit} — below the ${low} reference, which may contribute to tiredness and low energy.`,
        gu: `તમારું serum iron ${value} ${unit} છે — ${low} reference કરતાં ઓછું. થાક અને ઓછી energy નું કારણ હોઈ શકે.`,
        hi: `आपका serum iron ${value} ${unit} है — ${low} reference से कम। थकान और कम energy का कारण हो सकता है।`,
      }, lang),
      thisWeek: s({
        en: [
          "Focus on iron-rich Indian foods: palak (spinach), methi (fenugreek) leaves, ragi, bajra roti, chana, rajma, and til (sesame).",
          "Cook in iron cookware (iron tawa or kadai) — this adds iron to food naturally.",
          "Drink a glass of nimbu pani (lemon water) with meals to help iron absorption.",
        ],
        gu: [
          "Iron ભરપૂર Indian ખોરાક: palak, methi, ragi, bajra roti, chana, rajma, til — focus કરો.",
          "Iron ના વાસણ (iron tawa/kadai) માં રાંધો — naturally iron ઉમેરાય.",
          "ભોજન સાથે nimbu pani (lemon water) પીઓ — iron absorption વધે.",
        ],
        hi: [
          "Iron युक्त Indian खाना: पालक, मेथी, रागी, बाजरा रोटी, चना, राजमा, तिल खाएं।",
          "लोहे के बर्तन (iron tawa/kadai) में पकाएं — naturally iron मिलता है।",
          "खाने के साथ नींबू पानी पिएं — iron absorption बढ़ती है।",
        ],
      }, lang),
      checkIns: [
        { id: "iron_food",    label: s({ en: "Had palak, chana, or bajra today",        gu: "આjE palak, chana, bajra ખાધું",      hi: "आज पालक, चना, या बाजरा खाया"      }, lang), icon: "🌿" },
        { id: "iron_vessel",  label: s({ en: "Cooked in iron vessel today",              gu: "Iron vessel mAM rAndyuM",            hi: "आज लोहे के बर्तन में पकाया"       }, lang), icon: "🍳" },
        { id: "nimbu_pani",   label: s({ en: "Had lemon water with a meal today",        gu: "AjE bhojan sAthe nimbu pani pIDhuM", hi: "आज खाने के साथ नींबू पानी पिया"   }, lang), icon: "🍋" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether the low iron level is due to diet, blood loss, or absorption — and if ferritin and CBC should be checked together.",
        gu: "Iron ઓછું — diet, blood loss, absorption? Ferritin અને CBC સાથે check કરવા?",
        hi: "Iron कम — diet, blood loss, absorption की वजह से? Ferritin और CBC साथ में check करने चाहिए?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your serum iron is ${value} ${unit} — above the ${high} upper reference.`,
        gu: `Serum iron ${value} ${unit} — ${high} ઉપલી સીમા કરતાં વધારે.`,
        hi: `Serum iron ${value} ${unit} — ${high} ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop any iron supplement immediately.",
          "Reduce red meat and organ meats (liver, kidney) this week.",
          "Note any joint pain, abdominal discomfort, or unusual fatigue.",
        ],
        gu: ["Iron supplement તરત બંધ.", "Red meat, organ meats (liver, kidney) ઓછા કરો.", "સાંધા-દુઃખ, પેટ-દુઃખ, અથવા થાક note કરો."],
        hi: ["Iron supplement तुरंत बंद।", "Red meat, organ meats (liver, kidney) कम करें।", "जोड़ों का दर्द, पेट दर्द, या थकान नोट करें।"],
      }, lang),
      checkIns: [
        { id: "stop_iron",   label: s({ en: "Stopped iron supplement today",        gu: "Iron supplement baMdh",      hi: "Iron supplement बंद"       }, lang), icon: "🛑" },
        { id: "less_meat",   label: s({ en: "Avoided red meat/organ meat today",    gu: "Red meat aTALyuM",          hi: "Red meat से बचे"           }, lang), icon: "🥩" },
        { id: "symptom_log", label: s({ en: "Noted any joint pain or fatigue",      gu: "Symptoms note karyA",       hi: "Symptoms नोट किए"          }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether the raised iron level points to an iron storage condition or is linked to recent supplements.",
        gu: "Iron વધારો — iron storage condition? અથવા supplement ને કારણ?",
        hi: "Iron बढ़ा — iron storage condition? या supplement की वजह से?",
      }, lang),
    }),
  },

  calcium: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your calcium is ${value} ${unit} — below the ${low} mg/dL reference level.`,
        gu: `Calcium ${value} ${unit} — ${low} mg/dL reference કરતાં ઓછું.`,
        hi: `Calcium ${value} ${unit} — ${low} mg/dL reference से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Include calcium-rich foods daily: 2 glasses of milk, curd, paneer, ragi (nachni), til ladoo, and drumstick leaves (moringa).",
          "Get 15–20 minutes of morning sunlight — Vitamin D is needed to absorb calcium.",
          "Reduce very high-fibre foods at the same meal as calcium (whole bran) — they can reduce absorption.",
        ],
        gu: [
          "Calcium ભરપૂર: 2 ગ્લાસ દૂધ, દહીં, paneer, ragi, til ladoo, drumstick leaves (moringa) રોજ ખાઓ.",
          "સવારે 15–20 min તડકો — Vitamin D વગર calcium absorb ન થાય.",
          "Calcium ભોજન સાથે ઘઉં ના bran ઓછા — absorption ઘટે.",
        ],
        hi: [
          "Calcium से भरपूर: रोज़ 2 गिलास दूध, दही, paneer, रागी, तिल के लड्डू, drumstick leaves (moringa) खाएं।",
          "सुबह 15–20 मिनट धूप लें — Vitamin D के बिना calcium absorb नहीं होता।",
          "Calcium भोजन के साथ अत्यधिक bran कम करें — absorption घटती है।",
        ],
      }, lang),
      checkIns: [
        { id: "calcium_food", label: s({ en: "Had milk, curd, or ragi today",         gu: "AjE doodh, dahi, ragi lIDhUM",       hi: "आज दूध, दही, या रागी लिया"      }, lang), icon: "🥛" },
        { id: "sunlight",     label: s({ en: "Got morning sunlight today",             gu: "AjE savAraNO tadako lIDho",          hi: "आज सुबह धूप ली"                 }, lang), icon: "☀️" },
        { id: "symptom_log",  label: s({ en: "Noted any cramps, numbness, or fatigue", gu: "Cramps, numbness, thAk note karyuM", hi: "Cramps, numbness, थकान नोट किए" }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether Vitamin D or parathyroid function should also be checked alongside the calcium.",
        gu: "Calcium સાથે Vitamin D અને parathyroid check કરવા?",
        hi: "Calcium के साथ Vitamin D और parathyroid function भी check करने चाहिए?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your calcium is ${value} ${unit} — above the ${high} mg/dL upper reference.`,
        gu: `Calcium ${value} ${unit} — ${high} ઉપ્પર reference કરતાં વધ.`,
        hi: `Calcium ${value} ${unit} — ${high} mg/dL ऊपरी सीमा से अधिक।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop calcium supplements and any high-dose Vitamin D supplement immediately.",
          "Drink plenty of water (2.5–3 litres daily) to help the kidneys manage excess calcium.",
          "Note any excessive thirst, frequent urination, constipation, confusion, or bone/muscle pain.",
        ],
        gu: [
          "Calcium supplement અને high-dose Vitamin D supplement તરત બંધ.",
          "2.5–3 litre પાણી રોજ પીઓ — kidneys excess calcium manage કરે.",
          "ખૂબ તરસ, વારંવાર urination, constipation, confusion, bones/muscles દુઃખ note.",
        ],
        hi: [
          "Calcium supplement और high-dose Vitamin D supplement तुरंत बंद करें।",
          "रोज़ 2.5–3 लीटर पानी पिएं — kidneys excess calcium manage करती हैं।",
          "अत्यधिक प्यास, बार-बार पेशाब, कब्ज़, confusion, हड्डी/मांसपेशी दर्द नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "stop_supp",   label: s({ en: "Stopped calcium/Vit D supplement today",  gu: "Supplement baMdh karyuM",            hi: "Supplement बंद किया"             }, lang), icon: "🛑" },
        { id: "water",       label: s({ en: "Drank 2.5+ litres of water today",        gu: "2.5+ litre pANI pIDhuM",            hi: "2.5+ लीटर पानी पिया"            }, lang), icon: "💧" },
        { id: "symptom_log", label: s({ en: "Noted any thirst, pain, or confusion",    gu: "Symptoms note karyuM",              hi: "Symptoms नोट किए"               }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 28,
      retest: s(RETEST["4w"], lang),
      bringToDoctor: s({
        en: "Ask what is causing the raised calcium — parathyroid function, Vitamin D toxicity, or another cause should be discussed.",
        gu: "Calcium ઊંચું — parathyroid, Vitamin D toxicity, અથવા બીજું કારણ? Review જોઈએ.",
        hi: "Calcium बढ़ा — parathyroid, Vitamin D toxicity, या कोई और कारण? Review ज़रूरी।",
      }, lang),
    }),
  },

  sodium: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your sodium is ${value} ${unit} — below the ${low} mEq/L reference.`,
        gu: `Sodium ${value} ${unit} — ${low} mEq/L reference કરતાં ઓછું.`,
        hi: `Sodium ${value} ${unit} — ${low} mEq/L reference से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Do not self-treat low sodium — the cause matters more than adding salt to your food.",
          "Note symptoms: headache, nausea, confusion, fatigue, muscle cramps or weakness.",
          "Bring a list of all medicines you take — some medicines (diuretics, certain BP medicines) can lower sodium.",
        ],
        gu: [
          "Low sodium ઘરે ઠીક ન કરો — salt ઉમેરવાથી solution નથી. Cause important.",
          "Headache, nausea, confusion, cramps, weakness note કરો.",
          "Medicines list ડૉક્ટર ને બતાઓ — diuretics, BP medicines sodium ઘટાડી શકે.",
        ],
        hi: [
          "Low sodium घर पर ठीक न करें — नमक बढ़ाने से solution नहीं। Cause ज़रूरी है।",
          "सिरदर्द, मतली, confusion, cramps, कमज़ोरी नोट करें।",
          "सभी दवाओं की list doctor को दिखाएं — diuretics, BP दवाएं sodium कम कर सकती हैं।",
        ],
      }, lang),
      checkIns: [
        { id: "symptom_log", label: s({ en: "Noted any headache, nausea, or cramps",  gu: "Symptoms note karyuM",       hi: "Symptoms नोट किए"          }, lang), icon: "📝", linkedTracker: "symptoms" },
        { id: "med_list",    label: s({ en: "Medicine list ready for doctor visit",    gu: "Medicines list taiyAr",      hi: "Medicines list तैयार"      }, lang), icon: "💊" },
        { id: "water_note",  label: s({ en: "Not over-drinking plain water this week", gu: "Vahu pANI na pIDhuM",        hi: "ज़्यादा पानी नहीं पिया"    }, lang), icon: "💧" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask what is causing the low sodium and whether medicines, fluid intake, or another condition needs adjustment.",
        gu: "Low sodium નું કારণ? Medicines, fluid, અથવા condition change જોઈએ?",
        hi: "Low sodium का कारण? Medicines, fluid, या कोई condition बदलनी होगी?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your sodium is ${value} ${unit} — above the ${high} mEq/L upper reference.`,
        gu: `Sodium ${value} ${unit} — ${high} mEq/L ઉપ્પર reference.`,
        hi: `Sodium ${value} ${unit} — ${high} mEq/L ऊपरी सीमा।`,
      }, lang),
      thisWeek: s({
        en: [
          "Increase water intake to 2.5–3 litres per day unless your doctor has given you a fluid restriction.",
          "Reduce high-salt foods: papad, pickles (achar), namkeen, instant noodles, processed food, and extra salt in cooking.",
          "Note symptoms: unusual thirst, dry mouth, confusion, or decreased urine output.",
        ],
        gu: [
          "2.5–3 litre પાણી રોજ — doctor ની fluid restriction ન હોય તો.",
          "High-salt ઓછા: papad, achar, namkeen, instant noodles, processed food, cooking salt.",
          "ખૂબ તરસ, dry mouth, confusion, urine ઘટ્યો — note.",
        ],
        hi: [
          "रोज़ 2.5–3 लीटर पानी पिएं — doctor की fluid restriction न हो तो।",
          "High-salt कम करें: papad, achar, namkeen, instant noodles, processed food।",
          "बहुत प्यास, dry mouth, confusion, urine कम — नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "water",       label: s({ en: "Drank 2.5+ litres of water today",    gu: "2.5+ litre pANI",        hi: "2.5+ लीटर पानी"        }, lang), icon: "💧" },
        { id: "low_salt",    label: s({ en: "Avoided papad, achar, namkeen today", gu: "Papad, achar, namkeen aTALyuM", hi: "Papad, achar, namkeen से बचे" }, lang), icon: "🧂" },
        { id: "symptom_log", label: s({ en: "Noted any thirst or confusion",       gu: "Symptoms note karyuM",   hi: "Symptoms नोट किए"      }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask whether high sodium is related to dehydration, diet, kidney function, or a medicine and what to monitor.",
        gu: "High sodium — dehydration, diet, kidney, medicine? શું monitor?",
        hi: "High sodium — dehydration, diet, kidney, medicine? क्या monitor करें?",
      }, lang),
    }),
  },

  potassium: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your potassium is ${value} ${unit} — below the ${low} mEq/L reference.`,
        gu: `Potassium ${value} ${unit} — ${low} mEq/L reference કરતાં ઓછો.`,
        hi: `Potassium ${value} ${unit} — ${low} mEq/L reference से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Include potassium-rich Indian foods: banana (kela), coconut water (nariyal pani), potato, tomato, dal, and curd.",
          "Avoid excessive salty or processed foods — they cause potassium to be lost faster.",
          "Note any muscle weakness, cramps, irregular heartbeat feeling, or unusual fatigue.",
        ],
        gu: [
          "Potassium ભરપૂર: kela, nariyal pani, potato, tomato, dal, dahi — રોજ ઉમેરો.",
          "Salty/processed ખોરાક ઓછો — potassium ઝડપ loss.",
          "Muscle weakness, cramps, heartbeat change, thAk — note.",
        ],
        hi: [
          "Potassium से भरपूर: केला, नारियल पानी, आलू, टमाटर, दाल, दही — रोज़ शामिल करें।",
          "Salty/processed खाना कम — potassium जल्दी खोता है।",
          "मांसपेशी कमज़ोरी, cramps, heartbeat बदलाव, थकान — नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "kela_pani",   label: s({ en: "Had banana or coconut water today",       gu: "AjE kela yA nariyal pani lIDhuM",  hi: "आज केला या नारियल पानी लिया"    }, lang), icon: "🍌" },
        { id: "dal_curd",    label: s({ en: "Had dal or curd with a meal today",        gu: "AjE dal/dahi bhojanmAM lIDhuM",   hi: "आज dal/दही भोजन में लिया"       }, lang), icon: "🥣" },
        { id: "symptom_log", label: s({ en: "Noted any cramps or weakness",             gu: "Cramps, weakness note karyuM",    hi: "Cramps, कमज़ोरी नोट किए"        }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask whether potassium loss is related to medicines (diuretics), vomiting/diarrhoea, or kidney function — and if oral or IV replacement is needed.",
        gu: "Potassium loss — diuretics, vomiting/diarrhoea, kidney? Oral/IV replacement?",
        hi: "Potassium loss — diuretics, vomiting/diarrhoea, kidney? Oral/IV replacement चाहिए?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your potassium is ${value} ${unit} — above the ${high} mEq/L upper reference.`,
        gu: `Potassium ${value} ${unit} — ${high} mEq/L ઉ.`,
        hi: `Potassium ${value} ${unit} — ${high} mEq/L ऊपरी।`,
      }, lang),
      thisWeek: s({
        en: [
          "Reduce high-potassium foods this week: banana, coconut water, orange juice, potato skin, tomato puree, and dried fruits.",
          "Stop potassium supplements immediately and bring the label to your doctor.",
          "Note any chest discomfort, muscle weakness, or unusual heartbeat sensation.",
        ],
        gu: [
          "High-potassium ઓછા: kela, nariyal pani, orange juice, potato skin, tomato puree, dried fruits.",
          "Potassium supplement તરત બંધ.",
          "Chest discomfort, muscle weakness, heartbeat change note.",
        ],
        hi: [
          "High-potassium कम करें: केला, नारियल पानी, orange juice, आलू का छिलका, tomato puree।",
          "Potassium supplement तुरंत बंद।",
          "Chest discomfort, मांसपेशी कमज़ोरी, heartbeat बदलाव नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "stop_k_supp", label: s({ en: "Stopped potassium supplement today",      gu: "Potassium supplement baMdh",     hi: "Potassium supplement बंद"        }, lang), icon: "🛑" },
        { id: "low_k_food",  label: s({ en: "Avoided banana, coconut water today",     gu: "Kela, nariyal pani aTALyuM",    hi: "केला, नारियल पानी से बचे"       }, lang), icon: "🍌" },
        { id: "symptom_log", label: s({ en: "Noted any chest discomfort or weakness",  gu: "Chest/weakness note karyuM",    hi: "Chest/कमज़ोरी नोट किए"          }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask whether kidney function or a medicine is causing the raised potassium and what diet changes are safe.",
        gu: "High potassium — kidney? medicine? Safe diet changes?",
        hi: "High potassium — kidney? medicine? Safe diet changes क्या हैं?",
      }, lang),
    }),
  },

  magnesium: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your magnesium is ${value} ${unit} — below the ${low} mg/dL reference.`,
        gu: `Magnesium ${value} ${unit} — ${low} reference કરતાં ઓછો.`,
        hi: `Magnesium ${value} ${unit} — ${low} reference से कम।`,
      }, lang),
      thisWeek: s({
        en: [
          "Add magnesium-rich Indian foods: cashews (kaju), almonds (badam), pumpkin seeds, dark leafy sabzis, rajma, moong dal, and banana.",
          "Reduce tea, coffee, and alcohol — they increase magnesium excretion.",
          "Note muscle cramps, eye twitching, sleep trouble, or anxiety — common signs of low magnesium.",
        ],
        gu: [
          "Magnesium ભرپूر: kaju, badam, pumpkin seeds, green sabzis, rajma, moong dal, kela.",
          "ચા, coffee, alcohol ઓછા — magnesium loss.",
          "Muscle cramps, eye twitching, ઊંઘ ઓછી, anxiety — note.",
        ],
        hi: [
          "Magnesium से भरपूर: काजू, बादाम, pumpkin seeds, हरी सब्ज़ियां, राजमा, मूंग दाल, केला।",
          "चाय, coffee, alcohol कम — magnesium loss बढ़ता है।",
          "Muscle cramps, eye twitching, नींद न आना, anxiety — नोट करें।",
        ],
      }, lang),
      checkIns: [
        { id: "nuts_daily",  label: s({ en: "Had nuts or seeds today (kaju, badam)",   gu: "Kaju/badam/seeds AjE lIDhA",    hi: "आज काजू/बादाम/seeds लिए"      }, lang), icon: "🌰" },
        { id: "dal_meal",    label: s({ en: "Had moong or rajma at a meal today",       gu: "AjE moong/rajma lIDhI",         hi: "आज मूंग/राजमा लिया"           }, lang), icon: "🫘" },
        { id: "symptom_log", label: s({ en: "Noted any cramps or sleep trouble",        gu: "Cramps/ûngha note karyuM",     hi: "Cramps/नींद नोट किया"         }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask whether a magnesium supplement is needed and whether diabetes or a medicine is causing the low level.",
        gu: "Supplement જોઈ? Diabetes/medicine low magnesium નું કારણ?",
        hi: "Supplement ज़रूरी? Diabetes/medicine low magnesium का कारण?",
      }, lang),
    }),
    high: ({ value, unit, high }, lang) => ({
      headline: s({
        en: `Your magnesium is ${value} ${unit} — above the ${high} mg/dL upper reference.`,
        gu: `Magnesium ${value} ${unit} — ${high} ઉ. સ. `,
        hi: `Magnesium ${value} ${unit} — ${high} ऊपरी।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stop magnesium supplements and any magnesium-containing antacids immediately.",
          "Stay well hydrated — water helps the kidneys clear excess magnesium.",
          "Note nausea, low BP feeling, muscle weakness, or unusual tiredness.",
        ],
        gu: ["Magnesium supplement/antacids બંધ.", "Hydrated રહો — kidney clear.", "Nausea, low BP, muscle weakness note."],
        hi: ["Magnesium supplement/antacids बंद।", "Hydrated रहें।", "Nausea, low BP, weakness नोट।"],
      }, lang),
      checkIns: [
        { id: "stop_supp",   label: s({ en: "Stopped magnesium supplement today",    gu: "Supplement baMdh",          hi: "Supplement बंद"           }, lang), icon: "🛑" },
        { id: "water",       label: s({ en: "Drank 2.5+ litres today",               gu: "2.5+ litre pANI",           hi: "2.5+ लीटर पानी"           }, lang), icon: "💧" },
        { id: "symptom_log", label: s({ en: "Noted any nausea or weakness",          gu: "Nausea/weakness note",      hi: "Nausea/कमज़ोरी नोट"       }, lang), icon: "📝", linkedTracker: "symptoms" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 14,
      retest: s(RETEST["1_2w"], lang),
      bringToDoctor: s({
        en: "Ask what is causing the high magnesium — kidney function and supplement history should both be reviewed.",
        gu: "High magnesium — kidney? Supplement history? Review.",
        hi: "High magnesium — kidney? Supplement history? Review करें।",
      }, lang),
    }),
  },

  folate: makeReviewPlaybook({
    label: "Folate",
    area: "red_cells",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Continue balanced diet — no diet change needed for high folate.",
      "Stop high-dose folic acid supplements unless prescribed by your doctor.",
      "Bring your supplement list to the next visit.",
    ],
    lowActions: [
      "Eat folate-rich foods daily: methi (fenugreek), palak, moong sprouts, rajma, and chana.",
      "Avoid overcooking leafy vegetables — folate is destroyed by long boiling.",
      "Ask your doctor whether a folic acid supplement is needed, especially if planning pregnancy.",
    ],
    highQuestion: "Ask whether the high folate level needs any action or is simply a supplement effect.",
    lowQuestion: "Ask whether a folic acid supplement is needed and if this is related to B12 or diet.",
  }),

  albumin: makeReviewPlaybook({
    label: "Albumin",
    area: "liver",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["symptoms"],
    lowActions: [
      "Include protein at every meal: dal, curd, eggs, paneer, chana, or tofu — at least 2 portions daily.",
      "Avoid skipping meals — albumin reflects overall nutrition over weeks.",
      "Note any swelling in legs or abdomen, fatigue, or poor appetite.",
    ],
    highActions: [
      "High albumin is usually from dehydration — drink 2.5–3 litres of water today.",
      "Continue normal diet; no change needed for isolated high albumin.",
      "Note if you have had vomiting, diarrhoea, or heavy sweating recently.",
    ],
    lowQuestion: "Ask whether low albumin is related to protein intake, liver function, kidney loss, or inflammation.",
    highQuestion: "Ask whether high albumin is from dehydration or needs any further check.",
  }),

  total_protein: makeReviewPlaybook({
    label: "Total Protein",
    area: "liver",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["symptoms"],
    lowActions: [
      "Add protein to every meal: dal, paneer, curd, eggs, chana, sprouts, or soya.",
      "Avoid long gaps between meals — distribute protein across breakfast, lunch, and dinner.",
      "Note any weakness, poor wound healing, or swelling.",
    ],
    highActions: [
      "Stay well hydrated — high protein can sometimes reflect dehydration.",
      "Continue normal diet; isolated high total protein rarely needs diet change.",
      "Note any unusual symptoms or recent illness.",
    ],
    lowQuestion: "Ask whether low protein is from diet, absorption, liver, or kidney causes.",
    highQuestion: "Ask whether high total protein needs further review with protein electrophoresis.",
  }),

  alp: makeReviewPlaybook({
    label: "ALP (Alkaline Phosphatase)",
    area: "liver",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Avoid alcohol completely while this result is being reviewed.",
      "Keep a list of all medicines, supplements, and herbal products — some raise ALP.",
      "Note any bone pain, joint discomfort, jaundice, or abdominal pain.",
    ],
    lowActions: [
      "Low ALP is uncommon — note any zinc deficiency symptoms or severe dietary restriction.",
      "Continue a balanced diet with zinc-rich foods: til, chana, pumpkin seeds, paneer.",
      "Bring a list of all supplements to your doctor visit.",
    ],
    highQuestion: "Ask whether the raised ALP is from liver, bone, or another cause — and if liver function and bone markers should be checked.",
    lowQuestion: "Ask whether low ALP is linked to zinc deficiency or another underlying cause.",
  }),

  egfr: {
    low: ({ value, unit, low }, lang) => ({
      headline: s({
        en: `Your eGFR is ${value} ${unit} — below the ${low} mL/min/1.73m² reference, suggesting kidney filtration needs monitoring.`,
        gu: `eGFR ${value} ${unit} — ${low} reference કરતાં ઓછો. Kidney filtration monitoring ની જરૂર.`,
        hi: `eGFR ${value} ${unit} — ${low} reference से कम। Kidney filtration की monitoring ज़रूरी।`,
      }, lang),
      thisWeek: s({
        en: [
          "Stay well hydrated — drink 2–2.5 litres of water daily unless your doctor has advised a fluid restriction.",
          "Avoid painkillers (ibuprofen, diclofenac, aspirin) without a doctor's advice — they reduce kidney blood flow.",
          "Reduce salt and high-protein intake: limit papad, achar, namkeen, and large meat portions this week.",
        ],
        gu: [
          "2–2.5 litre water — doctor ની fluid restriction ન હોય.",
          "Painkillers (ibuprofen, diclofenac) ટાળો — kidney blood flow ઘટાડે.",
          "Salt/high-protein ઓછા: papad, achar, namkeen, large meat portions.",
        ],
        hi: [
          "2–2.5 लीटर पानी — doctor की fluid restriction न हो तो।",
          "Painkillers (ibuprofen, diclofenac) बिना doctor सलाह न लें।",
          "Salt/high-protein कम: papad, achar, namkeen, large meat।",
        ],
      }, lang),
      checkIns: [
        { id: "water",         label: s({ en: "Drank 2+ litres of water today",         gu: "2+ litre pANI",          hi: "2+ लीटर पानी"          }, lang), icon: "💧" },
        { id: "no_painkiller", label: s({ en: "Avoided OTC painkillers today",           gu: "Painkillers aTALyA",     hi: "Painkillers से बचे"    }, lang), icon: "💊" },
        { id: "low_salt",      label: s({ en: "Avoided papad, achar, namkeen today",     gu: "Papad/achar/namkeen aTALyuM", hi: "Papad/achar से बचे" }, lang), icon: "🧂" },
      ],
      linkedTrackers: ["symptoms"],
      retestDays: 42,
      retest: s(RETEST["6w"], lang),
      bringToDoctor: s({
        en: "Ask what stage of kidney function this represents and whether blood pressure, protein, and diabetes control should all be reviewed together.",
        gu: "eGFR stage? BP, protein, diabetes control — sathe review?",
        hi: "eGFR stage? BP, protein, diabetes control — साथ में review ज़रूरी?",
      }, lang),
    }),
    high: ({ value, unit }, lang) => ({
      headline: s({
        en: `Your eGFR is ${value} ${unit} — above the usual range. This is generally a positive finding.`,
        gu: `eGFR ${value} ${unit} — સામાન્ય range ઉ. આ generally positive finding.`,
        hi: `eGFR ${value} ${unit} — सामान्य range से अधिक। यह generally positive finding है।`,
      }, lang),
      thisWeek: s({
        en: [
          "Continue staying well hydrated daily.",
          "No dietary change needed for a high eGFR.",
          "Keep this result for reference alongside future kidney panel results.",
        ],
        gu: ["Hydrated raho.", "Diet change nathi.", "Future kidney results sAthe reference rAkho."],
        hi: ["Hydrated रहें।", "Diet change नहीं।", "Future kidney results के reference के लिए रखें।"],
      }, lang),
      checkIns: [
        { id: "water",     label: s({ en: "Stayed well hydrated today", gu: "Hydrated rahyA", hi: "Hydrated रहे" }, lang), icon: "💧" },
        { id: "good_news", label: s({ en: "Noted good kidney result",   gu: "Kidney result saAruM", hi: "Kidney result अच्छा" }, lang), icon: "✓" },
        { id: "keep_ref",  label: s({ en: "Saved result for future reference", gu: "Result reference mATe sAchavyuM", hi: "Future reference के लिए save किया" }, lang), icon: "📋" },
      ],
      linkedTrackers: [],
      retestDays: 180,
      retest: s({ en: "6 months", gu: "6 મહિના", hi: "6 महीने" }, lang),
      bringToDoctor: s({
        en: "Mention this result at your next routine visit — no urgent action needed.",
        gu: "Next routine visit mAM mention karo — urgent kaMi nahi.",
        hi: "अगली routine visit में mention करें — urgent कुछ नहीं।",
      }, lang),
    }),
  },

  microalbumin_creatinine: makeReviewPlaybook({
    label: "Urine Albumin:Creatinine Ratio",
    area: "kidney",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Keep BP well controlled — high BP is the biggest driver of kidney protein leakage in Indian patients.",
      "Manage blood sugar tightly this week if you have diabetes — both sugar and BP damage kidney filters.",
      "Reduce salt intake (papad, achar, namkeen, processed food) to help BP and kidney pressure.",
    ],
    lowActions: [
      "Low uACR is a normal finding — continue your current diet and medicines.",
      "No diet or lifestyle change needed.",
      "Keep this result as a baseline for future kidney monitoring.",
    ],
    highQuestion: "Ask whether raised uACR means kidney protection medicines (ACE inhibitors or ARBs) should be discussed.",
    lowQuestion: "Confirm this is a normal result and ask when the next check is appropriate.",
  }),

  prolactin: makeReviewPlaybook({
    label: "Prolactin",
    area: "inflammation",
    retestKey: "4_6w",
    retestDays: 42,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Avoid heavy exercise, stress, and breast stimulation before the next blood draw — these temporarily raise prolactin.",
      "Bring a list of all medicines: antacids (domperidone), some blood pressure or psychiatric medicines raise prolactin.",
      "Note any irregular periods, milk discharge unrelated to breastfeeding, vision changes, or headaches.",
    ],
    lowActions: [
      "Low prolactin is rarely clinically significant outside of pregnancy.",
      "Continue normal diet and routine.",
      "Mention this result at your next visit for context.",
    ],
    highQuestion: "Ask whether the raised prolactin needs an MRI to check the pituitary gland and whether medicines are a cause.",
    lowQuestion: "Ask whether low prolactin is relevant in your current clinical context.",
  }),

  testosterone: makeReviewPlaybook({
    label: "Testosterone",
    area: "inflammation",
    retestKey: "4_6w",
    retestDays: 42,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Note symptoms this week: acne, excess facial or body hair, hair thinning on scalp, irregular periods, or unusual mood changes — these help your doctor understand the cause.",
      "If you take any testosterone, DHEA, or hormone supplement, stop it now and bring the label to your next visit.",
      "Avoid protein powders or gym supplements with undisclosed ingredients — some contain hidden hormones.",
    ],
    lowActions: [
      "Include zinc-rich foods: pumpkin seeds, til, chana, paneer, eggs — zinc supports testosterone.",
      "Prioritise 7–8 hours of sleep — testosterone production peaks during deep sleep.",
      "Add resistance exercise (yoga, body-weight exercises) 3 times this week.",
    ],
    highQuestion: "Ask whether the high testosterone level needs investigation for adrenal or ovarian causes (women) or supplement-related causes (men).",
    lowQuestion: "Ask whether lifestyle factors (sleep, stress, weight) or a medical cause is responsible, and if treatment is needed.",
  }),

  cortisol: makeReviewPlaybook({
    label: "Cortisol",
    area: "inflammation",
    retestKey: "4_6w",
    retestDays: 42,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Reduce stress where possible: note your biggest daily stressors and consider 10 minutes of pranayama or slow breathing in the morning.",
      "Prioritise 7–8 hours of sleep — poor sleep is the single biggest driver of elevated cortisol.",
      "Bring a list of steroid medicines or creams — these can elevate cortisol in blood tests.",
    ],
    lowActions: [
      "Low cortisol is uncommon — note any persistent fatigue, dizziness on standing, salt craving, or low BP.",
      "Do not change any steroid medicine dose without medical advice.",
      "Keep this result visible for your doctor visit.",
    ],
    highQuestion: "Ask whether high cortisol needs a 24-hour urine cortisol or overnight dexamethasone suppression test.",
    lowQuestion: "Ask whether low cortisol means adrenal function needs further investigation.",
  }),

  homa_ir: makeReviewPlaybook({
    label: "HOMA-IR (Insulin Resistance)",
    area: "sugar",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["bloodSugar", "weight", "walking"],
    highActions: [
      "Replace white rice or maida at one meal per day with whole grain roti, millets (bajra, jowar, ragi), or oats.",
      "Walk 30 minutes after your largest meal — post-meal walking is the single most effective way to lower insulin resistance.",
      "Reduce chai with sugar, packaged fruit juice, and sweet lassi — liquid sugar spikes insulin sharply.",
    ],
    lowActions: [
      "Low HOMA-IR is a normal finding — your insulin sensitivity is good.",
      "Continue current diet and exercise habits.",
      "Keep this as a baseline for future metabolic monitoring.",
    ],
    highQuestion: "Ask whether the HOMA-IR level means pre-diabetes management should start and whether metformin or lifestyle-only approach is right for you.",
    lowQuestion: "Confirm this is a normal result at your next visit.",
  }),

  absolute_eosinophil: makeReviewPlaybook({
    label: "Absolute Eosinophil Count (AEC)",
    area: "allergy",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Note any itching, skin rash, nasal symptoms, wheezing, or recent travel — high eosinophils in India are commonly from parasites or allergy.",
      "If you have not had a recent stool examination, mention this to your doctor — intestinal parasites are a common cause in India.",
      "Do not self-start anti-parasitic or anti-allergy medicines from this result alone.",
    ],
    lowActions: [
      "Low eosinophil count is generally not significant on its own.",
      "Continue normal diet and routine.",
      "Mention this result at your next routine visit.",
    ],
    highQuestion: "Ask whether a stool test for parasites, allergy testing, or a specialist referral is needed given your symptoms.",
    lowQuestion: "Ask whether low eosinophil count is relevant in your clinical context.",
  }),

  vldl: makeReviewPlaybook({
    label: "VLDL Cholesterol",
    area: "sugar",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["weight", "walking"],
    highActions: [
      "Reduce sugar and refined carbs sharply — VLDL is driven more by sugar and alcohol than by dietary fat.",
      "Cut sweet chai, cold drinks, fruit juice, mithai, biscuits, and white bread this week.",
      "Walk 30 minutes after your largest meal — this helps clear triglycerides from blood, which directly lowers VLDL.",
    ],
    lowActions: [
      "Low VLDL is generally a positive finding.",
      "Continue current diet and lifestyle.",
      "Keep this as a baseline for your lipid panel monitoring.",
    ],
    highQuestion: "Ask whether high VLDL needs a full lipid panel review and whether triglyceride-lowering treatment is appropriate.",
    lowQuestion: "Confirm this is a normal finding at your next visit.",
  }),

  non_hdl: makeReviewPlaybook({
    label: "Non-HDL Cholesterol",
    area: "sugar",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["weight", "walking"],
    highActions: [
      "Non-HDL combines LDL and VLDL — reduce both saturated fat (ghee, coconut oil excess, full-fat dairy) and sugar/refined carbs.",
      "Add a handful of walnuts or flaxseeds (alsi) daily — omega-3 helps lower non-HDL.",
      "Walk or do yoga for 30 minutes daily — physical activity improves the full cholesterol picture.",
    ],
    lowActions: [
      "Low non-HDL is generally a positive finding.",
      "Continue current diet and lifestyle.",
      "No dietary change needed.",
    ],
    highQuestion: "Ask whether the non-HDL level means a statin or another cholesterol medicine should be considered.",
    lowQuestion: "Confirm this is a normal result at your next routine visit.",
  }),

  direct_bilirubin: makeReviewPlaybook({
    label: "Direct Bilirubin",
    area: "liver",
    retestKey: "2_4w",
    retestDays: 21,
    linkedTrackers: ["symptoms"],
    highActions: [
      "Avoid alcohol and paracetamol (only take paracetamol at prescribed doses) while this is being reviewed.",
      "Note any yellowing of skin or eyes (jaundice), dark urine, pale stools, or itching.",
      "Keep a list of all medicines and supplements — some cause direct bilirubin to rise.",
    ],
    lowActions: [
      "Low direct bilirubin is generally not clinically significant.",
      "Continue normal diet and routine.",
      "Mention this at your next routine visit.",
    ],
    highQuestion: "Ask whether raised direct bilirubin points to bile duct obstruction, liver disease, or a medicine effect — and what test is next.",
    lowQuestion: "Ask whether low direct bilirubin is relevant in your current clinical context.",
  }),

  psa: makeReviewPlaybook({
    label: "PSA (Prostate Specific Antigen)",
    area: "inflammation",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["symptoms"],
    highActions: [
      "PSA can be temporarily raised by prostate infection (prostatitis), a recent digital rectal exam, cycling, or ejaculation — mention these to your doctor.",
      "Note any difficulty urinating, frequent urination at night, or groin/back pain.",
      "Do not make decisions about biopsy or treatment from PSA alone — this needs clinical review.",
    ],
    lowActions: [
      "Low PSA is generally a reassuring finding.",
      "Continue routine monitoring as advised by your doctor.",
      "No dietary change needed.",
    ],
    highQuestion: "Ask whether the PSA level needs a repeat fasting test, free PSA ratio, or urologist referral.",
    lowQuestion: "Confirm this is a normal result and ask when the next PSA check should be.",
  }),

  phosphorus: makeReviewPlaybook({
    label: "Phosphorus",
    area: "kidney",
    retestKey: "4w",
    retestDays: 28,
    linkedTrackers: ["symptoms"],
    lowActions: [
      "Include phosphorus-rich foods: milk, curd, paneer, dal, nuts, and seeds daily.",
      "Note any bone pain, muscle weakness, or fatigue.",
      "Ask your doctor whether a supplement or cause investigation is needed.",
    ],
    highActions: [
      "Reduce dairy excess, cola drinks, and packaged processed food — these are high in phosphorus.",
      "Note any bone or joint pain, itching, or calcification symptoms.",
      "Stop phosphorus supplements if you are taking any.",
    ],
    lowQuestion: "Ask whether low phosphorus is related to diet, Vitamin D deficiency, or medication.",
    highQuestion: "Ask whether high phosphorus is related to kidney function and whether phosphate binders are needed.",
  }),

  zinc: makeReviewPlaybook({
    label: "Zinc",
    area: "inflammation",
    retestKey: "3m",
    retestDays: 90,
    linkedTrackers: ["symptoms"],
    lowActions: [
      "Include zinc-rich Indian foods: til (sesame), pumpkin seeds, chana, rajma, paneer, and eggs.",
      "Note poor wound healing, hair loss, taste or smell changes, or frequent infections — common signs of low zinc.",
      "Ask your doctor whether a zinc supplement dose is appropriate — excess zinc is also harmful.",
    ],
    highActions: [
      "Stop zinc supplements immediately — excess zinc interferes with copper absorption.",
      "Reduce very high-dose zinc lozenges or throat sprays.",
      "Note any nausea or metallic taste.",
    ],
    lowQuestion: "Ask whether a zinc supplement and dietary review is the right approach for your level.",
    highQuestion: "Ask whether high zinc from supplements needs a copper level check.",
  }),

  urine_urobilinogen: makeReviewPlaybook({
    label: "urine urobilinogen",
    area: "urine",
    retestKey: "2_4w",
    retestDays: 21,
    linkedTrackers: ["symptoms"],
    highQuestion: "Ask how urine urobilinogen fits with bilirubin, liver enzymes, blood count, and symptoms.",
    lowQuestion: "Ask whether this urobilinogen result needs confirmation with the rest of the urine and liver results.",
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  const n = Number(value);
  return n % 1 === 0 ? String(n) : String(Math.round(n * 10) / 10);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function buildContextPersonalization(patientContext = {}, lang = "en") {
  const age = Number(patientContext.ageYears ?? patientContext.age);
  const conditions = normalizeList(patientContext.chronicConditions || patientContext.conditions);
  const medications = normalizeList(patientContext.medications || patientContext.currentMedications);
  const lowerConditions = conditions.map((item) => item.toLowerCase());
  const notes = [];

  if (Number.isFinite(age) && age < 18) {
    notes.push(s({
      en: "Because this result is for someone under 18, use age-specific ranges and review the plan with a parent or clinician.",
      gu: "આ પરિણામ 18 વર્ષથી ઓછી ઉંમર માટે છે, તેથી ઉંમર પ્રમાણેની રેન્જ અને ડૉક્ટરની સમીક્ષા જરૂરી છે.",
      hi: "यह परिणाम 18 वर्ष से कम उम्र के लिए है, इसलिए उम्र के अनुसार range और clinician review ज़रूरी है।",
    }, lang));
  } else if (Number.isFinite(age) && age >= 65) {
    notes.push(s({
      en: "Because you are 65 or older, keep changes gentle and match activity and hydration to your mobility and medical advice.",
      gu: "ઉંમર 65 વર્ષ કે વધુ હોવાથી ફેરફારો ધીમા રાખો અને પ્રવૃત્તિ તથા પાણી ડૉક્ટરની સલાહ મુજબ રાખો.",
      hi: "उम्र 65 वर्ष या अधिक होने पर बदलाव धीरे रखें और activity तथा hydration डॉक्टर की सलाह के अनुसार रखें।",
    }, lang));
  }

  if (lowerConditions.some((item) => /diabetes|prediabetes|blood sugar/.test(item))) {
    notes.push(s({
      en: "Your existing sugar history makes comparison with HbA1c and home glucose readings more useful.",
      gu: "હાલની શુગર હિસ્ટ્રીને કારણે HbA1c અને ઘરનાં ગ્લુકોઝ રીડિંગ સાથે સરખામણી વધુ ઉપયોગી છે.",
      hi: "मौजूदा sugar history के कारण HbA1c और home glucose readings से तुलना अधिक उपयोगी है।",
    }, lang));
  }
  if (lowerConditions.some((item) => /kidney|renal|ckd/.test(item))) {
    notes.push(s({
      en: "Because kidney disease is already in your profile, do not increase fluids, protein, or supplements without checking your care plan.",
      gu: "પ્રોફાઇલમાં કિડનીની સ્થિતિ હોવાથી પાણી, પ્રોટીન અથવા સપ્લિમેન્ટ ડૉક્ટરની સલાહ વગર વધારશો નહીં.",
      hi: "प्रोफ़ाइल में kidney condition होने के कारण fluids, protein या supplements बिना सलाह के न बढ़ाएं।",
    }, lang));
  }
  if (lowerConditions.some((item) => /heart|cardiac|hypertension|blood pressure/.test(item))) {
    notes.push(s({
      en: "Keep blood pressure, swelling, breathlessness, and your heart medicines visible when this result is reviewed.",
      gu: "આ પરિણામની સમીક્ષા વખતે બ્લડ પ્રેશર, સોજો, શ્વાસની તકલીફ અને હાર્ટની દવાઓની યાદી સાથે રાખો.",
      hi: "इस परिणाम की review में blood pressure, swelling, breathlessness और heart medicines की सूची साथ रखें।",
    }, lang));
  }
  if (medications.length) {
    notes.push(s({
      en: `Your profile lists ${medications.slice(0, 3).join(", ")}. Keep this medicine list ready and do not change a dose from the report alone.`,
      gu: `પ્રોફાઇલમાં ${medications.slice(0, 3).join(", ")} નોંધાયેલ છે. દવાઓની યાદી સાથે રાખો અને રિપોર્ટ પરથી ડોઝમાં ફેરફાર ન કરો.`,
      hi: `प्रोफ़ाइल में ${medications.slice(0, 3).join(", ")} दर्ज है। दवाओं की सूची साथ रखें और report के आधार पर dose न बदलें।`,
    }, lang));
  }
  return notes.slice(0, 4);
}

/**
 * Builds a single action plan object from a trend + playbook block.
 * @param {object} trend
 * @param {string} lang  "en" | "gu" | "hi"
 */
function buildSingleActionPlan(trend, lang = "en", patientContext = {}) {
  const playbook = METRIC_PLAYBOOKS[trend.metricKey];
  if (!playbook) return null;
  const direction = trend.zone === "high" ? "high" : "low";
  const fn = playbook[direction];
  if (typeof fn !== "function") return null;

  const params = {
    value: formatValue(trend.latestValue),
    unit:  trend.unit || "",
    low:   trend.low  != null ? formatValue(trend.low)  : null,
    high:  trend.high != null ? formatValue(trend.high) : null,
    zone:  trend.zone,
  };

  const block = fn(params, lang);
  const contextNotes = buildContextPersonalization(patientContext, lang);

  // Improvement message (language-aware)
  let improvement = null;
  if (Number.isFinite(trend.previousValue) && Number.isFinite(trend.latestValue)) {
    const prev = trend.previousValue;
    const curr = trend.latestValue;
    const delta = Math.abs(prev - curr);
    const pct   = prev !== 0 ? Math.round((delta / Math.abs(prev)) * 100) : 0;
    const movingTowardNormal =
      (trend.zone === "high" && curr < prev) ||
      (trend.zone === "low"  && curr > prev);
    if (movingTowardNormal && pct >= 3) {
      improvement = {
        previousValue: formatValue(prev),
        delta: formatValue(delta),
        pct,
        message: s({
          en: `Your ${trend.metricLabel} improved ${pct}% since your last report — keep going.`,
          gu: `તમારા ${trend.metricLabel} માં છેલ્લા report થી ${pct}% સુધારો થયો — ચાલુ રાખો.`,
          hi: `आपके ${trend.metricLabel} में पिछली report से ${pct}% सुधार हुआ — जारी रखें।`,
        }, lang),
      };
    }
  }

  return {
    metricKey:      trend.metricKey,
    metricLabel:    trend.metricLabel,
    value:          params.value,
    unit:           params.unit,
    zone:           trend.zone,
    improvement,
    headline:       block.headline,
    thisWeek:       block.thisWeek,
    checkIns:       block.checkIns       || [],
    linkedTrackers: block.linkedTrackers || [],
    retestDays:     block.retestDays     || null,
    retest:         block.retest,
    bringToDoctor:  block.bringToDoctor,
    contextNotes,
  };
}

/**
 * @param {Array}  trends
 * @param {string} lang  "en" | "gu" | "hi"
 */
function buildActionMap(trends = [], lang = "en", patientContext = {}) {
  const abnormal = trends
    .filter((t) => t.zone && t.zone !== "normal" && Number.isFinite(t.latestValue))
    .sort((a, b) => {
      const priority = { high: 0, low: 1, borderline: 2 };
      return (priority[a.zone] ?? 3) - (priority[b.zone] ?? 3);
    });

  const plans = [];
  for (const trend of abnormal) {
    if (plans.length >= 3) break;
    const plan = buildSingleActionPlan(trend, lang, patientContext);
    if (plan) plans.push(plan);
  }

  if (plans.length === 0) return null;

  const primary   = plans[0];
  const secondary = plans.slice(1);

  return {
    ...primary,
    secondary,
  };
}

module.exports = { buildActionMap, METRIC_PLAYBOOKS };
