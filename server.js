const { Server, TextOperation, Selection } = require("ot")
const WebSocket = require("ws")
const wss = new WebSocket.Server({ port: 6666, noServer: true })
const express = require("express")
const cors = require("cors")
const app = express()
const session = require("express-session")
const server = new Server("content")
let revision = 0

var sess = {
  secret: "replace this...",
  resave: false,
  saveUninitialized: false,
  cookie: {},
}

if (app.get("env") === "production") {
  app.set("trust proxy", 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))

app.on("upgrade", function upgrade(request, socket, head) {
  console.log(request, socket, head)
  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit("connection", ws, request, client)
  })
})

wss.on("connection", function connection(ws, req, client) {
  console.log("connection", client)
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
