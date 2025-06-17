import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerativeModel,
  GenerationConfig,
  ChatSession,
} from "@google/generative-ai";
import { salesCallAnalysisSystemPrompt, generateSystemPromptWithNotes, UserProfile } from "./SystemPrompts";
import { ModelSettings } from "@/types";
import { CallDetails } from "@/components/meeting/StartCallDialog";

// Default settings
const defaultSettings: ModelSettings = {
  model: "gemini-1.5-flash-latest",
  thinkingMode: "off",
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
  stopSequences: [],
  safetySettings: {
    harassment: "block_medium_and_above",
    hateSpeech: "block_medium_and_above",
    sexuallyExplicit: "block_medium_and_above",
    dangerous: "block_medium_and_above"
  }
};

/**
 * Client for interacting with the Gemini API
 */
class GeminiClient {
  private static instance: GeminiClient;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private apiKey: string | null = null;
  private settings: ModelSettings = {
    model: "gemini-1.5-flash-latest",
    temperature: 0.7,
    thinkingMode: "off",
    topP: 1,
    topK: 1,
    maxOutputTokens: 8192, // Increased for longer conversations
    safetySettings: {
      harassment: "BLOCK_NONE",
      hateSpeech: "BLOCK_NONE",
      sexuallyExplicit: "BLOCK_NONE",
      dangerous: "BLOCK_NONE",
    },
    stopSequences: [],
  };

  private constructor() {
    // In a Vite project, environment variables are exposed on `import.meta.env`
    // and must be prefixed with VITE_ to be accessible in the client.
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
    console.log("GeminiClient: Constructor called");

    // Try to load settings from localStorage
    const savedSettings = localStorage.getItem("geminiModelSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        this.settings = { ...this.settings, ...parsedSettings };
        console.log(`GeminiClient: Loaded settings from localStorage, using model: ${this.settings.model}`);
      } catch (e) {
        console.error("GeminiClient: Failed to parse saved model settings:", e);
      }
    }

    if (!this.apiKey) {
      console.error(
        "GeminiClient: API key is not defined. Please set VITE_GEMINI_API_KEY environment variable."
      );
      // Fallback to a dummy object to avoid crashing the app
      this.genAI = {} as GoogleGenerativeAI;
      this.model = {} as GenerativeModel;
      return;
    }
    
    console.log(`GeminiClient: API key available: ${!!this.apiKey} Length: ${this.apiKey?.length}`);

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      console.log(`GeminiClient: Using model settings: ${this.settings.model} with temperature: ${this.settings.temperature}`);
      
      this.model = this.genAI.getGenerativeModel({
        model: this.settings.model,
        // System prompt is now passed when starting a chat session
      });
      console.log("GeminiClient: Initializing GoogleGenAI model");

    } catch (error) {
      console.error("GeminiClient: Error initializing GoogleGenAI:", error);
      this.genAI = {} as GoogleGenerativeAI;
      this.model = {} as GenerativeModel;
    }
  }

  public static getInstance(): GeminiClient {
    if (!this.instance) {
      console.log("GeminiClient: Creating singleton instance");
      this.instance = new GeminiClient();
      console.log("GeminiClient: Singleton instance created successfully");
    }
    return this.instance;
  }

  /**
   * Starts a new stateful chat session with the sales analysis system prompt.
   * This session will maintain conversation history.
   * @param notes Optional notes data to include in the system prompt
   */
  public startSalesAnalysisChat(details: CallDetails, notes: {
    markdown?: string;
    checklist?: Array<{id: string; label: string; completed: boolean}>;
    questions?: Array<{id: number; text: string}>;
  }, userProfile: UserProfile): ChatSession {
    if (!this.model) {
      throw new Error("Gemini model is not initialized.");
    }
    
    console.log("GeminiClient: Starting stateful sales analysis chat session...");
    
    // Use the notes-enhanced system prompt if notes are provided
    const systemPrompt = notes 
      ? generateSystemPromptWithNotes(details, notes, userProfile)
      : salesCallAnalysisSystemPrompt;
    
    if (notes) {
      console.log("GeminiClient: Including user notes in system prompt");
    }
    
    return this.model.startChat({
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: this.settings.temperature,
      } as GenerationConfig,
      history: [],
    });
  }
  
  /**
   * Sends a message within an existing stateful chat session.
   */
  public async sendMessageInSession(session: ChatSession, message: string): Promise<string> {
    try {
      console.log("GeminiClient: Sending message in existing session:", message.substring(0, 100));
      const result = await session.sendMessage(message);
      const response = result.response;
      const text = response.text();
      console.log("GeminiClient: Received stateful response from API.");
      return text;
    } catch (error) {
       console.error("GeminiClient: Error sending stateful message:", error);
      return JSON.stringify({ 
        error: "Failed to get response from Gemini API in session",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Sends a one-off, stateless message. Used for things like the test chat window.
   */
  public async sendStatelessMessage(message: string): Promise<string> {
    if (!this.model || !this.model.startChat) {
      console.error("GeminiClient: Model is not initialized, cannot send message.");
      return JSON.stringify({ error: "Model not initialized" });
    }
    
    try {
      console.log("GeminiClient: Starting stateless chat session...");
      const chat = this.model.startChat({
        history: [],
      });

      console.log("GeminiClient: Sending stateless message to API:", message);
      const result = await chat.sendMessage(message);
      const response = result.response;
      const text = response.text();
      
      console.log("GeminiClient: Received stateless response from API");
      return text;
    } catch (error) {
      console.error("GeminiClient: Error sending stateless message:", error);
      return JSON.stringify({ 
        error: "Failed to get response from Gemini API",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Get the current model settings
   */
  getSettings(): ModelSettings {
    return { ...this.settings };
  }
  
  /**
   * Update the model settings
   */
  updateSettings(newSettings: ModelSettings): void {
    console.log('GeminiClient: Updating settings to model:', newSettings.model);
    this.settings = { ...newSettings };
    localStorage.setItem("geminiModelSettings", JSON.stringify(this.settings));
    
    // Update the model instance with the new settings
    this.updateModelInstance();
  }
  
  /**
   * Update the model instance with current settings
   */
  private updateModelInstance(): void {
    if (this.genAI && this.apiKey) {
      console.log(`GeminiClient: Updating model instance to ${this.settings.model}`);
      this.model = this.genAI.getGenerativeModel({
        model: this.settings.model,
      });
    }
  }
  
  /**
   * Check if the client is properly initialized
   */
  isReady(): boolean {
    return !!this.model && !!this.genAI;
  }
}

export default GeminiClient.getInstance(); 