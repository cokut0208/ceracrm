import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Building2, FolderKanban, Phone, Users } from 'lucide-react';

const DashboardPage = () => {
  const [{ user }] = useAtom(authStateAtom);
  const [stats, setStats] = useState({
    customerCount: 0,
    projectCount: 0,
    personnelCount: 0,
    callCount: 0,
  });
  const [projectsByStatus, setProjectsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Get customer count
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });
          
        // Get project count
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });
          
        // Get personnel count
        const { count: personnelCount } = await supabase
          .from('personnel')
          .select('*', { count: 'exact', head: true });
          
        // Get call count
        const { count: callCount } = await supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true });
          
        // Get projects by status
        const { data: projectStatusData } = await supabase
          .from('projects')
          .select('status')
          
        const statusCounts: Record<string, number> = {};
        projectStatusData?.forEach(project => {
          const status = project.status || 'Başvuru Hazırlık';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
          
        const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({
          name,
          value,
        }));
          
        // Get recent customers
        const { data: recentCustomersData } = await supabase
          .from('customers')
          .select(`
            id,
            company_name,
            customer_type,
            created_at,
            responsible_personnel:personnel(name, surname)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        setStats({
          customerCount: customerCount || 0,
          projectCount: projectCount || 0,
          personnelCount: personnelCount || 0,
          callCount: callCount || 0,
        });
        
        setProjectsByStatus(statusChartData || []);
        setRecentCustomers(recentCustomersData || []);
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hoş Geldiniz, {user?.personnel?.name || 'Kullanıcı'}
        </h1>
        <p className="text-muted-foreground">
          KARACA CRM Dashboard - Güncel verilere genel bakış
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Müşteri</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerCount}</div>
            <p className="text-xs text-muted-foreground">
              Sistemde kayıtlı müşteri sayısı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Proje</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projectCount}</div>
            <p className="text-xs text-muted-foreground">
              Sistemde kayıtlı proje sayısı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personel</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.personnelCount}</div>
            <p className="text-xs text-muted-foreground">
              Sistemde kayıtlı personel sayısı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Çağrı Kaydı</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.callCount}</div>
            <p className="text-xs text-muted-foreground">
              Sistemde kayıtlı çağrı sayısı
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Proje Durumları</CardTitle>
            <CardDescription>
              Durum bazında mevcut projeler
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {projectsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Son Eklenen Müşteriler</CardTitle>
            <CardDescription>
              Son eklenen 5 müşteri kaydı
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCustomers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{customer.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.customer_type === 'sahis' ? 'Şahıs' : 'Tüzel'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {customer.responsible_personnel?.name} {customer.responsible_personnel?.surname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))}
              
              {recentCustomers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Henüz müşteri kaydı bulunmamaktadır.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;