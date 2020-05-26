import { decodeJsonPayload } from '../src/run';
import path from 'path';
import fs from 'fs-extra';
import { S3 } from 'aws-sdk';
import { Globals } from '../src/common/env';

describe('run', () => {
    const dummy = {
        // native crash from an arm64 build
        idlegame_report_arm64_native: {
            files: {
                request_body_json: path.join(
                    __dirname,
                    'dummy_data',
                    'requestBody_2_native.json',
                ),
                // when you have access, these symbols can be downloaded from:
                // https://s3.console.aws.amazon.com/s3/buckets/gitlab-test-symbols/symbols/android/f39fefb7-01d9-4509-8f76-4a99957dcf24/ARM64/?region=us-east-2
                symbols_libil2cpp: path.join(
                    __dirname,
                    'dummy_data',
                    'test_symbols',
                    'libil2cpp.so.debug',
                ),
            },
        },
        idlegame_report_arm64_jvm: {
            files: {
                request_body_json: path.join(__dirname, 'dummy_data', 'requestBody_1_jvm.json'),
            },
        },
    };

    async function getNativePayloadContents(): Promise<string> {
        const jsonFileContents = await fs.readFile(
            dummy.idlegame_report_arm64_native.files.request_body_json,
        );
        return jsonFileContents.toString();
    }

    async function getJvmPayloadContents(): Promise<string> {
        const jsonFileContents = await fs.readFile(
            dummy.idlegame_report_arm64_jvm.files.request_body_json,
        );
        return jsonFileContents.toString();
    }

    test('ensure s3 config is set', () => {
        const expectedEnvVars = [
            'SYMBOLS_S3_ACCESS_KEY',
            'SYMBOLS_S3_SECRET_ACCESS_KEY'
        ]
        const msg = `To run the tests that use s3, please create a file called '.env.local' next to the package.json.
                     It should contain:\n${expectedEnvVars.map(envName => `${envName}=?`).join('\n')}`.replace(/ +/g, ' ')
        expectedEnvVars.forEach((envName) => {
            const envValue = process.env[envName];
            if (!envValue) {
                throw msg;
            }
        })
    })

    test('native payload', async () => {
        const nativeJsonPayload = await getNativePayloadContents();
        const s3Config: S3.Types.ClientConfiguration = {
            credentials: {
                accessKeyId: Globals.SYMBOLS_S3_ACCESS_KEY,
                secretAccessKey: Globals.SYMBOLS_S3_SECRET_ACCESS_KEY,
            },
            region: process.env.AWS_DEFAULT_REGION,
        }
        const output = await decodeJsonPayload(nativeJsonPayload, s3Config);
        console.log(output);
        if (!output) {
            return fail('output is falsy');
        }
        expect(output.decoder_error_count!).toBe(0);
        delete output['@timestamp']
        delete output['decoder_processing_duration']
        expect(output).toMatchSnapshot();
    }, 30 * 10 * 1000);

    test('jvm payload', async () => {
        const jvmJsonPayload = await getJvmPayloadContents();
        const s3Config: S3.Types.ClientConfiguration = {
            credentials: {
                accessKeyId: Globals.SYMBOLS_S3_ACCESS_KEY,
                secretAccessKey: Globals.SYMBOLS_S3_SECRET_ACCESS_KEY,
            },
            region: process.env.AWS_DEFAULT_REGION,
        }
        const output = await decodeJsonPayload(jvmJsonPayload, s3Config);
        console.log(output);
        if (!output) {
            return fail('output is falsy');
        }
        expect(output.decoder_error_count!).toBe(0);
        // ensure snapshot doesnt change based on when the test is run
        delete output['@timestamp']
        delete output['decoder_processing_duration']
        expect(output).toMatchSnapshot();
    }, 10 * 1000);
});
