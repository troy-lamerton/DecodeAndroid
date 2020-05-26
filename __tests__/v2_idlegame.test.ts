import '../src/common/env';
import path from 'path';
import fs from 'fs-extra';
import {
    convertReportToDecodableText,
    decodeBacktrace,
    convertJvmReportToReadableStacktrace,
} from '../src/processing_v2/steps';
import { CrashReportV2 } from '../src/processing_v2/report_v2';
import { CrashReportV2Body } from '../src/schema/crashes_v2/crashes_v2.schema';
import {
    getUnityEngineSymbols,
    IdleGameAndroidBuildArchE,
    libil2cppDotSo,
    prepareUnityEngineSymbols,
    unity2019_2_8f1
} from '../src/processing_v2/download_symbols';

describe('idlegame crashes', () => {

    const dummy = {
        // native crash from an arm64 build
        idlegame_report_arm64_native: {
            files: {
                request_body_json: path.join(__dirname, 'dummy_data', 'requestBody_2_native.json'),
                // when you have access, these symbols can be downloaded from:
                // https://s3.console.aws.amazon.com/s3/buckets/gitlab-test-symbols/symbols/android/f39fefb7-01d9-4509-8f76-4a99957dcf24/ARM64/?region=us-east-2
                symbols_libil2cpp: path.join(__dirname, 'dummy_data', 'test_symbols', 'libil2cpp.so.debug'),
            }
        },
        idlegame_report_arm64_jvm: {
            files: {
                request_body_json: path.join(__dirname, 'dummy_data', 'requestBody_1_jvm.json'),
                symbols_libil2cpp: path.join(__dirname, 'dummy_data', 'test_symbols', 'libil2cpp.so.debug'),
            }
        }
    };

    describe('process report', () => {

        const tempFolder = path.join(__dirname, 'tmp');

        async function getPayloadContents(): Promise<string> {
            const jsonFileContents = await fs.readFile(dummy.idlegame_report_arm64_native.files.request_body_json);
            return jsonFileContents.toString();
        }

        test('parse report json', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const report = new CrashReportV2('init', payloadBody, 'unique-hash-here123');

            expect(report.hash).toBe('unique-hash-here123')
            expect(report.unity_build_id).toBe('f39fefb7-01d9-4509-8f76-4a99957dcf24')
        });

        test('s3 download key', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const report = new CrashReportV2('init', payloadBody, 'unique-hash-here123');
            const unityBuildId = 'f39fefb7-01d9-4509-8f76-4a99957dcf24';
            expect(report.unity_build_id).toBe(unityBuildId)
            expect(report.architecture).toBe(IdleGameAndroidBuildArchE.ARM64)
            const s3Key = report.getSymbolsDownloadKey()
            expect(s3Key).toBe(`symbols/android/${unityBuildId}/ARM64/libil2cpp.so.debug.gz`)
        })

        test('prepare engine symbol files', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const report = new CrashReportV2('init', payloadBody, 'unique-hash-here123');

            // copy in the unity sym files
            await prepareUnityEngineSymbols(tempFolder, report);

            // expect the correct unity symbol files
            const unitySymbols = await getUnityEngineSymbols(unity2019_2_8f1, IdleGameAndroidBuildArchE.ARM64);
            expect(unitySymbols.length).toBe(2);
            unitySymbols.forEach(filepath => {
                expect(filepath).toMatch(/^.+\/lib(?:main|unity).so$/i);
            });
        });

        test('get stacktrace from payload', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const { report_contents } = payloadBody;
            const decodableText = convertReportToDecodableText(report_contents);
            expect(decodableText).toMatchSnapshot();
        });

        test('decode the stacktrace', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const { report_contents } = payloadBody;
            const decodableText = convertReportToDecodableText(report_contents);
            const report = new CrashReportV2('init', payloadBody, 'unique-hash-here123');

            // copy over the app sym file (normally downloaded from s3 or copied from cache folder)
            const demoSymbolsFile = dummy.idlegame_report_arm64_native.files.symbols_libil2cpp;
            await fs.copy(demoSymbolsFile, path.join(tempFolder, libil2cppDotSo));

            // copy in the unity sym files
            await prepareUnityEngineSymbols(tempFolder, report);

            const decoded = await decodeBacktrace(decodableText, tempFolder);

            expect(decoded).toBeTruthy();
            expect(decoded).toMatchSnapshot();
        }, 40 * 1000);

        beforeAll(() => {
            fs.ensureDir(tempFolder);
        });

        afterAll(async () => {
            // delete files created during tests
            await fs.remove(tempFolder);
        });
    });

    describe('process jvm report', () => {
        async function getPayloadContents(): Promise<string> {
            const jsonFileContents = await fs.readFile(dummy.idlegame_report_arm64_jvm.files.request_body_json);
            return jsonFileContents.toString();
        }

        test('produce readable output', async () => {
            const payloadBodyJson = await getPayloadContents();
            const payloadBody = JSON.parse(payloadBodyJson) as CrashReportV2Body;
            const { report_contents } = payloadBody;
            const readableStacktrace = convertJvmReportToReadableStacktrace(report_contents);
            expect(readableStacktrace).toMatchSnapshot();
        })
    })

});
