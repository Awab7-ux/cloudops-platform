import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar />
      <div className="pl-72">
        <Header />
        <main className="relative pt-16 w-full px-gutter bg-surface">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
