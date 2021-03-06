import { useEffect, useRef, useState } from "react"
import MonacoEditor, { EditorDidMount, monaco } from "react-monaco-editor"
import convertChangeEventToOperation from "./util/event-to-transform"
import ot, { TextOperation } from "ot"
import environment from "./environment"

const options = {
  selectOnLineNumbers: true,
}

export type ClientProps = {
  id: number
}

export const Client = ({ id }: ClientProps) => {
  const monacoRef = useRef<MonacoEditor>(null)
  const [initialCode, setInitialCode] = useState<string | null>(null)
  const baseRevision = useRef<number>(0)
  const [localCode, setLocalCode] = useState<string | null>(null)
  const [applyingFromServer, setApplyingFromServer] = useState<boolean>(false)

  // websocket
  const ws = useRef<WebSocket | null>(null)
  useEffect(() => {
    const uri = `${environment.ws_endpoint}/${id}`
    console.log("connecting websocket:", uri)
    ws.current = new WebSocket(uri)
  }, [id])

  // fetch initial code
  useEffect(() => {
    async function fetchInitialCode() {
      const res = await fetch(`${environment.endpoint}/content`)
      const obj = await res.json()
      setInitialCode(obj.content)
      setLocalCode(obj.content)
      baseRevision.current = obj.revision
    }
    fetchInitialCode()
  }, [])

  // ot client implementation
  class OtClient extends ot.Client {
    sendOperation(revision: number, operation: TextOperation) {
      revision += baseRevision.current
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

  // eslint-disable-next-line
  const [client, setClient] = useState<OtClient>(new OtClient(0))

  // message handler
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
  }, [ws, client, id])

  // onChange handler
  const onChange = (value: string, event: monaco.editor.IModelContentChangedEvent) => {
    if (applyingFromServer || localCode === null) return
    console.log("onChange", value, event)
    const { operation, newCode } = convertChangeEventToOperation(monacoRef.current!.editor!, event, localCode!)
    setLocalCode(newCode)
    client.applyClient(operation)
  }

  // onDidChangeCursorSelection handler
  const onDidChangeCursorSelection = (e: monaco.editor.ICursorSelectionChangedEvent) => {
    console.log(e.selection)
  }

  // register handlers
  const mounted: EditorDidMount = (editor) => {
    editor.onDidChangeCursorSelection(onDidChangeCursorSelection)
  }

  const editor = () => {
    if (initialCode !== null) {
      return (
        <MonacoEditor
          className="editor"
          width="100vw"
          height="100vh"
          language="javascript"
          theme="vs-dark"
          defaultValue={initialCode}
          options={options}
          onChange={onChange}
          editorDidMount={mounted}
          ref={monacoRef}
        />
      )
    }
  }

  return <div>{editor()}</div>
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
