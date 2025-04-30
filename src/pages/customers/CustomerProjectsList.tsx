import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ExternalLink, Briefcase, Tag, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react'; // İkonlar
import type { AssociatedProjectInfo } from './CustomerDetailPage'; // Ana component'teki tip

interface CustomerProjectsListProps {
    initialProjects: AssociatedProjectInfo[];
}

export const CustomerProjectsList = ({ initialProjects }: CustomerProjectsListProps) => {

    const formatDate = (dateString: string | null | undefined) => { if (!dateString) return '-'; try { return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return dateString; } };
    const getStatusIcon = (status: string) => { if (status === 'Onaylandı' || status === 'Tamamlandı') return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />; if (status === 'Reddedildi') return <XCircle className="h-4 w-4 text-red-500 mr-1" />; if (status === 'Değerlendirmede') return <Clock className="h-4 w-4 text-blue-500 mr-1" />; return <Tag className="h-4 w-4 text-muted-foreground mr-1" />; };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Müşterinin Projeleri</CardTitle>
                <CardDescription>Bu müşteriyle ilişkilendirilmiş tüm projeler.</CardDescription>
            </CardHeader>
            <CardContent>
                {initialProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Bu müşteriye ait proje kaydı bulunamadı.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Proje Adı</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Sorumlu Personel</TableHead>
                                    <TableHead>Oluşturma Tarihi</TableHead>
                                    <TableHead className="text-right">Detay</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialProjects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="font-medium">{project.project_name}</TableCell>
                                        <TableCell>
                                            <Badge variant={project.status === 'Onaylandı' || project.status === 'Tamamlandı' ? 'success' : project.status === 'Reddedildi' ? 'destructive' : 'secondary'} className="whitespace-nowrap text-xs">
                                                {getStatusIcon(project.status)} {project.status}
                                            </Badge>
                                        </TableCell>
                                         <TableCell>
                                            {project.responsible_personnel ? (
                                                <span className='flex items-center gap-1 text-sm'><UserCheck className='h-3 w-3 text-muted-foreground'/>{project.responsible_personnel.name} {project.responsible_personnel.surname}</span>
                                            ) : ('-')}
                                         </TableCell>
                                        <TableCell className="whitespace-nowrap">{formatDate(project.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="icon" asChild className="h-8 w-8">
                                                <Link to={`/projeler/${project.id}`} title="Projeye Git">
                                                    <ExternalLink className="h-4 w-4" />
                                                    <span className="sr-only">Projeyi Görüntüle</span>
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};