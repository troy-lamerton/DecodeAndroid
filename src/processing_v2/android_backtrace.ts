import {
    BugsnagApp,
    bugsnagCrashSchema,
    BugsnagReportJson,
    BugsnagEvent,
} from '../schema/native_crash/bugsnag_crash.schema';
import { bugsnagArchToUnityArch, IdleGameAndroidBuildArchE } from './download_symbols';
import Ajv from 'ajv';

export class AndroidBacktrace {
    stripped_contents: string;
    raw_contents: string;

    private constructor(decoderOutput: string, strippedContents: string) {
        this.raw_contents = decoderOutput;
        this.stripped_contents = strippedContents;
    }

    static parseDecoderOutput(decoderOutput: string): AndroidBacktrace {
        let strippedContents = decoderOutput;

        // todo: strip the hex addresses and useless parts of filepaths

        return new AndroidBacktrace(decoderOutput, strippedContents);
    }
}

const validateBugsnagCrashJson = new Ajv({ schemaId: 'auto' }).compile(bugsnagCrashSchema);

export const validateBugsnagJsonString = (
    bugsnagCrashReport: any,
): bugsnagCrashReport is BugsnagReportJson => {
    const valid = validateBugsnagCrashJson(bugsnagCrashReport);

    if (!valid) {
        const validationErrors = validateBugsnagCrashJson.errors;
        if (validationErrors) {
            // copy the array because ajv mutates it on every call to validate(data)
            throw validationErrors.slice();
        }
        throw 'Bugsnag json validation failed!';
    }

    return valid as boolean;
};

export class AndroidNativeCrash {
    readonly architecture: IdleGameAndroidBuildArchE;

    /**
     * @param json is validated again the bugsnag report json schema.
     * When this function returns without throwing, you can be sure that everything is guchi.
     */
    static fromBugsnagJson(json: string): AndroidNativeCrash {
        const bugsnagCrash = this.parseRawBugsnagJson(json);
        // there is always only one event in the bugsnag crash json (bugsnag-unity v4.8.2)
        return this.parseBugsnagReport(bugsnagCrash.events[0]);
    }

    private static parseRawBugsnagJson(rawJsonString: string): BugsnagReportJson {
        const bugsnagCrash = JSON.parse(rawJsonString);
        validateBugsnagJsonString(bugsnagCrash);
        // after validating, it is safe to return as BugsnagEvent
        return bugsnagCrash;
    }

    private static parseBugsnagReport(d: BugsnagEvent): AndroidNativeCrash {
        const arch = bugsnagArchToUnityArch(d.app.binaryArch);

        if (arch === 'Unknown') {
            throw `reported binary architecture '${d.app.binaryArch}' is not supported by the crash decoder`;
        }

        return new AndroidNativeCrash(arch);
    }

    private constructor(arch: IdleGameAndroidBuildArchE) {
        this.architecture = arch;
    }
}
