const { Server, TextOperation } = require("ot")
const WebSocket = require("ws")
const wss = new WebSocket.Server({ port: 6666 })

const server = new Server("hello")

wss.on("connection", function connection(ws, req) {
  //console.log("connected", req.url)
  ws.on("message", function incoming(message) {
    message = JSON.parse(message)
    console.log("got", message)
    const operation = TextOperation.fromJSON(message.operation)
    const transformedOp = server.receiveOperation(message.revision, operation)
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return
      if (client === ws) {
        console.log("send ack")
        client.send(JSON.stringify({ type: "ack" }))
      } else {
        console.log("send diff update")
        client.send(JSON.stringify({ type: "update", op: transformedOp }))
      }
    })
  })
})
