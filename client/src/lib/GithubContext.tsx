import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { githubConfigStore, type GithubConfig } from "./data";

interface GithubContextType {
  pat: string;
  config: GithubConfig | null;
  setPat: (pat: string) => void;
  setConfig: (cfg: GithubConfig) => void;
  isConfigured: boolean;
}

const GithubContext = createContext<GithubContextType>({
  pat: "",
  config: null,
  setPat: () => {},
  setConfig: () => {},
  isConfigured: false,
});

export function GithubProvider({ children }: { children: ReactNode }) {
  const [pat, setPat] = useState<string>("");
  const [config, setConfigState] = useState<GithubConfig | null>(githubConfigStore.get());

  const setConfig = useCallback((cfg: GithubConfig) => {
    githubConfigStore.save(cfg);
    setConfigState(cfg);
  }, []);

  return (
    <GithubContext.Provider
      value={{
        pat,
        config,
        setPat,
        setConfig,
        isConfigured: !!pat && !!config,
      }}
    >
      {children}
    </GithubContext.Provider>
  );
}

export function useGithub() {
  return useContext(GithubContext);
}
