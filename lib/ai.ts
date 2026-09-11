import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const doomPredictionSchema = z.object({
  prophecy: z.string().min(1),
  objectName: z.string().min(1),
  shortDescription: z.string().min(1),
  causeOfDeath: z.string().min(1),
  timeUntilDoom: z.string().min(1),
  lastWords: z.string().min(1),
  funeralNote: z.string().min(1),
  visualEvidence: z.array(z.string().min(1)).min(2).max(5),
  confidence: z.number().min(0).max(100),
  suggestedDoomScore: z.number().min(0).max(100),
});

export type DoomPrediction = z.infer<typeof doomPredictionSchema>;
export const doomTones = ["dark", "savage", "existential", "corporate"] as const;
export type DoomTone = (typeof doomTones)[number];

const systemPrompt = `You are the Object Doom Predictor: a completely serious doom analyst whose confidence is wildly disproportionate to the evidence. You are writing fictional entertainment, not claiming to see or predict the actual future.

Perform a visual autopsy before writing. Identify the object, apparent age, color, condition, wear, scratches, cracks, stains, dirt, dents, missing parts, fraying, readable brand or logo, surrounding environment, nearby objects, hazards, signs of neglect, and how the object appears to be used. Only report details genuinely visible in the image. If text or a brand is blurry, do not guess it. Record 2-5 short factual observations in visualEvidence; these observations must directly influence the doom scenario.

Build a connected comedy story from the evidence. The prophecy is the main 2-4 sentence forecast, causeOfDeath is the concrete failure, timeUntilDoom is a plausible human-readable estimate, lastWords is a short line the object would say, and funeralNote is a brief deadpan eulogy. Make the fate specific, surprising, and mundane enough to feel inevitable. Vary the mechanism: gradual deterioration, negligence, environmental damage, obsolescence, replacement, abandonment, misuse, disappearance, or a completely absurd but visually plausible mishap. Do not default to coffee, dropping, Monday, existential crisis, or accidental breakage unless the image clearly earns it.

Your voice is dark, dry, witty, sarcastic, occasionally absurd, and slightly cruel toward the object. Never target a person or protected class. Avoid gore, threats, sexual content, and generic filler such as "it will break someday."

Tone rules:
- dark: morbidly amused, understated, and bleak
- savage: brutally sarcastic, insulting the object's design and choices
- existential: philosophical, nihilistic, and absurd without becoming vague
- corporate: an incident report, performance review, and restructuring memo disguised as a eulogy

The confidence score measures visual certainty, not comedic quality. The doom score measures visible danger, fragility, deterioration, age, environmental risk, and apparent usage: 0-20 basically immortal, 21-40 mostly safe, 41-60 concerning, 61-80 questionable future, 81-95 rapidly approaching doom, 96-100 living on borrowed time. Use the full range and do not cluster scores around 50.`;

function getGoogleAI(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
}

function getImageData(image: string | Buffer): { data: string; mimeType: string } {
  if (Buffer.isBuffer(image)) {
    return { data: image.toString("base64"), mimeType: "image/jpeg" };
  }

  const trimmedImage = image.trim();
  const dataUrlMatch = trimmedImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] };
  }

  return { data: trimmedImage, mimeType: "image/jpeg" };
}

export async function generateDoomPrediction(
  image: string | Buffer,
  tone: DoomTone = "dark",
): Promise<DoomPrediction> {
  const imageData = getImageData(image);
  const normalizedTone = tone;
  const response = await getGoogleAI().models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: imageData,
          },
          {
            text: `Inspect this object and return its doom prediction. Use the ${normalizedTone} tone:
- dark: bleak, understated, and morbidly amused
- savage: sharper, more ruthless, and personally unimpressed
- existential: philosophical, bleak, and absurd
- corporate: polished workplace language hiding total inevitability`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prophecy: { type: Type.STRING },
          objectName: { type: Type.STRING },
          shortDescription: { type: Type.STRING },
          causeOfDeath: { type: Type.STRING },
          timeUntilDoom: { type: Type.STRING },
          lastWords: { type: Type.STRING },
          funeralNote: { type: Type.STRING },
          visualEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER },
          suggestedDoomScore: { type: Type.NUMBER },
        },
        required: [
          "prophecy",
          "objectName",
          "shortDescription",
          "causeOfDeath",
          "timeUntilDoom",
          "lastWords",
          "funeralNote",
          "visualEvidence",
          "confidence",
          "suggestedDoomScore",
        ],
      },
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error("Google Gemini returned an empty prediction");
  }

  const parsedPrediction = doomPredictionSchema.parse(JSON.parse(content));
  return {
    ...parsedPrediction,
    confidence:
      parsedPrediction.confidence <= 1 ? parsedPrediction.confidence * 100 : parsedPrediction.confidence,
    suggestedDoomScore:
      parsedPrediction.suggestedDoomScore <= 1
        ? parsedPrediction.suggestedDoomScore * 100
        : parsedPrediction.suggestedDoomScore,
  };
}
