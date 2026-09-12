import { NextResponse } from "next/server";
import { z } from "zod";

import { doomTones, generateDoomPrediction } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  image: z.string().trim().min(1, "image is required"),
  tone: z.enum(doomTones).default("dark"),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const prediction = await generateDoomPrediction(parsedBody.data.image, parsedBody.data.tone);

    const testUser = await prisma.user.upsert({
      where: { email: "doom-test-user@doomos.local" },
      update: {},
      create: {
        email: "doom-test-user@doomos.local",
        name: "DoomOS Test User",
      },
    });

    const object = await prisma.object.create({
      data: {
        userId: testUser.id,
        name: prediction.objectName,
        description: prediction.shortDescription,
        imageUrl: "uploaded-image",
        doomScore: prediction.suggestedDoomScore,
        predictions: {
          create: {
            prophecy: prediction.prophecy,
            causeOfDeath: prediction.causeOfDeath,
            timeUntilDoom: prediction.timeUntilDoom,
            lastWords: prediction.lastWords,
            funeralNote: prediction.funeralNote,
            tone: parsedBody.data.tone,
            confidence: prediction.confidence,
          },
        },
      },
    });

    return NextResponse.json({ ...prediction, objectId: object.id });
  } catch (error) {
    console.error("Doom prediction failed", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to generate a doom prediction";
    return NextResponse.json(
      { error: `Unable to generate a doom prediction: ${message}` },
      { status: 500 },
    );
  }
}
