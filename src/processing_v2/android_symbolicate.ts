import l from '../common/logger';
import { BugsnagStackFrame } from '../schema/native_crash/bugsnag_crash.schema';
import path from 'path';
import fs from 'fs-extra';
import { writeToProcessForOutput } from '../common/spawn_process';
import glob from 'tiny-glob';
import * as assert from 'assert';
import { notEmpty } from '../common/lang';

/**
 * helper methods
 */
export function getBacktraceInNdkStackFormat(frame: BugsnagStackFrame, i: number): string {
    // to use ndk-stack we must make lines that conform to this format:
    //   #00  pc 000abc12345 path/to/file.so

    return `  #${i.toString().padStart(2, '0')}  pc ${frame.lineNumber.toString(
        16,
    )}  ${frame.file || '_unknown_file'}`;
}

/**
 * helper methods
 */
export function getBacktraceInJvmFormat(frame: BugsnagStackFrame, i: number): string {
    return `#${i.toString().padStart(2, '0')} ${frame.method} in ${frame.file || '_unknown_file'}:${frame.lineNumber}`;
}

async function runNdkStackForOutput(
    inputLines: string[],
    symbolsFolder: string,
): Promise<string> {
    if (!process.env.ANDROID_NDK_HOME) {
        l.w('process.env.ANDROID_NDK_HOME is not set');
        throw process.env;
    }

    l.info('runNdkStackForOutput() using symbols folder: ' + symbolsFolder);

    const ndkStackExecutable = path.join(process.env.ANDROID_NDK_HOME, 'ndk-stack');
    if (!fs.existsSync(ndkStackExecutable)) throw new Error('ndk-stack does not exist');

    const relFolder = path.relative(process.cwd(), symbolsFolder);
    const files = await glob(`${relFolder}/*.so`);
    console.log('runNdkStackForOutput() here come the files', files);
    files.forEach(file => {
        const stats = fs.statSync(file);
        l.info(`${file} is ${Math.round(stats.size / 1024)} KB`);
    });
    l.info('runNdkStackForOutput() using symbols: ' + files.join());
    l.info(files);

    if (files.length == 0) {
        throw 'No symbols';
    }

    // required lines to make ndk-stack expect the backtrace
    const triggerLines = [
        '*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
        "00-00 00:00:00.000: E/CRASH(12300): Build fingerprint: 'placeholder/release-keys'" +
            '00-00 00:00:00.000: E/CRASH(12300): pid: 12300, tid: 12300, name: Thread  >>> app.app <<<',
    ];
    return writeToProcessForOutput(
        ndkStackExecutable,
        ['-sym', symbolsFolder],
        [...triggerLines, ...inputLines],
    );
}

export async function symbolicateAndroid(
    inputLines: string[],
    symbolsFolder: string,
): Promise<string> {
    const result = await runNdkStackForOutput(inputLines, symbolsFolder);
    const rawLines = result.split('\n').slice(2);
    // .filter(line => /#\d{2,3} /.test(line));

    assert.strict.ok(notEmpty(rawLines), 'notEmpty(rawLines)');
    assert.strict.ok(
        rawLines.length >= 1,
        `rawLines.length >= 1. rawLines:\n-->${rawLines}<-- END`,
    );

    // l.debug(rawLines);
    // format lines to make them easier to read quickly
    return rawLines
        .map(line => line.replace(/C:\\(?:\w+\\)+idlegame/g, '\\idlegame'))
        .map(l =>
            l.replace(
                '\\idlegame\\IdleGame\\Temp\\StagingArea\\assets\\bin\\Data\\Managed/',
                '',
            ),
        )
        .map(l =>
            l.replace(
                /(_[a-z][A-Z0-9]{8})[A-Z0-9]+([A-Z0-9]{3})/,
                (whole, g1, g2) => `${g1}...${g2}`,
            ),
        )
        .map(l =>
            l.replace(
                /\\idlegame\\IdleGame\\Temp\\StagingArea\\Il2Cpp\\il2cppOutput\\lumpedcpp\/(?:\.\.\\)+Program/,
                '\\Program',
            ),
        )
        .map(l =>
            l.replace(
                '\\idlegame\\IdleGame\\Temp\\StagingArea\\Il2Cpp\\il2cppOutput',
                'il2cppOutput',
            ),
        )
        .map(l => l.replace(/(?:\/data\/app\/)?com\.\w+\.\w+-[^\/]+\/lib/g, '<app-lib>'))
        .map(l =>
            l.replace(
                /(?:Stack frame )?#(\d+) +pc +([a-f0-9]+)\s+(.+)$/,
                (whole, num, addr, rest) => `#${num} ${addr.padStart(6, ' ')} ${rest}`,
            ),
        )
        .join('\n');
}
