import axios from 'axios';

// Create an axios instance with the base URL
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
    const response = await api.put(`/budget-categories/${itemId}`, { planned_amount: amount });
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

export const getTransactions = async ({ skip = 0, limit = 50, project_id = null, date_from = null, date_to = null, search = null, transaction_type = null, tx_type = null, budget_item_id = null } = {}) => {
    const params = { skip, limit };
    if (project_id) params.project_id = project_id;
    if (date_from) params.date_from = date_from;
    if (date_to) params.date_to = date_to;
    if (search) params.search = search;
    if (transaction_type !== null && transaction_type !== undefined) params.transaction_type = transaction_type;
    if (tx_type) params.tx_type = tx_type;
    if (budget_item_id) params.budget_item_id = budget_item_id;
    const response = await api.get('/transactions/', { params });
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

export const getApartments = async (projectId, { skip = 0, limit = 50 } = {}) => {
    const response = await api.get(`/projects/${projectId}/apartments`, { params: { skip, limit } });
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

// --- Budget Timeline ---

export const getBudgetTimeline = async (projectId) => {
    const response = await api.get(`/reports/budget-timeline/${projectId}`);
    return response.data;
};

// --- Portfolio Summary ---

export const getPortfolioSummary = async () => {
    const response = await api.get('/reports/portfolio-summary');
    return response.data;
};

// --- Project KPI Summary ---

export const getProjectKpiSummary = async (projectId) => {
    const response = await api.get(`/projects/${projectId}/kpi-summary`);
    return response.data;
};

// --- CSV Import ---

export const importApartments = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/apartments', formData);
    return response.data;
};

// --- Feature 4: Project Settings ---

export const getProjectSettings = async (projectId) => {
    const response = await api.get(`/projects/${projectId}/settings`);
    return response.data;
};

export const updateProjectSettings = async (projectId, data) => {
    const response = await api.put(`/projects/${projectId}/settings`, data);
    return response.data;
};

// --- Feature 3: Suggested Category ---

export const getSuggestedCategory = async (accountId) => {
    const response = await api.get(`/accounts/${accountId}/suggested-category`);
    return response.data;
};

// --- Feature 1: Apartment Search ---

export const searchApartments = async (query, projectId) => {
    const params = { q: query };
    if (projectId) params.project_id = projectId;
    const response = await api.get('/apartments/search', { params });
    return response.data;
};

// --- Feature 5: Direct to Owner ---

export const createDirectToOwnerPayment = async (apartmentId, data) => {
    const response = await api.post(`/apartments/${apartmentId}/payments/direct-to-owner`, data);
    return response.data;
};

export default api;