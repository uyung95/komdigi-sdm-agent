import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Button } from './ui/Button';

interface ChatInterfaceProps {
  history: Message[];
  onSendMessage: (text: string) => Promise<void>;
  onReset: () => void;
  isLoading: boolean;
  hasKnowledge: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  history, 
  onSendMessage, 
  onReset,
  isLoading,
  hasKnowledge
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue('');
    
    // Reset height of textarea
    if(inputRef.current) {
        inputRef.current.style.height = 'auto';
    }

    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">Agent SDM Komdigi</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-gray-500 font-medium">Online • Terhubung ke Data Internal</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} title="Reset Percakapan">
          <RefreshCw className="w-4 h-4 mr-2" />
          Mulai Baru
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50">
        
        {history.length === 0 && (
           <div className="max-w-2xl mx-auto mt-10 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-700">
                  <Bot className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Halo! Ada yang bisa saya bantu?</h3>
              <p className="text-gray-600 mb-8">
                  Saya siap menjawab pertanyaan seputar layanan SDM, cuti, kenaikan pangkat, dan organisasi Komdigi berdasarkan data yang tersedia.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
                  <button onClick={() => { setInputValue("Bagaimana prosedur pengajuan cuti tahunan?"); if(inputRef.current) inputRef.current.focus(); }} className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-blue-300 hover:shadow-sm transition-all">
                      "Bagaimana prosedur pengajuan cuti tahunan?"
                  </button>
                  <button onClick={() => { setInputValue("Apa syarat kenaikan pangkat reguler?"); if(inputRef.current) inputRef.current.focus(); }} className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-blue-300 hover:shadow-sm transition-all">
                      "Apa syarat kenaikan pangkat reguler?"
                  </button>
              </div>
           </div>
        )}

        {history.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-700 flex-shrink-0 flex items-center justify-center text-white mt-1 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
            )}
            
            <div
              className={`flex-1 max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
              }`}
            >
              <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-600 mt-1">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-4 max-w-4xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex-shrink-0 flex items-center justify-center text-white mt-1 shadow-sm">
                <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto relative">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 shadow-sm transition-all">
                <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={adjustTextareaHeight}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik pertanyaan Anda tentang layanan SDM..."
                    className="w-full max-h-[150px] py-1 bg-transparent border-none focus:ring-0 resize-none outline-none text-gray-800 placeholder:text-gray-400 leading-relaxed"
                    rows={1}
                />
                <Button 
                    type="submit" 
                    size="sm" 
                    disabled={!inputValue.trim() || isLoading}
                    className="mb-0.5 rounded-lg h-9 w-9 p-0 flex items-center justify-center shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-2">
                AI menjawab berdasarkan data internal Biro SDM. Selalu verifikasi informasi penting dengan petugas resmi.
            </p>
        </div>
      </div>
    </div>
  );
};