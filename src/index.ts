import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { Hono } from "hono";
import { env } from "hono/adapter";

const app = new Hono();

app.post("/face-recognition", async (c) => {
  const { imageSrc } = await c.req.json();

  if (!imageSrc) {
    return c.json({ success: false, error: "画像データが必要です" }, 400);
  }

  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = env<{
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
  }>(c);

  const rekognitionClient = new RekognitionClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const response = await rekognitionClient.send(
    new SearchFacesByImageCommand({
      CollectionId: process.env.PATIENT_FACES_BUCKET,
      Image: {
        Bytes: Buffer.from(imageSrc, "base64"),
      },
      MaxFaces: 1,
      FaceMatchThreshold: 95,
    })
  );

  const faceId = response.FaceMatches?.[0]?.Face?.FaceId;

  if (!faceId) {
    return c.json({ success: false, error: "一致する顔が見つかりません" }, 404);
  }

  return c.json({ success: true, faceId });
});

export default app;
