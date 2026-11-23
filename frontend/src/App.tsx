/** Atomic CRM root adaptation: injected North Start providers; no Supabase or persisted cache. */
import {useEffect,useMemo} from 'react';
import {CoreAdminContext,CoreAdminUI,CustomRoutes,Resource,memoryStore} from 'ra-core';
import {QueryClient} from '@tanstack/react-query';
import {Route} from 'react-router';
import {SessionProvider,useSession,NorthStartDataProvider,NorthStartAuthProvider} from '@/providers/north-start';
import {i18nProvider} from '@/lib/i18nProvider';
import {Layout} from '@/app/Layout';
import {LoginPage} from '@/app/LoginPage';
import {Overview} from '@/modules/dashboard/Overview';
import {LeadList} from '@/modules/crm/LeadList';
import {LeadCreate} from '@/modules/crm/LeadCreate';
import {LeadDetail} from '@/modules/crm/LeadDetail';
import {TasksPage} from '@/modules/tasks/TasksPage';
import {IntegrationsPage} from '@/modules/integrations/IntegrationsPage';
import {ReportsPage} from '@/modules/settings/ReportsPage';
import {SettingsPage} from '@/modules/settings/SettingsPage';
import {InboxPage} from '@/modules/inbox/InboxPage';
import {AdsPage} from '@/modules/ads/AdsPage';
import {EmptyState} from '@/app/shared';
function Workspace(){const {session,generation}=useSession();return session.authenticated?<WorkspaceAdmin key={generation}/>:<LoginPage/>;}
function WorkspaceAdmin(){const queryClient=useMemo(()=>new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:0,gcTime:0},mutations:{retry:false}}}),[]);const store=useMemo(()=>memoryStore(),[]);useEffect(()=>()=>{void queryClient.cancelQueries();queryClient.clear();},[queryClient]);return <CoreAdminContext dataProvider={NorthStartDataProvider} authProvider={NorthStartAuthProvider} queryClient={queryClient} store={store} i18nProvider={i18nProvider}><CoreAdminUI layout={Layout} dashboard={Overview} disableTelemetry loginPage={LoginPage}><Resource name="leads" options={{label:'Khách tiềm năng'}} list={LeadList} show={LeadDetail} create={LeadCreate}/><CustomRoutes><Route path="/access-denied" element={<EmptyState title="Bạn không có quyền truy cập">Ngữ cảnh và bản nháp đã được xóa. Chọn mục được phép trong menu hoặc đăng nhập đúng tài khoản. Không có yêu cầu tự gửi lại.</EmptyState>}/><Route path="/inbox" element={<InboxPage/>}/><Route path="/pipeline" element={<TasksPage board/>}/><Route path="/tasks" element={<TasksPage/>}/><Route path="/ads" element={<AdsPage/>}/><Route path="/intelligence" element={<ReportsPage intelligence/>}/><Route path="/integrations" element={<IntegrationsPage/>}/><Route path="/reports" element={<ReportsPage/>}/><Route path="/settings" element={<SettingsPage/>}/></CustomRoutes></CoreAdminUI></CoreAdminContext>;}
export default function App(){return <SessionProvider><Workspace/></SessionProvider>;}
