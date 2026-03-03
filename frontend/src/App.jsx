import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import Layout from './components/Layout';
import PortfolioDashboard from './pages/PortfolioDashboard';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Projects from './pages/Projects';
import BudgetReport from './pages/BudgetReport';
import Apartments from './pages/Apartments';
import Counterparties from './pages/Counterparties';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Forecast from './pages/Forecast';

function App() {
  return (
    <Router>
      <ProjectProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<PortfolioDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/apartments" element={<Apartments />} />
            <Route path="/budget-report" element={<BudgetReport />} />
            <Route path="/counterparties" element={<Counterparties />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/forecast" element={<Forecast />} />
          </Routes>
        </Layout>
      </ProjectProvider>
    </Router>
  );
}

export default App;
