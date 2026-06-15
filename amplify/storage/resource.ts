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
    }),
});
