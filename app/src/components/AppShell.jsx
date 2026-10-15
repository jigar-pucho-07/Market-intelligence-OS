'use client';
// AppShell — the signed-in page: the rows the server loaded, the route's named params, the page kind from os.yaml
// (page · overview · settings · users · detail), inside the dashboard layout. Pages are composed, never copied.
import { useEffect } from 'react';
import { DataProvider } from '../lib/data-context';
import { RouteContext } from '../lib/router';
import { rememberPage } from '../utils/api';
import DashboardLayout from '../layouts/DashboardLayout';
import Page from '../module/Page';
import DetailPage from '../module/DetailPage';
import OverviewPage from '../module/OverviewPage';
import SettingsPage from '../module/SettingsPage';
import UsersPage from '../module/UsersPage';
import { OVERRIDES } from '../screens/overrides';

const KIND = { module: Page, page: Page, overview: OverviewPage, settings: SettingsPage, users: UsersPage };

export default function AppShell({ config, kind, data, params, wiring }) {
  useEffect(() => { rememberPage(config.id); }, [config.id]);
  const C = kind === 'detail' ? DetailPage : (OVERRIDES[config.id] ?? KIND[config.kind ?? 'module'] ?? Page);
  return (
    <RouteContext.Provider value={{ params: params ?? {} }}>
      <DataProvider data={data}>
        <DashboardLayout wiring={wiring}><C config={config} /></DashboardLayout>
      </DataProvider>
    </RouteContext.Provider>
  );
}
