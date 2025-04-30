import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Calendar } from "@/components/ui/calendar";
import { useAuthStore } from "@/store/authStore";
import { CircleUser, Users, PhoneCall, ClipboardList, TrendingUp, Percent } from "lucide-react";

// Simulated data for charts
const callData = [
  { name: "Pzt", incoming: 40, outgoing: 24 },
  { name: "Sal", incoming: 30, outgoing: 28 },
  { name: "Çar", incoming: 20, outgoing: 39 },
  { name: "Per", incoming: 27, outgoing: 35 },
  { name: "Cum", incoming: 18, outgoing: 29 },
  { name: "Cmt", incoming: 23, outgoing: 15 },
  { name: "Paz", incoming: 34, outgoing: 12 },
];

const taskStatusData = [
  { name: "Tamamlandı", value: 45, color: "hsl(var(--chart-1))" },
  { name: "Devam Ediyor", value: 30, color: "hsl(var(--chart-2))" },
  { name: "Beklemede", value: 15, color: "hsl(var(--chart-3))" },
  { name: "İptal Edildi", value: 10, color: "hsl(var(--chart-4))" },
];

const departmentPerformance = [
  { name: "Satış", performance: 85 },
  { name: "Pazarlama", performance: 70 },
  { name: "Müşteri Hizmetleri", performance: 90 },
  { name: "Teknik Destek", performance: 65 },
  { name: "İnsan Kaynakları", performance: 75 },
];

// Current tasks list (mock data)
const currentTasks = [
  { id: 1, title: "Yeni müşteri toplantısı", dueDate: "Bugün" },
  { id: 2, title: "Proje demo sunumu", dueDate: "Yarın" },
  { id: 3, title: "Teknik rapor tamamlama", dueDate: "3 gün içinde" },
  { id: 4, title: "Ekip toplantısı", dueDate: "Bugün" },
  { id: 5, title: "Yazılım güncellemesi", dueDate: "Gelecek hafta" },
];

// Recent calls list (mock data)
const recentCalls = [
  { id: 1, contact: "Ahmet Yılmaz", company: "ABC Şirketi", time: "5 dk önce", status: "Gelen" },
  { id: 2, contact: "Mehmet Demir", company: "XYZ Ltd.", time: "25 dk önce", status: "Giden" },
  { id: 3, contact: "Ayşe Kaya", company: "LMN A.Ş.", time: "1 saat önce", status: "Cevapsız" },
  { id: 4, contact: "Fatma Şahin", company: "PQR Holding", time: "2 saat önce", status: "Giden" },
  { id: 5, contact: "Ali Öztürk", company: "DEF Teknoloji", time: "3 saat önce", status: "Gelen" },
];

export function DashboardPage() {
  const { user } = useAuthStore();
  const date = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gösterge Paneli</h1>
        <p className="text-muted-foreground">
          Hoş geldiniz, {user?.name}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex overflow-x-auto md:flex-wrap md:overflow-visible">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
          <TabsTrigger value="reports">Raporlar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="overflow-hidden border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Toplam Müşteri
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-500">
                  <CircleUser className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">245</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+12%</span> bu ay
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bekleyen Görevler
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-500">
                  <ClipboardList className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">18</div>
                <p className="text-xs text-muted-foreground">
                  4 görevi bugün tamamlamalısınız
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktif Projeler</CardTitle>
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-500">
                  <Percent className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">7</div>
                <p className="text-xs text-muted-foreground">
                  2 proje bu hafta tamamlanacak
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bugünkü Çağrılar
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-500">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">
                  15 gelen, 9 giden çağrı
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
            <Card className="col-span-1 lg:col-span-4">
              <CardHeader>
                <CardTitle>Haftalık Çağrı Analizi</CardTitle>
                <CardDescription>
                  Son 7 gündeki gelen ve giden çağrılar
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={callData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="incoming"
                        stackId="1"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                      />
                      <Area
                        type="monotone"
                        dataKey="outgoing"
                        stackId="1"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2))"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1 lg:col-span-3">
              <CardHeader>
                <CardTitle>Görev Durumları</CardTitle>
                <CardDescription>
                  Mevcut görevlerin durumu
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
            <Card className="col-span-1 lg:col-span-4">
              <CardHeader>
                <CardTitle>Departman Performansı</CardTitle>
                <CardDescription>
                  Son 30 gündeki departman bazlı performans
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="performance" fill="hsl(var(--chart-3))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1 lg:col-span-3">
              <CardHeader>
                <CardTitle>Takvim</CardTitle>
                <CardDescription>
                  {date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Güncel Görevler</CardTitle>
                <CardDescription>
                  Yaklaşan ve devam eden görevler
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {currentTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">Son tarih: {task.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Son Çağrılar</CardTitle>
                <CardDescription>
                  Son 24 saatteki çağrılar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {recentCalls.map((call) => (
                      <div key={call.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">{call.contact}</p>
                          <p className="text-sm text-muted-foreground">{call.company}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            call.status === "Cevapsız" ? "text-destructive" : ""
                          }`}>
                            {call.status}
                          </p>
                          <p className="text-sm text-muted-foreground">{call.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">Detaylı analitik veriler bu panelde görüntülenecek.</div>
            <div className="text-6xl text-primary/20">📊</div>
          </div>
        </TabsContent>
        
        <TabsContent value="reports" className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">Raporlar bu panelde görüntülenecek.</div>
            <div className="text-6xl text-primary/20">📈</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}