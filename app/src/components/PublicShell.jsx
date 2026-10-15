'use client';
// PublicShell — a `public: true` page (no sign-in): the client's mark, the page's form, powered-by. Its only writes go
// through the actions os.yaml declared on it (PUBLIC_ACTIONS); its reads are the entities it names.
import { useEffect } from 'react';
import { DataProvider } from '../lib/data-context';
import { RouteContext } from '../lib/router';
import { rememberPage } from '../utils/api';
import PublicLayout from '../layouts/PublicLayout';
import Page from '../module/Page';

export default function PublicShell({ config, data, params }) {
  useEffect(() => { rememberPage(config.id); }, [config.id]);
  return (
    <RouteContext.Provider value={{ params: params ?? {} }}>
      <DataProvider data={data} poll={0}>
        <PublicLayout><Page config={config} /></PublicLayout>
      </DataProvider>
    </RouteContext.Provider>
  );
}
