// src/store/auth.ts
import { atom } from 'jotai';
import { supabase } from '@/lib/supabase';
// Kendi tanımladığın tipleri import et
import type { AuthState, UserWithRole, Role, Personnel } from '@/types/auth.types'; // Personnel tipini de import edelim (varsa)

// 1. Initial State
// AuthState tipini kullanarak başlangıç state'ini tanımla
export const authStateAtom = atom<AuthState>({
  user: null,
  isLoading: true, // Uygulama ilk açıldığında oturum kontrolü için true
  error: null,
});

// 2. Helper Function: Kullanıcı Verisini ve Rollerini Yükleme
// Bu fonksiyon, giriş yapıldığında veya oturum kontrol edildiğinde çağrılır.
async function loadUserData(
  userId: string,
  set: any, // Jotai SetState tipi (import edilebilir veya any kalabilir)
  get: any // Jotai GetState tipi (import edilebilir veya any kalabilir)
) {
  console.log(`[loadUserData] Kullanıcı ${userId} için veri yükleniyor...`); // Loglama eklendi
  try {
    // Supabase Auth'dan en güncel kullanıcı bilgisini al
    const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
    if (authUserError || !authUserData?.user) {
      throw authUserError || new Error('Supabase kullanıcı oturumu alınamadı.');
    }
    const currentAuthUser = authUserData.user;
    console.log('[loadUserData] Supabase auth kullanıcısı alındı:', currentAuthUser.email);

    // Personel bilgisini `personnel` tablosundan çek (avatar_url EKLENDİ!)
    console.log('[loadUserData] Personel bilgisi çekiliyor...');
    const { data: personnelData, error: personnelError } = await supabase
      .from('personnel')
      // ******** İŞTE DEĞİŞİKLİK BURADA ********
      .select('id, name, surname, verimor_extension, avatar_url') // <-- avatar_url EKLENDİ!
      // ***************************************
      .eq('user_id', userId) // veya .eq('email', currentAuthUser.email) // Doğru eşleşme anahtarını kullan
      .maybeSingle(); // Tek kayıt veya null döner, hata fırlatmaz

    // Hata yönetimi
    if (personnelError) {
      // PGRST116: Kayıt bulunamadı hatası. Bu beklenen bir durum olabilir, logla ama hata fırlatma.
      if (personnelError.code === 'PGRST116') {
        console.warn(`[loadUserData] Kullanıcı ${userId} için personel kaydı bulunamadı (PGRST116).`);
      } else {
        // Diğer veritabanı hatalarını logla ve fırlat
        console.error('[loadUserData] Personel bilgisi çekilirken hata:', personnelError);
        throw personnelError;
      }
    } else if (personnelData) {
        console.log('[loadUserData] Personel bilgisi bulundu:', personnelData);
    } else {
        console.log('[loadUserData] Personel bilgisi bulunamadı (veri null).');
    }
    // `personnelData` null olabilir.

    let userRoles: Role[] = []; // Rolleri tutacak dizi

    // SADECE personel kaydı varsa rolleri çekmeye çalış
    if (personnelData) {
      console.log(`[loadUserData] ${personnelData.id} ID'li personel için roller çekiliyor...`);
      const { data: rolesData, error: rolesError } = await supabase
        .from('personnel_roles')
        .select(`
          roles: roles (role_name)
        `)
        .eq('personnel_id', personnelData.id);

      if (rolesError) {
        console.error('[loadUserData] Roller çekilirken hata:', rolesError);
      } else if (rolesData) {
        userRoles = rolesData
          .map(item => item.roles?.role_name)
          .filter((roleName): roleName is Role =>
            typeof roleName === 'string' && ['admin', 'danisman', 'izleyici'].includes(roleName) // Kendi rollerine göre güncelle
          );
        console.log('[loadUserData] Roller bulundu:', userRoles);
      } else {
        console.log('[loadUserData] Rol bulunamadı.');
      }
    } else {
        console.log('[loadUserData] Personel kaydı olmadığı için roller çekilmiyor.');
    }


    // Auth state için UserWithRole tipine uygun son kullanıcı objesini oluştur
    // Personnel tip tanımının avatar_url içerdiğini varsayıyoruz
    const personnelInfoForState: Personnel | undefined = personnelData ? {
        id: personnelData.id,
        name: personnelData.name,
        surname: personnelData.surname,
        verimor_extension: personnelData.verimor_extension ?? '',
        avatar_url: personnelData.avatar_url // <-- ARTIK personnelData içinde bu alan var (null olabilir)
    } : undefined;

    const finalUser: UserWithRole = {
      id: currentAuthUser.id,
      email: currentAuthUser.email!,
      roles: userRoles,
      personnel: personnelInfoForState, // personnelData null ise undefined olacak
    };
    console.log('[loadUserData] Son kullanıcı objesi oluşturuldu:', finalUser);

    // Global auth state'ini güncelle
    set(authStateAtom, {
      user: finalUser,
      isLoading: false,
      error: null
    });
    console.log('[loadUserData] authStateAtom güncellendi.');

  } catch (error) {
    console.error("[loadUserData] Fonksiyon içinde genel hata:", error);
    set(authStateAtom, {
      user: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Kullanıcı bilgileri yüklenemedi'
    });
  }
}

// 3. Action Atomları (Giriş, Çıkış, Oturum Kontrolü)

// loginAtom: Giriş yapar ve başarılı olursa loadUserData'yı çağırır
export const loginAtom = atom(
  null,
  async (get, set, { email, password }: { email: string; password: string }) => {
    console.log(`[loginAtom] Giriş deneniyor: ${email}`);
    try {
      set(authStateAtom, { ...get(authStateAtom), isLoading: true, error: null });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        console.log(`[loginAtom] Giriş başarılı, kullanıcı verisi yükleniyor: ${data.user.id}`);
        await loadUserData(data.user.id, set, get); // Veriyi yükle
      } else {
        throw new Error('Giriş sonrası kullanıcı bilgisi alınamadı.');
      }
    } catch (error) {
      console.error("[loginAtom] Giriş hatası:", error);
      set(authStateAtom, {
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Giriş başarısız'
      });
    }
  }
);

// logoutAtom: Çıkış yapar ve state'i temizler
export const logoutAtom = atom(
  null,
  async (get, set) => {
    console.log('[logoutAtom] Çıkış yapılıyor...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('[logoutAtom] Çıkış başarılı, state sıfırlanıyor.');
      set(authStateAtom, { user: null, isLoading: false, error: null });
    } catch (error) {
      console.error("[logoutAtom] Çıkış hatası:", error);
      // Hata olsa bile state'i sıfırlıyoruz, kullanıcıyı çıkmış varsayıyoruz.
      set(authStateAtom, {
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Çıkış başarısız'
      });
    }
  }
);

// checkAuthAtom: Uygulama yüklendiğinde oturumu kontrol eder ve loadUserData'yı çağırır
export const checkAuthAtom = atom(
  null,
  async (get, set) => {
    console.log('[checkAuthAtom] Oturum kontrol ediliyor...');
    const currentState = get(authStateAtom);

    try {
      // Yükleniyor durumunu hemen set et, mevcut state'i koru
      set(authStateAtom, { ...currentState, isLoading: true });

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (data.session?.user) {
        console.log(`[checkAuthAtom] Aktif oturum bulundu, kullanıcı verisi yükleniyor: ${data.session.user.id}`);
        await loadUserData(data.session.user.id, set, get); // Oturum varsa veriyi yükle
      } else {
        console.log('[checkAuthAtom] Aktif oturum bulunamadı, state sıfırlanıyor.');
        set(authStateAtom, { user: null, isLoading: false, error: null }); // Oturum yoksa state'i temizle
      }
    } catch (error) {
      console.error("[checkAuthAtom] Oturum kontrolü hatası:", error);
      set(authStateAtom, {
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Oturum kontrolü başarısız'
      });
    }
  }
);