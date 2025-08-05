import { useState } from "react"

function App() {
  const [chatInput, setChatInput] = useState("")
  const [chatHistory, setChatHistory] = useState([])
  const [plants, setPlants] = useState([])
  const [newPlantName, setNewPlantName] = useState("")
  const [newPlantDescription, setNewPlantDescription] = useState("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [loadingPlants, setLoadingPlants] = useState(false)
  const [addingPlant, setAddingPlant] = useState(false)

  const API_KEY = "secret"
  const BACKEND_URL = "http://localhost:8000"

  // Chat with AI
  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    setLoadingAI(true)
    setChatHistory(history => [...history, { sender: "user", text: chatInput }])
    const res = await fetch(`${BACKEND_URL}/generate-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ description: chatInput })
    })
    const data = await res.json()
    setChatHistory(history => [
      ...history,
      { sender: "ai", text: data.suggested_name || "No response." }
    ])
    setChatInput("")
    setLoadingAI(false)
  }

  // Load all plants
  const handleGetPlants = async () => {
    setLoadingPlants(true)
    const res = await fetch(`${BACKEND_URL}/plants`, {
      method: "GET",
      headers: { "x-api-key": API_KEY }
    })
    const data = await res.json()
    setPlants(data)
    setLoadingPlants(false)
  }

  // Add a new plant
  const handleCreatePlant = async () => {
    if (!newPlantName.trim() || !newPlantDescription.trim()) return
    setAddingPlant(true)
    const res = await fetch(`${BACKEND_URL}/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({
        name: newPlantName,
        PlantDescription: newPlantDescription
      })
    })
    const data = await res.json()
    setPlants(plants => [...plants, data])
    setNewPlantName("")
    setNewPlantDescription("")
    setAddingPlant(false)
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-green-900 via-gray-900 to-blue-900 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full flex flex-col items-center justify-center bg-black bg-opacity-60 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-green-300 text-center">🌱 Rooted AI Chat</h1>
        
        {/* Chatbox */}
        <div className="w-full flex flex-col items-center mb-8">
          <div className="w-full h-64 bg-gray-800 rounded-lg p-4 overflow-y-auto mb-4 flex flex-col">
            {chatHistory.length === 0 && (
              <div className="text-gray-400 text-center mt-16">Start chatting with the AI about plants!</div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`mb-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <span className={`inline-block px-4 py-3 rounded-lg text-lg font-semibold shadow ${msg.sender === "user" ? "bg-green-200 text-black" : "bg-blue-200 text-black"}`}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type your message to the AI..."
              className="flex-1 p-3 rounded border border-green-400 bg-white text-black text-lg"
              onKeyDown={e => e.key === "Enter" && handleSendChat()}
              disabled={loadingAI}
              autoFocus
            />
            <button
              onClick={handleSendChat}
              className="bg-green-500 hover:bg-green-600 p-3 rounded font-semibold text-white text-lg"
              disabled={loadingAI}
            >
              {loadingAI ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        {/* Plants Section */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-green-200">🌿 All Saved Plants</h2>
            <button
              onClick={handleGetPlants}
              className="bg-blue-500 hover:bg-blue-600 p-2 rounded text-white"
              disabled={loadingPlants}
            >
              {loadingPlants ? "Loading..." : "Load All Plants"}
            </button>
          </div>
          <ul className="text-base mt-2 max-h-32 overflow-y-auto">
            {plants.length === 0 && <li className="text-gray-400">No plants loaded.</li>}
            {plants.map(p => (
              <li key={p.id} className="mb-1">• <span className="font-bold text-green-100">{p.name}</span> <span className="italic text-gray-300">({p.PlantDescription})</span></li>
            ))}
          </ul>
        </div>

        {/* Add Plant Section */}
        <div className="w-full">
          <h2 className="text-lg font-semibold text-green-200 mb-2">Add a New Plant</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newPlantName}
              onChange={e => setNewPlantName(e.target.value)}
              placeholder="Plant name"
              className="p-3 rounded border border-purple-400 bg-white text-black text-lg"
              disabled={addingPlant}
            />
            <input
              type="text"
              value={newPlantDescription}
              onChange={e => setNewPlantDescription(e.target.value)}
              placeholder="Plant description"
              className="p-3 rounded border border-purple-400 bg-white text-black text-lg"
              disabled={addingPlant}
            />
            <button
              onClick={handleCreatePlant}
              className="bg-purple-500 hover:bg-purple-600 p-3 rounded text-white font-semibold text-lg"
              disabled={addingPlant}
            >
              {addingPlant ? "Adding..." : "Add Plant"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App