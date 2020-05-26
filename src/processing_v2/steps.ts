import { BuildEnvironmentE } from '../schema/crashes_v2/crashes_v2.schema';
import { getBacktraceInNdkStackFormat, symbolicateAndroid, getBacktraceInJvmFormat } from './android_symbolicate';
import { CrashReportV2 } from './report_v2';
import * as path from 'path';
import fs from 'fs-extra';
import l from '../common/logger';
import glob from 'tiny-glob';
import { serializeError } from '../common/nice_print_error';
import { extractGzipStreamToFile } from './extract_gzip';
import { strict as assert } from 'assert';
import { BugsnagReportJson } from '../schema/native_crash/bugsnag_crash.schema';
import { downloadGzip, libil2cppDotSo, prepareUnityEngineSymbols } from './download_symbols';
import { statSync } from 'fs';
import { DateTime } from 'luxon';
import { getS3Client }  from './s3_client'

/** takes the report_contents from request body and returns valid input for decoder executable */
export function convertReportToDecodableText(report_contents: string): string {
    // the report_contents is a bugsnag report json
    const reportData = JSON.parse(report_contents) as BugsnagReportJson;
    const { stacktrace } = reportData.events[0].exceptions[0];
    const lines = stacktrace.map(getBacktraceInNdkStackFormat);
    if (isJavaError(reportData)) {
        throw 'convertReportToDecodableText should not be called with a jvm error';
    }
    return lines.join('\n');
}

export function convertJvmReportToReadableStacktrace(report_contents: string): string {
    // the report_contents is a bugsnag report json
    const reportData = JSON.parse(report_contents) as BugsnagReportJson;
    const { stacktrace } = reportData.events[0].exceptions[0];
    if (!isJavaError(reportData)) {
        throw 'convertJvmReportToReadableStacktrace should not be called with native error';
    }
    const lines = stacktrace.map(getBacktraceInJvmFormat);
    return lines.join('\n');
}

function isJavaError(reportData: BugsnagReportJson): boolean {
    return reportData.events[0].app.binaryArch === undefined;
}

/**
 * @returns path to the folder containing symbols for `report`
 */
export async function ensureSymbolsFolderIsPrepared(
    report: CrashReportV2,
    symbolsBucket: string
): Promise<string | null> {
    const { unity_build_id, architecture } = report;

    if (architecture === null) {
        return null;
    }

    assert.ok(symbolsBucket, 'Bucket for symbols not set');

    // unique local folder name for these symbols
    const localFolderName = `${unity_build_id}_${architecture}`
        .replace(/\./g, '-')
        .replace(/[^\w_-]+/gi, '-');

    const symbolsFolder = path.join(process.cwd(), 'symbols', localFolderName);

    // check if symbols already exist locally

    // ensure folder exists
    l.debug(`create symbolsFolder:\n${symbolsFolder}`);
    fs.ensureDirSync(symbolsFolder);

    // ensure engine symbols are in the folder
    const ok = await prepareUnityEngineSymbols(symbolsFolder, report);
    if (!ok) {
        l.warn('unity engine symbols could not be prepared, continuing but unity stacktrace lines will not be decoded!')
    }

    // download app symbols

    const s3 = getS3Client();

    let symbolFiles = await getExistingAppSymbols(symbolsFolder);

    // are the symbolFiles there already?
    const gotExistingSymbols = symbolFiles.length === 1; // exactly one is expected

    if (gotExistingSymbols) return symbolsFolder;

    const debugTimeLabel = `download symbols from s3 CrashReportV2{hash: ${report.hash}}`;
    console.time(debugTimeLabel);

    try {
        const downloadKey = report.getSymbolsDownloadKey();

        const gzipStream = downloadGzip(s3, symbolsBucket, downloadKey);

        await extractGzipStreamToFile(gzipStream, path.join(symbolsFolder, libil2cppDotSo));

        // assert that android symbols file is there
        symbolFiles = await getExistingAppSymbols(symbolsFolder);
        assert.equal(symbolFiles.length, 1, `symbols folder contains one symbols file`);

        return symbolsFolder;
    } catch (err) {
        // failed to download symbols
        report.addError('Downloading symbols failed: ' + serializeError(err, 400));
        return null;
    } finally {
        console.timeEnd(debugTimeLabel);
    }
}

async function getExistingAppSymbols(symbolsFolder: string): Promise<string[]> {
    const folderExists = await fs.pathExists(symbolsFolder);
    if (!folderExists) return [];

    const symbols = await getFilesAndFolders(symbolsFolder, libil2cppDotSo);
    return symbols.filter(filepath => {
        // `libil2cppDotSo` files are, on average, 1.4 GB at the time of writing
        // anything less than several MB is probably a failed download
        const valid = statSync(filepath).size > 12 * 1000 * 1000;
        if (!valid) fs.removeSync(filepath);
        return valid;
    });
}

/**
 * @return the symbolicated stacktrace of the thread that crashed
 * @throws when the backtrace could not be decoded
 * @param decodableText
 * @param platform
 * @param symbolsFolder folder containing the needed binary symbols for this report
 */
export async function decodeBacktrace(
    decodableText: string,
    symbolsFolder: string,
): Promise<string> {
    const lines = decodableText.split('\n');
    return symbolicateAndroid(lines, symbolsFolder);
}

export async function getFilesAndFolders(
    rootFolder: string,
    pattern: string = '*.*',
): Promise<string[]> {
    const relFolder = path.relative(process.cwd(), rootFolder);
    return await glob(`${relFolder}/**/${pattern}`);
}

// returns the nicely structured object to be sent to our dashboard
export function getFinalReportObject(
    report: CrashReportV2,
    reason: string,
    strippedContents: string,
): { [key: string]: any } {
    const formattedReportContents = createDocument(
        report.release_stage,
        {
            crashreport_reason: reason,
            crashreport_description: strippedContents,
        },
        {
            client_stats: report.request_body!.client_stats,

            crash_contents_md5: report.hash,
            decoder_status: report.status,
            decoder_error_count: report.errorCount,
            decoder_errors: report.errorOutputSecret,
            decoder_debug: report.bodyInfos,
            decoder_processing_duration: `${report.startedProcessingAt.diffNow().as('second') *
                -1} seconds`,
            // crashed_thread: appleCrash.meta.thread_that_crashed,
            // crashed_at: appleCrash.meta.crashed_at
        },
    );
    return formattedReportContents;
}

export function createDocument(
    release_stage: BuildEnvironmentE,
    doc: {
        crashreport_reason: string;
        crashreport_description: string;
    },
    {
        client_stats,
        ...extras
    }: {
        client_stats: object;
        [extra: string]: any;
    },
) {
    return getBody(doc, {
        release_stage,
        ...extras,
        ...client_stats,
    });
    //debugging for now
    // await fs.outputJSON(process.cwd()+'/tmp/'+Math.random()+'.json', body);
}

function getBody(doc: object, extras: object) {
    return {
        '@timestamp': DateTime.utc().toJSON(),
        decoder_version: 20200516, // date of last commit
        decoder_name: 'V2.4.0 - new crashreporting',
        ...extras,
        ...doc,
    };
}
