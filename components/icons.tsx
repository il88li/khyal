// components/icons.tsx — طبقة أيقونات موحّدة مبنية على lucide-react، شبكة 24px وسمك افتراضي 1.5px
import * as L from "lucide-react";
import type { LucideProps, LucideIcon as LucideComponent } from "lucide-react";
import type { ReactNode } from "react";

export type IconProps = Omit<LucideProps, "ref"> & { size?: number | string; strokeWidth?: number | string };
export type LucideIcon = (p: IconProps) => ReactNode; // توافق مع أنواع الاستيراد القديمة
export type Icon = LucideIcon;

// غلاف يوحّد السمك الافتراضي (1.5) مع بقية النظام
const w = (I: LucideComponent, name: string): LucideIcon => {
  const C = ({ strokeWidth = 1.5, ...p }: IconProps) => <I strokeWidth={strokeWidth} {...p} />;
  C.displayName = name;
  return C;
};

export const Plus = w(L.Plus, "Plus");
export const X = w(L.X, "X");
export const Check = w(L.Check, "Check");
export const ChevronLeft = w(L.ChevronLeft, "ChevronLeft");
export const ChevronRight = w(L.ChevronRight, "ChevronRight");
export const ChevronDown = w(L.ChevronDown, "ChevronDown");
export const ArrowLeft = w(L.ArrowLeft, "ArrowLeft");
export const ArrowDown = w(L.ArrowDown, "ArrowDown");
export const Search = w(L.Search, "Search");
export const Heart = w(L.Heart, "Heart");
export const Home = w(L.Home, "Home");
export const Compass = w(L.Compass, "Compass");
export const Bookmark = w(L.Bookmark, "Bookmark");
export const BookMarked = w(L.BookMarked, "BookMarked");
export const UserRound = w(L.UserRound, "UserRound");
export const Users = w(L.Users, "Users");
export const UserPlus = w(L.UserPlus, "UserPlus");
export const UserX = w(L.UserX, "UserX");
export const Bell = w(L.Bell, "Bell");
export const Settings = w(L.Settings, "Settings");
export const SlidersHorizontal = w(L.SlidersHorizontal, "SlidersHorizontal");
export const ShieldCheck = w(L.ShieldCheck, "ShieldCheck");
export const BadgeCheck = w(L.BadgeCheck, "BadgeCheck");
export const Lock = w(L.Lock, "Lock");
export const Mail = w(L.Mail, "Mail");
export const Eye = w(L.Eye, "Eye");
export const EyeOff = w(L.EyeOff, "EyeOff");
export const Camera = w(L.Camera, "Camera");
export const ImagePlus = w(L.ImagePlus, "ImagePlus");
export const Copy = w(L.Copy, "Copy");
export const FileText = w(L.FileText, "FileText");
export const FileWarning = w(L.FileWarning, "FileWarning");
export const Trash2 = w(L.Trash2, "Trash2");
export const Send = w(L.Send, "Send");
export const Share2 = w(L.Share2, "Share2");
export const Star = w(L.Star, "Star");
export const Sparkles = w(L.Sparkles, "Sparkles");
export const Flame = w(L.Flame, "Flame");
export const Trophy = w(L.Trophy, "Trophy");
export const Award = w(L.Award, "Award");
export const Target = w(L.Target, "Target");
export const Rocket = w(L.Rocket, "Rocket");
export const Database = w(L.Database, "Database");
export const Languages = w(L.Languages, "Languages");
export const Palette = w(L.Palette, "Palette");
export const History = w(L.History, "History");
export const Inbox = w(L.Inbox, "Inbox");
export const GitFork = w(L.GitFork, "GitFork");
export const MessageCircle = w(L.MessageCircle, "MessageCircle");
export const AlertTriangle = w(L.AlertTriangle, "AlertTriangle");
export const Info = w(L.Info, "Info");
export const CheckCircle = w(L.CheckCircle, "CheckCircle");
export const Braces = w(L.Braces, "Braces");
export const Square = w(L.Square, "Square");
export const RefreshCw = w(L.RefreshCw, "RefreshCw");
export const RotateCw = w(L.RotateCw, "RotateCw");
export const RotateCcw = w(L.RotateCcw, "RotateCcw");
export const Loader2 = w(L.Loader2, "Loader2");
export const FlaskConical = w(L.FlaskConical, "FlaskConical");
export const BarChart3 = w(L.BarChart3, "BarChart3");
export const MoreHorizontal = w(L.MoreHorizontal, "MoreHorizontal");
export const LogIn = w(L.LogIn, "LogIn");
export const LogOut = w(L.LogOut, "LogOut");
export const Pencil = w(L.Pencil, "Pencil");
export const ExternalLink = w(L.ExternalLink, "ExternalLink");
export const Megaphone = w(L.Megaphone, "Megaphone");

// أسماء بديلة كانت مستخدمة سابقاً
export const User = UserRound;
export const Share = Share2;
export const WandSparkles = Sparkles;
export const LoaderCircle = Loader2;
export const TriangleAlert = AlertTriangle;
export const CircleCheck = CheckCircle;
