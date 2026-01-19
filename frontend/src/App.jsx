import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Projects from './pages/Projects';
import BudgetReport from './pages/BudgetReport';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/budget-report" element={<BudgetReport />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
