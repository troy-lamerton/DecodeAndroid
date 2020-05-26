import * as AWS from 'aws-sdk';
import * as path from 'path';
import { strict as assert } from 'assert';
import l from '../common/logger';
import { isUndefined } from 'lodash';
import { notEmpty } from '../common/lang';
import { CommitSha, UnityPlatform } from '../schema/crashes_v2/crashes_v2.schema';
import { CrashReportV2 } from './report_v2';
import { getFilesAndFolders } from './steps';
import fs from 'fs-extra';

export const libil2cppDotSo = 'libil2cpp.so';

export function downloadGzip(s3: AWS.S3, bucket: string, key: string) {
    l.debug(`begin download; bucket:${bucket}; Key:${key}`);

    return s3
        .getObject({
            Bucket: bucket,
            Key: key,
            ResponseContentType: 'application/gzip',
        })
        .createReadStream();
}

export function downloadZip(s3: AWS.S3, bucket: string, key: string) {
    l.debug(`begin download; bucket:${bucket}; Key:${key}`);

    return s3
        .getObject({
            Bucket: bucket,
            Key: key,
            ResponseContentType: 'application/zip',
        })
        .createReadStream();
}

// ---------------------------------------------------------------------------
//  Prepare engine symbols

// unity editor version
export const unity2019_2_8f1 = '2019.2.8f1' as const;
export type UnityVersion = typeof unity2019_2_8f1; // todo: support more than one unity version

// build architecture
export type UnknownBuildArch = 'Unknown';

export enum IdleGameAndroidBuildArchE {
    ARM64 = 'ARM64',
    ARMv7 = 'ARMv7',
}

/**
 * Map bugsnag binaryArch to unity symbols folder name.
 * `binaryArch` can be undefined when the bugsnag report is for a java exception.
 */
export function bugsnagArchToUnityArch(
    bugsnagBinaryArch: string | undefined,
): IdleGameAndroidBuildArchE | UnknownBuildArch {
    type Lookup = { [key: string]: IdleGameAndroidBuildArchE };
    const possibleArchs: Lookup = {
        arm64: IdleGameAndroidBuildArchE.ARM64,
        arm32: IdleGameAndroidBuildArchE.ARMv7,
        armv7: IdleGameAndroidBuildArchE.ARMv7,
        arm: IdleGameAndroidBuildArchE.ARMv7,
        // x86: 'X86', // we don't build x86 anymore, Unity deprecated android x86.
    };
    if (isUndefined(bugsnagBinaryArch)) return 'Unknown';
    return possibleArchs[bugsnagBinaryArch] || 'Unknown';
}

/**
 * @param editorVersion
 * unity editor that built the app
 * @param arch
 * target cpu architecture used to build the apk
 * @return local filepaths to unity symbols for the specified editor version and architecture
 * @see CrashReportV2
 */
export async function getUnityEngineSymbols(
    editorVersion: UnityVersion,
    arch: IdleGameAndroidBuildArchE,
): Promise<string[]> {
    const folder = path.join('unity_engine_symbols', editorVersion, arch);
    return getFilesAndFolders(folder, '*.so');
}

/**
 * @return true when unity engine symbols were successfully copied into `targetFolder`
 */
export async function prepareUnityEngineSymbols(
    targetFolder: string,
    report: CrashReportV2,
): Promise<boolean> {
    const reportedArch = <IdleGameAndroidBuildArchE>report.architecture;
    const engineSymFiles = await getUnityEngineSymbols(unity2019_2_8f1, reportedArch);
    const symbolsOk = engineSymFiles.every(fs.existsSync);
    if (!symbolsOk) {
        l.debug(
            `unity symbols do not exist for report '${report.hash}' which has arch ${reportedArch}`,
        );
        return false;
    }

    for (let file of engineSymFiles) {
        const destFile = path.join(targetFolder, path.basename(file));
        await fs.copy(file, destFile, { overwrite: true });
    }
    return true;
}

// ---------------------------------------------------------------------------
// Download app symbols from S3

type SymbolsIdentifier = { unityBuildId: string; architecture: IdleGameAndroidBuildArchE };

export function getSymbolsS3Key(identifier: SymbolsIdentifier): string {
    // e.g. 'symbols/android/f39fefb7-01d9-4509-8f76-4a99957dcf24/ARM64/libil2cpp.so.debug.gz'
    return [
        'symbols',
        'android',
        identifier.unityBuildId,
        identifier.architecture,
        `${libil2cppDotSo}.debug.gz`,
    ].join('/');
}
