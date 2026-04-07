import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AIChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant logistique. Posez-moi une question sur vos operations, supports ou plans de palettisation.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // TODO: Appel Claude API via backend proxy
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Analyse en cours pour : "${userMsg.content}". Le backend API n'est pas encore connecte — cette reponse est un placeholder.`,
        timestamp: new Date(),
      }])
      setLoading(false)
    }, 800)
  }

  return (
    <div className="absolute bottom-0 right-0 w-[360px] h-[420px] border-l border-t border-gray-200 bg-white rounded-tl-xl flex flex-col z-20 shadow-lg">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center">
            <span className="text-indigo-600 text-xs font-medium">IA</span>
          </div>
          <div>
            <div className="font-medium text-[13px]">Assistant IA</div>
            <div className="text-[10px] text-gray-400">Nanotera copilote</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[90%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
              msg.role === 'user'
                ? 'self-end bg-indigo-50 text-indigo-800 rounded-br-sm'
                : 'self-start bg-gray-50 text-gray-700 rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="self-start bg-gray-50 text-gray-400 px-3 py-2 rounded-xl rounded-bl-sm text-[12px]">
            Reflexion en cours...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Poser une question..."
            className="flex-1 text-[12px] px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
