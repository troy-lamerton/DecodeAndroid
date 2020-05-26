import { onExit, readableToString, streamEnd, streamWrite } from '@rauschma/stringio';
import { spawn, spawnSync } from 'child_process';
import { Writable } from 'stream';
import l from './logger';

/**
 * test me
 * Line A: We ignore stdin, want to access stdout via a stream and forward stderr to process.stderr.
 * Line B: We await until echoReadable() is completely done. Without this await, DONE would be printed before the first line of source.stdout.
 */
export async function demo_readProcessOutput(inputFile: string): Promise<string> {
    const source = spawn('cat', [inputFile], { stdio: ['ignore', 'pipe', process.stderr] }); // (A)

    return await readableToString(source.stdout!);
}

export async function demo_writeProcessInput(linesToWrite = ['First line', 'Second line']) {
    const sink = spawn('cat', [], { stdio: ['pipe', process.stdout, process.stderr] }); // (A)

    await writeToWritable(sink.stdin!, linesToWrite); // (B)
    await onExit(sink);
}

export function runProcessForOutput(executableFile: string, args: string[]): [string, string] {
    l.info(`running: ${executableFile} ${args.join(' ')}`);
    const proc = spawnSync(executableFile, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const code = proc.status;

    const errorOutput = proc.stderr.toString().trim();

    if (code === 0) {
        if (errorOutput) l.w(errorOutput);
        return [proc.stdout.toString().trimRight(), errorOutput];
    } else {
        throw errorOutput;
    }
}

export async function writeToProcessForOutput(
    executableFile: string,
    args: string[],
    inputLines: string[],
): Promise<string> {
    l.trace(`${executableFile} ${args.join(' ')}`);

    const proc = spawn(executableFile, args, { stdio: ['pipe', 'pipe', process.stderr] });

    l.trace('writing ' + inputLines.join('\n'));

    await writeToWritable(proc.stdin!, inputLines, true);
    l.trace('writing to child process done');
    const output = await readableToString(proc.stdout!);
    l.trace('read to end done');

    // if (!proc.killed) await onExit(proc);
    proc.kill();
    l.trace('process did exit done');

    return output.trimRight();
}

async function writeToWritable(writable: Writable, lines: string[], instantEnd = true) {
    for (const line of lines) {
        await streamWrite(writable, line + '\n');
    }
    if (instantEnd) await streamEnd(writable);
}
