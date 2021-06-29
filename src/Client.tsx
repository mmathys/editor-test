import { forwardRef, Ref, useImperativeHandle, useRef, useState } from "react"
import MonacoEditor, { monaco } from "react-monaco-editor"
import { initialCode } from "."
import convertChangeEventToOperation from "./util/event-to-transform"
import ot, { TextOperation } from "ot"

const options = {
  selectOnLineNumbers: true,
}

export type ClientProps = {
  id: number
  onSend: (id: number, revision: number, operation: TextOperation) => void
}

export type ClientRef = {
  ack: () => void
  update: (op: TextOperation) => void
}

export const Client = forwardRef(({ onSend, id }: ClientProps, ref: Ref<ClientRef>) => {
  const monacoRef = useRef<MonacoEditor>(null)
  const [localCode, setLocalCode] = useState<string>(initialCode)
  const [applyingFromServer, setApplyingFromServer] = useState<boolean>(false)

  class OtClient extends ot.Client {
    sendOperation(revision: number, operation: TextOperation) {
      console.log(`[${id}] sending`, revision, operation)
      onSend(id, revision, operation)
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

  const onChange = (value: string, event: monaco.editor.IModelContentChangedEvent) => {
    if (applyingFromServer) return
    console.log("onChange", value, event)
    const { operation, newCode } = convertChangeEventToOperation(monacoRef.current!.editor!, event, localCode)
    setLocalCode(newCode)
    client.applyClient(operation)
  }

  useImperativeHandle(ref, () => ({
    ack: () => {
      console.log("ack")
      client.serverAck()
    },
    update: (op: TextOperation) => {
      client.applyServer(op)
    },
  }))

  return (
    <MonacoEditor
      width="500"
      height="300"
      language="javascript"
      theme="vs-dark"
      defaultValue={initialCode}
      options={options}
      onChange={onChange}
      ref={monacoRef}
    />
  )
})

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
