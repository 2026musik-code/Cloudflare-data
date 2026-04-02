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

export const generateScopedToken = async (globalKey: string) => {
  setAuthToken(globalKey);
  
  try {
    const groupsRes = await api.get('/user/tokens/permission_groups');
    const groups = groupsRes.data.result;
    
    const findGroupId = (nameIncludes: string[]) => {
      const matchedGroups = groups.filter((g: any) => {
        return nameIncludes.every(name => g.name.toLowerCase().includes(name.toLowerCase()));
      });
      if (matchedGroups.length === 0) throw new Error(`Permission group not found for: ${nameIncludes.join(' ')}`);
      matchedGroups.sort((a: any, b: any) => a.name.length - b.name.length);
      return matchedGroups[0].id;
    };

    const accountReadId = findGroupId(['account', 'read']);
    const dnsEditId = findGroupId(['dns', 'write']);
    const workersEditId = findGroupId(['workers', 'scripts', 'write']);
    const kvEditId = findGroupId(['kv', 'storage', 'write']);
    const r2EditId = findGroupId(['r2', 'write']);

    const tokenRes = await api.post('/user/tokens', {
      name: `Dashbro Auto-Generated Token - ${new Date().toISOString().split('T')[0]}`,
      policies: [
        {
          effect: 'allow',
          resources: {
            'com.cloudflare.api.account.*': '*'
          },
          permission_groups: [
            { id: accountReadId },
            { id: workersEditId },
            { id: kvEditId },
            { id: r2EditId }
          ]
        },
        {
          effect: 'allow',
          resources: {
            'com.cloudflare.api.zone.*': '*'
          },
          permission_groups: [
            { id: dnsEditId }
          ]
        }
      ]
    });

    return tokenRes.data.result.value;
  } catch (error: any) {
    console.error("Error generating token:", error);
    const cfError = error.response?.data?.errors?.[0]?.message;
    const cfErrorCode = error.response?.data?.errors?.[0]?.code;
    const errorChainCode = error.response?.data?.errors?.[0]?.error_chain?.[0]?.code;
    
    if (cfError === "Authentication error" || cfErrorCode === 10000) {
      throw new Error("Authentication error. Please ensure you are using your Global API Key (not an API Token) and the format is exactly 'your-email@example.com:your-global-api-key'.");
    }
    if (errorChainCode === 6111 || cfErrorCode === 6003) {
      throw new Error("Invalid token format. Please ensure there are no spaces or invalid characters in your token or email:key.");
    }
    throw new Error(cfError || "Failed to generate token. Make sure you provided a valid Global API Key (email:key).");
  }
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
    
    const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, formData);
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
      
      const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, formData);
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
