
import { GoogleGenAI, Type } from "@google/genai";

export interface LabelExtractionResult {
  amazonRef: string | null;
  packageInfo: string | null;
}

const MODEL_NAME = 'gemini-3-flash-preview';

export const extractLabelDetails = async (base64Image: string): Promise<LabelExtractionResult> => {
  const base64Data = base64Image.split(',')[1] || base64Image;
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
            text: "Extract shipping label data. The label might be rotated 90/180/270 degrees. 1) Find the Amazon Ref (FBA... or similar ID). 2) Find the package count (e.g. '1/2', '1 of 2', 'Pkg 1'). Look for any two numbers indicating sequence. Return JSON only.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amazonRef: { type: Type.STRING },
            packageInfo: { type: Type.STRING, description: "Normalized as X/Y" },
          },
          required: ["amazonRef", "packageInfo"]
        },
        temperature: 0.1,
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return { amazonRef: null, packageInfo: null };
  }
};

export const extractMuelleDataFromImage = async (base64Image: string): Promise<{ amazonRef: string; orderNumber: string }[]> => {
  const base64Data = base64Image.split(',')[1] || base64Image;
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
            text: "Extract 'Nº.PEDIDO' and 'REF. CLIENTE' from this list. Return JSON array.",
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
              orderNumber: { type: Type.STRING },
              amazonRef: { type: Type.STRING },
            },
            required: ["orderNumber", "amazonRef"],
          },
        },
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini Muelle Extraction Error:", error);
    return [];
  }
};
