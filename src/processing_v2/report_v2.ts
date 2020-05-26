import {
    CrashReportV2Body,
    CommitSha,
    UnityPlatform,
    BuildEnvironmentE,
} from '../schema/crashes_v2/crashes_v2.schema';
import { DateTime, Duration } from 'luxon';
import { serializeError } from '../common/nice_print_error';
import { filter, isEmpty, isUndefined, size } from 'lodash';
import l from '../common/logger';
import { getSymbolsS3Key, IdleGameAndroidBuildArchE } from './download_symbols';
import { isDefined, notEmpty } from '../common/lang';
import { strict as assert } from 'assert';
import { AndroidNativeCrash } from './android_backtrace';

type ProcessingError = string;

export type ReportStatus =
    | 'init'
    | 'processing'
    | 'success' // everything went well
    | 'failed' // something went wrong during processing
    | 'faulted'; // a fatal error was thrown

export class CrashReportV2 {
    readonly startedProcessingAt: DateTime;
    /** Current status, set by methods in steps.ts */
    status: ReportStatus;
    /** Value is always available during processing.
     * To release memory, request_body is deleted once this report is safely in elastic search */
    request_body?: CrashReportV2Body;
    processing_job?: Promise<any>;
    readonly platform: UnityPlatform;
    readonly hash: string;
    private readonly errors: ProcessingError[] = [];
    readonly release_stage: BuildEnvironmentE;
    readonly client_commit: CommitSha;
    readonly client_version: string;
    readonly unity_build_id: string;
    readonly architecture: IdleGameAndroidBuildArchE | null;

    constructor(status: ReportStatus, request_body: CrashReportV2Body, hash: string) {
        this.startedProcessingAt = DateTime.utc();
        this.hash = hash;

        // copy common values from `request_body`
        // so they are available always, even when request_body is deleted
        const { platform, report_contents } = request_body;
        this.platform = platform;
        this.request_body = request_body;
        this.status = status;
        this.client_commit = request_body.client_stats.client_commit;
        this.client_version = request_body.client_stats.client_version;
        this.unity_build_id = request_body.unity_build_id;

        // computed values
        this.release_stage = request_body.index;
        try {
            this.architecture = AndroidNativeCrash.fromBugsnagJson(report_contents).architecture;
        } catch {
            this.architecture = null;
        }
    }

    getSymbolsDownloadKey(): string {
        if (!this.architecture) throw 'do not attempt to download symbols when architecture is unknown!';
        return getSymbolsS3Key({
            architecture: this.architecture,
            unityBuildId: this.unity_build_id,
        });
    }

    /**
     * Finalizes this report and releases allocations that were only needed for processing.
     * @param error
     * final error to add to this report.
     * @param faulted
     * this report is kaput, nothing more can be done with it.
     */
    markDone(error?: any, faulted?: boolean) {
        this.addError(error);

        if (faulted) {
            this.status = 'faulted';
            return;
        }

        if (isUndefined(error)) {
            this.status = 'success';
        } else {
            this.status = 'failed';
        }
        l.info(this.status + ' - finished processing report');
        if (this.errorCount)
            l.warn('Finished processing report with errors:\n' + this.errorOutputSecret);
    }

    deleteRequestBody() {
        delete this.request_body;
    }

    addError(throwable: any, logItNow?: boolean) {
        const error = serializeError(throwable, 512);
        l.debug('addError ' + error);

        // should not be adding new errors to a finalized report
        assert.notEqual(this.isFinalized(), true, 'this report is not finalized');

        if (isDefined(throwable)) {
            this.errors.push(error);
            if (logItNow) l.e(error);
        }
    }

    private isFinalized(): boolean {
        const finalStates: ReportStatus[] = ['failed', 'faulted', 'success'];
        return this.status in finalStates;
    }

    // info string is cached because request_body will be deleted at some point
    private _bodyInfos?: string;

    get bodyInfos(): string {
        if (this._bodyInfos) return this._bodyInfos;
        if (isEmpty(this.request_body)) return '<request_body is empty>';

        const body = this.request_body!;
        const { client_stats } = body;

        const infos = [
            `Build: ${body.index} - ${body.platform}`,
            `Version: ${client_stats.client_version} (commit: ${client_stats.client_commit})`,
            `Person: ${client_stats.person_id}`,
        ];

        return (this._bodyInfos = infos.join('\n'));
    }

    get errorCount(): number {
        return size(this.errors);
    }

    /**
     * May contain confidential information
     */
    get errorOutputSecret(): string | undefined {
        return isEmpty(this.errors)
            ? undefined
            : this.errors.map((str, i) => `#ERROR_${i + 1} ${str}`).join('\n');
    }

    /**
     * May contain confidential information
     */
    get descriptionSecret(): string {
        return filter([this.status, this.errorOutputSecret, this.bodyInfos], notEmpty).join(
            '\n',
        );
    }

    get description(): string {
        return filter(
            [this.status, `${this.errorCount} processing errors`, this.bodyInfos],
            notEmpty,
        ).join('\n');
    }
}
