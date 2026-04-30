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
  startFileUri?: string;
  startMimeType?: string;
  endFileUri?: string;
  endMimeType?: string;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  includeAudio?: boolean;
}

export async function uploadImage(imageBase64: string): Promise<{ uri: string, mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  const base64Data = imageBase64.split(",")[1] || imageBase64;
  
  const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType = match ? match[1] : "image/png";

  const response = await (ai.files as any).upload({
    file: {
      data: base64Data,
      mimeType: mimeType
    }
  });

  const uri = (response as any).uri || (response as any).file?.uri || (response as any).name;
  return { uri, mimeType };
}

export async function generateFlowVideo({
  prompt,
  startImageBase64,
  endImageBase64,
  startFileUri,
  startMimeType,
  endFileUri,
  endMimeType,
  resolution,
  aspectRatio,
  includeAudio = false
}: VideoGenerationParams) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const config: any = {
    numberOfVideos: 1,
    resolution,
    aspectRatio,
    includeAudio: includeAudio,
  };

  const getMimeType = (base64: string) => {
    const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    return match ? match[1] : "image/png";
  };

  // Set last frame (end image)
  if (endFileUri) {
    config.lastFrame = { fileUri: endFileUri, mimeType: endMimeType || "image/png" };
  } else if (endImageBase64) {
    config.lastFrame = {
      imageBytes: endImageBase64.split(",")[1] || endImageBase64,
      mimeType: getMimeType(endImageBase64),
    };
  }

  // Use Lite model for speed and lower cost
  const model = resolution === VideoResolution.R_4K ? "veo-3.1-generate-preview" : "veo-3.1-lite-generate-preview";

  // Determine start image
  let imagePart: any = undefined;
  if (startFileUri) {
    imagePart = { fileUri: startFileUri, mimeType: startMimeType || "image/png" };
  } else if (startImageBase64) {
    imagePart = {
      imageBytes: startImageBase64.split(",")[1] || startImageBase64,
      mimeType: getMimeType(startImageBase64),
    };
  }

  let operation = await ai.models.generateVideos({
    model,
    prompt: prompt || "A cinematic transition between these two images",
    image: imagePart,
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
