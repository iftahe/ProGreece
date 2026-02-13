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
          </Routes>
        </Layout>
      </ProjectProvider>
    </Router>
  );
}

export default App;
