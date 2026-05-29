import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { createVehicle } from '@/lib/api';
import { useNavigate } from '@tanstack/react-router';
import { Button, Input, Textarea, toast } from '@blinkdotnew/ui';
import { useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';

const vehicleSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().min(1900).max(2026),
  price: z.coerce.number().min(0),
  mileage: z.coerce.number().min(0),
  location: z.string().min(1, 'Location is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
});

type VehicleForm = z.infer<typeof vehicleSchema>;

export function SellPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema) as any,
    defaultValues: {
      year: new Date().getFullYear(),
    }
  });

  const onSubmit = async (data: VehicleForm) => {
    if (!user) return login();
    if (images.length === 0) {
      return toast.error('Please upload at least one image.');
    }

    setIsSubmitting(true);
    try {
      const vehicle = await createVehicle({
        ...data,
        sellerName: user.name || user.email,
        image: images[0],
        images,
        status: 'available',
      });
      
      toast.success('Listing created successfully.');
      navigate({ to: '/vehicle/$id', params: { id: vehicle.id } });
    } catch (error) {
      console.error(error);
      toast.error('Failed to create listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setImages(prev => [...prev, url]);
      toast.success('Image uploaded.');
    } catch (error) {
      toast.error('Failed to upload image.');
    }
  };

  return (
    <div className="animate-fade-in px-6 py-12 max-w-screen-md mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sell Your Vehicle</h1>
        <p className="text-muted-foreground text-[13px]">Create a professional listing in minutes.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-12">
        {/* Images */}
        <section className="space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Vehicle Photography</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((url, i) => (
              <div key={i} className="relative aspect-square bg-muted border border-border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button 
                  type="button" 
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 p-1 bg-background/80 backdrop-blur-sm border border-border"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <label className="aspect-square bg-secondary/50 border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors">
                <Camera className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Add Photo</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Clear, high-resolution photos increase trust and speed up sales.</p>
        </section>

        {/* Basic Info */}
        <section className="space-y-6">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Make</label>
              <Input {...register('make')} placeholder="e.g. Tesla" className="h-10 text-[13px]" />
              {errors.make && <p className="text-[11px] text-destructive">{errors.make.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Model</label>
              <Input {...register('model')} placeholder="e.g. Model 3" className="h-10 text-[13px]" />
              {errors.model && <p className="text-[11px] text-destructive">{errors.model.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Year</label>
              <Input {...register('year')} type="number" className="h-10 text-[13px]" />
              {errors.year && <p className="text-[11px] text-destructive">{errors.year.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Mileage</label>
              <Input {...register('mileage')} type="number" className="h-10 text-[13px]" />
              {errors.mileage && <p className="text-[11px] text-destructive">{errors.mileage.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Price ($)</label>
              <Input {...register('price')} type="number" className="h-10 text-[13px]" />
              {errors.price && <p className="text-[11px] text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium">Location</label>
              <Input {...register('location')} placeholder="City, State" className="h-10 text-[13px]" />
              {errors.location && <p className="text-[11px] text-destructive">{errors.location.message}</p>}
            </div>
          </div>
        </section>

        {/* Description */}
        <section className="space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Detailed Description</h2>
          <Textarea 
            {...register('description')} 
            placeholder="Tell potential buyers about the vehicle's condition, features, and history..."
            className="min-h-[200px] text-[13px] leading-relaxed p-4"
          />
          {errors.description && <p className="text-[11px] text-destructive">{errors.description.message}</p>}
        </section>

        <div className="pt-12 border-t border-border">
          <Button 
            disabled={isSubmitting} 
            className="w-full h-12 text-[13px] font-bold uppercase tracking-widest"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Listing...</>
            ) : (
              'Publish Vehicle Listing'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
