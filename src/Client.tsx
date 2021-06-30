import { useEffect, useRef, useState } from "react"
import MonacoEditor, { monaco } from "react-monaco-editor"
import { initialCode } from "."
import convertChangeEventToOperation from "./util/event-to-transform"
import ot, { TextOperation } from "ot"

const options = {
  selectOnLineNumbers: true,
}

export type ClientProps = {
  id: number
}

export const Client = ({ id }: ClientProps) => {
  const monacoRef = useRef<MonacoEditor>(null)
  const [localCode, setLocalCode] = useState<string>(initialCode)
  const [applyingFromServer, setApplyingFromServer] = useState<boolean>(false)
  
  const ws = useRef<WebSocket | null>(null)
  useEffect(() => {
    console.log("connect websocket")
    ws.current = new WebSocket(`ws://localhost:6666/${id}`)
  }, [])
  

  class OtClient extends ot.Client {
    sendOperation(revision: number, operation: TextOperation) {
      console.log(`[${id}] sending`, revision, operation)
      ws.current!.send(JSON.stringify({ revision, operation }))
    }
    applyOperation(operation: TextOperation) {
      console.log(`[${id}] applying`, operation)
      setApplyingFromServer(true)
      applyOperationToMonaco(operation, monacoRef.current!.editor!)
      setLocalCode(monacoRef.current!.editor!.getValue())
      setApplyingFromServer(false)
    }
  }

  const [client, setClient] = useState<OtClient>(new OtClient(0))

  useEffect(() => {
    if (ws.current != null) {
      ws.current.onmessage = (event) => {
        let payload = JSON.parse(event.data)
        console.log(id, payload)
        if (payload.type === "update") {
          const op = TextOperation.fromJSON(payload.op)
          client.applyServer(op)
        } else if (payload.type === "ack") {
          client.serverAck()
        } else {
          console.error(`could not recognize type ${payload.type}.`)
        }
      }
    }
  }, [ws])

  const onChange = (value: string, event: monaco.editor.IModelContentChangedEvent) => {
    if (applyingFromServer) return
    console.log("onChange", value, event)
    const { operation, newCode } = convertChangeEventToOperation(monacoRef.current!.editor!, event, localCode)
    setLocalCode(newCode)
    client.applyClient(operation)
  }

  return (
    <MonacoEditor
      width="500"
      height="200"
      language="javascript"
      theme="vs-dark"
      defaultValue={initialCode}
      options={options}
      onChange={onChange}
      ref={monacoRef}
    />
  )
}

const applyOperationToMonaco = (operation: TextOperation, me: monaco.editor.IStandaloneCodeEditor) => {
  const ops = operation.ops
  let index: number = 0
  for (var i = 0, l = ops.length; i < l; i++) {
    var op = ops[i]
    if (TextOperation.isRetain(op)) {
      index += op as number
    } else if (TextOperation.isInsert(op)) {
      const start = me.getModel()!.getPositionAt(index)
      me.executeEdits("", [
        {
          range: {
            startLineNumber: start.lineNumber,
            endLineNumber: start.lineNumber,
            startColumn: start.column,
            endColumn: start.column,
          },
          text: op as string,
        },
      ])
      index += (op as string).length
    } else if (TextOperation.isDelete(op)) {
      const start = me.getModel()!.getPositionAt(index)
      const end = me.getModel()!.getPositionAt(index - (op as number))
      me.executeEdits("", [
        {
          range: {
            startLineNumber: start.lineNumber,
            endLineNumber: end.lineNumber,
            startColumn: start.column,
            endColumn: end.column,
          },
          text: "",
        },
      ])
    }
  }
}
