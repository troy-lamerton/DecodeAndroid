# DecodeAndroid

- I accept backtraces in the IdleGame json format that contains a bugsnag report.
- I decode the backtrace using symbol files from s3.

## Development

```sh
yarn install
yarn dev
```

The entrypoint is [index.ts](./src/index.ts)
Make changes to files in src/ and it will restart.

### S3 access

Symbols are downloaded from the s3 bucket named in [.env](.env).
If needed, you can provide s3 credentials when calling `decodeJsonPayload`.

### Testing

You will need a `.env.local` file with credentials for the test symbols.
Credentials for the test symbols can be gotten from Troy.

```sh
yarn test
```

### Build container

```sh
yarn docker:build
# run the container to check it
yarn docker:run
```
