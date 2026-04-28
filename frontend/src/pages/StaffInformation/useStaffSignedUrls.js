import { useEffect, useRef, useState } from "react";
import api from "../../api/axiosClient";

const _signedUrlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000;

function getCachedSignedUrl(staffId) {
  const entry = _signedUrlCache.get(staffId);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt - EXPIRY_BUFFER_MS) {
    _signedUrlCache.delete(staffId);
    return null;
  }

  return entry.url;
}

function setCachedSignedUrl(staffId, url, expiresInSeconds = 3600) {
  _signedUrlCache.set(staffId, {
    url,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
}

async function fetchSignedUrl(staffId) {
  try {
    const res = await api.get(`/staff/${staffId}/photo-url`);
    const { url, expiresIn } = res.data || {};

    if (url) {
      setCachedSignedUrl(staffId, url, expiresIn ?? 3600);
      return url;
    }

    return null;
  } catch {
    return null;
  }
}

export default function useStaffSignedUrls(staffList) {
  const [signedUrls, setSignedUrls] = useState({});
  const pendingRef = useRef(new Set());

  useEffect(() => {
    if (!Array.isArray(staffList) || staffList.length === 0) return;

    const immediate = {};
    const toFetch = [];

    staffList.forEach((s) => {
      if (!s?.id || !s?.photo_url) return;

      const cached = getCachedSignedUrl(s.id);
      if (cached) {
        immediate[s.id] = cached;
        return;
      }

      if (!pendingRef.current.has(s.id)) {
        toFetch.push(s);
      }
    });

    if (Object.keys(immediate).length > 0) {
      setSignedUrls((prev) => ({ ...prev, ...immediate }));
    }

    if (toFetch.length === 0) return;

    toFetch.forEach((s) => pendingRef.current.add(s.id));

    Promise.allSettled(
      toFetch.map(async (s) => {
        const url = await fetchSignedUrl(s.id);
        pendingRef.current.delete(s.id);
        return { id: s.id, url };
      })
    ).then((results) => {
      const fetched = {};

      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value?.url) {
          fetched[r.value.id] = r.value.url;
        }
      });

      if (Object.keys(fetched).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...fetched }));
      }
    });
  }, [staffList]);

  return signedUrls;
}