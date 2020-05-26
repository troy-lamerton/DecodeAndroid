import './common/env';
import { CrashReportV2Body } from './schema/crashes_v2/crashes_v2.schema';
import { CrashReportV2 } from './processing_v2/report_v2';
import { validateAndProcess } from './processing_v2/start_processing';
import { setS3ClientConfig } from './processing_v2/s3_client';
import { serializeError } from './common/nice_print_error';
import l from './common/logger';
import md5 from 'md5';
import { S3 } from 'aws-sdk';

type AnyObject = { [key: string]: any };

export async function decodeJsonPayload(jsonPayload: string, s3Config?: S3.Types.ClientConfiguration): Promise<AnyObject | null> {
    if (s3Config) setS3ClientConfig(s3Config)

    const payloadBody = JSON.parse(jsonPayload) as CrashReportV2Body;
    const hash = md5(payloadBody.report_contents);
    const report = new CrashReportV2('init', payloadBody, hash);
    try {
        return await validateAndProcess(report);
    } catch (fatalError) {
        report.markDone(serializeError(fatalError), true);
        l.e(report.descriptionSecret);
        // null to indicate a fatal error
        return null;
    }
}
