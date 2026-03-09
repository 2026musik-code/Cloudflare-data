import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  Cpu, 
  Globe, 
  LayoutDashboard, 
  LogOut, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit3, 
  Search,
  ChevronRight,
  Loader2,
  Terminal,
  Shield,
  Zap,
  Code2,
  Sparkles,
  X,
  Menu,
  Settings,
  CheckCircle2,
  Eye,
  ExternalLink,
  Info,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';

import * as cf from './services/cloudflareService';
import * as ai from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const CodePreview = ({ code, language }: { code: string; language?: string }) => {
  const [showPreview, setShowPreview] = useState(false);
  
  const isPreviewable = language === 'html' || language === 'xml' || code.trim().startsWith('<');

  if (!isPreviewable) return null;

  return (
    <div className="mt-2 border border-white/10 rounded-xl overflow-hidden bg-black/40">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Live Preview</span>
        <button 
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-cf-orange hover:text-cf-orange/80 transition-colors"
        >
          {showPreview ? <X className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showPreview ? 'Close Preview' : 'Show Preview'}
        </button>
      </div>
      {showPreview && (
        <div className="bg-white h-[300px] w-full">
          <iframe 
            srcDoc={code}
            title="Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts"
          />
        </div>
      )}
    </div>
  );
};

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'cf-gradient text-white hover:opacity-90',
      secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/10',
      danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
      ghost: 'bg-transparent text-white/70 hover:text-white hover:bg-white/5',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('glass rounded-xl p-6', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('cf_token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [view, setView] = useState<'workers' | 'dns'>('workers');
  const [workers, setWorkers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  
  // Mobile State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [savedKeys, setSavedKeys] = useState<{ id: string; name: string; key: string }[]>(() => {
    const saved = localStorage.getItem('dashbro_gemini_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [keyStatus, setKeyStatus] = useState<Record<string, 'checking' | 'connected' | 'failed' | 'idle'>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(localStorage.getItem('gemini_model') || 'gemini-3-flash-preview');

  const syncKeysToR2 = async (keysToSync = savedKeys) => {
    setIsSyncing(true);
    try {
      await fetch('/api/storage/gemini_keys.json', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keysToSync),
      });
    } catch (error) {
      console.error("Failed to sync keys to R2:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadKeysFromR2 = async () => {
    try {
      const response = await fetch('/api/storage/gemini_keys.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setSavedKeys(data);
          localStorage.setItem('dashbro_gemini_keys', JSON.stringify(data));
          
          // If no active key is set, pick the first one from R2
          if (!localStorage.getItem('gemini_api_key') && data.length > 0) {
            setGeminiKey(data[0].key);
            localStorage.setItem('gemini_api_key', data[0].key);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load keys from R2:", error);
    }
  };

  const checkKeyConnection = async (id: string, key: string) => {
    setKeyStatus(prev => ({ ...prev, [id]: 'checking' }));
    const isValid = await ai.validateKey(key);
    setKeyStatus(prev => ({ ...prev, [id]: isValid ? 'connected' : 'failed' }));
  };
  
  const saveNewKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    const keyObj = { id: Date.now().toString(), name: newKeyName, key: newKeyValue };
    const updated = [...savedKeys, keyObj];
    setSavedKeys(updated);
    localStorage.setItem('dashbro_gemini_keys', JSON.stringify(updated));
    setNewKeyName('');
    setNewKeyValue('');
    
    // Sync to R2
    await syncKeysToR2(updated);
    
    // If no active key, set this as active
    if (!geminiKey) {
      setGeminiKey(newKeyValue);
      localStorage.setItem('gemini_api_key', newKeyValue);
    }
  };

  const deleteKey = async (id: string) => {
    const updated = savedKeys.filter(k => k.id !== id);
    setSavedKeys(updated);
    localStorage.setItem('dashbro_gemini_keys', JSON.stringify(updated));
    await syncKeysToR2(updated);
  };

  const selectKey = (key: string) => {
    setGeminiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };
  
  // AI State
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatContext, setChatContext] = useState<string>('');

  // Editor State
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [workerCode, setWorkerCode] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerPrompt, setWorkerPrompt] = useState('');
  const [isCodeGenerated, setIsCodeGenerated] = useState(false);

  useEffect(() => {
    if (token) {
      handleLogin(token);
    }
    loadKeysFromR2();
  }, []);

  const handleLogin = async (inputToken: string) => {
    setLoading(true);
    try {
      cf.setAuthToken(inputToken);
      const accs = await cf.getAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccount(accs[0]);
      }
      const initialZones = await cf.getZones();
      setZones(initialZones);
      
      localStorage.setItem('cf_token', inputToken);
      setToken(inputToken);
      setIsLoggedIn(true);
    } catch (err) {
      console.error(err);
      alert('Invalid Token or API Error');
      localStorage.removeItem('cf_token');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cf_token');
    setToken('');
    setIsLoggedIn(false);
    setAccounts([]);
    setSelectedAccount(null);
  };

  useEffect(() => {
    if (selectedAccount && view === 'workers') {
      fetchWorkers();
    }
  }, [selectedAccount, view]);

  const fetchWorkers = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const data = await cf.getWorkers(selectedAccount.id);
      setWorkers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDnsRecords = async (zoneId: string) => {
    setLoading(true);
    try {
      const data = await cf.getDnsRecords(zoneId);
      setDnsRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAiChat = async () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput;
    setAiMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiInput('');
    setAiLoading(true);
    
    try {
      const context = `Current Account: ${selectedAccount?.name}. Current View: ${view}. 
      Workers: ${workers.map(w => w.id).join(', ')}. 
      Zones: ${zones.map(z => z.name).join(', ')}.
      Active Context: ${chatContext || "None"}`;
      
      const response = await ai.chatWithAI(userMsg, context, geminiKey, selectedModel);
      setAiMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      const errorDetail = err.message || "Unknown error";
      setAiMessages(prev => [...prev, { 
        role: 'ai', 
        content: `Sorry, I encountered an error: **${errorDetail}**. Please check your Gemini API Key in Settings and ensure it has access to the selected model (${selectedModel}).` 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzeWorker = async (scriptName: string) => {
    if (!selectedAccount) return;
    setAiOpen(true);
    setAiLoading(true);
    setAiMessages(prev => [...prev, { role: 'user', content: `Analyze worker: ${scriptName}` }]);
    try {
      // Fetch the actual script content using the new helper
      const content = await cf.getWorkerContent(selectedAccount.id, scriptName);
      
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        throw new Error("Worker content is empty or could not be retrieved.");
      }

      const scriptText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      setChatContext(`Analyzing worker "${scriptName}". Code:\n${scriptText}`);
      const response = await ai.analyzeWorker(scriptText, geminiKey, selectedModel);
      setAiMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message || "Unknown error";
      setAiMessages(prev => [...prev, { 
        role: 'ai', 
        content: `**Error analyzing worker:** ${errorMsg}\n\nThis usually happens if:\n1. The API Token lacks "Account.Workers Scripts: Read" permission.\n2. The worker script is too large for the AI context.\n3. There was a network issue with Cloudflare.\n4. Your Gemini API Key is invalid.` 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const saveWorker = async () => {
    if (!selectedAccount || !workerName || !workerCode) return;
    setLoading(true);
    try {
      // Final cleanup of code (remove markdown backticks if any)
      const cleanCode = workerCode
        .replace(/^```(?:javascript|js|typescript|ts|html)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      
      await cf.upsertWorker(selectedAccount.id, workerName, cleanCode);
      setEditingWorker(null);
      fetchWorkers();
    } catch (err: any) {
      console.error('Save Worker Error:', err);
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message || "Unknown error";
      alert(`Error saving worker: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (name: string) => {
    if (!confirm(`Delete worker ${name}?`)) return;
    setLoading(true);
    try {
      await cf.deleteWorker(selectedAccount.id, name);
      fetchWorkers();
    } catch (err) {
      alert('Error deleting worker');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] from-cf-orange/10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl cf-gradient mb-4 shadow-lg shadow-cf-orange/20">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-serif font-bold mb-2">Dashbro AI</h1>
            <p className="text-white/50">Modern Cloudflare Management</p>
          </div>
          
          <Card className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Cloudflare API Token</label>
              <input 
                type="password"
                placeholder="Paste your token here..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cf-orange/50 transition-all"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="mt-2 text-xs text-white/40">
                Requires: <b>Account.Workers Scripts (Edit)</b>, <b>Zone.DNS (Read/Edit)</b>, and <b>Account.Account (Read)</b>.
                <br />
                <span className="text-cf-orange/60">Note: Use an API Token, not a Global API Key.</span>
              </p>
            </div>
            
            <Button 
              className="w-full py-3" 
              onClick={() => handleLogin(token)}
              disabled={loading || !token}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect Dashboard'}
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 border-r border-dark-border flex flex-col bg-dark-card/95 backdrop-blur-xl z-[70] transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg cf-gradient flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif font-bold text-xl">Dashbro</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => { setView('workers'); setSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              view === 'workers' ? "bg-cf-orange/10 text-cf-orange" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Cpu className="w-5 h-5" />
            <span className="font-medium">Workers</span>
          </button>
          <button 
            onClick={() => { setView('dns'); setSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              view === 'dns' ? "bg-cf-orange/10 text-cf-orange" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Globe className="w-5 h-5" />
            <span className="font-medium">DNS Records</span>
          </button>
          <button 
            onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              settingsOpen ? "bg-cf-orange/10 text-cf-orange" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Account</p>
            <select 
              className="w-full bg-transparent text-sm font-medium focus:outline-none"
              value={selectedAccount?.id}
              onChange={(e) => setSelectedAccount(accounts.find(a => a.id === e.target.value))}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-dark-card">{acc.name}</option>
              ))}
            </select>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-dark-border flex items-center justify-between px-4 lg:px-8 bg-dark-card/30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold capitalize">{view}</h2>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cf-orange/50 w-32 lg:w-64"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setAiOpen(!aiOpen)} className="px-2 sm:px-4">
              <Sparkles className="w-4 h-4 text-cf-orange" />
              <span className="hidden xs:inline">AI Assistant</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide">
          <AnimatePresence mode="wait">
            {view === 'workers' ? (
              <motion.div 
                key="workers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-serif font-bold">Workers Scripts</h3>
                    <p className="text-white/50 text-sm">Deploy serverless code instantly</p>
                  </div>
                  <Button onClick={() => {
                    setEditingWorker({});
                    setWorkerName('');
                    setWorkerPrompt('');
                    setWorkerCode('');
                    setIsCodeGenerated(false);
                  }}>
                    <Plus className="w-4 h-4" />
                    Create Worker
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workers.map(worker => (
                    <div 
                      key={worker.id} 
                      onClick={async () => {
                        setEditingWorker(worker);
                        setWorkerName(worker.id);
                        setWorkerCode('// Fetching code...');
                        setIsCodeGenerated(true);
                        try {
                          const content = await cf.getWorkerContent(selectedAccount!.id, worker.id);
                          const scriptText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                          setWorkerCode(scriptText);
                        } catch (err) {
                          setWorkerCode('// Error fetching code. Please try again.');
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Card className="group hover:border-cf-orange/30 transition-all h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-cf-orange/10 flex items-center justify-center">
                          <Terminal className="w-5 h-5 text-cf-orange" />
                        </div>
                        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAnalyzeWorker(worker.id); }}
                            className="p-2 hover:bg-white/10 rounded-lg text-cf-orange" title="AI Analyze"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingWorker(worker);
                              setWorkerName(worker.id);
                              // In real app, fetch content first
                              setWorkerCode('// Fetching code...');
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/70"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker.id); }}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-lg mb-1 truncate">{worker.id}</h4>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {worker.usage_model || 'Standard'}</span>
                        <span>•</span>
                        <span>Updated {new Date(worker.modified_on).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  </div>
                  ))}
                  {workers.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
                      <p className="text-white/30">No workers found in this account.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="dns"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-serif font-bold">DNS Management</h3>
                    <p className="text-white/50 text-sm">Manage your domains and records</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-1 space-y-2">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest px-2">Zones</p>
                    {zones.map(zone => (
                      <button
                        key={zone.id}
                        onClick={() => {
                          setSelectedZone(zone);
                          fetchDnsRecords(zone.id);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group",
                          selectedZone?.id === zone.id ? "bg-white/10 border border-white/10" : "hover:bg-white/5"
                        )}
                      >
                        <span className="font-medium truncate">{zone.name}</span>
                        <ChevronRight className={cn("w-4 h-4 transition-transform", selectedZone?.id === zone.id ? "rotate-90" : "opacity-0 group-hover:opacity-100")} />
                      </button>
                    ))}
                  </div>

                  <div className="lg:col-span-3">
                    {selectedZone ? (
                      <Card className="p-0 overflow-hidden">
                        <div className="p-6 border-bottom border-white/5 flex items-center justify-between">
                          <h4 className="font-bold">{selectedZone.name} Records</h4>
                          <Button size="sm"><Plus className="w-4 h-4" /> Add Record</Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-white/40 font-medium">
                              <tr>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Content</th>
                                <th className="px-6 py-3">Proxy</th>
                                <th className="px-6 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {dnsRecords.map(record => (
                                <tr key={record.id} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-cf-blue/20 text-cf-blue font-bold text-[10px]">{record.type}</span></td>
                                  <td className="px-6 py-4 font-medium">{record.name}</td>
                                  <td className="px-6 py-4 text-white/60 truncate max-w-xs">{record.content}</td>
                                  <td className="px-6 py-4">
                                    {record.proxied ? (
                                      <div className="flex items-center gap-1 text-cf-orange"><Shield className="w-3 h-3" /> Proxied</div>
                                    ) : (
                                      <span className="text-white/30">DNS Only</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button className="p-1 hover:text-cf-orange"><Edit3 className="w-4 h-4" /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-white/20">
                        <Globe className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a zone to view DNS records</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Assistant Drawer */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-full sm:w-96 bg-dark-card border-l border-dark-border shadow-2xl z-[80] flex flex-col"
            >
              <div className="p-6 border-b border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cf-orange" />
                  <h3 className="font-bold">AI Assistant</h3>
                </div>
                <button onClick={() => setAiOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {aiMessages.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-2xl bg-cf-orange/10 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6 text-cf-orange" />
                    </div>
                    <p className="text-sm text-white/50">How can I help you with your Cloudflare setup today?</p>
                    <div className="mt-6 grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => setAiInput("Generate a basic redirect worker")}
                        className="text-xs text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5"
                      >
                        "Generate a basic redirect worker"
                      </button>
                      <button 
                        onClick={() => setAiInput("Explain DNS proxying")}
                        className="text-xs text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5"
                      >
                        "Explain DNS proxying"
                      </button>
                    </div>
                  </div>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm",
                      msg.role === 'user' ? "bg-cf-orange text-white rounded-tr-none" : "bg-white/5 text-white/90 rounded-tl-none border border-white/10"
                    )}>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Markdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              const code = String(children).replace(/\n$/, '');
                              return !inline ? (
                                <div className="relative group">
                                  <pre className={cn(className, "bg-black/40 p-4 rounded-xl border border-white/5 overflow-x-auto")}>
                                    <code {...props}>{children}</code>
                                  </pre>
                                  <CodePreview code={code} language={match?.[1]} />
                                </div>
                              ) : (
                                <code className="bg-white/10 px-1.5 py-0.5 rounded text-cf-orange" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            p({ children }) {
                              const text = String(children);
                              if (typeof children === 'string') {
                                if (children.startsWith('[IMPORTANT:')) {
                                  return (
                                    <div className="my-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 items-start">
                                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                      <div className="text-red-200 font-medium">
                                        <span className="font-bold uppercase text-xs block mb-1">Important</span>
                                        {children.replace('[IMPORTANT:', '').replace(']', '')}
                                      </div>
                                    </div>
                                  );
                                }
                                if (children.startsWith('[TIP:')) {
                                  return (
                                    <div className="my-4 p-4 rounded-xl bg-cf-orange/10 border border-cf-orange/20 flex gap-3 items-start">
                                      <Lightbulb className="w-5 h-5 text-cf-orange shrink-0 mt-0.5" />
                                      <div className="text-cf-orange/90 font-medium">
                                        <span className="font-bold uppercase text-xs block mb-1">Tip</span>
                                        {children.replace('[TIP:', '').replace(']', '')}
                                      </div>
                                    </div>
                                  );
                                }
                                if (children.startsWith('[SUCCESS:')) {
                                  return (
                                    <div className="my-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 items-start">
                                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                      <div className="text-emerald-200 font-medium">
                                        <span className="font-bold uppercase text-xs block mb-1">Success</span>
                                        {children.replace('[SUCCESS:', '').replace(']', '')}
                                      </div>
                                    </div>
                                  );
                                }
                              }
                              return <p>{children}</p>;
                            }
                          }}
                        >
                          {msg.content}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-white/40 text-xs italic">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Gemini is thinking...
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-dark-border">
                <div className="relative">
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
                    placeholder="Ask anything..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cf-orange/50"
                  />
                  <button 
                    onClick={handleAiChat}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-cf-orange hover:bg-cf-orange/10 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Worker Editor Modal */}
      <AnimatePresence>
        {editingWorker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingWorker(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code2 className="w-6 h-6 text-cf-orange" />
                  <div>
                    <h3 className="font-bold text-lg">{editingWorker.id ? 'Edit Worker' : 'New Worker'}</h3>
                    <p className="text-xs text-white/40">Worker Script Editor</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingWorker.id && (
                    <Button size="sm" onClick={saveWorker} disabled={loading || aiLoading}>Save & Deploy</Button>
                  )}
                  <button onClick={() => setEditingWorker(null)} className="p-2 hover:bg-white/5 rounded-full ml-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* Left Panel: Controls & AI Prompt */}
                <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-dark-border p-6 bg-white/5 space-y-6 overflow-y-auto scrollbar-hide">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Worker Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. my-awesome-api"
                        className="w-full bg-transparent font-mono text-sm focus:outline-none border-b border-white/10 pb-1 focus:border-cf-orange/50 transition-colors"
                        value={workerName}
                        onChange={(e) => setWorkerName(e.target.value)}
                        disabled={!!editingWorker.id}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                        {editingWorker.id ? 'AI Instructions' : 'AI Prompt'}
                      </label>
                      <div className="flex flex-col gap-3">
                        <textarea 
                          placeholder={editingWorker.id 
                            ? "What would you like to change or improve?" 
                            : "Describe your worker in detail..."
                          }
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-cf-orange/50 resize-none h-48 lg:h-64 transition-all"
                          value={workerPrompt}
                          onChange={(e) => setWorkerPrompt(e.target.value)}
                        />
                        <Button 
                          onClick={async () => {
                            if (!workerPrompt) return;
                            setAiLoading(true);
                            try {
                              let code;
                              if (editingWorker.id) {
                                code = await ai.improveWorkerCode(workerCode, workerPrompt, geminiKey, selectedModel);
                              } else {
                                code = await ai.generateWorkerCode(workerPrompt, geminiKey, selectedModel);
                              }
                              setWorkerCode(code);
                              setIsCodeGenerated(true);
                              setWorkerPrompt('');
                            } finally {
                              setAiLoading(false);
                            }
                          }} 
                          disabled={!workerPrompt || aiLoading}
                          className="w-full py-3"
                        >
                          <Sparkles className="w-4 h-4" />
                          {editingWorker.id ? 'Improve with AI' : 'Generate Code'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isCodeGenerated && (
                    <div className="pt-4 border-t border-white/5">
                      <Button 
                        size="lg" 
                        className="w-full py-4 text-base shadow-[0_0_20px_rgba(242,125,38,0.1)]"
                        onClick={saveWorker}
                        disabled={loading || !workerName}
                      >
                        <Zap className="w-5 h-5" />
                        Deploy Worker
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right Panel: Editor */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d] relative group">
                  <div className="absolute top-3 right-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">JavaScript (ESM)</span>
                  </div>
                  
                  <div className="flex-1 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-12 bg-black/20 border-r border-white/5 flex flex-col items-center pt-6 text-[10px] font-mono text-white/10 select-none overflow-hidden">
                      {Array.from({ length: Math.max(20, workerCode.split('\n').length + 5) }).map((_, i) => (
                        <div key={i} className="h-5 leading-5">{i + 1}</div>
                      ))}
                    </div>
                    <textarea 
                      className="absolute inset-0 w-full h-full bg-transparent pl-16 pr-6 pt-6 font-mono text-sm resize-none focus:outline-none scrollbar-hide leading-5 text-cf-orange/90"
                      value={workerCode}
                      onChange={(e) => {
                        setWorkerCode(e.target.value);
                        if (e.target.value.trim()) setIsCodeGenerated(true);
                      }}
                      spellCheck={false}
                      placeholder={!editingWorker.id ? "// Code will appear here after generation..." : ""}
                    />
                  </div>

                  {aiLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-30">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-2 border-cf-orange/20 border-t-cf-orange animate-spin" />
                          <Sparkles className="w-5 h-5 text-cf-orange absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <span className="text-sm font-medium text-white/80 tracking-wide">AI is working...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-cf-orange" />
                  <h3 className="font-bold text-lg">Settings</h3>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cf-orange" />
                    Select AI Model
                  </h4>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cf-orange/50 transition-all appearance-none cursor-pointer"
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      localStorage.setItem('gemini_model', e.target.value);
                    }}
                  >
                    <option value="gemini-2.5-flash" className="bg-dark-card">Gemini 2.5 Flash</option>
                    <option value="gemini-3.1-flash-lite-preview" className="bg-dark-card">Gemini 2.5 Flash Lite</option>
                    <option value="gemini-3-flash-preview" className="bg-dark-card">Gemini 3 Flash</option>
                  </select>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-cf-orange" />
                    Add New Gemini Key
                  </h4>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Key Name (e.g. Personal, Work)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cf-orange/50 transition-all"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input 
                        type="password"
                        placeholder="Paste API Key here..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cf-orange/50 transition-all"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                      />
                      <Button size="sm" onClick={saveNewKey} disabled={!newKeyName || !newKeyValue}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>

                {savedKeys.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-white/80">Saved Keys</h4>
                      <button 
                        onClick={() => syncKeysToR2()}
                        disabled={isSyncing}
                        className="text-[10px] uppercase tracking-widest text-cf-orange hover:text-cf-orange/80 disabled:opacity-50"
                      >
                        {isSyncing ? 'Syncing...' : 'Sync to R2'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {savedKeys.map((k) => (
                        <div 
                          key={k.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                            geminiKey === k.key 
                              ? "bg-cf-orange/10 border-cf-orange/30" 
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                          onClick={() => selectKey(k.key)}
                        >
                          <div className="flex items-center gap-3">
                            {geminiKey === k.key ? (
                              <CheckCircle2 className="w-4 h-4 text-cf-orange" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-white/20" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{k.name}</p>
                                {keyStatus[k.id] === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
                                {keyStatus[k.id] === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
                                {keyStatus[k.id] === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-white/40" />}
                              </div>
                              <p className="text-[10px] text-white/30 font-mono">
                                {k.key.substring(0, 6)}...{k.key.substring(k.key.length - 4)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); checkKeyConnection(k.id, k.key); }}
                              className="p-2 text-white/20 hover:text-cf-orange hover:bg-cf-orange/10 rounded-lg transition-all"
                              title="Test Connection"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteKey(k.id); }}
                              className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/30 mb-2 uppercase tracking-widest">About Dashbro</p>
                  <p className="text-sm text-white/60">Version 1.2.0</p>
                  <p className="text-sm text-white/60">Cloudflare Management with AI</p>
                </div>
              </div>

              <Button className="w-full mt-8" onClick={() => setSettingsOpen(false)}>
                Close
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-dark-card/80 border border-white/10 p-4 rounded-2xl flex items-center gap-3 shadow-2xl">
              <Loader2 className="w-5 h-5 animate-spin text-cf-orange" />
              <span className="text-sm font-medium">Syncing with Cloudflare...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
