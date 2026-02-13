import axios from 'axios';

// יצירת מופע של axios עם כתובת הבסיס
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});



export const createProject = async (data) => {
    const response = await api.post('/projects/', data);
    return response.data;
};

export const updateProject = async (id, data) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
};

export const getBudgetCategories = async (projectId) => {
    const response = await api.get(`/projects/${projectId}/budget-items`);
    return response.data;
};

export const updateBudgetCategory = async (itemId, amount) => {
    const response = await api.put(`/budget-categories/${itemId}`, { amount });
    return response.data;
};

export const getAccounts = async () => {
    const response = await api.get('/accounts/');
    return response.data;
};

export const getProjects = async () => {
    const response = await api.get('/projects/');
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

export const getBudgetReport = async (projectId) => {
    const response = await api.get(`/reports/budget/${projectId}`);
    return response.data;
};

// --- התיקון כאן ---
// שינינו לשימוש ב-api.get במקום fetch כדי לשמור על אחידות וכדי שזה יעבוד עם ה-baseURL
export const getTransactions = async () => {
    const response = await api.get('/transactions/');
    return response.data;
};

export const deleteTransaction = async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
};

export const updateTransaction = async (id, data) => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
};

// --- Apartments ---

export const getApartments = async (projectId) => {
    const response = await api.get(`/projects/${projectId}/apartments`);
    return response.data;
};

export const createApartment = async (projectId, data) => {
    const response = await api.post(`/projects/${projectId}/apartments`, data);
    return response.data;
};

export const updateApartment = async (id, data) => {
    const response = await api.put(`/apartments/${id}`, data);
    return response.data;
};

export const deleteApartment = async (id) => {
    const response = await api.delete(`/apartments/${id}`);
    return response.data;
};

// --- Customer Payments ---

export const getPayments = async (apartmentId) => {
    const response = await api.get(`/apartments/${apartmentId}/payments`);
    return response.data;
};

export const createPayment = async (apartmentId, data) => {
    const response = await api.post(`/apartments/${apartmentId}/payments`, data);
    return response.data;
};

export const updatePayment = async (id, data) => {
    const response = await api.put(`/payments/${id}`, data);
    return response.data;
};

export const deletePayment = async (id) => {
    const response = await api.delete(`/payments/${id}`);
    return response.data;
};

// --- Budget Plans ---

export const getBudgetPlans = async (categoryId) => {
    const response = await api.get(`/budget-categories/${categoryId}/plans`);
    return response.data;
};

export const createBudgetPlan = async (categoryId, data) => {
    const response = await api.post(`/budget-categories/${categoryId}/plans`, data);
    return response.data;
};

export const updateBudgetPlan = async (id, data) => {
    const response = await api.put(`/budget-plans/${id}`, data);
    return response.data;
};

export const deleteBudgetPlan = async (id) => {
    const response = await api.delete(`/budget-plans/${id}`);
    return response.data;
};

// --- CSV Import ---

export const importApartments = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/apartments', formData);
    return response.data;
};

export default api;