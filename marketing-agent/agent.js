import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "generate_whatsapp_message",
    description:
      "Generate a WhatsApp referral or awareness message for SehatsaathiPlus. Produces a short, conversational message suitable for personal or broadcast sharing.",
    input_schema: {
      type: "object",
      properties: {
        audience: {
          type: "string",
          enum: ["patient", "family_referral", "community_broadcast"],
          description: "Who will receive this message",
        },
        language: {
          type: "string",
          enum: ["english", "gujarati", "bilingual"],
          description: "Language(s) for the message",
        },
        feature_focus: {
          type: "string",
          description:
            "Which product feature to highlight, e.g. 'lab reports', 'appointments', 'triage', 'pharmacy discovery'",
        },
        include_cta: {
          type: "boolean",
          description: "Whether to include a call-to-action link or prompt",
        },
      },
      required: ["audience", "language", "feature_focus"],
    },
  },
  {
    name: "generate_social_post",
    description:
      "Generate a social media post (Instagram caption, Facebook post, or Twitter/X thread) for SehatsaathiPlus.",
    input_schema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["instagram", "facebook", "twitter_x"],
          description: "Target social platform",
        },
        language: {
          type: "string",
          enum: ["english", "gujarati", "bilingual"],
        },
        theme: {
          type: "string",
          description:
            "Post theme or angle, e.g. 'empowerment', 'trust', 'local pride', 'ease of use', 'doctor partnership'",
        },
        include_hashtags: {
          type: "boolean",
          description: "Whether to include relevant hashtags",
        },
        emoji_style: {
          type: "string",
          enum: ["minimal", "moderate", "expressive"],
          description: "How many emojis to use in the post",
        },
      },
      required: ["platform", "language", "theme"],
    },
  },
  {
    name: "generate_referral_script",
    description:
      "Generate a referral script for a doctor, hospital staff member, or community health worker to use when recommending SehatsaathiPlus to patients.",
    input_schema: {
      type: "object",
      properties: {
        speaker_role: {
          type: "string",
          enum: ["doctor", "hospital_receptionist", "asha_worker", "pharmacist"],
          description: "Who will be delivering this script",
        },
        language: {
          type: "string",
          enum: ["english", "gujarati", "bilingual"],
        },
        setting: {
          type: "string",
          enum: ["opd_consultation", "discharge", "pharmacy_counter", "home_visit"],
          description: "Where the conversation takes place",
        },
        duration: {
          type: "string",
          enum: ["30_seconds", "1_minute", "2_minutes"],
          description: "Approximate script length",
        },
      },
      required: ["speaker_role", "language", "setting", "duration"],
    },
  },
  {
    name: "generate_onboarding_content",
    description:
      "Generate onboarding content — SMS welcome message, in-app tooltip text, or printed flyer copy — for new SehatsaathiPlus users.",
    input_schema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["sms_welcome", "in_app_tooltip", "printed_flyer", "email_welcome"],
          description: "Content format",
        },
        language: {
          type: "string",
          enum: ["english", "gujarati", "bilingual"],
        },
        user_segment: {
          type: "string",
          enum: ["new_patient", "returning_patient", "caregiver"],
          description: "Who this onboarding content targets",
        },
        highlight_feature: {
          type: "string",
          description: "Key feature to introduce during onboarding",
        },
      },
      required: ["format", "language", "user_segment"],
    },
  },
  {
    name: "generate_campaign_strategy",
    description:
      "Generate a short multi-channel marketing campaign strategy for a specific goal or milestone in the Vadodara pilot.",
    input_schema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description:
            "Campaign goal, e.g. 'acquire 100 new patients in week 1', 'drive appointment bookings', 'build Savita hospital brand awareness'",
        },
        channels: {
          type: "array",
          items: { type: "string" },
          description:
            "Marketing channels to include, e.g. ['whatsapp', 'instagram', 'in_clinic_posters', 'doctor_referrals']",
        },
        duration_weeks: {
          type: "number",
          description: "Campaign duration in weeks",
        },
        budget_tier: {
          type: "string",
          enum: ["zero_budget", "low_budget", "medium_budget"],
          description: "Available marketing budget tier",
        },
      },
      required: ["goal", "channels", "duration_weeks"],
    },
  },
  {
    name: "save_content",
    description:
      "Save generated marketing content to a file in the outputs directory.",
    input_schema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename without extension, e.g. 'whatsapp-patient-gujarati'",
        },
        content: {
          type: "string",
          description: "The marketing content to save",
        },
        content_type: {
          type: "string",
          description: "Type of content for organizing output",
        },
      },
      required: ["filename", "content", "content_type"],
    },
  },
];

// ─── Tool handlers ─────────────────────────────────────────────────────────────

function handleGenerateWhatsappMessage(input) {
  return {
    tool: "generate_whatsapp_message",
    params: input,
    status: "queued_for_claude",
  };
}

function handleGenerateSocialPost(input) {
  return {
    tool: "generate_social_post",
    params: input,
    status: "queued_for_claude",
  };
}

function handleGenerateReferralScript(input) {
  return {
    tool: "generate_referral_script",
    params: input,
    status: "queued_for_claude",
  };
}

function handleGenerateOnboardingContent(input) {
  return {
    tool: "generate_onboarding_content",
    params: input,
    status: "queued_for_claude",
  };
}

function handleGenerateCampaignStrategy(input) {
  return {
    tool: "generate_campaign_strategy",
    params: input,
    status: "queued_for_claude",
  };
}

function handleSaveContent(input) {
  const outputDir = join(process.cwd(), "outputs");
  mkdirSync(outputDir, { recursive: true });
  const filepath = join(outputDir, `${input.filename}.md`);
  const header = `# ${input.content_type}\n\nGenerated: ${new Date().toISOString()}\n\n---\n\n`;
  writeFileSync(filepath, header + input.content, "utf8");
  return { saved: true, path: filepath };
}

function executeTool(name, input) {
  switch (name) {
    case "generate_whatsapp_message":
      return handleGenerateWhatsappMessage(input);
    case "generate_social_post":
      return handleGenerateSocialPost(input);
    case "generate_referral_script":
      return handleGenerateReferralScript(input);
    case "generate_onboarding_content":
      return handleGenerateOnboardingContent(input);
    case "generate_campaign_strategy":
      return handleGenerateCampaignStrategy(input);
    case "save_content":
      return handleSaveContent(input);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the marketing AI agent for SehatsaathiPlus — a digital health platform built for Vadodara, Gujarat, India.

## About SehatsaathiPlus
- **Mission:** Faster OPD intake and better patient continuity for a Savita-anchored local care network in Vadodara
- **Pilot anchor:** Savita Hospital, Vadodara
- **Core patient features:**
  - Lab report summaries with plain-language explanations and doctor-ready questions
  - Appointment booking and status tracking
  - Local lab discovery by area, price, ETA, and visit mode
  - Local pharmacy discovery by area and fulfillment mode
  - Triage panel with symptom-based urgency guidance
  - Notifications for appointment and status changes
  - Health pass / profile for OPD intake readiness
- **Languages:** English and Gujarati (always bilingual-aware)
- **Target users:** Patients and families in Vadodara, hospital staff at Savita, local doctors, ASHA workers, pharmacists

## Your Role
You generate high-quality, culturally appropriate marketing content to attract new users after the pilot launch. You use your tools to plan, generate, and save content across channels.

## Content Principles
- **Warm and local:** Speak like a trusted community member, not a corporate brand
- **Gujarati pride:** When writing in Gujarati, use natural everyday language — not overly formal or translated-feeling
- **Trust through specificity:** Mention real features (lab reports, OPD intake, Savita hospital) rather than vague health claims
- **No medical diagnosis claims:** The platform helps patients navigate and understand, not diagnose
- **Action-oriented:** Every piece of content should move someone toward downloading the app, booking an appointment, or referring a friend

## Workflow
When given a marketing request:
1. Plan which content types and channels will be most impactful
2. Use your generation tools to create each piece of content
3. Use save_content to persist every generated piece
4. Provide a clear summary of what was created and recommended next steps`;

// ─── Agentic loop ──────────────────────────────────────────────────────────────

async function runMarketingAgent(userRequest) {
  console.log("\n🚀 SehatsaathiPlus Marketing Agent\n");
  console.log(`Request: ${userRequest}\n`);
  console.log("─".repeat(60));

  const messages = [{ role: "user", content: userRequest }];

  // Second-pass: Claude generates actual content using the tool params as context.
  // We accumulate tool results that need content generation, then do a single
  // follow-up asking Claude to write all the actual text.
  const pendingGeneration = [];
  let finalText = "";

  // First agentic loop: Claude plans and calls tools
  while (true) {
    const stream = await client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const response = await stream.finalMessage();
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      // Extract final text response
      for (const block of response.content) {
        if (block.type === "text") {
          finalText = block.text;
        }
      }
      break;
    }

    if (response.stop_reason !== "tool_use") break;

    // Process tool calls
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      console.log(`\n⚙️  Tool: ${block.name}`);
      console.log(`   Input: ${JSON.stringify(block.input, null, 2).replace(/\n/g, "\n   ")}`);

      const result = executeTool(block.name, block.input);

      // Queue content generation tools for second pass
      if (
        block.name !== "save_content" &&
        result.status === "queued_for_claude"
      ) {
        pendingGeneration.push({ id: block.id, name: block.name, params: block.input });
      }

      if (result.saved) {
        console.log(`   ✅ Saved: ${result.path}`);
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Second pass: generate actual content for each queued tool
  if (pendingGeneration.length > 0) {
    console.log(`\n📝 Generating ${pendingGeneration.length} content piece(s)...\n`);

    for (const item of pendingGeneration) {
      const contentRequest = buildContentRequest(item.name, item.params);

      const contentStream = await client.messages.stream({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentRequest }],
      });

      const contentResponse = await contentStream.finalMessage();
      let generatedContent = "";
      for (const block of contentResponse.content) {
        if (block.type === "text") generatedContent = block.text;
      }

      // Save the generated content
      const filename = buildFilename(item.name, item.params);
      const saveResult = handleSaveContent({
        filename,
        content: generatedContent,
        content_type: buildContentTypeLabel(item.name, item.params),
      });

      console.log(`   ✅ ${filename}.md`);
      console.log(`\n${"─".repeat(60)}`);
      console.log(`📄 ${buildContentTypeLabel(item.name, item.params)}`);
      console.log("─".repeat(60));
      console.log(generatedContent);
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log("✅ Marketing Agent Complete\n");
  if (finalText) {
    console.log("Summary:");
    console.log(finalText);
  }
}

function buildContentRequest(toolName, params) {
  const base = `Write the following SehatsaathiPlus marketing content. Be specific, warm, and locally resonant for Vadodara audiences. Do not add preamble — output only the final content ready to use.\n\n`;

  switch (toolName) {
    case "generate_whatsapp_message":
      return `${base}Type: WhatsApp message
Audience: ${params.audience}
Language: ${params.language}
Feature to highlight: ${params.feature_focus}
Include CTA: ${params.include_cta ?? true}

Write the WhatsApp message now:`;

    case "generate_social_post":
      return `${base}Type: Social media post for ${params.platform}
Language: ${params.language}
Theme/angle: ${params.theme}
Include hashtags: ${params.include_hashtags ?? true}
Emoji style: ${params.emoji_style ?? "moderate"}

Write the ${params.platform} post now:`;

    case "generate_referral_script":
      return `${base}Type: Referral script
Speaker: ${params.speaker_role}
Language: ${params.language}
Setting: ${params.setting}
Duration: ${params.duration}

Write the referral script now (include stage directions in [brackets] where helpful):`;

    case "generate_onboarding_content":
      return `${base}Type: Onboarding content — ${params.format}
Language: ${params.language}
User segment: ${params.user_segment}
Feature to highlight: ${params.highlight_feature ?? "core platform features"}

Write the onboarding content now:`;

    case "generate_campaign_strategy":
      return `${base}Type: Marketing campaign strategy
Goal: ${params.goal}
Channels: ${(params.channels || []).join(", ")}
Duration: ${params.duration_weeks} week(s)
Budget tier: ${params.budget_tier ?? "zero_budget"}

Write the campaign strategy now (include week-by-week breakdown and specific action items):`;

    default:
      return `${base}Tool: ${toolName}\nParams: ${JSON.stringify(params, null, 2)}\n\nGenerate the content now:`;
  }
}

function buildFilename(toolName, params) {
  const typeMap = {
    generate_whatsapp_message: "whatsapp",
    generate_social_post: "social",
    generate_referral_script: "script",
    generate_onboarding_content: "onboarding",
    generate_campaign_strategy: "campaign",
  };
  const base = typeMap[toolName] || "content";
  const lang = params.language || "en";
  const extra =
    params.audience ||
    params.platform ||
    params.speaker_role ||
    params.format ||
    params.goal?.slice(0, 20).replace(/\s+/g, "-") ||
    "general";
  return `${base}-${extra}-${lang}-${Date.now()}`;
}

function buildContentTypeLabel(toolName, params) {
  switch (toolName) {
    case "generate_whatsapp_message":
      return `WhatsApp Message — ${params.audience} — ${params.language}`;
    case "generate_social_post":
      return `${params.platform} Post — ${params.theme} — ${params.language}`;
    case "generate_referral_script":
      return `Referral Script — ${params.speaker_role} — ${params.setting} — ${params.language}`;
    case "generate_onboarding_content":
      return `Onboarding — ${params.format} — ${params.user_segment} — ${params.language}`;
    case "generate_campaign_strategy":
      return `Campaign Strategy — ${params.goal}`;
    default:
      return toolName;
  }
}

// ─── CLI entry point ───────────────────────────────────────────────────────────

const DEFAULT_REQUEST = `
We are launching SehatsaathiPlus in Vadodara next week, anchored at Savita Hospital.
Create a full pilot launch marketing kit:

1. A WhatsApp referral message in Gujarati for patients to share with family
2. An Instagram post in bilingual (English + Gujarati) highlighting lab report understanding
3. A 1-minute referral script for doctors at Savita OPD to recommend the app to patients
4. A campaign strategy for the first 2 weeks targeting WhatsApp, Instagram, and in-clinic posters with zero budget

Save all content to files.
`.trim();

const userInput = process.argv.slice(2).join(" ") || DEFAULT_REQUEST;

runMarketingAgent(userInput).catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
