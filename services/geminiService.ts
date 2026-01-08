
import { GoogleGenAI, Type } from "@google/genai";

export interface LabelExtractionResult {
  amazonRef: string | null;
  packageInfo: string | null;
}

// Recommended model for general extraction tasks
const MODEL_NAME = 'gemini-3-flash-preview';

export const extractLabelDetails = async (base64Image: string): Promise<LabelExtractionResult> => {
  const base64Data = base64Image.split(',')[1] || base64Image;
  // Initialize right before call to ensure up-to-date config if necessary
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: "Analyze this Amazon shipping label. Extract: 1) The Amazon Reference (usually starts with FBA or similar, or found in DataMatrix). 2) The package count/index (e.g., '1/2', '2/2', '1/1'). Return only as JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amazonRef: { type: Type.STRING, description: "The FBA or Amazon reference ID" },
            packageInfo: { type: Type.STRING, description: "The package indicator like 1/1 or 1/2" },
          },
          required: ["amazonRef", "packageInfo"]
        },
        temperature: 0.1,
      }
    });

    // Access .text property directly as per SDK guidelines
    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return { amazonRef: null, packageInfo: null };
  }
};

export const extractMuelleDataFromImage = async (base64Image: string): Promise<{ amazonRef: string; orderNumber: string }[]> => {
  const base64Data = base64Image.split(',')[1] || base64Image;
  // Initialize right before call as recommended
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: "This is a logistics document called 'LISTADO DE RUTA DE CAMIONES'. Extract the table data. Focus on 'Nº.PEDIDO' (Order Number) and 'REF. CLIENTE' (Amazon Reference). Return the data as a JSON array of objects with keys 'orderNumber' and 'amazonRef'.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              orderNumber: { type: Type.STRING, description: "The internal order number" },
              amazonRef: { type: Type.STRING, description: "The Amazon reference" },
            },
            required: ["orderNumber", "amazonRef"],
          },
        },
      }
    });

    // Access .text property directly
    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini Muelle Extraction Error:", error);
    return [];
  }
};
