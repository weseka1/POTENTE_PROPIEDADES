import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface FavCtx {
  favoritos: string[];
  esFavorito: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
}

const Ctx = createContext<FavCtx>(null as any);
const LS = "potente_favoritos";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoritos, setFavoritos] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFavoritos(JSON.parse(localStorage.getItem(LS) || "[]"));
    } catch {}
  }, []);

  const persist = (next: string[]) => {
    setFavoritos(next);
    localStorage.setItem(LS, JSON.stringify(next));
  };

  const toggle = (id: string) =>
    persist(favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id]);

  return (
    <Ctx.Provider
      value={{
        favoritos,
        esFavorito: (id) => favoritos.includes(id),
        toggle,
        count: favoritos.length,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useFavorites = () => useContext(Ctx);
