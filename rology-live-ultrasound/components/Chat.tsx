import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserRole } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  role: UserRole;
  onSendMessage: (text: string) => void;
}

const Chat: React.FC<ChatProps> = ({ messages, role, onSendMessage }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-3 border-b border-slate-700 bg-slate-900/50">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-rology-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Live Notes
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === role ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-2 text-sm ${msg.role === role ? 'bg-rology-500 text-white' : 'bg-slate-700 text-slate-200'}`}>
              {msg.text}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a note..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rology-accent transition-colors"
          />
          <button 
            type="submit" 
            className="bg-rology-accent hover:bg-cyan-600 text-slate-900 font-bold p-1.5 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;