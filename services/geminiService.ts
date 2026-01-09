
import { GoogleGenAI } from "@google/genai";

/**
 * Utiliza Gemini Vision con un prompt ultra-específico para logística de Amazon/UPS.
 */
export const extractRefWithVision = async (base64Image: string): Promise<string | null> => {
  try {
    // Inicializamos dentro de la función para asegurar que el entorno esté listo
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              text: `Analiza esta sección de una etiqueta de UPS. 
              TU OBJETIVO: Extraer el valor del campo "Reference 1" o "REF 1".
              
              INSTRUCCIONES CRÍTICAS:
              1. Busca palabras clave: "Reference No. 1", "REF 1:", "Ref 1", "Reference 1".
              2. El valor suele ser una Referencia de Amazon (ej: FBA15H8S9J, 1A2B3C4D5E, o códigos similares).
              3. Si ves varios códigos, prioriza el que empiece por "FBA" o el que tenga entre 8 y 14 caracteres alfanuméricos.
              4. RESPONDE ÚNICAMENTE EL CÓDIGO. No digas "El código es...", no des explicaciones.
              5. Si no hay nada, responde "NULL".`
            }
          ],
        },
      ],
      config: {
        temperature: 0.1,
        topP: 0.1,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const result = response.text?.trim().toUpperCase();
    if (!result || result.includes('NULL') || result.length < 3) return null;
    
    return result.replace(/^(REF|REFERENCE|REF1|REF\s1|:)\s*/, '').trim();
  } catch (error) {
    console.error("Error en Gemini Vision:", error);
    return null;
  }
};
