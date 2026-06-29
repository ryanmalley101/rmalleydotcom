import { defineFunction } from '@aws-amplify/backend';

export const suggestPhotoTagsFunction = defineFunction({
    name: 'suggest-photo-tags',
    entry: './handler.ts',
    timeoutSeconds: 30,
    environment: {
        MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    },
});
