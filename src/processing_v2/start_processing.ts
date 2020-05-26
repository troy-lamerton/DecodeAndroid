import l from '../common/logger';
import { CrashReportV2 } from './report_v2';
import {
    convertReportToDecodableText,
    decodeBacktrace,
    ensureSymbolsFolderIsPrepared,
    getFinalReportObject,
    convertJvmReportToReadableStacktrace,
} from './steps';
import delay from 'delay';
import { Globals } from '../common/env'

type AnyObjectAsync = Promise<{ [key: string]: any }>;
/**
 * @throws when the report is not the expected format
 */
export function validateAndProcess(report: CrashReportV2): AnyObjectAsync {
    const body = report.request_body!;
    if (!body) throw `report.request_body is falsy!`;

    const { platform } = body;

    if (platform !== 'Android') throw 'only android supported';

    report.status = 'processing';
    return processReport(report);
}

export async function processReport(report: CrashReportV2): AnyObjectAsync {
    const raw_maybe_decoded = await parseAndSymbolicate(report);
    report.markDone();
    return getFinalReportObject(report, '', raw_maybe_decoded);
}

/**
 * @return the crash text (maybe) decoded
 * @param report to be processed, which will have processing errors added to it
 */
export async function parseAndSymbolicate(report: CrashReportV2): Promise<string> {
    const { report_contents } = report.request_body!;

    if (report.architecture === null) {
        return convertJvmReportToReadableStacktrace(report_contents);
    }

    // parse to get stacktrace
    const decodableText: string = convertReportToDecodableText(report_contents);

    // return the original backtrace if decoding fails
    const fallbackReturnValue = decodableText;

    // download symbols if needed - with retrying
    let symbolsFolder: string | null | undefined = undefined;
    const maxAttempts = 3;
    let attemptsLeft = maxAttempts;
    do {
        symbolsFolder = await ensureSymbolsFolderIsPrepared(
            report,
            Globals.SYMBOLS_S3_BUCKET,
        ); // retry up to 3 times
        if (symbolsFolder === null) await delay(2 * 1000);
    } while (!symbolsFolder && --attemptsLeft > 0);

    // return the original backtrace because symbols are kaput
    if (!symbolsFolder) {
        report.addError(`failed to prepare symbols folder (tried ${maxAttempts} times).`, true);
        return fallbackReturnValue;
    }

    l.debug(`will try to decode ${CrashReportV2.name} ${report.hash}`);
    try {
        const decoded = await decodeBacktrace(decodableText, symbolsFolder);
        l.info(`decoded backtrace successfully. Report ${report.hash}`);
        return decoded;
    } catch (throwable) {
        report.addError(throwable);
        return fallbackReturnValue;
    }
}
