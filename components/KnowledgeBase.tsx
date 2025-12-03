import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Database, AlertCircle, CheckCircle, Lock, Key, File as FileIcon, LogOut, Loader2, Cloud, HardDrive, Settings, Link as LinkIcon, RefreshCw, Wifi, FolderOpen } from 'lucide-react';
import { KnowledgeDocument } from '../types';
import { Button } from './ui/Button';
import { geminiService } from '../services/geminiService';

// Declare types for Google API globals
declare const google: any;
declare const gapi: any;

// Hardcoded System Client ID
const GOOGLE_CLIENT_ID = "310497630500-92qf1coioib4fveh4c06kc29eas362so.apps.googleusercontent.com";
const MASTER_DATA_ID = "1A0pFuvodHydIyVhSO5OLE3zAiCU1Ck8e";
const TARGET_FOLDER_ID = "1bYY4trlE53x3RUmS9zrzsTXGn1N0l8lY"; // Folder: Database AI Agent

interface KnowledgeBaseProps {
  documents: KnowledgeDocument[];
  onAddDocument: (doc: KnowledgeDocument) => void;
  onRemoveDocument: (id: string) => void;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ documents, onAddDocument, onRemoveDocument }) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Form State
  const [textInput, setTextInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Drive Integration State
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Menginisialisasi sistem...');
  const tokenClient = useRef<any>(null);

  // --- GOOGLE DRIVE LOGIC ---

  useEffect(() => {
    // 1. Load Scripts Automatically
    const script1 = document.createElement('script');
    script1.src = 'https://accounts.google.com/gsi/client';
    script1.async = true;
    script1.defer = true;
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://apis.google.com/js/api.js';
    script2.async = true;
    script2.defer = true;
    script2.onload = () => {
      gapi.load('client', () => {
        setIsGapiLoaded(true);
        // Trigger init immediately after load
        initGoogleDrive();
      });
    };
    document.body.appendChild(script2);
  }, []);

  const initGoogleDrive = async () => {
    setConnectionStatus('Menghubungkan ke Google Cloud...');
    try {
      await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });

      tokenClient.current = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (response: any) => {
          if (response.error !== undefined) {
            console.error(response);
            setConnectionStatus('Gagal terkoneksi otomatis.');
            return;
          }
          setIsDriveConnected(true);
          setConnectionStatus('Terhubung ke Database SDM.');
          listDriveFiles();
        },
      });

      // AUTOMATICALLY REQUEST ACCESS TOKEN WITHOUT USER CLICK
      // Note: Browsers might block popups if not triggered by user. 
      // If blocked, we might need a fallback, but per request we try auto first.
      setTimeout(() => {
          if (tokenClient.current) {
              tokenClient.current.requestAccessToken({ prompt: '' });
          }
      }, 1000);

    } catch (err) {
      console.error("Error initializing Google API:", err);
      setConnectionStatus('Kesalahan inisialisasi API.');
    }
  };

  const listDriveFiles = async () => {
    setIsLoadingDrive(true);
    try {
      // Query restricted to specific parent folder
      const query = `'${TARGET_FOLDER_ID}' in parents and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'text/plain') and trashed = false`;
      
      const response = await gapi.client.drive.files.list({
        pageSize: 20,
        fields: 'files(id, name, mimeType)',
        q: query,
      });
      setDriveFiles(response.result.files || []);
    } catch (err) {
      console.error("Error listing files:", err);
      if (String(err).includes("401")) {
         setIsDriveConnected(false);
         setConnectionStatus("Sesi berakhir. Menghubungkan ulang...");
         // Auto retry once
         if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: '' });
      }
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleImportById = async (fileId: string) => {
    if (!isDriveConnected) {
      // Retry connection if needed
      if(tokenClient.current) tokenClient.current.requestAccessToken();
      return;
    }
    
    setIsLoadingDrive(true);
    try {
      // Fetch file metadata first to ensure access and get details
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType'
      });
      
      if (response.result) {
        // Pass to existing import handler
        await handleImportFromDrive(response.result);
      }
    } catch (err) {
      console.error("Error fetching specific file:", err);
      alert("Gagal mengakses Data Master SDM. Pastikan akun Google memiliki akses.");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleImportFromDrive = async (file: DriveFile) => {
    setTitleInput(file.name);
    setIsExtracting(true);
    setTextInput(`⏳ Mengunduh dan membaca file '${file.name}' dari Google Drive...`);

    try {
      let blob: Blob;

      // Handling Google Docs (Must export)
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const response = await gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'application/pdf', // Export as PDF is safest for formatting
        });
        const token = gapi.client.getToken().access_token;
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`;
        const res = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
        blob = await res.blob();
      } 
      // Handling Binary Files (PDF, DOCX)
      else {
        const token = gapi.client.getToken().access_token;
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const res = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
        blob = await res.blob();
      }

      // Now send blob to Gemini for extraction
      const extractedText = await geminiService.extractDocumentContent(blob);
      setTextInput(extractedText);

    } catch (error) {
      console.error("Drive Import Error:", error);
      setTextInput(`[ERROR]\nGagal mengimpor file ${file.name} dari Drive.\nDetail: ${error}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // --- EXISTING LOGIC ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'LayananBiro2025*') {
      setIsAuthenticated(true);
      setLoginError('');
      setPasswordInput('');
    } else {
      setLoginError('Password salah. Akses ke Log ditolak.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    setLoginError('');
  };

  const handleAddText = () => {
    if (!textInput.trim() || !titleInput.trim()) return;
    
    const newDoc: KnowledgeDocument = {
      id: Date.now().toString(),
      title: titleInput,
      content: textInput,
      dateAdded: new Date(),
    };

    onAddDocument(newDoc);
    setTextInput('');
    setTitleInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTitleInput(file.name);
    
    const isPdf = file.type === 'application/pdf';
    const isText = file.name.match(/\.(txt|md|json|csv)$/i);

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTextInput(event.target?.result as string || '');
      };
      reader.readAsText(file);
    } else if (isPdf) {
      setIsExtracting(true);
      setTextInput("🤖 AI sedang membaca isi dokumen PDF lokal... Mohon tunggu sebentar.");
      try {
        const extractedText = await geminiService.extractDocumentContent(file);
        setTextInput(extractedText);
      } catch (error) {
        setTextInput(`[ERROR]\nGagal mengekstrak teks otomatis.\nSilakan salin isi dokumen ${file.name} dan tempel di sini secara manual.`);
      } finally {
        setIsExtracting(false);
      }
    } else {
      setTextInput("[INFO] Untuk file Word/Excel (.docx/.xlsx), disarankan menggunakan integrasi Drive otomatis di bawah.\n\nJika ingin manual: Salin teks dari file Anda dan tempel di sini.");
    }
  };

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-200 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-700">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Akses Log & Data SDM</h2>
          <p className="text-gray-600 mb-6">
            Masukkan password administrator untuk mengelola database pengetahuan AI.
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <Key className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>
            {loginError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}
            <Button type="submit" className="w-full">Buka Database</Button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD SCREEN ---
  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4 md:p-6 w-full">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-700" />
            Manajemen Log & Data SDM
          </h2>
          <p className="text-gray-600 mt-1 text-sm">
            Kelola sumber pengetahuan AI melalui Unggah Lokal atau Integrasi Sistem Drive.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 hover:bg-red-50 border-red-200">
          <LogOut className="w-4 h-4 mr-2" />
          Keluar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* LEFT COLUMN: Input Sources (4 columns) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
          
          {/* 1. Google Drive System Integration Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-200 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10">
                <HardDrive className="w-24 h-24 text-blue-600" />
             </div>
             
             <div className="relative z-10">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="w-5 h-5" alt="Drive" />
                 Integrasi Data Drive
               </h3>

               {/* Connection Status Panel */}
               <div className={`p-3 rounded-lg border mb-4 flex items-center gap-3 transition-colors ${isDriveConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                  {isDriveConnected ? (
                    <Wifi className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                  <span className="text-sm font-medium">
                    {isDriveConnected ? "Sistem Terhubung" : connectionStatus}
                  </span>
               </div>

               {isDriveConnected && (
                 <div className="space-y-3">
                    
                    {/* Folder Info Header */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 mb-2">
                        <FolderOpen className="w-4 h-4 text-blue-500" />
                        <span>Folder: <strong>Database AI Agent</strong></span>
                    </div>

                    {/* SHORTCUT IMPORT SECTION */}
                    <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 shadow-sm">
                       <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 block flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> Rekomendasi Sistem
                       </label>
                       <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleImportById(MASTER_DATA_ID)} 
                          className="w-full text-xs h-auto py-2 justify-start text-left bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-normal group"
                          icon={<HardDrive className="w-3 h-3 flex-shrink-0 group-hover:text-blue-600" />}
                       >
                          <div>
                            <span className="font-semibold block">Import Master Data SDM</span>
                            <span className="text-[10px] text-gray-500 opacity-80">Shortcut Langsung (Data Utama)</span>
                          </div>
                       </Button>
                    </div>
                    
                    {/* File List */}
                    <div className="border rounded-lg max-h-40 overflow-y-auto bg-gray-50 custom-scrollbar mt-2">
                      {isLoadingDrive ? (
                        <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" /></div>
                      ) : driveFiles.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          Tidak ada file di folder "Database AI Agent".
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {driveFiles.map(file => (
                            <button 
                              key={file.id}
                              onClick={() => handleImportFromDrive(file)}
                              className="w-full text-left p-2 hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm"
                            >
                              {file.mimeType.includes('pdf') ? <FileIcon className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                              <span className="truncate flex-1 text-gray-700">{file.name}</span>
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">Import</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={listDriveFiles} className="w-full text-xs h-8">
                       <RefreshCw className="w-3 h-3 mr-1" /> Refresh Folder
                    </Button>
                 </div>
               )}
               
               {/* Fallback button if auto-connect fails due to popup blocker */}
               {!isDriveConnected && (
                   <button 
                     onClick={() => tokenClient.current?.requestAccessToken()}
                     className="text-xs text-blue-400 hover:text-blue-600 underline mt-2 w-full text-center"
                   >
                     Klik di sini jika koneksi tidak berjalan otomatis
                   </button>
               )}
             </div>
          </div>

          {/* 2. Manual Upload Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
               <Upload className="w-5 h-5 text-gray-600" />
               Upload Manual (Lokal)
             </h3>
             
             <div className="space-y-3">
               <div className="relative group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.txt,.md"
                    onChange={handleLocalFileSelect}
                    disabled={isExtracting}
                  />
                  <div className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-center bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 transition-colors">
                     {isExtracting ? 'Memproses...' : 'Klik untuk Pilih File Lokal (PDF/TXT)'}
                  </div>
               </div>
             </div>
          </div>

        </div>

        {/* CENTER/RIGHT COLUMN: Editor & List (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Editor Area */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Editor Konten</h3>
            
            <div className="mb-3">
               <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Judul Dokumen..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                />
            </div>

            <div className="relative flex-1">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={isExtracting}
                  placeholder="Isi dokumen akan muncul di sini (hasil ekstraksi Drive/Upload)..."
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg outline-none resize-none font-mono text-xs leading-relaxed focus:ring-2 focus:ring-blue-500"
                />
                 {isExtracting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px] rounded-lg z-10">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                      <span className="text-sm font-medium text-blue-700 animate-pulse">AI sedang membaca dokumen...</span>
                    </div>
                  )}
            </div>
            
            <Button 
                onClick={handleAddText} 
                disabled={!textInput.trim() || !titleInput.trim() || isExtracting} 
                className="w-full mt-3"
            >
                Simpan ke Database
            </Button>
          </div>

          {/* List Area */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="font-semibold text-gray-700 text-sm">Dokumen Tersimpan ({documents.length})</span>
              <div title="Tersimpan di Browser">
                <Cloud className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="overflow-y-auto p-3 space-y-2 flex-1 custom-scrollbar">
              {documents.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-10">Belum ada dokumen.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="group flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                       <div className="bg-blue-50 p-2 rounded text-blue-600">
                          <FileText className="w-4 h-4" />
                       </div>
                       <div className="min-w-0">
                          <h4 className="text-sm font-medium text-gray-800 truncate">{doc.title}</h4>
                          <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{doc.content.substring(0, 50)}...</p>
                       </div>
                    </div>
                    <button onClick={() => onRemoveDocument(doc.id)} className="text-gray-300 hover:text-red-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};