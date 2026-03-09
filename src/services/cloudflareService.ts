import axios from 'axios';

const api = axios.create({
  baseURL: '/api/cloudflare',
});

export const setAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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

export const upsertWorker = async (accountId: string, scriptName: string, content: string) => {
  const response = await api.put(`/accounts/${accountId}/workers/scripts/${scriptName}`, content, {
    headers: {
      'Content-Type': 'application/javascript',
    },
  });
  return response.data.result;
};

export const deleteWorker = async (accountId: string, scriptName: string) => {
  const response = await api.delete(`/accounts/${accountId}/workers/scripts/${scriptName}`);
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
