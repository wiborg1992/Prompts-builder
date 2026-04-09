import { DeepgramClient } from "@deepgram/sdk";

if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error(
    "DEEPGRAM_API_KEY must be set. Please add your Deepgram API key as a secret.",
  );
}

export const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
