import "./App.css"
import { Client } from "./Client"

function App() {
  const numClients = 2
  let ids = []
  for (let i = 0; i < numClients; i++) {
    ids.push(i)
  }

  const clients = ids.map((id) => {
    return <Client id={id} key={id}></Client>
  })

  return <div>{clients}</div>
}

export default App
