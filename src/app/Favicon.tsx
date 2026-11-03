import { useState } from "react";

/** Reads Chrome's local favicon cache (`favicon` permission); falls back to a monogram. */
export function Favicon({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !url.startsWith("http")) {
    return (
      <span className="favicon favicon-mono" aria-hidden="true">
        {Array.from(title.trim())[0]?.toUpperCase() ?? "·"}
      </span>
    );
  }
  // Extension pages share the extension origin, which serves /_favicon/.
  const src = `${location.origin}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
  return (
    <img
      className="favicon"
      src={src}
      alt=""
      width={16}
      height={16}
      onError={() => setFailed(true)}
    />
  );
}
