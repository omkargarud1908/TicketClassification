import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Classification = {
  category?: string
  priority?: string
  team?: string
  summary?: string
  reasoning?: string
  confidence?: number
  raw?: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const emptyTicket = {
  title: '',
  requester: '',
  product: '',
  description: '',
}

const apiBase = import.meta.env.VITE_API_URL || ''

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }

  return data as T
}

function normalizeAssistantContent(content: string) {
  return content
    .replace(/\s*#{2,3}\s*/g, '\n### ')
    .replace(/\s+(\d+)\.\s+/g, '\n$1. ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function renderInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function AssistantMessage({ content }: { content: string }) {
  const lines = normalizeAssistantContent(content)

  return (
    <div className="assistant-response">
      {lines.map((line, index) => {
        const heading = line.match(/^#{1,3}\s*(.+)$/)
        const step = line.match(/^(\d+)\.\s*(.+)$/)

        if (heading) {
          return <h3 key={`${line}-${index}`}>{heading[1].replace(/:$/, '')}</h3>
        }

        if (step) {
          return (
            <div className="step-row" key={`${line}-${index}`}>
              <span className="step-number">{step[1]}</span>
              <p>{renderInlineText(step[2])}</p>
            </div>
          )
        }

        return <p key={`${line}-${index}`}>{renderInlineText(line)}</p>
      })}
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState<'classify' | 'chat'>('chat')
  const [ticket, setTicket] = useState(emptyTicket)
  const [classification, setClassification] = useState<Classification | null>(null)
  const [ticketError, setTicketError] = useState('')
  const [isClassifying, setIsClassifying] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi, I can answer support questions or help you decide whether something should become a ticket.',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const confidenceLabel = useMemo(() => {
    if (typeof classification?.confidence !== 'number') return 'Not provided'
    return `${Math.round(classification.confidence * 100)}%`
  }, [classification])

  async function handleClassify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTicketError('')
    setClassification(null)
    setIsClassifying(true)

    try {
      const data = await postJson<{ classification: Classification }>('/api/classify-ticket', ticket)
      setClassification(data.classification)
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : 'Unable to classify ticket.')
    } finally {
      setIsClassifying(false)
    }
  }

  async function handleChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const message = chatInput.trim()
    if (!message) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setChatInput('')
    setChatError('')
    setIsChatting(true)

    try {
      const data = await postJson<{ reply: string }>('/api/chat', {
        message,
        history: messages,
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to get chat response.')
    } finally {
      setIsChatting(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="support-rail" aria-label="Support navigation">
        <div className="brand-lockup">
          <div className="brand-mark">SD</div>
          <div>
            <strong>SupportDesk</strong>
            <span>AI Operations</span>
          </div>
        </div>
        <nav className="rail-nav">
          <button
            type="button"
            className={activeView === 'chat' ? 'active' : ''}
            onClick={() => setActiveView('chat')}
          >
            <span>Chat</span>
            <small>Employee support</small>
          </button>
          <button
            type="button"
            className={activeView === 'classify' ? 'active' : ''}
            onClick={() => setActiveView('classify')}
          >
            <span>Classify</span>
            <small>Ticket routing</small>
          </button>
        </nav>
        <div className="rail-card">
          <span className="status-dot"></span>
          <div>
            <strong>Azure Foundry</strong>
            <small>Connected through backend API</small>
          </div>
        </div>
      </aside>

      <section className="support-console">
        <header className="topbar">
          <div>
            <p className="eyebrow">SharePoint Support Agent </p>
            <h1>{activeView === 'chat' ? 'Support Assistant' : 'Ticket Classification'}</h1>
          </div>
          <div className="service-summary" aria-label="Service status">
            <div>
              <span>Queue</span>
              <strong>Live</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>Azure</strong>
            </div>
          </div>
        </header>

        {activeView === 'classify' ? (
          <section className="workspace">
            <form className="panel" onSubmit={handleClassify}>
              <div className="panel-heading">
                <span>New ticket intake</span>
                <strong>Classification request</strong>
              </div>
              <label>
                Title
                <input
                  value={ticket.title}
                  onChange={(event) => setTicket({ ...ticket, title: event.target.value })}
                  placeholder="VPN disconnecting every few minutes"
                />
              </label>
              <div className="field-grid">
                <label>
                  Requester
                  <input
                    value={ticket.requester}
                    onChange={(event) => setTicket({ ...ticket, requester: event.target.value })}
                    placeholder="Aarav Sharma"
                  />
                </label>
                <label>
                  Product
                  <input
                    value={ticket.product}
                    onChange={(event) => setTicket({ ...ticket, product: event.target.value })}
                    placeholder="Corporate VPN"
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  required
                  value={ticket.description}
                  onChange={(event) => setTicket({ ...ticket, description: event.target.value })}
                  placeholder="Describe the issue, impact, error messages, and when it started."
                />
              </label>
              {ticketError ? <p className="error">{ticketError}</p> : null}
              <button className="primary-action" type="submit" disabled={isClassifying}>
                {isClassifying ? 'Classifying...' : 'Classify ticket'}
              </button>
            </form>

            <aside className="result-panel">
              <div className="result-header">
                <span>Routing Decision</span>
                <strong>{classification?.priority || 'Waiting'}</strong>
              </div>
              {classification ? (
                classification.raw ? (
                  <pre>{classification.raw}</pre>
                ) : (
                  <dl>
                    <div>
                      <dt>Category</dt>
                      <dd>{classification.category || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Routing Team</dt>
                      <dd>{classification.team || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{confidenceLabel}</dd>
                    </div>
                    <div>
                      <dt>Summary</dt>
                      <dd>{classification.summary || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Reasoning</dt>
                      <dd>{classification.reasoning || 'Not provided'}</dd>
                    </div>
                  </dl>
                )
              ) : (
                <p className="empty-state">Submit a ticket to see category, priority, team, and confidence.</p>
              )}
            </aside>
          </section>
        ) : (
          <section className="chat-layout">
            <div className="chat-header">
              <div className="bot-avatar">AI</div>
              <div>
                <strong>Enterprise Support Assistant</strong>
                <span>Answers common questions and guides users through support tasks.</span>
              </div>
            </div>
            <div className="chat-thread" aria-live="polite">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <span>{message.role === 'assistant' ? 'Support Assistant' : 'You'}</span>
                  {message.role === 'assistant' ? (
                    <AssistantMessage content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </article>
              ))}
              {isChatting ? (
                <article className="message assistant">
                  <span>Support Assistant</span>
                  <p>Thinking...</p>
                </article>
              ) : null}
            </div>
            <form className="chat-box" onSubmit={handleChat}>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask about access, SharePoint, VPN, software, or company support..."
              />
              <button type="submit" disabled={isChatting || !chatInput.trim()}>
                Send
              </button>
            </form>
            {chatError ? <p className="error">{chatError}</p> : null}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
