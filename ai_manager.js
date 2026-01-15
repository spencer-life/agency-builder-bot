const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

/**
 * Parses natural language instructions for agency setup using Gemini 3 Flash.
 * Optimized for full server builds and incremental additions.
 */
async function parseInsuranceCommand(input) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 flash as 3 flash might be too new for the SDK version

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}

/**
 * Specifically for the interactive /war-room wizard to process steps
 */
async function processWizardStep(step, input) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let systemPrompt = "";
    if (step === 1) {
        systemPrompt = "Extract the name of the main insurance agency from this text. Return JUST the name.";
    } else if (step === 2) {
        systemPrompt = "Extract a list of sub-agencies from this text. Return as a JSON array of strings.";
    } else if (step === 3) {
        systemPrompt = "Analyze the hierarchy described. Return a JSON array of objects like {downline: 'A', upline: 'B'}.";
    }

    try {
        const result = await model.generateContent(`${systemPrompt}\n\nUser Input: "${input}"`);
        const response = await result.response;
        let text = response.text().trim();
        
        if (text.startsWith('```')) {
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        }
        
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    } catch (error) {
        console.error("Wizard Step Error:", error);
        return null;
    }
}

module.exports = { parseInsuranceCommand, processWizardStep };
