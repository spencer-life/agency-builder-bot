const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

// Initialize the client correctly for the new SDK
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Parses natural language instructions for agency setup using Gemini 2.0 Flash.
 * Optimized for full server builds and incremental additions.
 */
async function parseInsuranceCommand(input) {
  const prompt = `
    You are an AI assistant for the "Agency Builder Bot" Discord system. 
    Your task is to take natural language instructions for building an insurance agency structure and convert them into a JSON format the bot can execute.

    Commands we support:
    1. INITIALIZE: {"agencies": [{"name": "Name", "emoji": "EMOJI", "is_main": boolean}]} - Creating agency roles/categories.
    2. MAP: {"downline": "A", "upline": "B"} - Hierarchy mapping.
    3. WIPE: {} - Complete channel/category deletion.
    4. CREATE_MAIN_STRUCTURE: {} - Build Admin, Start Here, Sales Ops, etc.
    5. DEPLOY_ONBOARDING: {} - Deploy role portal.

    Rules:
    - Return ONLY a JSON object with an "actions" array.
    - Pick a single relevant emoji for each agency.
    - If the user mentions a "main" or "top" agency, set is_main: true.
    - ALWAYS include CREATE_MAIN_STRUCTURE before INITIALIZE unless user explicitly says not to.
    - If user says "wipe" or "wipe first" or "start fresh", include WIPE action FIRST.
    - Parse hierarchy relationships like "X under Y" or "X -> Y" or "X reports to Y" into MAP actions.
    - Default to creating base channels unless user says "agencies only".
    
    Structure Example:
    {
      "actions": [
        {"type": "WIPE"},
        {"type": "CREATE_MAIN_STRUCTURE"},
        {
          "type": "INITIALIZE", 
          "agencies": [{"name": "Reflect Agencies", "emoji": "🦁", "is_main": true}]
        },
        {
          "type": "MAP",
          "downline": "The Vault",
          "upline": "Reflect Agencies"
        }
      ]
    }

    User Instruction: "${input}"
    `;

  try {
    const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
        }
    });
    
    // The new SDK handles JSON parsing automatically with responseMimeType
    // But we still robustly handle string/object returns
    const result = response.parsed;
    return result;

  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}

/**
 * Specifically for the interactive /war-room wizard to process steps
 */
async function processWizardStep(step, input) {
    let systemPrompt = "";
    if (step === 1) {
        systemPrompt = "Extract the name of the main insurance agency from this text. Return JUST the name as a plain string.";
    } else if (step === 2) {
        systemPrompt = "Extract a list of sub-agencies from this text. Return as a JSON array of strings.";
    } else if (step === 3) {
        systemPrompt = "Analyze the hierarchy described. Return a JSON array of objects like {downline: 'A', upline: 'B'}.";
    }

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `${systemPrompt}\n\nUser Input: "${input}"`
        });

        // Handle text vs JSON responses based on the step
        let text = response.text();
        
        // Clean markdown if present
        if (text.startsWith('```')) {
            text = text.replace(/json/g, "").replace(/```/g, "").trim();
        }

        try {
            // For steps 2 and 3, we expect JSON
            if (step === 2 || step === 3) {
                return JSON.parse(text);
            }
            // For step 1, just return the text
            return text;
        } catch (e) {
            return text;
        }
    } catch (error) {
        console.error("Wizard Step Error:", error);
        return null;
    }
}

module.exports = { parseInsuranceCommand, processWizardStep };
