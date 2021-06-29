import { Server, TextOperation } from "ot"
import React, { MutableRefObject, useCallback, useEffect, useRef, useState } from "react"
import MonacoEditor, { monaco } from "react-monaco-editor"
import { initialCode } from "."
import "./App.css"
import { Client, ClientRef } from "./Client"
import convertChangeEventToOperation from "./util/event-to-transform"
import styled from "styled-components"

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  p:after {
    content: " ";
    white-space: pre;
  }
`

function App() {
  const [serverCode, setServerCode] = useState<string>(initialCode)
  const [server, setServer] = useState<Server>(new Server(initialCode))
  const delay = useRef<number>(100)

  let ids = []
  for (let i = 0; i < 2; i++) {
    ids.push(i)
  }
  const numClients = 2
  const refs = useRef<ClientRef[]>([])
  useEffect(() => {
    refs.current = refs.current.slice(0, numClients)
  })

  
  const onClientSend = (idx: number, revision: number, operation: TextOperation) => {
    const transformedOp = server.receiveOperation(revision, operation)
    setServerCode(server.document)
    setServer(server)

    const origin = refs.current[idx]
    const others = refs.current.filter((_, i) => i !== idx)
    // ack and update after some delay
    console.log("timeout delay", delay)
    setTimeout(() => {
      origin.ack()
      others.forEach((client) => client.update(transformedOp))
    }, delay.current)
  }

  const clients = ids.map((id, i) => {
    return <Client id={i} key={i} ref={(el) => (refs.current[i] = el!)} onSend={onClientSend}></Client>
  })

  const onDelayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed: number = Number(event.target.value)
    console.log(parsed)
    if (parsed >= 0) {
      delay.current = parsed
    }
  }

  return (
    <div>
      <p>Server view: {serverCode}</p>
      <InputContainer>
        <p>Delay:</p>
        <input onChange={onDelayChange} type="number" min="0"></input>
      </InputContainer>
      {clients}
    </div>
  )
}

export default App
