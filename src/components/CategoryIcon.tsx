import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Bus,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { TransactionType } from '../types/finance';

interface CategoryIconProps {
  categoryId?: string;
  type: TransactionType;
  className?: string;
}

export function CategoryIcon({
  categoryId,
  type,
  className = 'w-4 h-4',
}: CategoryIconProps) {
  switch (categoryId) {
    case 'groceries':
      return <ShoppingCart className={className} />;
    case 'housing':
      return <Home className={className} />;
    case 'transport':
      return <Bus className={className} />;
    case 'health':
      return <HeartPulse className={className} />;
    case 'shopping':
      return <ShoppingBag className={className} />;
    case 'education':
      return <BookOpen className={className} />;
    case 'family':
      return <Users className={className} />;
    case 'salary':
      return <Wallet className={className} />;
    case 'business':
      return <Briefcase className={className} />;
    case 'freelance':
      return <Laptop className={className} />;
    case 'bonus':
      return <Gift className={className} />;
    case 'investment':
      return <TrendingUp className={className} />;
    default:
      return type === 'income' ? (
        <ArrowDownLeft className={className} />
      ) : (
        <ArrowUpRight className={className} />
      );
  }
}
