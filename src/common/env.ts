import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config();

export interface IGlobals {
    TESTING: boolean;
    SYMBOLS_S3_BUCKET: string;
    SYMBOLS_S3_ACCESS_KEY: string;
    SYMBOLS_S3_SECRET_ACCESS_KEY: string;
}

export const Globals: IGlobals = {
    TESTING: Boolean(global['TESTING']), // only set by jest config, not env args
    SYMBOLS_S3_BUCKET: String(global['SYMBOLS_S3_BUCKET'] || process.env['SYMBOLS_S3_BUCKET']),
    SYMBOLS_S3_ACCESS_KEY: String(global['SYMBOLS_S3_ACCESS_KEY'] || process.env['SYMBOLS_S3_ACCESS_KEY']),
    SYMBOLS_S3_SECRET_ACCESS_KEY: String(global['SYMBOLS_S3_SECRET_ACCESS_KEY'] || process.env['SYMBOLS_S3_SECRET_ACCESS_KEY']),
};
