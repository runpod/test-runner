export const DELETE_TEMPLATE = `
  mutation deleteTemplate($templateName: String) {
    deleteTemplate(templateName: $templateName)
  }
`

export const SAVE_TEMPLATE = `
  mutation saveTemplate($input: SaveTemplateInput) {
    saveTemplate(input: $input) {
      advancedStart
      containerDiskInGb
      dockerArgs
      env {
        key
        value
      }
      id
      imageName
      name
      ports
      readme
      startJupyter
      startScript
      startSsh
      volumeInGb
      volumeMountPath
    }
  }
`

export const GET_ENDPOINTS = `
  query getEndpoints {
    myself {
      id
      serverlessDiscount {
        discountFactor
        type
        expirationDate
      }
      endpoints {
        aiKey
        gpuIds
        id
        idleTimeout
        locations
        name
        networkVolumeId
        pods {
          desiredStatus
        }
        scalerType
        scalerValue
        templateId
        userId
        workersMax
        workersMin
      }
    }
  }
`

export const DELETE_ENDPOINT = `
  mutation deleteEndpoint($id: String!) {
    deleteEndpoint(id: $id)
  }
`

export const SAVE_ENDPOINT = `
  mutation saveEndpoint($input: EndpointInput!) {
    saveEndpoint(input: $input) {
      gpuIds
      id
      idleTimeout
      locations
      name
      networkVolumeId
      scalerType
      scalerValue
      templateId
      userId
      workersMax
      workersMin
    }
  }
`
