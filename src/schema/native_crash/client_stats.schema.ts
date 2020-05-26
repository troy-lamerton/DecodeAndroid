import { JSONSchema6Definition } from 'json-schema';

export const clientStatsSchema: JSONSchema6Definition = {
    type: 'object',
    properties: {
        client_commit: {
            type: 'string',
        },
    },
    required: ['client_commit'],
    additionalProperties: true,
};
