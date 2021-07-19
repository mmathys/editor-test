type Environment = {
  endpoint: string
  ws_endpoint: string
}

type Overrides = {
  endpoint?: string
  ws_endpoint?: string
}

const dev: Environment = {
  endpoint: "http://localhost:3100",
  ws_endpoint: "ws://localhost:6666",
}

const prod: Environment = {
  endpoint: "https://api.monument.ax",
  ws_endpoint: "wss://api.monument.ax/ws",
}

let overrides: Overrides = {}
if (process.env.REACT_APP_ENDPOINT === "dev") {
  overrides.endpoint = dev.endpoint
  overrides.ws_endpoint = dev.ws_endpoint
} else if (process.env.REACT_APP_ENDPOINT === "prod") {
  overrides.endpoint = prod.endpoint
  overrides.ws_endpoint = prod.ws_endpoint
}

console.log(process.env)

export default {
  ...(process.env.NODE_ENV === "production" ? prod : dev),
  ...overrides,
}
