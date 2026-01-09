
import { GoogleGenAI } from "@google/genai";

/**
 * SERVICIO DESACTIVADO POR PETICIÓN DEL USUARIO (EVITAR COSTES)
 * Cumple con las guías de @google/genai por si se decide activar.
 */
export const extractRefWithVision = async (base64Image: string): Promise<string | null> => {
  console.warn("Gemini Vision está desactivado por configuración de ahorro.");
  
  // Ejemplo de implementación siguiendo guías:
  /*
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
        { text: "Extract the Amazon Reference (like FBA... or X00...) from this label. Return ONLY the reference string." }
      ]
    }
  });
  return response.text || null;
  */

  return null;
};
