# runpod-test-runner

Runs serverless inputs on runpod, creating and deleting temporary templates and endpoints as needed from a docker image

`node print-all-combos.js > tests.json && node test-runner.js runpod/ai-api-faster-whisper:dev tests.json`

needs a .env file in enclosing folder, containing:
```
RUNPOD_API_KEY=[a valid runpod api key]
CONTAINER_REGISTRY_AUTH_ID=[a runpod id for a registry auth object, if you intend to make templates from a private image]
```

note: running this will *spend money* on the account linked by the api key.
