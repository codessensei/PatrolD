import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  Database, 
  Globe, 
  HeartPulse, 
  LifeBuoy, 
  ServerIcon, 
  Settings, 
  Shield, 
  Terminal,
  Loader2,
  ChevronRight,
  LucideIcon
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Setup Wizard Steps
type Step = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const steps: Step[] = [
  {
    id: "welcome",
    title: "Hoş Geldiniz",
    description: "PatrolD kurulum sihirbazına hoş geldiniz",
    icon: HeartPulse
  },
  {
    id: "database",
    title: "Veritabanı",
    description: "Veritabanı bağlantısını yapılandırın",
    icon: Database
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Telegram entegrasyonunu yapılandırın",
    icon: Globe
  },
  {
    id: "admin",
    title: "Yönetici",
    description: "Yönetici hesabı oluşturun",
    icon: Shield
  },
  {
    id: "finish",
    title: "Tamamlandı",
    description: "Kurulum tamamlandı",
    icon: CheckCircle2
  }
];

// Veritabanı formu için şema
const databaseSchema = z.object({
  host: z.string().min(1, "Veritabanı sunucusu gereklidir"),
  port: z.string().min(1, "Port numarası gereklidir"),
  database: z.string().min(1, "Veritabanı adı gereklidir"),
  username: z.string().min(1, "Kullanıcı adı gereklidir"),
  password: z.string(),
  ssl: z.boolean().default(false)
});

// Telegram formu için şema
const telegramSchema = z.object({
  botToken: z.string().min(1, "Telegram Bot Token gereklidir")
});

// Yönetici formu için şema
const adminSchema = z.object({
  username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalıdır"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  confirmPassword: z.string(),
  email: z.string().email("Geçerli bir e-posta adresi girin").optional().or(z.literal('')),
  terms: z.boolean().refine(value => value === true, {
    message: "Kullanım şartlarını kabul etmelisiniz"
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"]
});

// Form değer tipleri
type DatabaseFormValues = z.infer<typeof databaseSchema>;
type TelegramFormValues = z.infer<typeof telegramSchema>;
type AdminFormValues = z.infer<typeof adminSchema>;

interface DbStatus {
  success: boolean;
  version?: string;
  tables?: string[];
  message: string;
  error?: any;
}

export default function SetupWizard() {
  const [activeStep, setActiveStep] = useState<string>("welcome");
  const [completed, setCompleted] = useState<{[key: string]: boolean}>({});
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Veritabanı durumunu kontrol et
  const { data: dbStatus, isLoading: dbStatusLoading, refetch: refetchDbStatus } = useQuery<DbStatus>({
    queryKey: ['/api/db-status'],
    refetchInterval: false
  });

  // Kurulum durumunu kontrol et
  const { data: setupStatus, isLoading: setupStatusLoading } = useQuery<{configured: boolean}>({
    queryKey: ['/api/setup/status'],
    refetchInterval: false
  });
  
  // Kurulum durumu değiştiğinde
  useEffect(() => {
    if (setupStatus?.configured) {
      setIsConfigured(true);
      // Eğer kurulum tamamlanmışsa ana sayfaya yönlendir
      setLocation("/");
    } else {
      // İlerleme çubuğunu güncelle
      updateProgress();
    }
  }, [setupStatus, setLocation]);

  // Form tanımlamaları
  const databaseForm = useForm<DatabaseFormValues>({
    resolver: zodResolver(databaseSchema),
    defaultValues: {
      host: "localhost",
      port: "5432",
      database: "patrold",
      username: "postgres",
      password: "",
      ssl: false
    }
  });

  const telegramForm = useForm<TelegramFormValues>({
    resolver: zodResolver(telegramSchema),
    defaultValues: {
      botToken: ""
    }
  });

  const adminForm = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      username: "admin",
      password: "",
      confirmPassword: "",
      email: "",
      terms: false
    }
  });

  // Veritabanı bağlantısını test et
  const testDatabaseConnection = useMutation({
    mutationFn: async (data: DatabaseFormValues) => {
      const res = await apiRequest("POST", "/api/setup/test-db", data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Bağlantı başarılı",
          description: `PostgreSQL ${data.version?.split(' ')[1] || ''} bağlantısı kuruldu`,
          variant: "default"
        });
        
        // Adımı tamamlandı olarak işaretle
        markStepCompleted("database");
        
        // Bir sonraki adıma geç
        goToNextStep();
      } else {
        toast({
          title: "Bağlantı hatası",
          description: data.message || "Veritabanına bağlanılamadı",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Bağlantı hatası",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Telegram Bot Token doğrula
  const testTelegramToken = useMutation({
    mutationFn: async (data: TelegramFormValues) => {
      const res = await apiRequest("POST", "/api/setup/test-telegram", data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Telegram bağlantısı başarılı",
          description: `Bot adı: ${data.botName}`,
          variant: "default"
        });
        
        // Adımı tamamlandı olarak işaretle
        markStepCompleted("telegram");
        
        // Bir sonraki adıma geç
        goToNextStep();
      } else {
        toast({
          title: "Telegram bağlantı hatası",
          description: data.message || "Telegram bot token geçersiz",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Telegram bağlantı hatası",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Kurulumu tamamla
  const completeSetup = useMutation({
    mutationFn: async (data: {
      database: DatabaseFormValues,
      telegram: TelegramFormValues,
      admin: AdminFormValues
    }) => {
      const res = await apiRequest("POST", "/api/setup/complete", data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Kurulum tamamlandı",
          description: "PatrolD kurulumu başarıyla tamamlandı",
          variant: "default"
        });
        
        // Son adımı tamamlandı olarak işaretle
        markStepCompleted("admin");
        markStepCompleted("finish");
        
        // Bitiş adımına geç
        setActiveStep("finish");
      } else {
        toast({
          title: "Kurulum hatası",
          description: data.message || "Kurulum tamamlanamadı",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Kurulum hatası",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Adımları tamamlandı olarak işaretle
  const markStepCompleted = (stepId: string) => {
    setCompleted(prev => ({
      ...prev,
      [stepId]: true
    }));
    
    // İlerleme çubuğunu güncelle
    updateProgress();
  };

  // İlerleme çubuğunu güncelle
  const updateProgress = () => {
    const completedCount = Object.values(completed).filter(Boolean).length;
    const totalSteps = steps.length;
    const progressValue = Math.round((completedCount / (totalSteps - 1)) * 100);
    setProgress(progressValue);
  };

  // Sonraki adıma geç
  const goToNextStep = () => {
    const currentIndex = steps.findIndex(step => step.id === activeStep);
    if (currentIndex < steps.length - 1) {
      setActiveStep(steps[currentIndex + 1].id);
    }
  };

  // Veritabanı bağlantı formunu gönder
  const onDatabaseSubmit = (data: DatabaseFormValues) => {
    testDatabaseConnection.mutate(data);
  };

  // Telegram token formunu gönder
  const onTelegramSubmit = (data: TelegramFormValues) => {
    testTelegramToken.mutate(data);
  };

  // Yönetici formunu gönder
  const onAdminSubmit = (data: AdminFormValues) => {
    // Tüm formları birleştirerek kurulumu tamamla
    completeSetup.mutate({
      database: databaseForm.getValues(),
      telegram: telegramForm.getValues(),
      admin: data
    });
  };

  // Kurulumu atla ve ana sayfaya git
  const skipSetup = () => {
    markStepCompleted("welcome");
    markStepCompleted("database");
    markStepCompleted("telegram");
    markStepCompleted("admin");
    markStepCompleted("finish");
    
    setActiveStep("finish");
    
    // Tamamen atla ve ana sayfaya git
    toast({
      title: "Kurulum atlandı",
      description: "Varsayılan ayarlarla devam ediliyor",
      variant: "default"
    });
    
    setTimeout(() => {
      setLocation("/");
    }, 2000);
  };
  
  // Bitiş butonuna tıklandığında
  const finishSetup = () => {
    setLocation("/");
  };
  
  // Welcome adımını tamamla
  const completeWelcome = () => {
    markStepCompleted("welcome");
    goToNextStep();
  };

  // Hoşgeldiniz adımını otomatik olarak tamamla
  useEffect(() => {
    if (activeStep === "welcome" && !completed["welcome"]) {
      markStepCompleted("welcome");
    }
  }, [activeStep, completed]);

  // İlk yüklemede ilerleme çubuğunu güncelle
  useEffect(() => {
    updateProgress();
  }, []);

  // Eğer zaten yapılandırılmışsa ana sayfaya yönlendir
  if (isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>PatrolD Yapılandırılmış</CardTitle>
            <CardDescription>
              Sistem zaten yapılandırılmış durumda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Kurulum tamamlandı</AlertTitle>
              <AlertDescription>
                PatrolD kurulumu zaten tamamlanmış. Ana sayfaya yönlendiriliyorsunuz...
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => setLocation("/")} 
              className="w-full"
            >
              Ana Sayfaya Git
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (setupStatusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Kurulum durumu kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 bg-primary rounded-md flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-700"></div>
            </div>
            <span className="text-xl font-semibold text-gray-800 dark:text-gray-100">PatrolD Kurulum</span>
          </div>
          <div className="text-sm text-gray-500">Sürüm 1.0</div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8 flex-1 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Steps Sidebar */}
        <div className="md:col-span-1">
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Kurulum Adımları</CardTitle>
              <CardDescription>
                Kurulum sihirbazını tamamlamak için aşağıdaki adımları izleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-6" />
              <div className="space-y-4">
                {steps.map((step) => {
                  const StepIcon = step.icon;
                  const isActive = activeStep === step.id;
                  const isCompleted = completed[step.id];
                  
                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center p-3 rounded-md space-x-3 transition-colors cursor-pointer ${
                        isActive 
                          ? 'bg-primary/10 dark:bg-primary/20 text-primary' 
                          : isCompleted 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                      onClick={() => {
                        // Sadece tamamlanan adımlara veya aktif adıma gidilebilir
                        if (isCompleted || isActive || step.id === "welcome") {
                          setActiveStep(step.id);
                        }
                      }}
                    >
                      <div className={`rounded-full p-2 ${
                        isActive 
                          ? 'bg-primary/20 dark:bg-primary/30' 
                          : isCompleted 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{step.title}</div>
                        <div className="text-xs opacity-80">{step.description}</div>
                      </div>
                      {isActive && (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={skipSetup} 
                className="w-full"
              >
                Atla ve Varsayılanları Kullan
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Step Content */}
        <div className="md:col-span-2">
          <Card>
            {/* Welcome Step */}
            {activeStep === "welcome" && (
              <>
                <CardHeader>
                  <CardTitle className="text-2xl">PatrolD'ye Hoş Geldiniz!</CardTitle>
                  <CardDescription>
                    Bu kurulum sihirbazı, PatrolD servis izleme sistemini yapılandırmanıza yardımcı olacaktır.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                    <h3 className="text-lg font-semibold mb-2 text-primary">PatrolD Nedir?</h3>
                    <p className="text-muted-foreground">
                      PatrolD, ağ hizmetlerinizi, sunucularınızı ve web sitelerinizi izlemek ve performanslarını
                      takip etmek için tasarlanmış modern bir izleme platformudur. Görselleştirme araçları, uyarı 
                      sistemleri ve uzaktan ajanlar ile hizmetlerinizi her yerden izleyebilirsiniz.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex space-x-4 p-4 border rounded-lg">
                      <div className="shrink-0">
                        <Activity className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">Gerçek Zamanlı İzleme</h4>
                        <p className="text-sm text-muted-foreground">
                          Servislerinizi anlık olarak takip edin ve durum değişikliklerinden anında haberdar olun.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-4 p-4 border rounded-lg">
                      <div className="shrink-0">
                        <Globe className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">Dağıtık Ajanlar</h4>
                        <p className="text-sm text-muted-foreground">
                          Farklı konumlara dağıtılmış izleme ajanları ile servisleri her yerden kontrol edin.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-4 p-4 border rounded-lg">
                      <div className="shrink-0">
                        <AlertCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">Anında Bildirimler</h4>
                        <p className="text-sm text-muted-foreground">
                          Telegram entegrasyonu ile servis kesintileri hakkında anında bilgi alın.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-4 p-4 border rounded-lg">
                      <div className="shrink-0">
                        <Database className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">PostgreSQL Veri Depolama</h4>
                        <p className="text-sm text-muted-foreground">
                          Tüm izleme verileri güvenli bir PostgreSQL veritabanında saklanır.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <LifeBuoy className="h-4 w-4" />
                    <AlertTitle>Kuruluma başlamadan önce</AlertTitle>
                    <AlertDescription>
                      PostgreSQL veritabanı bilgilerinizi ve Telegram Bot Token bilgisini hazır bulundurun.
                      Bu bilgiler kurulum sırasında gerekecektir.
                    </AlertDescription>
                  </Alert>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" disabled>Geri</Button>
                  <Button onClick={completeWelcome}>
                    Devam Et <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </>
            )}
            
            {/* Database Step */}
            {activeStep === "database" && (
              <>
                <CardHeader>
                  <CardTitle>Veritabanı Yapılandırması</CardTitle>
                  <CardDescription>
                    PatrolD için PostgreSQL veritabanı bağlantısını yapılandırın
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...databaseForm}>
                    <form onSubmit={databaseForm.handleSubmit(onDatabaseSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={databaseForm.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sunucu Adresi</FormLabel>
                              <FormControl>
                                <Input placeholder="localhost" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={databaseForm.control}
                          name="port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input placeholder="5432" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={databaseForm.control}
                        name="database"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Veritabanı Adı</FormLabel>
                            <FormControl>
                              <Input placeholder="patrold" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={databaseForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Kullanıcı Adı</FormLabel>
                              <FormControl>
                                <Input placeholder="postgres" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={databaseForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Şifre</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={databaseForm.control}
                        name="ssl"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-md border">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>SSL Bağlantı</FormLabel>
                              <FormDescription>
                                Veritabanı bağlantısı için SSL kullanın
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      {dbStatus && (
                        <Alert className={`${dbStatus.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center">
                            {dbStatus.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                            )}
                            <div className="flex-1">
                              <AlertTitle className={dbStatus.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                                {dbStatus.success ? 'Veritabanı bağlantısı aktif' : 'Veritabanı bağlantı hatası'}
                              </AlertTitle>
                              <AlertDescription className={dbStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {dbStatus.success 
                                  ? `PostgreSQL ${dbStatus.version?.split(' ')[1] || ''} bağlantısı kuruldu`
                                  : `Hata: ${dbStatus.message}`
                                }
                              </AlertDescription>
                            </div>
                            <Database className={`h-5 w-5 ${dbStatus.success ? 'text-green-500' : 'text-red-500'}`} />
                          </div>
                        </Alert>
                      )}
                      
                      <div className="flex justify-between pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveStep("welcome")}
                        >
                          Geri
                        </Button>
                        
                        <Button 
                          type="submit" 
                          disabled={testDatabaseConnection.isPending}
                        >
                          {testDatabaseConnection.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Bağlantı Test Ediliyor
                            </>
                          ) : (
                            <>
                              Bağlantıyı Test Et
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </>
            )}
            
            {/* Telegram Step */}
            {activeStep === "telegram" && (
              <>
                <CardHeader>
                  <CardTitle>Telegram Yapılandırması</CardTitle>
                  <CardDescription>
                    Bildirimler için Telegram bot entegrasyonunu yapılandırın
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...telegramForm}>
                    <form onSubmit={telegramForm.handleSubmit(onTelegramSubmit)} className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
                        <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-2">Telegram Bot Oluşturma</h3>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                          Telegram bildirimlerini kullanmak için bir Telegram bot oluşturmanız gerekir. Aşağıdaki adımları izleyin:
                        </p>
                        <ol className="space-y-2 text-sm text-blue-600 dark:text-blue-400 list-decimal pl-4">
                          <li>Telegram'da <span className="font-semibold">@BotFather</span> ile bir sohbet başlatın</li>
                          <li><span className="font-mono">/newbot</span> komutunu gönderin</li>
                          <li>Botunuz için bir isim belirleyin</li>
                          <li>Botunuz için bir kullanıcı adı belirleyin (sonu <span className="font-mono">bot</span> ile bitmelidir)</li>
                          <li>BotFather tarafından verilen token'ı aşağıya kopyalayın</li>
                        </ol>
                      </div>

                      <FormField
                        control={telegramForm.control}
                        name="botToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telegram Bot Token</FormLabel>
                            <FormControl>
                              <Input placeholder="123456789:ABCDEF-1234567890abcdefghijklmnopqrstuv" {...field} />
                            </FormControl>
                            <FormDescription>
                              BotFather'dan aldığınız API token'ı
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-between pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveStep("database")}
                        >
                          Geri
                        </Button>
                        
                        <Button 
                          type="submit" 
                          disabled={testTelegramToken.isPending}
                        >
                          {testTelegramToken.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Token Doğrulanıyor
                            </>
                          ) : (
                            <>
                              Token'ı Doğrula
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </>
            )}
            
            {/* Admin Step */}
            {activeStep === "admin" && (
              <>
                <CardHeader>
                  <CardTitle>Yönetici Hesabı</CardTitle>
                  <CardDescription>
                    PatrolD için bir yönetici hesabı oluşturun
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...adminForm}>
                    <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                      <FormField
                        control={adminForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kullanıcı Adı</FormLabel>
                            <FormControl>
                              <Input placeholder="admin" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={adminForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-posta (İsteğe Bağlı)</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="admin@example.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              Bildirimler ve şifre sıfırlama için kullanılır
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={adminForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Şifre</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={adminForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Şifre Tekrar</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={adminForm.control}
                        name="terms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-md border">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Kullanım Şartları</FormLabel>
                              <FormDescription>
                                PatrolD kullanım şartlarını ve gizlilik politikasını kabul ediyorum
                              </FormDescription>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-between pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveStep("telegram")}
                        >
                          Geri
                        </Button>
                        
                        <Button 
                          type="submit" 
                          disabled={completeSetup.isPending}
                        >
                          {completeSetup.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Kurulum Tamamlanıyor
                            </>
                          ) : (
                            <>
                              Kurulumu Tamamla
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </>
            )}
            
            {/* Finish Step */}
            {activeStep === "finish" && (
              <>
                <CardHeader>
                  <CardTitle>Kurulum Tamamlandı!</CardTitle>
                  <CardDescription>
                    PatrolD başarıyla kuruldu ve kullanıma hazır
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800 text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2 text-green-700 dark:text-green-300">
                      Tebrikler!
                    </h3>
                    <p className="text-green-600 dark:text-green-400 mb-4">
                      PatrolD servis izleme sistemi başarıyla kuruldu ve kullanıma hazır.
                      Şimdi giriş yaparak izlemeye başlayabilirsiniz.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center">
                        <ServerIcon className="h-5 w-5 text-primary mr-2" />
                        Servis Ekleme
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        İzlemek istediğiniz servisleri ekleyin ve durumlarını takip edin
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center">
                        <Settings className="h-5 w-5 text-primary mr-2" />
                        Ajan Yapılandırma
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Uzak sunuculara izleme ajanları kurun ve yapılandırın
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center">
                        <Terminal className="h-5 w-5 text-primary mr-2" />
                        API Erişimi
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        API tokenleri oluşturun ve harici sistemlerle entegre edin
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center">
                        <Globe className="h-5 w-5 text-primary mr-2" />
                        Servis Haritaları
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Servislerinizi görsel olarak haritalandırın ve bağlantıları görüntüleyin
                      </p>
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <LifeBuoy className="h-4 w-4 text-blue-500" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">Yardıma mı ihtiyacınız var?</AlertTitle>
                    <AlertDescription className="text-blue-600 dark:text-blue-400">
                      Sorularınız veya sorunlarınız için destek ekibimize ulaşabilirsiniz. 
                      Kullanım kılavuzlarına ana sayfadan erişebilirsiniz.
                    </AlertDescription>
                  </Alert>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button onClick={finishSetup} className="px-8">
                    Panele Git
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}