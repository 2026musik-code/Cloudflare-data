import axios from 'axios';

const api = axios.create({
  baseURL: '/api/cloudflare',
});

export const setAuthToken = (token: string) => {
  // Clean up token: remove leading/trailing whitespace and ensure single Bearer prefix
  let cleanToken = token.trim().replace(/^(bearer\s+|Bearer\s+)+/i, '');
  // Strip quotes if user accidentally included them
  cleanToken = cleanToken.replace(/^["']|["']$/g, '');
  api.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
};

export const getAccounts = async () => {
  const response = await api.get('/accounts');
  return response.data.result;
};

export const getWorkers = async (accountId: string) => {
  const response = await api.get(`/accounts/${accountId}/workers/scripts`);
  return response.data.result;
};

export const getWorkerContent = async (accountId: string, scriptName: string) => {
  const response = await api.get(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
    transformResponse: [(data) => data],
  });
  return response.data;
};

export const upsertWorker = async (accountId: string, scriptName: string, content: string, bindings?: any[]) => {
  const isModule = /\bexport\s+default\b/.test(content) || /\bexport\s+\{/.test(content) || /\bexport\s+(const|let|var|function|class)\b/.test(content);

  if (isModule) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'worker.js',
      bindings: bindings || []
    }));
    formData.append('worker.js', new Blob([content], { type: 'application/javascript+module' }), 'worker.js');
    
    const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.result;
  } else {
    if (!bindings || bindings.length === 0) {
      const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, content, {
        headers: {
          'Content-Type': 'application/javascript',
        },
      });
      return response.data.result;
    } else {
      const formData = new FormData();
      formData.append('metadata', JSON.stringify({
        body_part: 'script',
        bindings: bindings
      }));
      formData.append('script', new Blob([content], { type: 'application/javascript' }), 'script.js');
      
      const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.result;
    }
  }
};

export const deleteWorker = async (accountId: string, scriptName: string) => {
  const response = await api.delete(`/accounts/${accountId}/workers/scripts/${scriptName}`);
  return response.data.result;
};

export const createKvNamespace = async (accountId: string, title: string) => {
  const response = await api.post(`/accounts/${accountId}/storage/kv/namespaces`, { title });
  return response.data.result;
};

export const listKvNamespaces = async (accountId: string) => {
  const response = await api.get(`/accounts/${accountId}/storage/kv/namespaces`);
  return response.data.result;
};

export const createR2Bucket = async (accountId: string, name: string) => {
  const response = await api.post(`/accounts/${accountId}/r2/buckets`, { name });
  return response.data.result;
};

export const listR2Buckets = async (accountId: string) => {
  const response = await api.get(`/accounts/${accountId}/r2/buckets`);
  return response.data.result;
};

export const getZones = async () => {
  const response = await api.get('/zones');
  return response.data.result;
};

export const getDnsRecords = async (zoneId: string) => {
  const response = await api.get(`/zones/${zoneId}/dns_records`);
  return response.data.result;
};
