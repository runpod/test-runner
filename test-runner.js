import { groupBy, omit, map, curry, isNil } from "ramda"
import "dotenv/config"
import axios from "axios"
import fs from "fs"
import { randomUUID, createHash } from "crypto"
import { SAVE_TEMPLATE, DELETE_TEMPLATE, SAVE_ENDPOINT, DELETE_ENDPOINT } from "./query.js"
import { defaultEndpointConfig, defaultTemplateConfig } from "./defaults.js"

const args = process.argv.slice(2)
const [imageName, testFilename] = args
const { RUNPOD_API_KEY, CONTAINER_REGISTRY_AUTH_ID } = process.env
const print = console.log //lemme just pretend it's python
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const groupByKey = curry((key, obj) =>
  Object.values(
    map(
      (group) => ({
        [key]: group[0][key],
        values: group.map(omit([key])),
      }),
      groupBy((elem) => JSON.stringify(elem[key]), obj)
    )
  )
)

const getRunpodGraphqlResult = async ({ query, variables }) => {
  const runpodGraphqlBaseUrl = `https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}`
  return axios.post(runpodGraphqlBaseUrl, { query, variables }).then(({ data }) => data)
}
const createEndpoint = async (endpointConfig) =>
  getRunpodGraphqlResult({
    query: SAVE_ENDPOINT,
    variables: { input: endpointConfig },
  }).then(({ data }) => data.saveEndpoint)

const createTemplate = async (templateConfig) =>
  getRunpodGraphqlResult({
    query: SAVE_TEMPLATE,
    variables: { input: templateConfig },
  }).then(({ data }) => ({
    templateId: data.saveTemplate.id,
    templateName: data.saveTemplate.name,
  }))
const getOrCreateEndpoint = async (hardwareConfig) => {
  const runpodServerlessBaseUrl = "https://api.runpod.ai/v2"
  const { endpoint, template, templateConfig, endpointConfig } = hardwareConfig
  if (endpoint) {
    return { endpointUrl: `${runpodServerlessBaseUrl}/${endpoint}` }
  }
  print("endpoint id not provided, need to make new endpoint...")
  if (template) {
    const endpointInput = {
      templateId: template,
      ...defaultEndpointConfig,
      ...(endpointConfig ?? {}),
    }
    const createEndpointResp = await createEndpoint(endpointInput)
    const { id: endpointId } = createEndpointResp
    print(`created endpoint ${endpointId} (${endpointInput.name})`)
    //TODO handle error
    return {
      endpointUrl: `${runpodServerlessBaseUrl}/${endpointId}`,
      endpoint: { ...endpointInput, id: endpointId },
      createEndpointResp,
    }
  }
  print("template id not provided, need to make new template...")
  //template names have uniqueness constraint unlike endpoint names
  const templateName =
    (templateConfig?.name ?? defaultTemplateConfig.name) + " " + randomUUID().slice(0, 8)
  const { templateId } = await createTemplate({
    containerRegistryAuthId: CONTAINER_REGISTRY_AUTH_ID,
    ...defaultTemplateConfig,
    ...(templateConfig ?? {}),
    imageName,
    name: templateName,
  })
  print(`created template ${templateId}`)
  //TODO handle error
  const endpointInput = {
    templateId,
    ...defaultEndpointConfig,
    ...(endpointConfig ?? {}),
  }
  const createEndpointResp = await createEndpoint(endpointInput)
  const { id: endpointId } = createEndpointResp
  print(`created endpoint ${endpointId} (${endpointInput.name})`)
  //TODO handle error
  return {
    endpointUrl: `${runpodServerlessBaseUrl}/${endpointId}`,
    endpoint: { ...endpointInput, id: endpointId },
    templateId,
    templateName,
  }
}
const deleteResources = async ({ endpoint, templateName }) => {
  if (endpoint) {
    //set min/max workers to 0
    await getRunpodGraphqlResult({
      query: SAVE_ENDPOINT,
      variables: {
        input: { ...endpoint, workersMin: 0, workersMax: 0 },
      },
    })
    //delete endpoint
    await getRunpodGraphqlResult({
      query: DELETE_ENDPOINT,
      variables: { id: endpoint.id },
    })
    print(`deleted endpoint ${endpoint.id}`)
  }
  if (templateName) {
    //wait a little while - some backend crap needs to resolve
    const start = Date.now()
    const estimatedWaitSeconds = 110
    print(`waiting ${estimatedWaitSeconds} seconds to delete template ${templateName}...`)
    await sleep(estimatedWaitSeconds * 1000)
    //delete template with retries
    const pollIntervalSeconds = 10
    let deleted = false
    while (!deleted) {
      const deleteResp = await getRunpodGraphqlResult({
        query: DELETE_TEMPLATE,
        variables: { templateName },
      })
      if (isNil(deleteResp.errors)) {
        deleted = true
      }
      if (!deleted) {
        print(`${(Date.now() - start) / 1000} seconds trying to delete template ${templateName}`)
        await sleep(pollIntervalSeconds * 1000)
      }
    }
    print(`deleted template ${templateName}`)
  }
}

const getRunpodResult = async (endpointUrl, input) => {
  const runUrl = endpointUrl + "/run"
  const authHeader = {
    headers: {
      "Authorization": `Bearer ${RUNPOD_API_KEY}`,
      "content-type": "application/json",
    },
  }
  const runResp = await axios.post(runUrl, { input }, authHeader)
  const { status, statusText } = runResp
  if (status !== 200) {
    return { status, statusText, succeeded: false }
  }
  let data = runResp.data
  const { id } = data
  const statusUrl = endpointUrl + "/status/" + id
  const pollIntervalSeconds = 10
  const start = Date.now()
  const maxWaitTimeSeconds = 300
  while (!["COMPLETED", "FAILED"].includes(data.status)) {
    if (Date.now() - start > maxWaitTimeSeconds * 1000) {
      print(`${statusUrl} timed out after ${maxWaitTimeSeconds} seconds`)
      return { ...data, succeeded: false }
    }
    await sleep(1000 * pollIntervalSeconds)
    const statusResp = await axios.get(statusUrl, authHeader)
    data = statusResp.data
    print(`${statusUrl}: ${data.status}`)
  }
  return { ...data, succeeded: data.status === "COMPLETED" }
}
print(`testing image ${imageName} against tests from ${testFilename}`)
let tests = JSON.parse(fs.readFileSync(testFilename, "utf8"))
const hardwareGroups = groupByKey("hardwareConfig", tests)
let promises = []
let resourcesCreated = []
for (const { hardwareConfig, values: tests } of hardwareGroups) {
  const endpoint = await getOrCreateEndpoint(hardwareConfig)
  resourcesCreated.push(endpoint)
  const { endpointUrl } = endpoint
  print(`running ${tests.length} inputs against ${endpointUrl}...`)
  for (const { input } of tests) {
    promises.push(
      getRunpodResult(endpointUrl, input).then((result) => ({
        input,
        hardwareConfig,
        ...result,
        outputHash: createHash("sha256").update(JSON.stringify(result.output)).digest("base64"),
      }))
    )
  }
}

const results = await Promise.all(promises)
print("Done!")
// TODO: print total exact matches with expected output
// TODO: estimate/print total spend

const outFilename = `test-results-${new Date().toISOString()}.json`
fs.writeFileSync(outFilename, JSON.stringify(results, null, 2), "utf-8")
print(`results written to ${outFilename}`)

print("Cleaning up...")
promises = []
for (const resource of resourcesCreated) {
  promises.push(deleteResources(resource))
}

await Promise.all(promises)
