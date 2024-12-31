import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

app.post("/face-recognition", async (c) => {
  try {
    const { base64Data } = await c.req.json();

    if (!base64Data || typeof base64Data !== "string") {
      return c.json(
        { success: false, error: "有効な画像データが必要です" },
        400
      );
    }

    const {
      AWS_REGION,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      PATIENT_FACES_BUCKET,
    } = env<{
      AWS_REGION: string;
      AWS_ACCESS_KEY_ID: string;
      AWS_SECRET_ACCESS_KEY: string;
      PATIENT_FACES_BUCKET: string;
    }>(c);

    // Validate environment variables
    if (
      !AWS_REGION ||
      !AWS_ACCESS_KEY_ID ||
      !AWS_SECRET_ACCESS_KEY ||
      !PATIENT_FACES_BUCKET
    ) {
      console.error("Missing required environment variables");
      return c.json({ success: false, error: "サーバー設定エラー" }, 500);
    }

    const rekognitionClient = new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const response = await rekognitionClient.send(
      new SearchFacesByImageCommand({
        CollectionId: PATIENT_FACES_BUCKET,
        Image: {
          Bytes: bytes,
        },
        MaxFaces: 1,
        FaceMatchThreshold: 95,
      })
    );

    const faceId = response.FaceMatches?.[0]?.Face?.FaceId;

    if (!faceId) {
      return c.json(
        { success: false, error: "一致する顔が見つかりません" },
        404
      );
    }

    return c.json({ success: true, faceId });
  } catch (error) {
    console.error("Face recognition error:", error);
    if (
      error instanceof Error &&
      error.name === "InvalidImageFormatException"
    ) {
      return c.json(
        { success: false, error: "無効な画像フォーマットです" },
        400
      );
    }
    return c.json(
      { success: false, error: "顔認識処理中にエラーが発生しました" },
      500
    );
  }
});

export default app;
