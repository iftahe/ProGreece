import axios from 'axios';

// יצירת מופע של axios עם כתובת הבסיס
const api = axios.create({
    baseURL: 'http://localhost:8000',
});

export const getProjects = async () => {
    const response = await api.get('/projects/');
    return response.data;
};

export const getAccounts = async () => {
    const response = await api.get('/accounts/');
    return response.data;
};

export const createTransaction = async (transactionData) => {
    const response = await api.post('/transactions/', transactionData);
    return response.data;
};

export const getCashFlowForecast = async (projectId) => {
    const response = await api.get(`/reports/cash-flow/${projectId}`);
    return response.data;
};

// --- התיקון כאן ---
// שינינו לשימוש ב-api.get במקום fetch כדי לשמור על אחידות וכדי שזה יעבוד עם ה-baseURL
export const getTransactions = async () => {
    const response = await api.get('/transactions/');
    return response.data;
};

export default api;