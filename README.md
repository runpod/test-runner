# runpod-test-runner

Runs serverless inputs on runpod, creating and deleting temporary templates and endpoints as needed from a docker image

example inputs have been provided, to be run with:

`node print-all-combos.js > tests.json && node test-runner.js runpod/ai-api-faster-whisper:dev tests.json`

needs a .env file in enclosing folder, containing:
```
RUNPOD_API_KEY=[a valid runpod api key]
CONTAINER_REGISTRY_AUTH_ID=[a runpod id for a registry auth object]
```
`CONTAINER_REGISTRY_AUTH_ID` is only needed if creating templates from a private container image

note: running this will *spend money* on the account linked by the api key.

# Using as a Github Action

This script can be run as a Github Action, placing the following snippet in the steps of your Github Workflow:

```yml
jobs:
  docker:
    runs-on: DO
    steps:
      ...
      - uses: actions/checkout@v3
      - name: Run Tests
        uses: direlines/runpod-test-runner@v1.6
        with:
          image-tag: [tag of image to test]
          runpod-api-key: [a valid Runpod API key]
          test-filename: [path for a json file containing a list of tests]
          request-timeout: [number of seconds to wait on each request before timing out, defaults to 300]
```

If test-filename is omitted, the test runner action will attempt to look for a test file at `.github/tests.json`.
