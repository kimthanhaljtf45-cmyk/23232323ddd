import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

type Club = {
  id: string;
  name: string;
  slug?: string;
  plan: string;
  status: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  coverUrl?: string;
  city?: string;
  studentCount: number;
  coachCount: number;
  branchCount: number;
  features: string[];
  maxStudents: number;
  maxCoaches: number;
  maxBranches: number;
};

type ClubTheme = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
};

type ClubContextType = {
  activeClub: Club | null;
  clubs: Club[];
  isLoading: boolean;
  theme: ClubTheme;
  setActiveClub: (club: Club) => void;
  refreshClubs: () => Promise<void>;
};

const DEFAULT_THEME: ClubTheme = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  secondary: '#0F0F10',
};

function buildTheme(club: Club | null): ClubTheme {
  if (!club || !club.primaryColor) return DEFAULT_THEME;
  const primary = club.primaryColor;
  // Simple lighter/darker derivation
  return {
    primary,
    primaryLight: primary,
    primaryDark: primary,
    secondary: club.secondaryColor || '#0F0F10',
  };
}

const ClubContext = createContext<ClubContextType>({
  activeClub: null,
  clubs: [],
  isLoading: false,
  theme: DEFAULT_THEME,
  setActiveClub: () => {},
  refreshClubs: async () => {},
});

export const useClub = () => useContext(ClubContext);

export const ClubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeClub, setActiveClubState] = useState<Club | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const theme = useMemo(() => buildTheme(activeClub), [activeClub]);

  const refreshClubs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get('/admin/clubs');
      const clubsList = Array.isArray(data) ? data : [];
      setClubs(clubsList);

      if (clubsList.length > 0 && !activeClub) {
        const savedId = await AsyncStorage.getItem('activeClubId');
        const saved = clubsList.find((c: Club) => c.id === savedId);
        setActiveClubState(saved || clubsList[0]);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setActiveClub = useCallback((club: Club) => {
    setActiveClubState(club);
    AsyncStorage.setItem('activeClubId', club.id);
  }, []);

  useEffect(() => {
    refreshClubs();
  }, []);

  return (
    <ClubContext.Provider value={{ activeClub, clubs, isLoading, theme, setActiveClub, refreshClubs }}>
      {children}
    </ClubContext.Provider>
  );
};
