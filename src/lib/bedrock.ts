import { BedrockRuntimeClient, ConverseCommand, type Message } from "@aws-sdk/client-bedrock-runtime";

// Klien Amazon Bedrock. Autentikasi memakai AWS_BEARER_TOKEN_BEDROCK (API key Bedrock)
// yang dibaca otomatis oleh AWS SDK, atau kredensial AWS biasa jika tersedia.
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-3-5-haiku-20241022-v1:0";

export type ChatTurn = { role: "user" | "assistant"; text: string };

// Mengirim percakapan ke model lewat Converse API.
// system berisi instruksi dan konteks data. history berisi riwayat chat.
export async function askBedrock(system: string, history: ChatTurn[]): Promise<string> {
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK && !process.env.AWS_ACCESS_KEY_ID) {
    return "Layanan AI belum dikonfigurasi. Hubungi admin untuk mengatur API key Amazon Bedrock.";
  }

  // Converse mewajibkan giliran pertama dari user, jadi buang pesan assistant di awal.
  // Hanya 10 giliran terakhir yang dikirim agar biaya token tetap terkendali.
  const trimmed = history.slice(-10);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  const messages: Message[] = trimmed.map((t) => ({ role: t.role, content: [{ text: t.text }] }));

  if (messages.length === 0) return "Silakan tulis pertanyaan Anda.";

  try {
    const res = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: system }],
        messages,
        // Temperatur rendah agar jawaban angka tidak mengarang
        inferenceConfig: { maxTokens: 800, temperature: 0.2 },
      }),
    );
    const text = res.output?.message?.content?.map((c) => c.text ?? "").join("").trim();
    return text || "Maaf, model tidak memberikan jawaban.";
  } catch (e) {
    console.error("Bedrock error:", e);
    return "Maaf, layanan AI sedang tidak tersedia. Coba lagi beberapa saat.";
  }
}
