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
  Settings
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
  
  // AI State
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Editor State
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [workerCode, setWorkerCode] = useState('');
  const [workerName, setWorkerName] = useState('');

  useEffect(() => {
    if (token) {
      handleLogin(token);
    }
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
      Zones: ${zones.map(z => z.name).join(', ')}.`;
      
      const response = await ai.chatWithAI(userMsg, context, geminiKey);
      setAiMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error. Please check your Gemini API Key in Settings." }]);
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
      const response = await ai.analyzeWorker(scriptText, geminiKey);
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
      await cf.upsertWorker(selectedAccount.id, workerName, workerCode);
      setEditingWorker(null);
      fetchWorkers();
    } catch (err) {
      alert('Error saving worker');
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
                    setWorkerCode('export default {\n  async fetch(request, env, ctx) {\n    return new Response("Hello World!");\n  },\n};');
                  }}>
                    <Plus className="w-4 h-4" />
                    Create Worker
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workers.map(worker => (
                    <div 
                      key={worker.id} 
                      onClick={() => {
                        setEditingWorker(worker);
                        setWorkerName(worker.id);
                        setWorkerCode('// Fetching code...');
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
                        <Markdown>
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
                  <Button variant="secondary" size="sm" onClick={async () => {
                    setAiLoading(true);
                    try {
                      const code = await ai.generateWorkerCode(workerName || "a simple worker", geminiKey);
                      setWorkerCode(code);
                    } finally {
                      setAiLoading(false);
                    }
                  }}>
                    <Sparkles className="w-4 h-4" />
                    AI Generate
                  </Button>
                  <Button size="sm" onClick={saveWorker}>Save & Deploy</Button>
                  <button onClick={() => setEditingWorker(null)} className="p-2 hover:bg-white/5 rounded-full ml-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 bg-white/5 border-b border-white/5">
                  <input 
                    type="text" 
                    placeholder="Worker Name (e.g. my-api)"
                    className="w-full bg-transparent font-mono text-sm focus:outline-none"
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    disabled={!!editingWorker.id}
                  />
                </div>
                <textarea 
                  className="flex-1 w-full bg-transparent p-6 font-mono text-sm resize-none focus:outline-none scrollbar-hide"
                  value={workerCode}
                  onChange={(e) => setWorkerCode(e.target.value)}
                  spellCheck={false}
                />
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Gemini API Key</label>
                  <input 
                    type="password"
                    placeholder="Enter Gemini API Key..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cf-orange/50 transition-all"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      localStorage.setItem('gemini_api_key', e.target.value);
                    }}
                  />
                  <p className="mt-2 text-xs text-white/40">
                    Used for AI Generate, AI Analyze, and Assistant.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/30 mb-2 uppercase tracking-widest">About Dashbro</p>
                  <p className="text-sm text-white/60">Version 1.1.0</p>
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
