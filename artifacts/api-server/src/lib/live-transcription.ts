import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { deepgram } from "./deepgram-client";
import { openai } from "@workspace/integrations-openai-ai-server";

interface TranscriptionConfig {
  provider: "deepgram" | "openai";
  language: string;
}

export function setupLiveTranscription(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/transcribe" });

  wss.on("connection", (ws: WebSocket) => {
    let config: TranscriptionConfig = { provider: "deepgram", language: "en" };
    let deepgramWs: WebSocket | null = null;
    let audioChunks: Buffer[] = [];
    let openaiTimer: ReturnType<typeof setInterval> | null = null;

    ws.on("message", async (data: Buffer | string) => {
      const strData = typeof data === "string" ? data : null;

      if (strData) {
        try {
          const msg = JSON.parse(strData);

          if (msg.type === "config") {
            config = {
              provider: msg.provider || "deepgram",
              language: msg.language || "en",
            };
            ws.send(JSON.stringify({ type: "config_ack", config }));
            return;
          }

          if (msg.type === "start") {
            if (config.provider === "deepgram") {
              startDeepgramStream(ws, config, (dgWs) => { deepgramWs = dgWs; });
            } else {
              audioChunks = [];
              openaiTimer = setInterval(async () => {
                if (audioChunks.length > 0) {
                  const combined = Buffer.concat(audioChunks);
                  audioChunks = [];
                  try {
                    const blob = new Blob([combined], { type: "audio/webm" });
                    const file = new File([blob], "chunk.webm", { type: "audio/webm" });
                    const result = await openai.audio.transcriptions.create({
                      model: "whisper-1",
                      file,
                      language: config.language === "da" ? "da" : "en",
                    });
                    if (result.text) {
                      ws.send(JSON.stringify({ type: "transcript", text: result.text, isFinal: true }));
                    }
                  } catch (err) {
                    console.error("OpenAI transcription chunk error:", err);
                  }
                }
              }, 5000);
            }
            ws.send(JSON.stringify({ type: "started" }));
            return;
          }

          if (msg.type === "stop") {
            if (deepgramWs) {
              deepgramWs.close();
              deepgramWs = null;
            }
            if (openaiTimer) {
              clearInterval(openaiTimer);
              openaiTimer = null;
              if (audioChunks.length > 0) {
                const combined = Buffer.concat(audioChunks);
                audioChunks = [];
                try {
                  const blob = new Blob([combined], { type: "audio/webm" });
                  const file = new File([blob], "chunk.webm", { type: "audio/webm" });
                  const result = await openai.audio.transcriptions.create({
                    model: "whisper-1",
                    file,
                    language: config.language === "da" ? "da" : "en",
                  });
                  if (result.text) {
                    ws.send(JSON.stringify({ type: "transcript", text: result.text, isFinal: true }));
                  }
                } catch (err) {
                  console.error("OpenAI final chunk error:", err);
                }
              }
            }
            ws.send(JSON.stringify({ type: "stopped" }));
            return;
          }
        } catch {
          // Not JSON, treat as binary
        }
      }

      // Binary audio data
      const audioData = typeof data === "string" ? Buffer.from(data) : data;

      if (config.provider === "deepgram" && deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(audioData);
      } else if (config.provider === "openai") {
        audioChunks.push(Buffer.from(audioData));
      }
    });

    ws.on("close", () => {
      if (deepgramWs) {
        deepgramWs.close();
        deepgramWs = null;
      }
      if (openaiTimer) {
        clearInterval(openaiTimer);
        openaiTimer = null;
      }
    });
  });

  return wss;
}

function startDeepgramStream(
  clientWs: WebSocket,
  config: TranscriptionConfig,
  onConnection: (ws: WebSocket) => void
) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    clientWs.send(JSON.stringify({ type: "error", message: "Deepgram API key not configured" }));
    return;
  }

  const dgUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=${config.language === "da" ? "da" : "en"}&encoding=linear16&sample_rate=16000&interim_results=true&utterance_end_ms=1000`;

  const dgWs = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  onConnection(dgWs);

  dgWs.on("open", () => {
    clientWs.send(JSON.stringify({ type: "dg_connected" }));
  });

  dgWs.on("message", (data: Buffer) => {
    try {
      const response = JSON.parse(data.toString());
      if (response.type === "Results") {
        const transcript = response.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          clientWs.send(JSON.stringify({
            type: "transcript",
            text: transcript,
            isFinal: response.is_final,
          }));
        }
      }
    } catch {
      // Ignore non-JSON messages
    }
  });

  dgWs.on("error", (err) => {
    console.error("Deepgram WebSocket error:", err);
    clientWs.send(JSON.stringify({ type: "error", message: "Deepgram connection error" }));
  });

  dgWs.on("close", () => {
    clientWs.send(JSON.stringify({ type: "dg_disconnected" }));
  });
}
