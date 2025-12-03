import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";
import { BASE_SYSTEM_INSTRUCTION } from "../constants";

declare const process: any;

// Helper to sanitize and format context
const buildSystemInstruction = (contextData: string): string => {
  return `${BASE_SYSTEM_INSTRUCTION}\n\n${contextData || "(Belum ada data diunggah. Mohon unggah data peraturan/SOP di menu Data SDM.)"}`;
};

export class GeminiService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private currentContext: string = "";

  constructor() {
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
    // Gemini vision works best with PDF for documents. 
    // For general robustness, we treat input as PDF for vision extraction if not specified.
    
    const mimeType = fileOrBlob.type || 'application/pdf';

    // Basic validation (permissive for Drive blobs which might lack type sometimes)
    if (!mimeType.includes('pdf') && !mimeType.includes('image')) {
       // Allow execution to try, but warn.
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
                    text: "Bertindaklah sebagai OCR yang sangat akurat. Ekstrak seluruh teks dari dokumen ini secara verbatim (kata per kata). Jangan buat ringkasan. Keluarkan hanya teks mentahnya saja agar bisa disimpan ke database."
                }
            ]
        }
      });

      return response.text || "";
    } catch (error) {
      console.error("Extraction error:", error);
      throw error;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Split to get only base64 part, remove "data:application/pdf;base64," etc
        const base64 = result.split(',')[1]; 
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const geminiService = new GeminiService();