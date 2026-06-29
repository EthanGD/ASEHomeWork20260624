const readBoolean = (value: string | undefined, fallback: boolean) => {
  const raw = value?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }
  return fallback;
};

export const clientConfig = {
  githubClientId: (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() || "",
  useApiGateWay: readBoolean(import.meta.env.VITE_USE_API_GATEWAY as string | undefined, true)
};
