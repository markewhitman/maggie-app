import { useState } from "react";
import { useGithub } from "@/lib/GithubContext";
import { validatePat, listRepos } from "@/lib/github";
import { githubConfigStore } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Github, CheckCircle2, AlertCircle, Loader2, Key, ExternalLink, Info, Shield, Trash2
} from "lucide-react";

export default function SettingsPage() {
  const { pat, config, setPat, setConfig, isConfigured } = useGithub();
  const { toast } = useToast();

  const [tokenInput, setTokenInput] = useState(pat);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<{ login: string } | null>(null);
  const [repos, setRepos] = useState<{ name: string; full_name: string; owner: { login: string } }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>(
    config ? `${config.owner}/${config.repo}` : ""
  );
  const [loadingRepos, setLoadingRepos] = useState(false);

  const handleValidate = async () => {
    if (!tokenInput.trim()) return;
    setValidating(true);
    setValidated(null);
    setRepos([]);
    try {
      const result = await validatePat(tokenInput.trim());
      if (result.valid && result.login) {
        setValidated({ login: result.login });
        setPat(tokenInput.trim());
        setLoadingRepos(true);
        const r = await listRepos(tokenInput.trim());
        setRepos(r);
        setLoadingRepos(false);
        toast({ title: "Token valid!", description: `Connected as @${result.login}` });
      } else {
        toast({ title: "Invalid token", description: "Check your PAT and try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection failed", description: "Could not reach GitHub API.", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveConfig = () => {
    if (!selectedRepo) {
      toast({ title: "Select a repository", variant: "destructive" });
      return;
    }
    const [owner, repo] = selectedRepo.split("/");
    setConfig({ owner, repo, releaseTag: "pdf-storage" });
    toast({ title: "GitHub config saved!", description: `${owner}/${repo}` });
  };

  const handleClear = () => {
    setPat("");
    setValidated(null);
    setRepos([]);
    setSelectedRepo("");
    githubConfigStore.clear();
    setConfig({ owner: "", repo: "", releaseTag: "" });
    toast({ title: "GitHub config cleared" });
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl italic mb-0.5">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure GitHub integration for PDF storage</p>
      </div>

      {/* GitHub PDF Storage */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-3">
          <Github className="w-5 h-5" />
          <div>
            <div className="font-semibold text-sm">GitHub PDF Storage</div>
            <div className="text-xs text-muted-foreground">PDFs are stored as GitHub Release Assets</div>
          </div>
          {isConfigured && (
            <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Active
            </Badge>
          )}
        </div>

        {/* How it works */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Info className="w-3.5 h-3.5" /> How PDF storage works
          </div>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
            <li>PDFs are uploaded to a GitHub Release in your repo (tag: <code>pdf-storage</code>)</li>
            <li>No repo commits required — Release Assets are separate from your code</li>
            <li>Each PDF is linked to a song and viewable inline in the app</li>
            <li>Free GitHub accounts get unlimited Release Asset storage</li>
          </ul>
        </div>

        {/* Token input */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> Personal Access Token (PAT)
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => { setTokenInput(e.target.value); setValidated(null); }}
              placeholder="github_pat_…"
              className="flex-1 font-mono text-sm"
              data-testid="input-github-pat"
            />
            <Button onClick={handleValidate} disabled={validating || !tokenInput.trim()} size="sm">
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
          {validated && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected as @{validated.login}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Create a fine-grained PAT with <strong>Contents: Read & Write</strong> scope on your repo.{" "}
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              Generate one here <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Your token is stored in memory only and is never saved to disk or localStorage. You'll need to re-enter it after refreshing.
          </div>
        </div>

        {/* Repo selector */}
        {(repos.length > 0 || config) && (
          <div className="space-y-1.5">
            <Label className="text-xs">Repository</Label>
            {loadingRepos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your repos…
              </div>
            ) : repos.length > 0 ? (
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a repo" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r.full_name} value={r.full_name}>
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : config ? (
              <div className="text-sm font-medium">{config.owner}/{config.repo}</div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              PDFs will be stored as Release Assets in this repo under the <code>pdf-storage</code> tag.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {repos.length > 0 && (
            <Button onClick={handleSaveConfig} disabled={!selectedRepo} className="flex-1" data-testid="button-save-github">
              Save Configuration
            </Button>
          )}
          {isConfigured && (
            <Button variant="outline" onClick={handleClear} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>

        {isConfigured && config && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-xl p-3">
            <div className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Active Configuration</div>
            <div className="text-xs text-green-800 dark:text-green-200 space-y-0.5">
              <div>Repo: <strong>{config.owner}/{config.repo}</strong></div>
              <div>Release tag: <code>{config.releaseTag}</code></div>
            </div>
          </div>
        )}
      </div>

      {/* GitHub Pages info */}
      <div className="bg-card border border-border rounded-xl p-5 mt-4">
        <div className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Github className="w-4 h-4" /> GitHub Pages Deployment
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          To host this app on GitHub Pages, run <code>npm run deploy</code> from the project directory. This builds the app and pushes to the <code>gh-pages</code> branch automatically.
        </p>
        <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
          <div># One-time setup:</div>
          <div>npm install</div>
          <div className="mt-1"># Deploy to GitHub Pages:</div>
          <div>npm run build && npm run deploy</div>
        </div>
      </div>
    </div>
  );
}
