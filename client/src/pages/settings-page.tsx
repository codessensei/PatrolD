import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Settings, User, Bell, Shield, Send, AlertTriangle, CheckCircle, Info, MessageCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type TelegramSettings = {
  enableTelegramAlerts: boolean;
  telegramChatId: string | null;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chatId, setChatId] = useState("");
  const [enableAlerts, setEnableAlerts] = useState(false);

  // Telegram ayarlarını getir
  const { data: telegramSettings, isLoading: isLoadingSettings } = useQuery<TelegramSettings>({
    queryKey: ["/api/telegram/settings"],
  });
  
  // Ayarlar geldiğinde state'i güncelle
  useEffect(() => {
    if (telegramSettings) {
      if (telegramSettings.telegramChatId) {
        setChatId(telegramSettings.telegramChatId);
      }
      setEnableAlerts(telegramSettings.enableTelegramAlerts);
    }
  }, [telegramSettings]);

  // Telegram ayarlarını kaydet
  const saveMutation = useMutation({
    mutationFn: async (data: { chatId: string; enableAlerts: boolean }) => {
      const response = await apiRequest("POST", "/api/telegram/settings", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ayarlar Kaydedildi",
        description: "Telegram bildirim ayarlarınız başarıyla güncellendi.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/settings"] });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: "Ayarlar kaydedilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });

  // Test mesajı gönder
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/telegram/test");
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Test Mesajı Gönderildi",
          description: data.message || "Telegram test mesajı başarıyla gönderildi.",
          variant: "default",
        });
      } else {
        toast({
          title: "Uyarı",
          description: data.message || "Test mesajı gönderilemedi. Telegram ayarlarınızı kontrol edin.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Test mesajı gönderilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });

  // Ayarları kaydet
  const handleSaveSettings = () => {
    saveMutation.mutate({ chatId, enableAlerts });
  };

  // Test mesajı gönder
  const handleTestMessage = () => {
    if (!chatId) {
      toast({
        title: "Uyarı",
        description: "Test mesajı göndermek için önce Telegram Chat ID'nizi girmelisiniz.",
        variant: "destructive",
      });
      return;
    }
    testMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Settings" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Hesap Ayarları</h1>
            <p className="text-slate-600 dark:text-slate-400">Hesap tercihlerinizi ve ayarlarınızı yönetin</p>
          </div>
          
          <Tabs defaultValue="notifications">
            <TabsList className="mb-6">
              <TabsTrigger value="account" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Hesap
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-1">
                <Bell className="h-4 w-4" />
                Bildirimler
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Güvenlik
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Hesap Ayarları</CardTitle>
                  <CardDescription>Hesap bilgilerinizi yönetin</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label htmlFor="username">Kullanıcı Adı</Label>
                      <Input id="username" value={user?.username} disabled />
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="email">E-posta Adresi</Label>
                      <Input id="email" type="email" value={user?.email || ''} disabled />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button variant="outline" disabled>Güncelle</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications">
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-blue-500" />
                        Telegram Bildirimleri
                      </CardTitle>
                      <CardDescription>Servis durumları hakkındaki bildirimleri Telegram üzerinden alın</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Aktif</span>
                      <Switch
                        checked={enableAlerts}
                        onCheckedChange={setEnableAlerts}
                        disabled={isLoadingSettings || saveMutation.isPending}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-6">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Bildirimleri nasıl ayarlarım?</AlertTitle>
                    <AlertDescription>
                      Telegram'da <strong>@ServiceMonitoringBot</strong> ile konuşun ve <strong>/start</strong> komutunu gönderin. 
                      Sonra <strong>/subscribe</strong> komutunu kullanarak bildirimlere abone olun. 
                      Alttaki Chat ID alanına Telegram'daki ID'nizi yazın (bot size bildirecektir).
                    </AlertDescription>
                  </Alert>
                
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="telegram-id">Telegram Chat ID</Label>
                      <Input 
                        id="telegram-id" 
                        placeholder="Buraya Telegram Chat ID'nizi yazın" 
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        disabled={isLoadingSettings || saveMutation.isPending}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bot size konuşma başladığında ID'nizi bildirecektir. Alternatif olarak, <strong>/subscribe</strong> komutunu kullanarak otomatik olarak kayıt olabilirsiniz.
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <Button 
                    variant="outline"
                    onClick={handleTestMessage}
                    disabled={!chatId || testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Test Mesajı Gönder
                  </Button>
                  
                  <Button 
                    onClick={handleSaveSettings}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Ayarları Kaydet
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>E-posta Bildirimleri</CardTitle>
                  <CardDescription>E-posta bildirim ayarlarınızı yönetin</CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-6 bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>E-posta Bildirimleri Hazırlanıyor</AlertTitle>
                    <AlertDescription>
                      E-posta bildirimleri özelliği henüz geliştirme aşamasındadır ve yakında kullanıma sunulacaktır.
                      Şimdilik Telegram bildirimlerini kullanabilirsiniz.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-6 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Servis Kesintileri</Label>
                        <p className="text-xs text-slate-500">Bir servis çevrimdışı olduğunda e-posta gönder</p>
                      </div>
                      <Switch disabled />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Servis Kurtarmaları</Label>
                        <p className="text-xs text-slate-500">Bir servis tekrar çevrimiçi olduğunda e-posta gönder</p>
                      </div>
                      <Switch disabled />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Günlük Özetler</Label>
                        <p className="text-xs text-slate-500">Servislerin durumu hakkında günlük özet e-postası gönder</p>
                      </div>
                      <Switch disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Güvenlik Ayarları</CardTitle>
                  <CardDescription>Hesap güvenliğinizi yönetin</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label htmlFor="password">Şifre Değiştir</Label>
                      <div className="flex gap-2">
                        <Input id="password" type="password" placeholder="Yeni şifre" disabled />
                        <Button variant="secondary" disabled>Şifreyi Güncelle</Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Şifre değiştirme özelliği yapım aşamasındadır ve yakında kullanıma sunulacaktır.
                      </p>
                    </div>
                    
                    <div className="rounded-lg border p-4 mt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium mb-1">İki Faktörlü Kimlik Doğrulama</h4>
                          <p className="text-sm text-slate-500">
                            Hesabınıza ekstra güvenlik katmanı ekler
                          </p>
                        </div>
                        <Switch disabled />
                      </div>
                      <p className="text-xs text-slate-500 mt-4">
                        Bu özellik yapım aşamasındadır ve yakında kullanıma sunulacaktır.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}