import Pino, { Logger } from 'pino';
import { serializeError } from './nice_print_error';
import { Globals } from './env';

const tag = `crashdecoder_android`;

const level = process.env.LOG_LEVEL || 'debug';
// logging that conforms to cos-* elastic search index
const humanFormat: Pino.LoggerOptions = {
    base: {},
    prettyPrint: {
        translateTime: 'SYS:HH:MM:ss.l',
        colorize: true,
    },
    level,
};
const elasticFormat: Pino.LoggerOptions = {
    level,
    timestamp: () => `,"@timestamp":"${new Date().toJSON()}"`,
    changeLevelName: 'log_level',
    base: {
        tag,
    },
};

const printForHuman =
    process.env.HUMAN_LOGS || process.env.NODE_ENV === 'development' || Globals.TESTING;
const loggerConfig: Pino.LoggerOptions = printForHuman ? humanFormat : elasticFormat;

type Best = {
    w(msg: string, stat?: string): void;
    e(msg: any, stat?: string): void;
};

const l = Pino(loggerConfig) as (Logger & Best);

const defaults = (stat: string, logtype: string, merger: any = {}) => {
    return printForHuman
        ? {
              ...merger,
          }
        : {
              stat,
              logtype,
              ...merger,
          };
};

l.w = (msg: string, stat?: string) => {
    l.warn(defaults(stat || 'log', 'Warning', { msg }));
};

l.e = (err: any, stat?: string) => {
    l.error(
        defaults(stat || 'log', 'Error', {
            is_error: true,
            msg: serializeError(err),
        }),
    );
};

export default l;
