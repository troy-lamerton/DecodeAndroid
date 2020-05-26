import '../src/common/env';
import path from 'path';
import fs from 'fs-extra';
import {
} from '../src/processing_v2/download_symbols';
import { demo_readProcessOutput, demo_writeProcessInput, writeToProcessForOutput } from '../src/common/spawn_process';

const dummy: {[key: string]: any} = {
    bugsnag: {
        full_crash: {
            file: path.join(__dirname, 'dummy_data', 'bugsnag_crash.json'),
        },
    },
};

describe('child process', () => {
    test.concurrent('reading stdout of a child process', async () => {
        const { file } = dummy.bugsnag.full_crash;
        const output = await demo_readProcessOutput(file);
        const inputFileContents = await fs.readFile(file);
        const expected = inputFileContents.toString().trimRight();
        expect(output).toBe(expected);
    });

    test.concurrent('write to stdin of a child process', async () => {
        await demo_writeProcessInput();
    });

    const dummyInputs = [
        ['1.hello', '2.world'],
        ['1.hello', '2.world'],
        ['1.hello', '2.world'],
    ];

    test.each(dummyInputs)(
        'writing and then reading from child process',
        async (line1, line2) => {
            const inputLines = [line1, line2];
            const output = await writeToProcessForOutput('cat', [], inputLines);
            expect(output.split('\n')).toStrictEqual(inputLines);
        },
    );
});