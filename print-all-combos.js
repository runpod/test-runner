import { xprod } from "ramda"
import hardwareConfigs from "./hardwareConfigs.json" assert { type: "json" }
import inputs from "./inputs.json" assert { type: "json" }

const combos = xprod(hardwareConfigs, inputs).map(([hardwareConfig, input]) => ({
  hardwareConfig,
  input,
}))
console.log(JSON.stringify(combos, null, 2))
