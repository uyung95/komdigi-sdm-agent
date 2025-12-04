import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";
import { BASE_SYSTEM_INSTRUCTION } from "../constants";

// Helper to sanitize and format context
const buildSystemInstruction = (contextData: string): string => {
  return `${BASE_SYSTEM_INSTRUCTION}\n\n${contextData || "(Belum ada data diunggah. Mohon unggah data peraturan/SOP di menu Log.)"}`;
};

export class GeminiService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private currentContext: string = "";

  constructor() {
    // The API key is injected by Vite's `define` config during build/dev
    // It maps VITE_API_KEY from the environment to process.env.API_KEY here
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Initializes or resets the chat session with the provided context (documents).
   */
  public initChat(contextData: string, history: Message[]) {
    this.currentContext = contextData;
    
    // Convert app history format to Gemini history format if needed
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    this.chatSession = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      history: formattedHistory,
      config: {
        systemInstruction: buildSystemInstruction(this.currentContext),
        temperature: 0.3, // Low temperature for factual consistency based on context
      },
    });
  }

  public async sendMessageStream(message: string, contextData: string, currentHistory: Message[]): Promise<AsyncIterable<string>> {
    // If context changed or session is null, re-init
    if (!this.chatSession || contextData !== this.currentContext) {
      this.initChat(contextData, currentHistory);
    }

    if (!this.chatSession) {
      throw new Error("Gagal menginisialisasi sesi chat.");
    }

    try {
      const result = await this.chatSession.sendMessageStream({ message });
      
      return {
        [Symbol.asyncIterator]: async function* () {
          for await (const chunk of result) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
              yield c.text;
            }
          }
        }
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  /**
   * Extracts text content from a file/blob using Gemini's multimodal capabilities.
   * Supports PDF and Images.
   */
  public async extractDocumentContent(fileOrBlob: File | Blob): Promise<string> {
    const validMimeTypes = ['application/pdf'];
    const mimeType = fileOrBlob.type || 'application/pdf';

    // Basic validation (permissive for Drive blobs which might lack type sometimes)
    if (!mimeType.includes('pdf') && !mimeType.includes('image')) {
       console.warn("Mime type might not be optimal for vision:", mimeType);
    }

    try {
      const base64Data = await this.blobToBase64(fileOrBlob);
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'application/pdf', // Force treat as PDF for document extraction consistency
                        data: base64Data
                    }
                },
                {
                    text: "Bertindaklah sebagai OCR yang sangat akurat. Ekstrak seluruh teks dari dokumen ini secara verbatim (kata per kata). Jangan buat ringkasan. Keluarkan hanya teks mentahnya saja agar bisa disimpan ke database"
                }
            ]
        }
      });
      
      return response.text || "";
    } catch (error) {
      console.error("Extraction Error:", error);
      return `Error extracting text: ${error}`;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const geminiService = new GeminiService();