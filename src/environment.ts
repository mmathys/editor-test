type Environment = {
  endpoint: string
  ws_endpoint: string
}

const prod: Environment = {
  endpoint: "https://api.monument.ax",
  ws_endpoint: "wss://api.monument.ax/ws",
}

const dev: Environment = {
  endpoint: "http://localhost:3100",
  ws_endpoint: "ws://localhost:6666",
}

export default process.env.NODE_ENV === "production" ? prod : dev
