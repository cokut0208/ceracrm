import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FolderKanban } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <FolderKanban className="h-16 w-16 text-primary mb-4" />
      <h1 className="text-3xl font-bold mb-2">404 - Sayfa Bulunamadı</h1>
      <p className="text-muted-foreground text-center mb-6">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Button asChild>
        <Link to="/">Ana Sayfaya Dön</Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;