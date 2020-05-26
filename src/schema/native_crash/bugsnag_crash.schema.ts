import { JSONSchema4 } from 'json-schema';
import { anyString } from '../crashes_v2/crashes_v2.schema';

export type BugsnagStackFrame = {
    file: string;
    lineNumber: number;
    method?: string;
    frameAddress?: number;
    symbolAddress?: number;
    loadAddress?: number;
};

export type BugsnagException = {
    stacktrace: BugsnagStackFrame[];
    errorClass: string;
    message: string;
    type: string;
};

export type BugsnagBreadcrumb = {
    type: string;
    name: string;
    timestamp: string;
    metaData: {
        [key: string]: string;
    };
};

/**
 * One or greater
 */
type CountingNumber = number;
const countingNumber: JSONSchema4 = {
    type: 'number',
    minimum: 1,
};
export type BinaryArchBugsnag = string;

export type BugsnagApp = {
    versionCode: CountingNumber;
    // binaryArch may be omitted when the bugsnag report is a java exception
    binaryArch?: BinaryArchBugsnag;
};
const bugsnagApp: JSONSchema4 = {
    type: 'object',
    properties: {
        versionCode: countingNumber,
        binaryArch: anyString,
    },
    required: ['versionCode'],
};

export type BugsnagReportJson = {
    events: BugsnagEvent[];
};

export type BugsnagEvent = {
    exceptions: BugsnagException[];
    breadcrumbs: BugsnagBreadcrumb[];
    app: BugsnagApp;
    metaData?: object;
    device?: object;
    user?: object;
    session?: object;
};

const stackFrame: JSONSchema4 = {
    type: 'object',
    properties: {
        file: { type: 'string' }, // "", "/data/app/com.gamin[...]8pvIZOQIOKNw==/lib/arm64/libunity.so"
        lineNumber: { type: 'number' }, // the program counter (pc)
        method: { type: 'string' },
        frameAddress: { type: 'number' },
        symbolAddress: { type: 'number' },
        loadAddress: { type: 'number' },
    },
    required: ['file', 'lineNumber'],
};
const bugsnagException: JSONSchema4 = {
    type: 'object',
    properties: {
        stacktrace: {
            type: 'array',
            items: stackFrame,
        },
        errorClass: {
            // usually the signal name, "SIGTRAP", "SIGSEGV", etc
            type: 'string',
        },
        message: { type: 'string' }, // description of a signal "Segmentation violation ..."
        type: { type: 'string' }, // "c", "<java-blah>"
    },
};
const breadcrumb: JSONSchema4 = {
    type: 'object',
    properties: {
        type: { type: 'string' },
        name: { type: 'string' },
        timestamp: { type: 'string' }, // "2019-06-23T20:16:44Z"
        metaData: { type: 'object' }, // Dictionary<string, string>
    },
    required: ['timestamp'],
};

const bugsnagEvent: JSONSchema4 = {
    type: 'object',
    properties: {
        exceptions: {
            type: 'array',
            items: bugsnagException,
        },
        breadcrumbs: {
            type: 'array',
            items: breadcrumb,
        },
        app: bugsnagApp,
        metaData: { type: 'object' },
        device: { type: 'object' },
        user: { type: 'object' },
        session: { type: 'object' },
    },
    required: ['exceptions', 'breadcrumbs', 'app'],
};

export const bugsnagCrashSchema: JSONSchema4 = {
    type: 'object',
    properties: {
        events: {
            type: 'array',
            items: bugsnagEvent,
        },
    },
    required: ['events'],
};
