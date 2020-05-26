import * as AWS from 'aws-sdk';

let s3ClientConfig: AWS.S3.Types.ClientConfiguration | undefined = undefined

export function setS3ClientConfig(config: AWS.S3.Types.ClientConfiguration) {
    s3ClientConfig = config
}

export function getS3Client(withConfig?: AWS.S3.Types.ClientConfiguration) {
    const config = withConfig || s3ClientConfig;
    return new AWS.S3(config)
}