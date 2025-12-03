import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeBase } from './components/KnowledgeBase';
import { AppView, Message, KnowledgeDocument } from './types';
import { geminiService } from './services/geminiService';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Combine all documents into a single context string for the AI
  const contextData = useMemo(() => {
    if (documents.length === 0) return "";
    
    return documents.map(doc => 
      `--- MULAI DOKUMEN: ${doc.title} ---\n${doc.content}\n--- AKHIR DOKUMEN ---\n`
    ).join('\n');
  }, [documents]);

  const handleSendMessage = async (text: string) => {
    // Optimistic update
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    
    // Initial placeholder for AI response
    const aiMsgId = (Date.now() + 1).toString();
    const placeholderAiMsg: Message = {
      id: aiMsgId,
      role: 'model',
      text: '', // Empty initially
      timestamp: new Date(),
    };

    setHistory(prev => [...prev, userMsg, placeholderAiMsg]);
    setIsLoading(true);

    try {
      const stream = await geminiService.sendMessageStream(text, contextData, history);
      
      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        // Stream update
        setHistory(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, text: fullText } : msg
        ));
      }
    } catch (error) {
      setHistory(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, text: "Maaf, terjadi kesalahan saat menghubungi layanan AI. Pastikan API Key valid atau coba lagi nanti.", isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setHistory([]);
  };

  const handleAddDocument = (doc: KnowledgeDocument) => {
    setDocuments(prev => [...prev, doc]);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  return (
    <Layout currentView={currentView} onChangeView={setCurrentView}>
      {currentView === AppView.CHAT && (
        <ChatInterface 
          history={history}
          onSendMessage={handleSendMessage}
          onReset={handleReset}
          isLoading={isLoading}
          hasKnowledge={documents.length > 0}
        />
      )}
      
      {currentView === AppView.KNOWLEDGE && (
        <KnowledgeBase 
          documents={documents}
          onAddDocument={handleAddDocument}
          onRemoveDocument={handleRemoveDocument}
        />
      )}
    </Layout>
  );
}