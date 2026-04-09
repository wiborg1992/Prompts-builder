import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { openai } from "@workspace/integrations-openai-ai-server";

interface TranscriptionConfig {
  provider: "deepgram" | "openai";
  language: string;
}

export function setupLiveTranscription(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/transcribe" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected");
    let config: TranscriptionConfig = { provider: "deepgram", language: "en" };
    let deepgramWs: WebSocket | null = null;
    let audioChunks: Buffer[] = [];
    let openaiTimer: ReturnType<typeof setInterval> | null = null;
    let deepgramReady = false;
    let pendingAudio: Buffer[] = [];

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
              deepgramReady = false;
              pendingAudio = [];
              startDeepgramStream(ws, config, (dgWs) => {
                deepgramWs = dgWs;
              }, () => {
                deepgramReady = true;
                for (const chunk of pendingAudio) {
                  if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
                    deepgramWs.send(chunk);
                  }
                }
                pendingAudio = [];
              });
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
            console.log("[WS] Stop received");
            if (deepgramWs) {
              try {
                deepgramWs.close();
              } catch {}
              deepgramWs = null;
              deepgramReady = false;
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
            console.log("[WS] Stopped sent");
            return;
          }
        } catch {
          // Not JSON, treat as binary
        }
      }

      const audioData = typeof data === "string" ? Buffer.from(data) : data;

      if (config.provider === "deepgram") {
        if (deepgramReady && deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(audioData);
        } else if (!deepgramReady) {
          pendingAudio.push(Buffer.from(audioData));
        }
      } else if (config.provider === "openai") {
        audioChunks.push(Buffer.from(audioData));
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
      if (deepgramWs) {
        try { deepgramWs.close(); } catch {}
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
  onConnection: (ws: WebSocket) => void,
  onReady: () => void
) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    clientWs.send(JSON.stringify({ type: "error", message: "Deepgram API key not configured" }));
    return;
  }

  const lang = config.language === "da" ? "da" : "en";
  const params = new URLSearchParams({
    model: "nova-3",
    language: lang,
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    interim_results: "true",
    utterance_end_ms: "1000",
    endpointing: "300",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
    no_delay: "true",
  });

  const dgUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  console.log("[Deepgram] Connecting...");

  const dgWs = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  onConnection(dgWs);

  dgWs.on("open", () => {
    console.log("[Deepgram] Connected and ready");
    clientWs.send(JSON.stringify({ type: "dg_connected" }));
    onReady();
  });

  dgWs.on("message", (data: Buffer) => {
    try {
      const response = JSON.parse(data.toString());
      if (response.type === "Results") {
        const alt = response.channel?.alternatives?.[0];
        const transcript = alt?.transcript;
        if (transcript) {
          const isFinal = response.is_final === true;
          const speechFinal = response.speech_final === true;
          clientWs.send(JSON.stringify({
            type: "transcript",
            text: transcript,
            isFinal: isFinal && speechFinal,
          }));
        }
      }
    } catch {
      // Ignore non-JSON messages
    }
  });

  dgWs.on("error", (err) => {
    console.error("[Deepgram] WebSocket error:", err.message);
    clientWs.send(JSON.stringify({ type: "error", message: `Deepgram error: ${err.message}` }));
  });

  dgWs.on("close", (code, reason) => {
    console.log(`[Deepgram] Disconnected: ${code} ${reason}`);
    clientWs.send(JSON.stringify({ type: "dg_disconnected" }));
  });
}
