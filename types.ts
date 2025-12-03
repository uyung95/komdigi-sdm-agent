export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  dateAdded: Date;
}

export enum AppView {
  CHAT = 'CHAT',
  KNOWLEDGE = 'KNOWLEDGE',
}

export interface ChatState {
  history: Message[];
  isLoading: boolean;
}