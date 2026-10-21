import { useEffect, useState } from "react";

/** The server watches delivery files, including atomic file and symlink replacement. */
export default function useDataRevision(domains: readonly string[]) {
  const [revision, setRevision] = useState(0);
  const key = domains.join(",");
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/local-data/events");
    let previous = "";
    const changed = (event: Event) => {
      try {
        const versions = JSON.parse((event as MessageEvent<string>).data) as Record<string, string>;
        const current = key.split(",").map(domain => versions[domain] ?? "").join(":");
        // Also reload on initial connect: files may change between the first fetch and subscription.
        if (current !== previous) { previous = current; setRevision(value => value + 1); }
      } catch { /* Ignore incomplete transport messages; reconnect uses the current versions. */ }
    };
    const focused = () => setRevision(value => value + 1);
    source.addEventListener("sources", changed);
    window.addEventListener("focus", focused);
    return () => { source.close(); window.removeEventListener("focus", focused); };
  }, [key]);
  return revision;
}
