import { JSONSchema4 } from 'json-schema';
import { IncomingMessage } from 'http';

export enum BuildEnvironmentE {
    prod = 'prod',
    test = 'test',
    debug = 'debug',
}

export const anyString: JSONSchema4 = { type: 'string' };

export const stringValue = (minLength: number = 1): JSONSchema4 => ({
    type: 'string',
    minLength,
});

/**
 * commit hash
 * @example abcdef00
 * @example a123b123c123
 */
export type CommitSha = string;
const commitSha: JSONSchema4 = {
    type: 'string',
    pattern: /^[a-z0-9]+$/.source,
    minLength: 8,
    maxLength: 64,
};

const bodySchema: JSONSchema4 = {
    $ref: '#/definitions/V2ExampleReport',
    definitions: {
        V2ExampleReport: {
            type: 'object',
            additionalProperties: true,
            properties: {
                index: {
                    type: 'string',
                    enum: Object.values(BuildEnvironmentE),
                },
                platform: stringValue(),
                client_stats: {
                    $ref: '#/definitions/ClientStats',
                },
                report_contents: stringValue(100),
                unity_build_id: stringValue(),
            },
            required: [
                'index',
                'platform',
                'client_stats',
                'report_contents',
                'unity_build_id',
            ],
        },
        ClientStats: {
            type: 'object',
            additionalProperties: true,
            properties: {
                person_id: { type: 'string' },
                client_commit: commitSha,
                client_version: stringValue(),
            },
            required: ['person_id', 'client_commit', 'client_version'],
        },
    },
};

// todo: consider refactoring to an enum (warning: many usages)
export type UnityPlatform =
    | 'OSXPlayer'
    | 'OSXEditor'
    | 'WindowsPlayer'
    | 'WindowsEditor'
    | 'IPhonePlayer'
    | 'Android'
    | 'LinuxPlayer'
    | 'LinuxEditor'
    | 'WebGLPlayer'
    | 'WSAPlayerX86'
    | 'WSAPlayerX64'
    | 'WSAPlayerARM'
    | 'PS4'
    | 'XboxOne'
    | 'tvOS'
    | 'Switch';

export interface CrashReportV2Body {
    index: BuildEnvironmentE;
    client_stats: ClientStats;
    report_contents: string;
    unity_build_id: string;

    // UnityEngine.Application.platform;
    platform: UnityPlatform;
}

export interface ClientStats {
    person_id: string;
    client_commit: CommitSha;
    client_version: string;
}
