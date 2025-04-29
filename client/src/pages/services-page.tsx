import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Server, 
  PlusCircle, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  Edit, 
  RefreshCw, 
  Loader2, 
  Search,
  Globe,
  Database,
  Activity,
  X,
  Info
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Service = {
  id: number;
  userId: number;
  name: string;
  host: string;
  port: number;
  type: string;
  status: string;
  checkInterval: number;
  lastChecked?: string;
  responseTime?: number;
  monitorType: string;
  agentId?: number;
};

type Agent = {
  id: number;
  userId: number;
  name: string;
  apiKey: string;
  status: string;
  lastSeen?: string;
  serverInfo?: any;
};

const SERVICE_TYPES = [
  { value: "web server", label: "Web Server (HTTP/HTTPS)" },
  { value: "api", label: "API Endpoint" },
  { value: "database", label: "Database Server" },
  { value: "mail server", label: "Mail Server" },
  { value: "custom", label: "Custom TCP Service" }
];

const CHECK_INTERVALS = [
  { value: 30, label: "30 saniye" },
  { value: 60, label: "1 dakika" },
  { value: 300, label: "5 dakika" },
  { value: 600, label: "10 dakika" },
  { value: 1800, label: "30 dakika" },
  { value: 3600, label: "1 saat" }
];

const MONITOR_TYPES = [
  { value: "direct", label: "Direkt Sunucu Tarafından" },
  { value: "agent", label: "Agent Üzerinden" }
];

export default function ServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  
  // Form state for add/edit
  const [formState, setFormState] = useState({
    name: "",
    host: "",
    port: "",
    type: "web server",
    checkInterval: 60,
    monitorType: "direct",
    agentId: ""
  });

  // Services listesini getir
  const { 
    data: services = [], 
    isLoading: isLoadingServices,
    isError: isServicesError,
    refetch: refetchServices
  } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    refetchInterval: 30000 // Her 30 saniyede bir güncelle
  });

  // Agent listesini getir
  const { 
    data: agents = [],
    isLoading: isLoadingAgents
  } = useQuery<Agent[]>({
    queryKey: ["/api/agents"]
  });
  
  // Servis ekleme
  const addServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/services", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Servis Eklendi",
        description: "Yeni servis başarıyla eklendi.",
        variant: "default",
      });
      setIsAddDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: "Servis eklenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });
  
  // Servis güncelleme
  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/services/${data.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Servis Güncellendi",
        description: "Servis bilgileri başarıyla güncellendi.",
        variant: "default",
      });
      setIsEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: "Servis güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });
  
  // Servis silme
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Servis Silindi",
        description: "Servis başarıyla silindi.",
        variant: "default",
      });
      setServiceToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: "Servis silinirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });

  // Form reset
  const resetForm = () => {
    setFormState({
      name: "",
      host: "",
      port: "",
      type: "web server",
      checkInterval: 60,
      monitorType: "direct",
      agentId: ""
    });
    setSelectedService(null);
  };

  // Servis ekleme formunu göster
  const handleAddService = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  // Servis düzenleme formunu göster
  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setFormState({
      name: service.name,
      host: service.host,
      port: String(service.port),
      type: service.type,
      checkInterval: service.checkInterval,
      monitorType: service.monitorType,
      agentId: service.agentId ? String(service.agentId) : ""
    });
    setIsEditDialogOpen(true);
  };

  // Servis silme
  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service);
  };

  // Servis silmeyi onayla
  const confirmDelete = () => {
    if (serviceToDelete) {
      deleteServiceMutation.mutate(serviceToDelete.id);
    }
  };

  // Form gönderme
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const serviceData = {
      name: formState.name,
      host: formState.host,
      port: parseInt(formState.port),
      type: formState.type,
      checkInterval: formState.checkInterval,
      monitorType: formState.monitorType,
      ...(formState.monitorType === "agent" && formState.agentId ? { agentId: parseInt(formState.agentId) } : {})
    };
    
    if (isEditDialogOpen && selectedService) {
      updateServiceMutation.mutate({
        id: selectedService.id,
        ...serviceData
      });
    } else {
      addServiceMutation.mutate(serviceData);
    }
  };

  // Form değişikliği
  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  // Arama ve filtreleme
  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    service.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Servis durumuna göre rozet rengi
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'online':
        return { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: <CheckCircle className="h-3.5 w-3.5 mr-1" /> };
      case 'offline':
        return { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: <AlertTriangle className="h-3.5 w-3.5 mr-1" /> };
      case 'degraded':
        return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: <Clock className="h-3.5 w-3.5 mr-1" /> };
      default:
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <Clock className="h-3.5 w-3.5 mr-1" /> };
    }
  };

  // Servis tipine göre ikon
  const getServiceTypeIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'web server':
        return <Globe className="h-4 w-4 mr-1 text-blue-500" />;
      case 'api':
        return <Activity className="h-4 w-4 mr-1 text-purple-500" />;
      case 'database':
        return <Database className="h-4 w-4 mr-1 text-amber-500" />;
      default:
        return <Server className="h-4 w-4 mr-1 text-slate-500" />;
    }
  };

  // Tarih formatı
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Henüz kontrol edilmedi";
    return new Date(dateStr).toLocaleString('tr-TR');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Services" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Servisler</h1>
            <p className="text-slate-600 dark:text-slate-400">Tüm servislerinizi tek bir yerden görüntüleyin ve yönetin</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Servis Yönetimi</CardTitle>
                  <CardDescription>İzlemek istediğiniz servisleri ekleyin, düzenleyin veya silin</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input 
                      placeholder="Servislerde ara..." 
                      className="pl-9" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleAddService}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Servis Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingServices ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isServicesError ? (
                  <Alert variant="destructive" className="my-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Hata!</AlertTitle>
                    <AlertDescription>
                      Servisler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
                    </AlertDescription>
                  </Alert>
                ) : filteredServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Server className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Servis Bulunamadı</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mt-2">
                      {searchTerm 
                        ? `"${searchTerm}" için eşleşen servis bulunamadı. Lütfen farklı bir arama terimi deneyin.` 
                        : "Henüz hiç servis eklenmemiş. İzlemek istediğiniz servisleri eklemek için 'Servis Ekle' butonuna tıklayın."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Servis Adı</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Port</TableHead>
                          <TableHead>Tip</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Son Kontrol</TableHead>
                          <TableHead>İşlemler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredServices.map((service) => {
                          const statusBadge = getStatusBadge(service.status);
                          return (
                            <TableRow key={service.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  {getServiceTypeIcon(service.type)}
                                  {service.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                {service.host}
                              </TableCell>
                              <TableCell>
                                {service.port}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {service.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("flex w-fit items-center", statusBadge.color)}>
                                  {statusBadge.icon}
                                  {service.status === 'online' ? 'Çalışıyor' : 
                                    service.status === 'offline' ? 'Çalışmıyor' : 
                                    service.status === 'degraded' ? 'Yavaş' : 'Bilinmiyor'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {formatDate(service.lastChecked)}
                                {service.responseTime ? ` (${service.responseTime}ms)` : ''}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleEditService(service)}
                                    title="Düzenle"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleDeleteService(service)}
                                    title="Sil"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              {filteredServices.length > 0 && (
                <CardFooter className="flex justify-between border-t p-4">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Toplam {filteredServices.length} servis gösteriliyor
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetchServices()}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Yenile
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Servis Ekleme Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="sm:max-w-[475px]">
              <DialogHeader>
                <DialogTitle>Yeni Servis Ekle</DialogTitle>
                <DialogDescription>
                  İzlemek istediğiniz yeni bir servis eklemek için aşağıdaki formu doldurun.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Servis Adı
                    </Label>
                    <Input
                      id="name"
                      placeholder="Örn: Web Sunucusu"
                      className="col-span-3"
                      value={formState.name}
                      onChange={handleFormChange('name')}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="host" className="text-right">
                      Host
                    </Label>
                    <Input
                      id="host"
                      placeholder="Örn: example.com"
                      className="col-span-3"
                      value={formState.host}
                      onChange={handleFormChange('host')}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="port" className="text-right">
                      Port
                    </Label>
                    <Input
                      id="port"
                      placeholder="Örn: 80"
                      className="col-span-3"
                      value={formState.port}
                      onChange={handleFormChange('port')}
                      type="number"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">
                      Servis Tipi
                    </Label>
                    <Select
                      value={formState.type}
                      onValueChange={handleFormChange('type')}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Servis tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="checkInterval" className="text-right">
                      Kontrol Aralığı
                    </Label>
                    <Select
                      value={formState.checkInterval.toString()}
                      onValueChange={(value) => setFormState({ ...formState, checkInterval: parseInt(value) })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Kontrol aralığı seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECK_INTERVALS.map((interval) => (
                          <SelectItem key={interval.value} value={interval.value.toString()}>
                            {interval.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="monitorType" className="text-right">
                      İzleme Tipi
                    </Label>
                    <Select
                      value={formState.monitorType}
                      onValueChange={handleFormChange('monitorType')}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="İzleme tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONITOR_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formState.monitorType === "agent" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="agentId" className="text-right">
                        Agent
                      </Label>
                      <Select
                        value={formState.agentId}
                        onValueChange={handleFormChange('agentId')}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Agent seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingAgents ? (
                            <SelectItem value="loading" disabled>
                              Agentlar yükleniyor...
                            </SelectItem>
                          ) : agents.length === 0 ? (
                            <SelectItem value="none" disabled>
                              Agent bulunamadı
                            </SelectItem>
                          ) : (
                            agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id.toString()}>
                                {agent.name} {agent.status === 'active' ? '(Aktif)' : '(Pasif)'}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addServiceMutation.isPending}
                  >
                    {addServiceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ekleniyor...
                      </>
                    ) : (
                      "Servisi Ekle"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Servis Düzenleme Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[475px]">
              <DialogHeader>
                <DialogTitle>Servis Düzenle</DialogTitle>
                <DialogDescription>
                  Servis bilgilerini güncellemek için aşağıdaki formu kullanın.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">
                      Servis Adı
                    </Label>
                    <Input
                      id="edit-name"
                      placeholder="Örn: Web Sunucusu"
                      className="col-span-3"
                      value={formState.name}
                      onChange={handleFormChange('name')}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-host" className="text-right">
                      Host
                    </Label>
                    <Input
                      id="edit-host"
                      placeholder="Örn: example.com"
                      className="col-span-3"
                      value={formState.host}
                      onChange={handleFormChange('host')}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-port" className="text-right">
                      Port
                    </Label>
                    <Input
                      id="edit-port"
                      placeholder="Örn: 80"
                      className="col-span-3"
                      value={formState.port}
                      onChange={handleFormChange('port')}
                      type="number"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-type" className="text-right">
                      Servis Tipi
                    </Label>
                    <Select
                      value={formState.type}
                      onValueChange={handleFormChange('type')}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Servis tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-checkInterval" className="text-right">
                      Kontrol Aralığı
                    </Label>
                    <Select
                      value={formState.checkInterval.toString()}
                      onValueChange={(value) => setFormState({ ...formState, checkInterval: parseInt(value) })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Kontrol aralığı seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECK_INTERVALS.map((interval) => (
                          <SelectItem key={interval.value} value={interval.value.toString()}>
                            {interval.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-monitorType" className="text-right">
                      İzleme Tipi
                    </Label>
                    <Select
                      value={formState.monitorType}
                      onValueChange={handleFormChange('monitorType')}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="İzleme tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONITOR_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formState.monitorType === "agent" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-agentId" className="text-right">
                        Agent
                      </Label>
                      <Select
                        value={formState.agentId}
                        onValueChange={handleFormChange('agentId')}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Agent seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingAgents ? (
                            <SelectItem value="loading" disabled>
                              Agentlar yükleniyor...
                            </SelectItem>
                          ) : agents.length === 0 ? (
                            <SelectItem value="none" disabled>
                              Agent bulunamadı
                            </SelectItem>
                          ) : (
                            agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id.toString()}>
                                {agent.name} {agent.status === 'active' ? '(Aktif)' : '(Pasif)'}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateServiceMutation.isPending}
                  >
                    {updateServiceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Güncelleniyor...
                      </>
                    ) : (
                      "Servisi Güncelle"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Servis Silme Alert Dialog */}
          <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Servisi Silmek İstediğinize Emin Misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  <p className="mb-2">
                    <strong>{serviceToDelete?.name}</strong> servisini silmek üzeresiniz. Bu işlem geri alınamaz.
                  </p>
                  <p>
                    Bu servisle ilgili tüm izleme verileri ve alarmlar da silinecektir.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteServiceMutation.isPending}
                >
                  {deleteServiceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Siliniyor...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Servisi Sil
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
    </div>
  );
}