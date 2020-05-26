import { isUndefined, get, negate, isEmpty } from 'lodash';

export function callElseThrow<T>(func: undefined | (() => T), throws: any) {
    if (isUndefined(func)) {
        throw throws;
    }
    return func();
}

export const TODO = (msg?: string): never => {
    throw `[TODO] ${msg || 'not yet implemented'}`;
};

export function randomHex(n: number): string {
    let rs = '';
    let r = n % 8,
        q = (n - r) / 8,
        i;
    for (i = 0; i < q; i++) {
        rs += Math.random()
            .toString(16)
            .slice(2);
    }
    if (r > 0) {
        rs += Math.random()
            .toString(16)
            .slice(2, i);
    }
    return rs;
}

export const notEmpty = negate(isEmpty);

export const isDefined = <T>(value: any): value is T => value !== undefined;
