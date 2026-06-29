import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Schema } from '../../data/resource';
import { AI_VISION_TAGS, AI_VISION_TAG_DESCRIPTIONS } from '../../../lib/aestheticTags';

const s3 = new S3Client();
const bedrock = new BedrockRuntimeClient();

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

When given a photo, choose up to 8 tags total whose evidence is clearly present, drawing from multiple categories where relevant (layout, design archetype, lighting, color, texture, material) rather than only one. Respond with ONLY a JSON array of the exact tag strings, e.g. ["open-concept","warm-toned","natural wood"]. Do not include any other text.`;

export const handler: Schema['suggestPhotoTags']['functionHandler'] = async (event) => {
    const { storageKey } = event.arguments;

    const object = await s3.send(new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: storageKey,
    }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return [];
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = object.ContentType ?? 'image/jpeg';

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
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                    { type: 'text', text: 'Tag this photo per the system prompt.' },
                ],
            }],
        }),
    }));

    const parsed = JSON.parse(Buffer.from(response.body).toString());
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
