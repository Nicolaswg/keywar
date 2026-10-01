import { useCallback, useState } from "react";
import { strings } from "./i18n/strings";
import { OnlineSession } from "./net/online";
import { PracticeSession } from "./net/practice";
import type { GameSession } from "./net/session";
import { loadProfile, saveProfile, type Profile } from "./profile";
import { DesignSystem } from "./screens/DesignSystem";
import { Home } from "./screens/Home";
import { MatchFlow } from "./screens/MatchFlow";
import { ChannelJoin } from "./screens/twitch/ChannelJoin";
import { Overlay } from "./screens/twitch/Overlay";
import { StreamPanel } from "./screens/twitch/StreamPanel";

/** Tiny path router: the game has four entry points and no nested navigation. */
function route(): { name: "home" } | { name: "channel" | "overlay"; channel: string } | { name: "stream" } {
  const parts = location.pathname.split("/").filter(Boolean);
  const channel = (parts[1] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (parts[0] === "c" && channel) return { name: "channel", channel };
  if (parts[0] === "overlay" && channel) return { name: "overlay", channel };
  if (parts[0] === "stream") return { name: "stream" };
  return { name: "home" };
}

export function App() {
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = strings(profile.lang);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    saveProfile(p);
  }, []);

  if (new URLSearchParams(location.search).has("ds")) return <DesignSystem />;
  const r = route();
  if (r.name === "overlay") return <Overlay channel={r.channel} />;
  if (r.name === "stream") return <StreamPanel profile={profile} onProfile={setProfile} />;
  if (r.name === "channel") return <ChannelJoin channel={r.channel} profile={profile} onProfile={setProfile} />;

  const joinOpts = () => ({ name: profile.name, lang: profile.lang, difficulty: profile.difficulty, loadout: profile.loadout });

  const play = async (regionUrl: string) => {
    setError(null);
    try {
      setSession(await OnlineSession.join(regionUrl, profile.mode, joinOpts()));
    } catch {
      setError(t("connectionError"));
    }
  };

  const practice = () => setSession(new PracticeSession(profile.mode, joinOpts()));

  const exit = () => {
    session?.leave();
    setSession(null);
  };

  if (session) {
    return (
      <MatchFlow
        key={session.meId + session.kind}
        session={session}
        profile={profile}
        onExit={exit}
        onAgain={() => {
          const kind = session.kind;
          exit();
          if (kind === "practice") practice();
        }}
      />
    );
  }

  return <Home profile={profile} onProfile={setProfile} onPlay={play} onPractice={practice} error={error} />;
}
