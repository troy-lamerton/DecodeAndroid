import * as zlib from 'zlib';
import l from '../common/logger';
import fs from 'fs-extra';
import { Stream } from 'stream';

export async function extractGzipStreamToFile(downloadStream: Stream, outputFilePath: string) {
    await fs.ensureFile(outputFilePath);

    const outputFile = fs.createWriteStream(outputFilePath);

    const gzip = zlib.createGunzip();

    downloadStream.pipe(gzip).pipe(outputFile);

    const downloadPromise = new Promise((resolve, reject) => {
        downloadStream.once('error', err => {
            l.e('downloadStream error: ' + err);
            downloadStream.removeAllListeners();
            outputFile.removeAllListeners();
            try {
                outputFile.close();
            } catch {}
            reject(err);
        });
        outputFile.once('error', err => {
            l.e('output file stream error: ' + err);
            downloadStream.removeAllListeners();
            outputFile.removeAllListeners();
            try {
                outputFile.close();
            } catch {}
            reject(err);
        });
        outputFile.once('end', () => {
            l.debug('finished downloading symbols file (end)');
            resolve();
        });
        outputFile.once('close', () => {
            l.debug('finished downloading symbols file (close)');
            resolve();
        });
    });

    // wait for download to complete
    await downloadPromise;
}
