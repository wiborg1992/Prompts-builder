import { Router, type IRouter } from "express";
import { deepgram } from "../lib/deepgram-client";

const router: IRouter = Router();

router.post("/transcribe", async (req, res): Promise<void> => {
  try {
    const { audio, mimetype } = req.body;

    if (!audio || typeof audio !== "string") {
      res.status(400).json({ error: "Missing audio data. Send base64-encoded audio in the 'audio' field." });
      return;
    }

    const audioBuffer = Buffer.from(audio, "base64");

    if (audioBuffer.length === 0) {
      res.status(400).json({ error: "Audio data is empty." });
      return;
    }

    const response = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
      model: "nova-3",
      smartFormat: true,
    });

    const body = await response.body;
    const transcript =
      body?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    res.json({ transcript });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown transcription error";
    console.error("Transcription failed:", message);
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

export default router;
