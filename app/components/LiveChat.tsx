import { useEffect, useRef, useState, useCallback } from "react"

interface ChatMsg {
	messageId?: string
	userId?: string
	displayName: string
	message: string
	timestamp?: string
	systemMessage?: boolean
	type?: string
	event?: string
}

interface LiveChatProps {
	eventId: string
	userEmail: string
	displayName: string
	wsToken: string
}

/**
 * Real-time chat component using WebSocket connection to LiveDO.
 * Auto-scrolls to bottom on new messages.
 * XSS-safe: server-side HTML sanitization.
 */
export default function LiveChat({
	eventId,
	userEmail,
	displayName,
	wsToken,
}: LiveChatProps) {
	const [messages, setMessages] = useState<ChatMsg[]>([])
	const [input, setInput] = useState("")
	const [connected, setConnected] = useState(false)
	const wsRef = useRef<WebSocket | null>(null)
	const bottomRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Connect WebSocket
	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
		const host = window.location.host
		const wsUrl = `${protocol}//${host}/api/v1/live/${encodeURIComponent(eventId)}/chat?userEmail=${encodeURIComponent(userEmail)}&displayName=${encodeURIComponent(displayName)}&token=${encodeURIComponent(wsToken)}`

		const ws = new WebSocket(wsUrl)
		wsRef.current = ws

		ws.onopen = () => {
			setConnected(true)
		}

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as ChatMsg
				setMessages((prev) => [...prev, data])
			} catch {
				// ignore malformed messages
			}
		}

		ws.onclose = () => {
			setConnected(false)
		}

		ws.onerror = () => {
			setConnected(false)
		}

		return () => {
			ws.close()
		}
	}, [eventId, userEmail, displayName, wsToken])

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages])

	const sendMessage = useCallback(() => {
		const trimmed = input.trim()
		if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

		wsRef.current.send(
			JSON.stringify({ type: "chat", message: trimmed }),
		)
		setInput("")
		inputRef.current?.focus()
	}, [input])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	}

	return (
		<div className="flex h-full flex-col rounded-lg border border-kumo-border bg-kumo-base">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-kumo-border px-4 py-3">
				<h3 className="text-sm font-semibold text-kumo-primary">Live Chat</h3>
				<div className="flex items-center gap-2">
					<div
						className={`size-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
					/>
					<span className="text-xs text-kumo-subtle">
						{connected ? "Connected" : "Disconnected"}
					</span>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-3">
				{messages.length === 0 && (
					<div className="flex h-full items-center justify-center">
						<p className="text-sm text-kumo-muted">
							No messages yet. Say something!
						</p>
					</div>
				)}
				{messages.map((msg, i) => {
					const isSystem = msg.type === "system" || msg.systemMessage
					const isJoin = msg.event === "user_joined"
					const isLeave = msg.event === "user_left"
					const isStreamEnded = msg.event === "stream_ended"

					if (isSystem) {
						return (
							<div key={i} className="mb-2 flex justify-center">
								<span className={`rounded-full px-3 py-1 text-xs ${
									isStreamEnded
										? "bg-red-500/10 text-red-500"
										: "bg-kumo-recessed text-kumo-subtle"
								}`}>
									{isJoin ? `${msg.displayName} joined` : ""}
									{isLeave ? `${msg.displayName} left` : ""}
									{isStreamEnded ? "Stream ended" : ""}
									{!isJoin && !isLeave && !isStreamEnded ? msg.message : ""}
								</span>
							</div>
						)
					}

					const isMe = msg.userId === userEmail.split("@")[0]
					return (
						<div
							key={i}
							className={`mb-2 flex ${isMe ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg px-3 py-2 ${
									isMe
										? "bg-kumo-primary text-white"
										: "bg-kumo-recessed text-kumo-primary"
								}`}
							>
								{!isMe && (
									<p className="text-xs font-medium text-kumo-subtle mb-1">
										{msg.displayName}
									</p>
								)}
								<p className="text-sm break-words">{msg.message}</p>
							</div>
						</div>
					)
				})}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="border-t border-kumo-border p-3">
				{connected ? (
					<div className="flex gap-2">
						<input
							ref={inputRef}
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Type a message..."
							maxLength={500}
							className="flex-1 rounded-md border border-kumo-border bg-kumo-recessed px-3 py-2 text-sm text-kumo-primary placeholder:text-kumo-muted focus:border-kumo-primary focus:outline-none"
						/>
						<button
							onClick={sendMessage}
							disabled={!input.trim()}
							className="rounded-md bg-kumo-primary px-4 py-2 text-sm font-medium text-white hover:bg-kumo-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Send
						</button>
					</div>
				) : (
					<p className="text-center text-xs text-kumo-muted">
						Connecting to chat...
					</p>
				)}
			</div>
		</div>
	)
}
