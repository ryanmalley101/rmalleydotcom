import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Jimp } from 'jimp';
import type { Schema } from '../../data/resource';
import { AI_VISION_TAGS, AI_VISION_TAG_DESCRIPTIONS } from '../../../lib/aestheticTags';

const s3 = new S3Client();
const bedrock = new BedrockRuntimeClient();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

// Bedrock caps vision input at 5MB and Anthropic's own guidance gets no
// quality benefit past ~1568px on the long edge — original uploads (phone
// photos especially) routinely exceed both, so always downscale + re-encode
// as JPEG rather than passing the original bytes through.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 82;

// Claude Haiku 4.5 on Bedrock: $1 / $5 per million input/output tokens —
// expressed as micro-dollars per token so the running daily total can be
// an integer in DynamoDB (1 input token = 1 micro, 1 output token = 5 micros).
const INPUT_MICROS_PER_TOKEN = 1;
const OUTPUT_MICROS_PER_TOKEN = 5;
const DAILY_BUDGET_MICROS = Number(process.env.DAILY_BUDGET_MICROS ?? 3_000_000);

function todayKey(): string {
    return new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

// Each tag is paired with the concrete visual evidence that justifies it, so
// the model checks the image against a checklist instead of guessing from
// the bare word — see lib/aestheticTags.ts for why these are framed as
// visual primitives (layout, lighting, color histogram, texture, material)
// rather than subjective style words.
const TAG_CHECKLIST = AI_VISION_TAGS
    .map(tag => `- ${tag}: ${AI_VISION_TAG_DESCRIPTIONS[tag]}`)
    .join('\n');

// Persistent role + glossary + output contract — lives in the Bedrock
// `system` field so it's treated as standing instructions, separate from
// the per-request user turn below (which carries just the image).
const SYSTEM_PROMPT = `You are a computer vision system tagging home decor / interior design photos. Each candidate tag below is defined by concrete visual evidence — check the image against that evidence, don't rely on a general impression.

${TAG_CHECKLIST}

When given a photo, choose up to 12 tags total whose evidence is clearly present, drawing from multiple categories where relevant (layout, design archetype, lighting, color, texture, material) rather than only one. Respond with ONLY a JSON array of the exact tag strings, e.g. ["open-concept","warm-toned","natural wood"]. Do not include any other text.`;

export const handler: Schema['suggestPhotoTags']['functionHandler'] = async (event) => {
    const { storageKey } = event.arguments;
    const date = todayKey();

    const usageSoFar = await ddb.send(new GetCommand({
        TableName: process.env.AI_USAGE_TABLE_NAME,
        Key: { date },
    }));
    const spentMicros = usageSoFar.Item?.costMicros ?? 0;
    if (spentMicros >= DAILY_BUDGET_MICROS) {
        throw new Error(`Daily AI tagging budget of $${(DAILY_BUDGET_MICROS / 1_000_000).toFixed(2)} reached — try again tomorrow.`);
    }

    const object = await s3.send(new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: storageKey,
    }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return [];

    const image = await Jimp.read(Buffer.from(bytes));
    if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
        image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
    }
    const jpegBuffer = await image.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
    const base64 = jpegBuffer.toString('base64');

    const response = await bedrock.send(new InvokeModelCommand({
        modelId: process.env.MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 200,
            system: SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
                    { type: 'text', text: 'Tag this photo per the system prompt.' },
                ],
            }],
        }),
    }));

    const parsed = JSON.parse(Buffer.from(response.body).toString());

    const usage = parsed.usage ?? {};
    const callMicros = (usage.input_tokens ?? 0) * INPUT_MICROS_PER_TOKEN
        + (usage.output_tokens ?? 0) * OUTPUT_MICROS_PER_TOKEN;
    await ddb.send(new UpdateCommand({
        TableName: process.env.AI_USAGE_TABLE_NAME,
        Key: { date },
        UpdateExpression: 'ADD costMicros :inc',
        ExpressionAttributeValues: { ':inc': callMicros },
    }));

    const text: string = parsed.content?.[0]?.text ?? '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();

    let suggested: unknown;
    try {
        suggested = JSON.parse(cleaned);
    } catch {
        return [];
    }
    if (!Array.isArray(suggested)) return [];

    return suggested.filter((tag): tag is string =>
        typeof tag === 'string' && AI_VISION_TAGS.includes(tag)
    );
};
