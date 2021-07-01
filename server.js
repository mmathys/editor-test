const { Server, TextOperation } = require("ot")
const WebSocket = require("ws")
const wss = new WebSocket.Server({ port: 6666 })
const express = require("express")
const cors = require("cors")
const app = express()
const server = new Server("content")
let revision = 0

wss.on("connection", function connection(ws, req) {
  ws.on("message", function incoming(message) {
    message = JSON.parse(message)
    console.log("got", message)
    const operation = TextOperation.fromJSON(message.operation)
    const transformedOp = server.receiveOperation(message.revision, operation)
    revision++
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

app.get("/content", cors(), (req, res) => {
  res.json({
    content: server.document,
    revision,
  })
})

app.use(cors())

app.listen(3100)
