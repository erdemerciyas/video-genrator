import { GoogleGenAI } from "@google/genai";

export enum VideoResolution {
  R_720P = "720p",
  R_1080P = "1080p",
  R_4K = "4k"
}

export enum VideoAspectRatio {
  AR_16_9 = "16:9",
  AR_9_16 = "9:16"
}

export interface VideoGenerationParams {
  prompt: string;
  startImageBase64?: string;
  endImageBase64?: string;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
}

export async function generateFlowVideo({
  prompt,
  startImageBase64,
  endImageBase64,
  resolution,
  aspectRatio
}: VideoGenerationParams) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const config: any = {
    numberOfVideos: 1,
    resolution,
    aspectRatio,
    includeAudio: false,
  };

  const getMimeType = (base64: string) => {
    const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    return match ? match[1] : "image/private";
  };

  if (endImageBase64) {
    config.lastFrame = {
      imageBytes: endImageBase64.split(",")[1] || endImageBase64,
      mimeType: getMimeType(endImageBase64) || "image/png",
    };
  }

  // Use Lite model for speed and lower cost
  const model = resolution === VideoResolution.R_4K ? "veo-3.1-generate-preview" : "veo-3.1-lite-generate-preview";

  let operation = await ai.models.generateVideos({
    model,
    prompt: `${prompt || "A cinematic transition between these two images"}. Strict: No music, no sound, purely visual animation.`,
    image: startImageBase64 ? {
      imageBytes: startImageBase64.split(",")[1] || startImageBase64,
      mimeType: getMimeType(startImageBase64) || "image/png",
    } : undefined,
    config,
  });

  return operation;
}

export async function pollVideoOperation(operationId: any) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
    return await ai.operations.getVideosOperation({ operation: operationId });
}

export async function fetchVideoData(uri: string) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    const response = await fetch(uri, {
        method: 'GET',
        headers: {
            'x-goog-api-key': apiKey!,
        },
    });
    if (!response.ok) throw new Error("Failed to fetch video data");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}
