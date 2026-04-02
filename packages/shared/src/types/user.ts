export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  googleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
}
