export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  description: string;
  images: string[];
  status: 'available' | 'sold';
  createdAt: string;
  lat?: number;
  lng?: number;
  title?: string;
  bodyType?: string;
  fuelType?: string;
  drivetrain?: string;
  badges?: string[];
  features?: string[];
  seller?: {
    name?: string;
    verified?: boolean;
    responseTime?: string;
    completedSales?: number;
  };
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  vehicleId: string;
  content: string;
  createdAt: string;
}

export interface SavedVehicle {
  id: string;
  userId: string;
  vehicleId: string;
  createdAt: string;
}
