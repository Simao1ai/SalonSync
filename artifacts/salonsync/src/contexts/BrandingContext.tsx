import { createContext, useContext, ReactNode, useMemo } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListLocations } from "@workspace/api-client-react";

interface Branding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  locationId: string | null;
  isLoading: boolean;
}

const BrandingContext = createContext<Branding>({
  name: "SalonSync",
  logoUrl: null,
  primaryColor: null,
  tagline: null,
  locationId: null,
  isLoading: false,
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: locations, isLoading } = useListLocations();

  const branding = useMemo<Branding>(() => {
    if (!locations || locations.length === 0) {
      return { name: "SalonSync", logoUrl: null, primaryColor: null, tagline: null, locationId: null, isLoading };
    }

    const loc = user?.locationId
      ? locations.find((l: any) => l.id === user.locationId)
      : locations[0];

    if (!loc) {
      return { name: "SalonSync", logoUrl: null, primaryColor: null, tagline: null, locationId: null, isLoading };
    }

    return {
      name: (loc as any).brandName || loc.name || "SalonSync",
      logoUrl: (loc as any).logoUrl || null,
      primaryColor: (loc as any).primaryColor || null,
      tagline: (loc as any).tagline || null,
      locationId: loc.id,
      isLoading,
    };
  }, [locations, user?.locationId, isLoading]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
