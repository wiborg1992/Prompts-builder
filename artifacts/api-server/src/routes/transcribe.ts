import { Router, type IRouter } from "express";
import { deepgram } from "../lib/deepgram-client";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/transcribe", async (req, res): Promise<void> => {
  try {
    const { audio, mimetype, provider = "deepgram", language = "en" } = req.body;

    if (!audio || typeof audio !== "string") {
      res.status(400).json({ error: "Missing audio data. Send base64-encoded audio in the 'audio' field." });
      return;
    }

    const audioBuffer = Buffer.from(audio, "base64");

    if (audioBuffer.length === 0) {
      res.status(400).json({ error: "Audio data is empty." });
      return;
    }

    let transcript = "";

    if (provider === "openai") {
      const blob = new Blob([audioBuffer], { type: mimetype || "audio/webm" });
      const file = new File([blob], "audio.webm", { type: mimetype || "audio/webm" });

      const result = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
        language: language === "da" ? "da" : "en",
      });
      transcript = result.text;
    } else {
      const response = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
        model: "nova-3",
        smartFormat: true,
        language: language === "da" ? "da" : "en",
      });

      const body = await response.body;
      transcript = body?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    }

    res.json({ transcript });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown transcription error";
    console.error("Transcription failed:", message);
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

export default router;
