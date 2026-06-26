import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'wikiAssets',
    access: (allow) => ({
        'maps/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'portraits/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'wiki-covers/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'wiki-gallery/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'vtt-maps/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'vtt-tokens/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
        'session-music/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
    }),
});
